export function RouterIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-router" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/10" />
        </pattern>
        <linearGradient id="glow-router" x1="0" y1="0" x2="400" y2="200">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill="url(#grid-router)" />
      
      {/* Top Inactive Route & View */}
      <rect x="40" y="44" width="110" height="28" rx="6" class="fill-surface border border-border opacity-50" />
      <rect x="52" y="56" width="40" height="4" rx="2" class="fill-fg-muted/40" />
      <path d="M 150 58 L 260 58" class="stroke-fg-muted/20" stroke-width="2" stroke-dasharray="4 4" />
      <rect x="260" y="30" width="100" height="50" rx="6" class="fill-surface border border-border opacity-50" />
      <rect x="270" y="44" width="30" height="4" rx="2" class="fill-fg-muted/40" />
      <rect x="270" y="54" width="50" height="4" rx="2" class="fill-fg-muted/20" />

      {/* Bottom Inactive Route & View */}
      <rect x="40" y="128" width="110" height="28" rx="6" class="fill-surface border border-border opacity-50" />
      <rect x="52" y="140" width="50" height="4" rx="2" class="fill-fg-muted/40" />
      <path d="M 150 142 L 260 142" class="stroke-fg-muted/20" stroke-width="2" stroke-dasharray="4 4" />
      <rect x="260" y="120" width="100" height="50" rx="6" class="fill-surface border border-border opacity-50" />
      <rect x="270" y="134" width="40" height="4" rx="2" class="fill-fg-muted/40" />
      <rect x="270" y="144" width="40" height="4" rx="2" class="fill-fg-muted/20" />

      {/* Center Active Route & View */}
      <rect x="30" y="80" width="130" height="40" rx="8" class="fill-surface border border-brand/40 shadow-[0_4px_16px_rgba(43,74,168,0.2)]" />
      <rect x="46" y="98" width="60" height="4" rx="2" class="fill-brand" />
      <circle cx="140" cy="100" r="4" class="fill-brand" />
      
      <path d="M 160 100 L 230 100" class="stroke-brand" stroke-width="2" stroke-dasharray="4 4" />
      <path d="M 160 100 L 230 100" class="stroke-brand/50" stroke-width="2" />
      
      {/* Glowing Moving dot using pulse or a custom animated element */}
      <circle cx="195" cy="100" r="3" class="fill-brand shadow-[0_0_10px_rgba(43,74,168,0.8)] animate-[pulse_1s_ease-in-out_infinite]" />
      
      <rect x="230" y="60" width="130" height="80" rx="8" class="fill-surface-alt border-2 border-brand/30 shadow-[0_8px_32px_rgba(43,74,168,0.25)] backdrop-blur-md" />
      <rect x="246" y="76" width="40" height="6" rx="3" class="fill-brand" />
      
      <rect x="246" y="92" width="98" height="32" rx="4" class="fill-brand/[0.05] border border-brand/20 animate-[pulse_3s_ease-in-out_infinite]" />
      <rect x="254" y="100" width="30" height="4" rx="2" class="fill-brand/60" />
      <rect x="254" y="110" width="70" height="4" rx="2" class="fill-brand/40" />
    </svg>
  );
}

export function SsrIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-ssr" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/10" />
        </pattern>
        <radialGradient id="glow-ssr" cx="200" cy="100" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="transparent" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="200" fill="url(#grid-ssr)" />
      
      {/* Stream Lines */}
      <path d="M 140 100 L 260 100" class="stroke-brand/50" stroke-width="4" stroke-dasharray="10 10" />
      <path d="M 140 85 L 260 85" class="stroke-brand/30" stroke-width="2" stroke-dasharray="4 8" />
      <path d="M 140 115 L 260 115" class="stroke-brand/30" stroke-width="2" stroke-dasharray="4 8" />
      
      {/* Server Box (Left) */}
      <rect x="60" y="60" width="80" height="80" rx="12" class="fill-surface border-2 border-brand shadow-[0_8px_24px_rgba(43,74,168,0.2)]" />
      <circle cx="84" cy="84" r="4" class="fill-brand" />
      <rect x="80" y="100" width="40" height="6" rx="3" class="fill-brand/30" />
      <rect x="80" y="114" width="30" height="6" rx="3" class="fill-brand/30" />
      <rect x="80" y="128" width="20" height="6" rx="3" class="fill-brand/30" />
      <path d="M100 84 L116 84" class="stroke-brand" stroke-width="3" stroke-linecap="round" />
      
      {/* Client Box (Right) */}
      <rect x="260" y="60" width="80" height="80" rx="12" class="fill-surface border border-border shadow-lg" />
      <path d="M 260 72 C 260 65.37 265.37 60 272 60 L 328 60 C 334.63 60 340 65.37 340 72 L 340 84 L 260 84 L 260 72 Z" class="fill-surface-alt border-b border-border" />
      <circle cx="274" cy="72" r="3" class="fill-fg-muted/40" />
      <circle cx="284" cy="72" r="3" class="fill-fg-muted/40" />
      <circle cx="294" cy="72" r="3" class="fill-fg-muted/40" />
      
      <rect x="272" y="96" width="56" height="32" rx="4" class="fill-brand/10 border border-brand/20" />
      <rect x="280" y="104" width="40" height="4" rx="2" class="fill-brand" />
      <rect x="280" y="114" width="24" height="4" rx="2" class="fill-brand/60" />
      
      {/* Moving Packets (Data) */}
      <rect x="160" y="96" width="16" height="8" rx="4" class="fill-brand shadow-[0_0_12px_rgba(43,74,168,0.8)] animate-[bounce_1s_infinite]" />
      <rect x="210" y="96" width="12" height="8" rx="4" class="fill-brand/60 animate-[bounce_1.5s_infinite]" />
    </svg>
  );
}

export function AwaitIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-await" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/10" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-await)" />
      
      {/* Left Side: Loading skeleton */}
      <rect x="60" y="40" width="120" height="120" rx="12" class="fill-surface border border-border shadow-lg" />
      
      {/* Skeleton items */}
      <circle cx="200" cy="110" r="8" class="fill-surface animate-pulse" />
      <rect x="104" y="64" width="50" height="6" rx="3" class="fill-fg-muted/20 animate-pulse" />
      <rect x="104" y="74" width="30" height="4" rx="2" class="fill-fg-muted/20 animate-pulse" />
      
      <rect x="74" y="96" width="92" height="50" rx="6" class="fill-fg-muted/10 border border-fg-muted/10 animate-pulse" />
      
      {/* Spinner ring in center of skeleton frame */}
      <path d="M 120 109 A 12 12 0 0 1 132 121" class="stroke-brand" stroke-width="3" stroke-linecap="round" />
      <circle cx="120" cy="121" r="12" class="stroke-fg-muted/20" stroke-width="3" />
      
      {/* Arrow connecting them */}
      <path d="M 195 100 L 215 100 M 210 95 L 215 100 L 210 105" class="stroke-fg-muted/50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      
      {/* Right Side: Resolved state */}
      <rect x="230" y="40" width="120" height="120" rx="12" class="fill-surface border border-brand/40 shadow-[0_8px_30px_rgba(43,74,168,0.15)]" />
      
      {/* Loaded items */}
      <circle cx="254" cy="70" r="10" class="fill-brand/80" />
      <rect x="274" y="64" width="50" height="6" rx="3" class="fill-fg" />
      <rect x="274" y="74" width="30" height="4" rx="2" class="fill-fg-muted" />
      
      {/* Image/Content placeholder with nice gradients */}
      <rect x="244" y="96" width="92" height="50" rx="6" class="fill-brand/10 border border-brand/20" />
      <rect x="252" y="106" width="50" height="6" rx="3" class="fill-brand/40" />
      <rect x="252" y="118" width="70" height="6" rx="3" class="fill-brand/40" />
      <rect x="252" y="130" width="40" height="6" rx="3" class="fill-brand/40" />
    </svg>
  );
}

export function HmrIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-hmr" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/10" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-hmr)" />
      
      {/* Code Editor Side */}
      <rect x="50" y="40" width="120" height="120" rx="8" class="fill-surface border border-border shadow-lg" />
      <path d="M 50 60 L 170 60" class="stroke-border" stroke-width="1" />
      <circle cx="62" cy="50" r="3" class="fill-fg-muted/40" />
      <circle cx="72" cy="50" r="3" class="fill-fg-muted/40" />
      <circle cx="82" cy="50" r="3" class="fill-fg-muted/40" />
      
      {/* Code Lines */}
      <rect x="65" y="75" width="40" height="4" rx="2" class="fill-brand/60" />
      <rect x="65" y="87" width="70" height="4" rx="2" class="fill-fg-muted/40" />
      <rect x="75" y="99" width="50" height="4" rx="2" class="fill-brand animate-[pulse_1s_ease-in-out_infinite]" />
      <rect x="75" y="111" width="30" height="4" rx="2" class="fill-fg-muted/40" />
      <rect x="65" y="123" width="20" height="4" rx="2" class="fill-fg-muted/40" />

      {/* Connection arrow with fast packets */}
      <path d="M 180 100 L 220 100" class="stroke-brand/20" stroke-width="4" stroke-dasharray="8 4" />
      <rect x="190" y="98" width="8" height="4" rx="2" class="fill-brand animate-[bounce_0.5s_infinite]" />
      
      {/* Browser View Side */}
      <rect x="230" y="40" width="120" height="120" rx="8" class="fill-surface border border-brand/40 shadow-[0_4px_20px_rgba(43,74,168,0.2)]" />
      <path d="M 230 60 L 350 60" class="stroke-border" stroke-width="1" />
      
      {/* Browser content */}
      <rect x="250" y="80" width="80" height="20" rx="4" class="fill-brand/10 border border-brand/20 transition-all duration-500 animate-[pulse_1s_ease-in-out_infinite]" />
      <rect x="260" y="88" width="60" height="4" rx="2" class="fill-brand" />
      
      <rect x="250" y="110" width="45" height="4" rx="2" class="fill-fg-muted/60" />
      <rect x="250" y="120" width="60" height="4" rx="2" class="fill-fg-muted/40" />
      
      {/* Keep state icon */}
      <circle cx="330" cy="130" r="10" class="fill-surface border border-brand/40" />
      <path d="M 326 130 L 329 133 L 334 127" class="stroke-brand" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function MicrofrontendIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-mfe" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/10" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-mfe)" />
      
      {/* Sub-apps (sources) */}
      <rect x="60" y="40" width="60" height="40" rx="6" class="fill-surface border border-brand/30 shadow-sm animate-[pulse_3s_ease-in-out_infinite]" />
      <rect x="70" y="50" width="20" height="4" rx="2" class="fill-brand/50" />
      <rect x="70" y="60" width="40" height="4" rx="2" class="fill-fg-muted/30" />
      
      <rect x="60" y="120" width="60" height="40" rx="6" class="fill-surface border border-[#10b981]/30 shadow-sm animate-[pulse_4s_ease-in-out_infinite]" />
      <rect x="70" y="130" width="20" height="4" rx="2" class="fill-[#10b981]/50" />
      <rect x="70" y="140" width="40" height="4" rx="2" class="fill-fg-muted/30" />
      
      {/* Connecting lines */}
      <path d="M 130 60 C 180 60, 180 100, 220 100" class="stroke-brand/40" stroke-width="2" stroke-dasharray="4 4" />
      <path d="M 130 140 C 180 140, 180 100, 220 100" class="stroke-[#10b981]/40" stroke-width="2" stroke-dasharray="4 4" />
      
      {/* Shell App (destination) */}
      <rect x="230" y="40" width="120" height="120" rx="8" class="fill-surface border border-border shadow-lg" />
      
      {/* Embedded MFE 1 */}
      <rect x="240" y="55" width="100" height="35" rx="4" class="fill-brand/[0.05] border border-brand/20 transition-all hover:bg-brand/10" />
      <rect x="250" y="65" width="20" height="4" rx="2" class="fill-brand/60" />
      <rect x="250" y="75" width="40" height="4" rx="2" class="fill-fg-muted/40" />
      
      {/* Embedded MFE 2 */}
      <rect x="240" y="105" width="100" height="35" rx="4" class="fill-[#10b981]/[0.05] border border-[#10b981]/20 transition-all hover:bg-[#10b981]/10" />
      <rect x="250" y="115" width="20" height="4" rx="2" class="fill-[#10b981]/60" />
      <rect x="250" y="125" width="40" height="4" rx="2" class="fill-fg-muted/40" />
    </svg>
  );
}

export function TypeSafetyIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-ts" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/10" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-ts)" />
      
      {/* TS Logo Background Hint */}
      <rect x="170" y="70" width="60" height="60" rx="8" class="fill-brand/[0.05] border border-brand/20 transform rotate-12" />
      <path d="M 185 105 L 195 105 L 195 120 L 185 120 Z" class="fill-brand/20 transform rotate-12" />
      
      {/* Protection Shield / Box */}
      <path d="M 200 40 L 260 60 L 260 120 C 260 150, 200 170, 200 170 C 200 170, 140 150, 140 120 L 140 60 L 200 40 Z" class="fill-surface border border-brand/30 shadow-[0_0_30px_rgba(43,74,168,0.15)]" />
      
      {/* Types and Connectors inside the shield */}
      <rect x="160" y="70" width="40" height="20" rx="4" class="fill-surface-alt border border-brand/40" />
      <rect x="168" y="78" width="24" height="4" rx="2" class="fill-brand" />
      
      <rect x="200" y="110" width="40" height="20" rx="4" class="fill-surface-alt border border-brand/40" />
      <rect x="208" y="118" width="24" height="4" rx="2" class="fill-brand" />
      
      {/* Validating laser line */}
      <path d="M 180 90 L 220 110" class="stroke-brand animate-[pulse_2s_ease-in-out_infinite]" stroke-width="2" stroke-dasharray="4 4" />
      
      {/* Checkmark confirming type match */}
      <circle cx="200" cy="100" r="12" class="fill-surface border border-brand" />
      <path d="M 195 100 L 199 104 L 205 96" class="stroke-brand" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      
      {/* Invalid connection rejected outside */}
      <path d="M 100 120 L 130 120" class="stroke-[#ef4444]/60" stroke-width="2" stroke-dasharray="4 2" />
      <path d="M 125 115 L 135 125 M 135 115 L 125 125" class="stroke-[#ef4444]" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}
