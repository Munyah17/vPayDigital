interface VLogoIconProps {
  className?: string;
}

export function VLogoIcon({ className = 'w-8' }: VLogoIconProps) {
  return (
    <svg
      viewBox="0 0 52 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="vpay-main" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="45%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <radialGradient id="vpay-inner-shadow" cx="0.5" cy="0.2" r="0.55">
          <stop offset="0%" stopColor="rgba(0,0,0,0.28)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      {/* Main V shape */}
      <path d="M2 4 L14 4 L26 37 L38 4 L50 4 L26 44 Z" fill="url(#vpay-main)" />
      {/* Inner shadow at the V notch */}
      <path d="M2 4 L14 4 L26 37 L38 4 L50 4 L26 44 Z" fill="url(#vpay-inner-shadow)" />
      {/* Right arm depth shadow */}
      <path d="M26 37 L38 4 L50 4 L26 44 Z" fill="rgba(0,0,0,0.18)" />
    </svg>
  );
}
