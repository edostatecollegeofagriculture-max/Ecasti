import React from 'react';
import { useAuth } from '../context/AuthContext';

interface Props {
  className?: string;
  size?: number | string;
  variant?: 'full' | 'shield' | 'watermark' | 'badge';
  watermarkOpacity?: number;
}

export const SchoolLogo: React.FC<Props> = ({
  className = '',
  size = 56,
  variant = 'full',
  watermarkOpacity = 0.04,
}) => {
  const { settings } = useAuth();

  if (settings?.logoUrl) {
    const resolvedSize = typeof size === 'number' ? `${size}px` : size;
    const isWatermark = variant === 'watermark';
    return (
      <img
        src={settings.logoUrl}
        alt={isWatermark ? '' : `${settings.shortName || 'EDOCASTI'} Official Crest`}
        aria-hidden={isWatermark ? true : undefined}
        draggable={false}
        className={`${isWatermark ? 'object-cover' : 'object-contain rounded-full'} ${className}`}
        style={{
          width: resolvedSize,
          height: resolvedSize,
          opacity: isWatermark ? watermarkOpacity : 1,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    );
  }

  // If variant is watermark, we render a high-detail heraldic crest with subtle strokes
  if (variant === 'watermark') {
    return (
      <svg
        viewBox="0 0 500 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{
          width: typeof size === 'number' ? `${size}px` : size,
          height: typeof size === 'number' ? `${size}px` : size,
          opacity: watermarkOpacity,
        }}
        aria-hidden="true"
      >
        {/* Outer Circular Rims */}
        <circle cx="250" cy="250" r="236" stroke="currentColor" strokeWidth="6" strokeDasharray="8 6" className="text-amber-500" />
        <circle cx="250" cy="250" r="222" stroke="currentColor" strokeWidth="12" className="text-emerald-900 dark:text-emerald-400" />
        <circle cx="250" cy="250" r="208" stroke="currentColor" strokeWidth="4" className="text-amber-500" />

        {/* Heraldic Circular Text Arc Guides */}
        <circle cx="250" cy="250" r="185" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="text-emerald-800 dark:text-emerald-500" />

        {/* Outer Laurel / Palm Wreath */}
        <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400">
          <path d="M 85,250 C 75,170 120,95 200,60" />
          <path d="M 415,250 C 425,170 380,95 300,60" />
          <path d="M 85,250 C 75,330 120,405 200,440" />
          <path d="M 415,250 C 425,330 380,405 300,440" />

          {/* Laurel Leaf Sprigs */}
          <path d="M 95,200 Q 70,185 85,165 Q 105,180 95,200" fill="currentColor" fillOpacity="0.3" />
          <path d="M 120,150 Q 95,130 115,115 Q 135,135 120,150" fill="currentColor" fillOpacity="0.3" />
          <path d="M 160,105 Q 140,80 165,70 Q 180,95 160,105" fill="currentColor" fillOpacity="0.3" />

          <path d="M 405,200 Q 430,185 415,165 Q 395,180 405,200" fill="currentColor" fillOpacity="0.3" />
          <path d="M 380,150 Q 405,130 385,115 Q 365,135 380,150" fill="currentColor" fillOpacity="0.3" />
          <path d="M 340,105 Q 360,80 335,70 Q 320,95 340,105" fill="currentColor" fillOpacity="0.3" />
        </g>

        {/* Heraldic Shield */}
        <path
          d="M 170,140 L 330,140 C 330,240 310,310 250,350 C 190,310 170,240 170,140 Z"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-emerald-950 dark:text-emerald-300"
        />

        {/* Cross Dividers inside Shield */}
        <line x1="250" y1="140" x2="250" y2="350" stroke="currentColor" strokeWidth="4" className="text-amber-500" />
        <line x1="172" y1="230" x2="328" y2="230" stroke="currentColor" strokeWidth="4" className="text-amber-500" />

        {/* Quadrant 1: Sheaf of Grain / Agriculture */}
        <g stroke="currentColor" strokeWidth="3" className="text-amber-600 dark:text-amber-400" fill="currentColor" fillOpacity="0.2">
          <path d="M 210,215 Q 210,165 210,155 Q 210,165 210,215" strokeWidth="4" />
          <path d="M 210,195 Q 190,175 195,160 Q 210,175 210,195" />
          <path d="M 210,185 Q 230,165 225,150 Q 210,165 210,185" />
          <path d="M 210,170 Q 192,155 198,142 Q 210,155 210,170" />
          <path d="M 210,158 Q 228,145 222,132 Q 210,145 210,158" />
        </g>

        {/* Quadrant 2: Open Book of Knowledge */}
        <g stroke="currentColor" strokeWidth="3" className="text-emerald-800 dark:text-emerald-400" fill="none">
          <path d="M 285,165 C 275,160 260,162 254,168 L 254,210 C 260,205 275,203 285,208 Z" fill="currentColor" fillOpacity="0.2" />
          <path d="M 285,165 C 295,160 310,162 316,168 L 316,210 C 310,205 295,203 285,208 Z" fill="currentColor" fillOpacity="0.2" />
          <line x1="285" y1="165" x2="285" y2="208" strokeWidth="4" />
        </g>

        {/* Quadrant 3: Mechanization Gear */}
        <g stroke="currentColor" strokeWidth="3" className="text-amber-600 dark:text-amber-400" fill="none">
          <circle cx="210" cy="285" r="18" strokeWidth="4" />
          <circle cx="210" cy="285" r="7" fill="currentColor" fillOpacity="0.4" />
          <path d="M 210,260 L 210,267 M 210,303 L 210,310 M 185,285 L 192,285 M 228,285 L 235,285 M 192,267 L 197,272 M 223,298 L 228,303 M 192,303 L 197,298 M 223,272 L 228,267" strokeWidth="5" strokeLinecap="round" />
        </g>

        {/* Quadrant 4: Science Flask & Molecule */}
        <g stroke="currentColor" strokeWidth="3" className="text-emerald-800 dark:text-emerald-400" fill="none">
          <path d="M 285,255 L 285,268 L 272,298 C 268,306 274,315 285,315 C 296,315 302,306 298,298 L 285,268" strokeWidth="4" fill="currentColor" fillOpacity="0.2" />
          <ellipse cx="285" cy="285" rx="24" ry="8" strokeWidth="2" strokeDasharray="3 3" />
        </g>

        {/* Crest Top: Rising Sun of Enlightenment */}
        <path d="M 220,135 C 220,118 280,118 280,135 Z" fill="currentColor" className="text-amber-500" fillOpacity="0.5" />
        <line x1="250" y1="115" x2="250" y2="95" stroke="currentColor" strokeWidth="4" className="text-amber-500" />
        <line x1="230" y1="120" x2="220" y2="105" stroke="currentColor" strokeWidth="4" className="text-amber-500" />
        <line x1="270" y1="120" x2="280" y2="105" stroke="currentColor" strokeWidth="4" className="text-amber-500" />

        {/* Bottom Banner Ribbon */}
        <g stroke="currentColor" strokeWidth="4" className="text-emerald-950 dark:text-emerald-300">
          <path d="M 120,400 L 150,375 L 350,375 L 380,400 L 360,425 L 340,410 L 160,410 L 140,425 Z" fill="currentColor" fillOpacity="0.1" />
        </g>
      </svg>
    );
  }

  // Full detailed Institutional Brand Logo
  return (
    <svg
      viewBox="0 0 500 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
      }}
      role="img"
      aria-label="EDOCASTI Official Crest"
    >
      <defs>
        <radialGradient id="edocastiBgGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="70%" stopColor="#022c22" />
          <stop offset="100%" stopColor="#011812" />
        </radialGradient>
        <linearGradient id="edocastiGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="30%" stopColor="#f59e0b" />
          <stop offset="70%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="edocastiShieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>
        <filter id="edocastiShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Main Base Disc */}
      <circle cx="250" cy="250" r="240" fill="url(#edocastiBgGrad)" filter="url(#edocastiShadow)" />

      {/* Outer Golden Heraldic Beaded Border */}
      <circle cx="250" cy="250" r="234" stroke="url(#edocastiGoldGrad)" strokeWidth="6" />
      <circle cx="250" cy="250" r="226" stroke="#fbbf24" strokeWidth="2" strokeDasharray="6 5" />
      <circle cx="250" cy="250" r="172" stroke="url(#edocastiGoldGrad)" strokeWidth="5" />

      {/* Circular Institutional Title Around Ring */}
      <path
        id="textPathUpper"
        d="M 60,250 A 190,190 0 1,1 440,250"
        fill="none"
      />
      <text fill="#fef08a" fontSize="19.5" fontWeight="900" letterSpacing="2.8" fontFamily="system-ui, sans-serif">
        <textPath href="#textPathUpper" startOffset="50%" textAnchor="middle">
          EDO STATE COLLEGE OF AGRICULTURE
        </textPath>
      </text>

      <path
        id="textPathLower"
        d="M 440,250 A 190,190 0 0,1 60,250"
        fill="none"
      />
      <text fill="#fbbf24" fontSize="18" fontWeight="800" letterSpacing="3.5" fontFamily="system-ui, sans-serif">
        <textPath href="#textPathLower" startOffset="50%" textAnchor="middle">
          SCIENCE & TECHNOLOGY • IGUORIAKHI
        </textPath>
      </text>

      {/* Laurel Wreath on Left and Right of Ring */}
      <g fill="#f59e0b" opacity="0.9">
        <circle cx="68" cy="250" r="5" fill="#fde047" />
        <circle cx="432" cy="250" r="5" fill="#fde047" />
      </g>

      {/* Inner Central Field */}
      <circle cx="250" cy="250" r="168" fill="#032e23" stroke="#f59e0b" strokeWidth="3" />

      {/* Heraldic Shield in Center */}
      <g filter="url(#edocastiShadow)">
        <path
          d="M 165,142 L 335,142 C 335,248 312,322 250,364 C 188,322 165,248 165,142 Z"
          fill="url(#edocastiShieldGrad)"
          stroke="url(#edocastiGoldGrad)"
          strokeWidth="7"
        />

        {/* Shield Cross Divider (Deep Green with Gold Borders) */}
        <path d="M 244,142 L 256,142 L 256,360 L 244,360 Z" fill="#044e37" />
        <path d="M 167,236 L 333,236 L 333,248 L 167,248 Z" fill="#044e37" />
        <line x1="250" y1="142" x2="250" y2="360" stroke="#f59e0b" strokeWidth="2" />
        <line x1="167" y1="242" x2="333" y2="242" stroke="#f59e0b" strokeWidth="2" />

        {/* Top-Left Quadrant: Agricultural Crops / Sheaf of Grain */}
        <g transform="translate(178, 150)">
          {/* Golden Wheat / Corn Ears */}
          <path d="M 32,70 Q 32,30 32,15" stroke="#b45309" strokeWidth="3" strokeLinecap="round" />
          <path d="M 32,55 Q 16,42 20,28 Q 32,42 32,55" fill="#f59e0b" />
          <path d="M 32,45 Q 48,32 44,18 Q 32,32 32,45" fill="#f59e0b" />
          <path d="M 32,32 Q 18,20 22,8 Q 32,20 32,32" fill="#fbbf24" />
          <path d="M 32,22 Q 46,10 42,-2 Q 32,10 32,22" fill="#fde047" />
          <circle cx="32" cy="7" r="4" fill="#fef08a" />
        </g>

        {/* Top-Right Quadrant: Open Book of Knowledge & Learning */}
        <g transform="translate(262, 158)">
          <path
            d="M 28,16 C 18,12 6,14 1,20 L 1,58 C 6,52 18,50 28,54 Z"
            fill="#065f46"
            stroke="#047857"
            strokeWidth="1.5"
          />
          <path
            d="M 28,16 C 38,12 50,14 55,20 L 55,58 C 50,52 38,50 28,54 Z"
            fill="#065f46"
            stroke="#047857"
            strokeWidth="1.5"
          />
          <path d="M 28,16 L 28,54" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
          {/* Gold text lines on book pages */}
          <line x1="6" y1="28" x2="23" y2="28" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <line x1="6" y1="36" x2="23" y2="36" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <line x1="6" y1="44" x2="20" y2="44" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <line x1="33" y1="28" x2="50" y2="28" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <line x1="33" y1="36" x2="50" y2="36" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <line x1="33" y1="44" x2="47" y2="44" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Bottom-Left Quadrant: Agricultural Mechanization Gear */}
        <g transform="translate(182, 258)">
          <circle cx="28" cy="30" r="18" fill="#d97706" stroke="#b45309" strokeWidth="2" />
          <circle cx="28" cy="30" r="8" fill="#ffffff" stroke="#92400e" strokeWidth="2" />
          {/* Gear Cogs */}
          <path
            d="M 28,7 L 28,14 M 28,46 L 28,53 M 5,30 L 12,30 M 44,30 L 51,30 M 12,14 L 17,19 M 39,41 L 44,46 M 12,46 L 17,41 M 39,19 L 44,14"
            stroke="#b45309"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>

        {/* Bottom-Right Quadrant: Science Beaker & Atom / Molecular Orbital */}
        <g transform="translate(265, 256)">
          {/* Flask */}
          <path
            d="M 28,10 L 28,24 L 12,50 C 9,56 14,62 21,62 L 35,62 C 42,62 47,56 44,50 L 28,24"
            fill="#059669"
            fillOpacity="0.25"
            stroke="#047857"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Liquid level */}
          <path d="M 16,46 Q 28,42 40,46 L 43,51 C 41,56 36,60 30,60 L 26,60 C 20,60 15,56 13,51 Z" fill="#10b981" />
          {/* Atomic rings */}
          <ellipse cx="28" cy="36" rx="24" ry="8" stroke="#f59e0b" strokeWidth="1.8" transform="rotate(-25 28 36)" />
          <ellipse cx="28" cy="36" rx="24" ry="8" stroke="#f59e0b" strokeWidth="1.8" transform="rotate(25 28 36)" />
          <circle cx="28" cy="36" r="3" fill="#fbbf24" />
        </g>
      </g>

      {/* Crest Top: Rising Sun of Knowledge with Golden Rays */}
      <g>
        <path d="M 215,138 C 215,112 285,112 285,138 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
        <line x1="250" y1="112" x2="250" y2="88" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />
        <line x1="232" y1="116" x2="218" y2="98" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="268" y1="116" x2="282" y2="98" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="218" y1="126" x2="198" y2="114" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
        <line x1="282" y1="126" x2="302" y2="114" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* Bottom Ribbon / Banner with College Motto */}
      <g filter="url(#edocastiShadow)">
        {/* Ribbon Fold Ends */}
        <path d="M 80,412 L 125,385 L 125,432 Z" fill="#b45309" />
        <path d="M 420,412 L 375,385 L 375,432 Z" fill="#b45309" />

        {/* Main Ribbon Body */}
        <path
          d="M 115,392 L 385,392 C 395,392 402,400 400,410 L 392,434 C 390,440 384,444 376,444 L 124,444 C 116,444 110,440 108,434 L 100,410 C 98,400 105,392 115,392 Z"
          fill="url(#edocastiGoldGrad)"
          stroke="#92400e"
          strokeWidth="2.5"
        />

        {/* Motto Text */}
        <text
          x="250"
          y="423"
          textAnchor="middle"
          fill="#1c1917"
          fontSize="13.5"
          fontWeight="900"
          letterSpacing="1.8"
          fontFamily="system-ui, sans-serif"
        >
          KNOWLEDGE • INNOVATION • FOOD SECURITY
        </text>
      </g>
    </svg>
  );
};
