import React from 'react';

interface HrmsLogoProps {
  size?: number;
  className?: string;
}

export const HrmsLogo: React.FC<HrmsLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      id="hrms-logo-svg"
    >
      <defs>
        <linearGradient id="hrmsBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="hrmsAccentGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Outer rounded container */}
      <rect width="120" height="120" rx="28" fill="url(#hrmsBlueGrad)" />

      {/* Decorative inner ambient glow */}
      <circle cx="95" cy="25" r="40" fill="#ffffff" fillOpacity="0.08" />

      {/* HRMS Stylized Monogram */}
      <g transform="translate(24, 26)">
        {/* Left vertical bar */}
        <rect x="8" y="10" width="12" height="48" rx="6" fill="#ffffff" />
        {/* Right vertical bar */}
        <rect x="52" y="10" width="12" height="48" rx="6" fill="#ffffff" />
        {/* Cross bridge */}
        <rect x="16" y="28" width="40" height="12" rx="4" fill="url(#hrmsAccentGrad)" />

        {/* Dynamic user network circle at apex */}
        <circle cx="36" cy="14" r="7" fill="#ffffff" />
        <circle cx="36" cy="14" r="4" fill="#4f46e5" />
      </g>
    </svg>
  );
};

export const ThreadLogo = HrmsLogo;
