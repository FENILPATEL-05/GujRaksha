import React from 'react';

export const LogoBadge = ({ size = 38, className = '' }) => {
  return (
    <div className={`brand-mark-wrapper ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-logo-svg"
      >
        <defs>
          <linearGradient id="shieldDarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10233d" />
            <stop offset="100%" stopColor="#07111e" />
          </linearGradient>
          <linearGradient id="shieldLightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <radialGradient id="radarSweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(34, 211, 238, 0.4)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Shield Security Crest */}
        <path
          d="M 24,3 L 42,9 C 42,25 36,39 24,45 C 12,39 6,25 6,9 Z"
          className="logo-shield-base"
        />
        <path
          d="M 24,3 L 42,9 C 42,25 36,39 24,45 C 12,39 6,25 6,9 Z"
          className="logo-shield-edge"
          fill="none"
          strokeWidth="1.8"
        />

        {/* Concentric Surveillance Radar Rings */}
        <circle cx="24" cy="22" r="13" className="logo-radar-outer" strokeDasharray="3 2" fill="none" strokeWidth="1" />
        <circle cx="24" cy="22" r="8" className="logo-radar-inner" fill="none" strokeWidth="1.2" />

        {/* Spatial Target Crosshairs */}
        <line x1="24" y1="9" x2="24" y2="35" className="logo-axis" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="11" y1="22" x2="37" y2="22" className="logo-axis" strokeWidth="1" strokeDasharray="2 2" />

        {/* Tactical Netra Iris / Sensor Core */}
        <circle cx="24" cy="22" r="4.2" className="logo-sensor-ring" fill="none" strokeWidth="1.6" />
        <circle cx="24" cy="22" r="2.2" className="logo-sensor-pupil" />

        {/* Tactical Warning Signal Flare */}
        <path
          d="M 18,15 Q 24,11 30,15"
          className="logo-top-beacon"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className="brand-logo-sweep"></div>
    </div>
  );
};
