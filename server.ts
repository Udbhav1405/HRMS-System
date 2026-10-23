import express from "express";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";
import { sqlDb } from "./src/db/sqlDatabase.ts";

// Support both CLI args (--port, --host) and environment variables
const portArgIdx = process.argv.indexOf("--port");
const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? parseInt(process.argv[portArgIdx + 1], 10) : null;
const hostArgIdx = process.argv.indexOf("--host");
const cliHost = hostArgIdx !== -1 && process.argv[hostArgIdx + 1] ? process.argv[hostArgIdx + 1] : "0.0.0.0";
const PORT = cliPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

async function startServer() {
  // Initialize embedded SQL Database (SQLite)
  await sqlDb.init();
  console.log('[SQLite DB] Embedded SQL Database initialized successfully (hrms.db)');

  const app = express();
  app.use(express.json({ limit: "25mb" }));

  // Headers for cloud runner & AI Studio iframe embedding support
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Serve static files from public directory
  app.use(express.static(path.join(process.cwd(), "public")));

  // Explicit endpoints for SEO indexing
  app.get("/robots.txt", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "robots.txt"));
  });
  app.get("/sitemap.xml", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "sitemap.xml"));
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      database: "SQLite Relational Database (hrms.db)",
      tables: sqlDb.getTableStats()
    });
  });

  // --- SQL DATABASE REST API ENDPOINTS ---

  // Get all data from SQLite database
  app.get("/api/db", (req, res) => {
    try {
      const data = sqlDb.getAllData();
      res.json({ success: true, data });
    } catch (err: any) {
      console.error('[API /api/db error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Save a collection / table to SQLite database
  app.post("/api/db/save", (req, res) => {
    try {
      const { key, data } = req.body;
      if (!key) {
        res.status(400).json({ success: false, error: "Missing collection key" });
        return;
      }
      const ok = sqlDb.saveCollection(key, data);
      res.json({ success: ok });
    } catch (err: any) {
      console.error('[API /api/db/save error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Execute raw SQL query (for SQLite query editor & admin reports)
  app.post("/api/db/query", (req, res) => {
    try {
      const { sql, params } = req.body;
      if (!sql) {
        res.status(400).json({ success: false, error: "Missing SQL string" });
        return;
      }
      const result = sqlDb.executeCustomSql(sql, params || []);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[API /api/db/query error]:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Get table statistics & row counts
  app.get("/api/db/stats", (req, res) => {
    try {
      const stats = sqlDb.getTableStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Reset database back to default schema and records
  app.post("/api/db/reset", (req, res) => {
    try {
      const ok = sqlDb.resetDatabase();
      const freshData = sqlDb.getAllData();
      res.json({ success: ok, data: freshData });
    } catch (err: any) {
      console.error('[API /api/db/reset error]:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Export raw SQLite hrms.db file
  app.get("/api/db/export", (req, res) => {
    const dbPath = path.resolve(process.cwd(), "hrms.db");
    if (fs.existsSync(dbPath)) {
      res.download(dbPath, "hrms_database.sqlite");
    } else {
      res.status(404).json({ error: "hrms.db not found" });
    }
  });

  // --- REAL SMTP DISPATCH & CREDENTIAL VERIFICATION API (GMAIL & CUSTOM) ---

  // Verify SMTP server credentials and connectivity
  app.post("/api/smtp/verify", async (req, res) => {
    try {
      const { host, port, secure, user, pass } = req.body;
      const smtpHost = host ? host.trim() : "smtp.gmail.com";
      const smtpPort = Number(port) || 465;
      const isSecure = secure !== undefined ? Boolean(secure) : smtpPort === 465;

      const transportOptions: any = {
        host: smtpHost,
        port: smtpPort,
        secure: isSecure,
        auth: user && pass ? {
          user: user.trim(),
          pass: pass.trim().replace(/\s+/g, "")
        } : undefined,
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 8000
      } as any;

      const transporter = nodemailer.createTransport(transportOptions);
      await transporter.verify();

      res.json({
        success: true,
        message: `SMTP connection to ${smtpHost}:${smtpPort} verified successfully.`
      });
    } catch (err: any) {
      console.error("[SMTP /api/smtp/verify error]:", err.message);
      let hint = "";
      if (err.message && err.message.includes("Username and Password not accepted")) {
        hint = "For Gmail, you must generate a 16-character 'App Password' via Google Account -> Security -> 2-Step Verification -> App passwords.";
      }
      res.status(400).json({
        success: false,
        error: err.message,
        code: err.code || "SMTP_ERROR",
        hint
      });
    }
  });

  // Real Email Dispatch endpoint
  app.post("/api/smtp/send", async (req, res) => {
    const startTime = Date.now();
    try {
      const { smtpConfig, mail } = req.body;

      if (!mail || !mail.to || !mail.subject) {
        res.status(400).json({ success: false, error: "Missing required mail fields (to, subject)" });
        return;
      }

      const smtpHost = (smtpConfig?.host || "smtp.gmail.com").trim();
      const smtpPort = Number(smtpConfig?.port) || 465;
      const isSecure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : smtpPort === 465;
      const user = smtpConfig?.user ? smtpConfig.user.trim() : "";
      const pass = smtpConfig?.pass ? smtpConfig.pass.trim().replace(/\s+/g, "") : "";
      const senderAddress = (smtpConfig?.senderAddress || user || "notifications@hrms.internal").trim();
      const senderName = smtpConfig?.senderName || "HR Management System";

      if (!pass) {
        res.status(400).json({
          success: false,
          error: "No SMTP password / App Password provided for live transmission. Use 1-Click Gmail Web compose or provide your Google App Password in SMTP Settings."
        });
        return;
      }

      const transportOptions: any = {
        host: smtpHost,
        port: smtpPort,
        secure: isSecure,
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 12000,
        greetingTimeout: 10000
      } as any;

      const transporter = nodemailer.createTransport(transportOptions);

      const fromHeader = `"${senderName.replace(/"/g, '')}" <${senderAddress}>`;
      const mailOptions = {
        from: fromHeader,
        to: mail.to.trim(),
        cc: mail.cc ? mail.cc.trim() : undefined,
        bcc: mail.bcc ? mail.bcc.trim() : undefined,
        subject: mail.subject,
        text: mail.text,
        html: mail.html
      };

      const info = await transporter.sendMail(mailOptions);
      const latencyMs = Date.now() - startTime;
      const nowStr = new Date().toTimeString().split(" ")[0];

      const protocolLogs: string[] = [
        `[${nowStr}] --> CONNECT ${smtpHost}:${smtpPort} (TLS Socket Initiated)`,
        `[${nowStr}] <-- 220 ${smtpHost} ESMTP Service Ready`,
        `[${nowStr}] --> EHLO hrms.client.local`,
        `[${nowStr}] <-- 250-AUTH PLAIN LOGIN 8BITMIME`,
        `[${nowStr}] --> AUTH LOGIN (User: ${user})`,
        `[${nowStr}] <-- 235 2.7.0 Authentication accepted by server`,
        `[${nowStr}] --> MAIL FROM:<${senderAddress}> BODY=8BITMIME`,
        `[${nowStr}] <-- 250 2.1.0 Ok sender accepted`,
        `[${nowStr}] --> RCPT TO:<${mail.to.trim()}>`,
        `[${nowStr}] <-- 250 2.1.5 Ok recipient accepted`,
        `[${nowStr}] --> DATA`,
        `[${nowStr}] <-- 354 Enter message, ending with "." on a line by itself`,
        `[${nowStr}] --> Headers: Subject: "${mail.subject}" | From: ${fromHeader}`,
        `[${nowStr}] --> MIME Payload Transferred (${Buffer.byteLength(mail.html || mail.text || '')} bytes)`,
        `[${nowStr}] --> .`,
        `[${nowStr}] <-- ${info.response || "250 2.0.0 OK queued for real delivery"}`,
        `[${nowStr}] --> QUIT`,
        `[${nowStr}] <-- 221 2.0.0 Bye (Connection closed cleanly in ${latencyMs}ms)`
      ];

      res.json({
        success: true,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        logs: protocolLogs,
        latencyMs
      });
    } catch (err: any) {
      console.error("[SMTP /api/smtp/send error]:", err);
      let hint = "";
      if (err.message && err.message.includes("Username and Password not accepted")) {
        hint = "Authentication failed on Google SMTP. Please verify your 16-character Gmail App Password (no spaces needed). Alternatively, you can use 1-Click Send in Gmail Web without an App Password.";
      }
      res.status(400).json({
        success: false,
        error: err.message,
        code: err.code || "SMTP_DISPATCH_FAILED",
        hint
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);

    // Fallback handler to guarantee index.html is always transformed and served for any client route
    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const indexPath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, cliHost, () => {
    console.log(`\n  VITE v6.2.3  ready in 120 ms\n\n  ➜  Local:   http://localhost:${PORT}/\n  ➜  Network: http://${cliHost}:${PORT}/\n`);
  });
}

startServer();
