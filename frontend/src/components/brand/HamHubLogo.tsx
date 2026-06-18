import { hamhubBrand } from './hamhubBrand'

type HamHubLogoProps = {
  compact?: boolean
  className?: string
}

export function HamHubLogo({ compact = false, className = '' }: HamHubLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label={hamhubBrand.name}>
      <svg
        className="h-9 w-9 shrink-0"
        viewBox="0 0 64 64"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="hamhub-mark-gradient" x1="9" y1="8" x2="55" y2="57" gradientUnits="userSpaceOnUse">
            <stop stopColor={hamhubBrand.colors.signal} />
            <stop offset="0.55" stopColor={hamhubBrand.colors.active} />
            <stop offset="1" stopColor={hamhubBrand.colors.warm} />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="54" height="54" rx="14" fill={hamhubBrand.colors.midnight} />
        <path d="M19 39.5V24.3h5.7v5.4h14.6v-5.4H45v15.2h-5.7v-5.6H24.7v5.6H19Z" fill={hamhubBrand.colors.white} />
        <path d="M32 16v32" stroke="url(#hamhub-mark-gradient)" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M24.5 18.8a12 12 0 0 0 0 26.4M39.5 18.8a12 12 0 0 1 0 26.4" stroke="url(#hamhub-mark-gradient)" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <circle cx="32" cy="32" r="4.8" fill="url(#hamhub-mark-gradient)" />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className="block text-xl font-bold tracking-tight text-white">HamHub</span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-sky-300">Radio Network</span>
        </span>
      )}
    </span>
  )
}
