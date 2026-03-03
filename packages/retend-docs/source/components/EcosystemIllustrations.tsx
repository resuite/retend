export function RouterIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-router" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/5" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-router)" />

      {/* URL Bar */}
      <rect x="60" y="15" width="280" height="36" rx="8" class="fill-surface stroke-border/50 dark:stroke-border/30" stroke-width="2.5" />
      <circle cx="80" cy="33" r="5" class="fill-fg-muted/10 stroke-border/50" stroke-width="1.5" />
      <circle cx="96" cy="33" r="5" class="fill-fg-muted/10 stroke-border/50" stroke-width="1.5" />
      <circle cx="112" cy="33" r="5" class="fill-fg-muted/10 stroke-border/50" stroke-width="1.5" />
      <rect x="130" y="26" width="190" height="14" rx="4" class="fill-surface-alt/50 stroke-border/50" stroke-width="1.5" />
      <rect x="140" y="30" width="30" height="6" rx="3" class="fill-fg-muted/15" />
      <rect x="175" y="30" width="6" height="6" rx="1" class="fill-fg-muted/10" />
      <rect x="186" y="30" width="50" height="6" rx="3" class="fill-fg-muted/40" />

      {/* Root Node */}
      <circle cx="200" cy="80" r="10" class="fill-surface-alt/50 stroke-border/50" stroke-width="2.5" />
      <path d="M 200 51 L 200 70" class="stroke-border/40" stroke-width="2" />

      {/* Left Branch (inactive) */}
      <path d="M 192 87 L 120 115" class="stroke-border/30" stroke-width="2" stroke-dasharray="6 3" />
      <rect x="80" y="115" width="80" height="45" rx="6" class="fill-surface-alt/30 stroke-border/30" stroke-width="2" />
      <rect x="95" y="128" width="50" height="6" rx="3" class="fill-fg-muted/10" />
      <rect x="95" y="140" width="35" height="4" rx="2" class="fill-fg-muted/5" />

      {/* Center Branch (active) */}
      <path d="M 200 90 L 200 115" class="stroke-fg-muted/30" stroke-width="2.5" />
      <circle cx="200" cy="107" r="4" class="fill-fg-muted/30" />
      <rect x="160" y="115" width="80" height="65" rx="6" class="fill-surface-alt/50 stroke-border/50" stroke-width="2.5" />
      <rect x="175" y="128" width="50" height="8" rx="4" class="fill-fg-muted/40" />
      <rect x="175" y="143" width="50" height="25" rx="3" class="fill-surface stroke-border/40" stroke-width="1.5" />
      <rect x="183" y="152" width="34" height="4" rx="2" class="fill-fg-muted/20" />
      <rect x="183" y="160" width="20" height="4" rx="2" class="fill-fg-muted/15" />

      {/* Right Branch (inactive) */}
      <path d="M 208 87 L 280 115" class="stroke-border/30" stroke-width="2" stroke-dasharray="6 3" />
      <rect x="240" y="115" width="80" height="45" rx="6" class="fill-surface-alt/30 stroke-border/30" stroke-width="2" />
      <rect x="255" y="128" width="50" height="6" rx="3" class="fill-fg-muted/10" />
      <rect x="255" y="140" width="35" height="4" rx="2" class="fill-fg-muted/5" />
    </svg>
  );
}

export function SsrIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-ssr" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/5" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-ssr)" />
      
      {/* Server Tower */}
      <rect x="70" y="50" width="80" height="100" rx="4" class="fill-surface-alt/40 stroke-border/40" stroke-width="2" />
      <rect x="85" y="70" width="50" height="6" rx="3" class="fill-fg-muted/20" />
      <rect x="85" y="85" width="40" height="4" rx="2" class="fill-fg-muted/10" />
      <rect x="85" y="95" width="40" height="4" rx="2" class="fill-fg-muted/10" />
      <circle cx="85" cy="130" r="4" class="fill-fg-muted/40" />
      <circle cx="100" cy="130" r="4" class="fill-fg-muted/20" />
      
      {/* Flow line */}
      <path d="M 150 100 L 220 100" class="stroke-border/30" stroke-width="2" stroke-dasharray="8 4" />
      <circle cx="185" cy="100" r="4" class="fill-fg-muted/30" />

      {/* Resulting Page */}
      <g class="translate-x-[230px] translate-y-[40px]">
        <rect x="0" y="0" width="100" height="120" rx="4" class="fill-surface stroke-border/40 shadow-sm" stroke-width="2" />
        <rect x="15" y="20" width="70" height="8" rx="4" class="fill-fg-muted/40" />
        <rect x="15" y="40" width="70" height="40" rx="2" class="fill-surface-alt/40 stroke-border/30" stroke-width="1.5" />
        <rect x="15" y="90" width="50" height="4" rx="2" class="fill-fg-muted/20" />
        <rect x="15" y="100" width="30" height="4" rx="2" class="fill-fg-muted/20" />
      </g>
    </svg>
  );
}

export function AwaitIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-await" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/5" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-await)" />
      
      {/* Frame Container */}
      <rect x="80" y="40" width="240" height="120" rx="8" class="fill-surface stroke-border/40" stroke-width="2.5" />
      
      {/* Split Line */}
      <line x1="200" y1="40" x2="200" y2="160" class="stroke-border/30" stroke-width="2" stroke-dasharray="4 4" />

      {/* Loading Side */}
      <g class="translate-x-[100px] translate-y-[60px]">
        <circle cx="20" cy="20" r="15" class="fill-surface-alt/30 stroke-border/20" stroke-width="1.5" />
        <rect x="45" y="10" width="40" height="8" rx="4" class="fill-surface-alt/30 stroke-border/20" stroke-width="1.5" />
        <rect x="45" y="25" width="25" height="4" rx="2" class="fill-surface-alt/20" />
        <rect x="0" y="50" width="85" height="30" rx="4" class="fill-surface-alt/30 stroke-border/20" stroke-width="1.5" />
      </g>

      {/* Loaded Side */}
      <g class="translate-x-[215px] translate-y-[60px]">
        <circle cx="20" cy="20" r="15" class="fill-surface-alt/50 stroke-border/30" stroke-width="2" />
        <rect x="45" y="10" width="40" height="8" rx="4" class="fill-fg-muted/40" />
        <rect x="45" y="25" width="25" height="4" rx="2" class="fill-fg-muted/20" />
        <rect x="0" y="50" width="85" height="30" rx="4" class="fill-surface-alt/50 stroke-border/30" stroke-width="2" />
        <rect x="10" y="60" width="50" height="6" rx="3" class="fill-fg-muted/40" />
      </g>

      {/* Scanner Handle */}
      <rect x="195" y="30" width="10" height="140" rx="5" class="fill-fg-muted/20 stroke-border/30" stroke-width="2" />
    </svg>
  );
}

export function HmrIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-hmr" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/5" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-hmr)" />

      {/* Abstract Browser Frame (Minimalist) */}
      <rect x="60" y="30" width="280" height="140" rx="12" class="fill-surface stroke-border/40" stroke-width="2.5" />
      <line x1="60" y1="55" x2="340" y2="55" class="stroke-border/30" stroke-width="2" />

      {/* The "Hot" Update: A component being instantly replaced */}
      <g class="translate-x-[90px] translate-y-[75px]">
        {/* Ghost of the previous version */}
        <rect x="10" y="10" width="100" height="70" rx="8" class="fill-fg-muted/5 stroke-border/10" stroke-width="1" />
        
        {/* The New version emerging */}
        <rect x="0" y="0" width="100" height="70" rx="8" class="fill-surface-alt/30 stroke-fg-muted/30 shadow-sm" stroke-width="2.5" />
        <rect x="15" y="15" width="70" height="10" rx="5" class="fill-fg-muted/30" />
        <rect x="15" y="35" width="40" height="6" rx="3" class="fill-fg-muted/15" />
        <rect x="15" y="48" width="70" height="8" rx="4" class="fill-fg-muted/10" />
      </g>

      {/* The Lightning Strike (Sleek, integrated as a speed indicator) */}
      <path d="M 280 15 L 240 100 L 270 100 L 220 185" class="stroke-fg-muted/20" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M 280 15 L 240 100 L 270 100 L 220 185" class="stroke-surface dark:stroke-surface" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

      {/* Instant Success Indicator */}
      <g class="translate-x-[305px] translate-y-[85px]">
        <circle cx="0" cy="0" r="22" class="fill-fg-muted/10 stroke-border/20" stroke-width="1" />
        <text x="0" y="4" class="fill-fg-muted/40 font-bold text-[10px]" text-anchor="middle">0ms</text>
      </g>
      
      {/* Speed lines */}
      <path d="M 40 80 L 70 80" class="stroke-fg-muted/15" stroke-width="2" stroke-linecap="round" stroke-dasharray="6 4" />
      <path d="M 35 100 L 60 100" class="stroke-fg-muted/10" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 4" />
    </svg>
  );
}

export function ScopedContextIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-scope" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/5" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-scope)" />
      
      {/* Outer Scope Boundary */}
      <rect x="60" y="20" width="280" height="160" rx="12" class="fill-fg-muted/5 stroke-border/30" stroke-width="2.5" stroke-dasharray="8 4" />

      {/* Root Node */}
      <circle cx="200" cy="50" r="12" class="fill-fg-muted/30 stroke-border/40" stroke-width="2.5" />

      {/* Branches */}
      <path d="M 188 58 L 140 85" class="stroke-border/30" stroke-width="2" />
      <path d="M 212 58 L 260 85" class="stroke-border/30" stroke-width="2" />

      {/* Left Scope Boundary */}
      <rect x="85" y="75" width="110" height="90" rx="8" class="fill-surface stroke-border/30" stroke-width="2" stroke-dasharray="6 3" />
      <circle cx="140" cy="100" r="10" class="fill-surface-alt/40 stroke-border/30" stroke-width="2" />
      <path d="M 133 107 L 115 130" class="stroke-border/20" stroke-width="1.5" />
      <path d="M 147 107 L 165 130" class="stroke-border/20" stroke-width="1.5" />
      <circle cx="115" cy="140" r="7" class="fill-surface-alt/30 stroke-border/20" stroke-width="1.5" />
      <circle cx="165" cy="140" r="7" class="fill-surface-alt/30 stroke-border/20" stroke-width="1.5" />

      {/* Right Scope Boundary */}
      <rect x="205" y="75" width="110" height="90" rx="8" class="fill-surface stroke-border/30" stroke-width="2" stroke-dasharray="6 3" />
      <circle cx="260" cy="100" r="10" class="fill-surface-alt/40 stroke-border/30" stroke-width="2" />
      <path d="M 253 107 L 240 130" class="stroke-border/20" stroke-width="1.5" />
      <path d="M 267 107 L 280 130" class="stroke-border/20" stroke-width="1.5" />
      <circle cx="240" cy="140" r="7" class="fill-fg-muted/20 stroke-border/20" stroke-width="1.5" />
      <circle cx="280" cy="140" r="7" class="fill-surface-alt/30 stroke-border/20" stroke-width="1.5" />
    </svg>
  );
}

export function UniversalRenderingIllustration() {
  return (
    <svg viewBox="0 0 400 200" class="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid-uni" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" class="fill-fg/5" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="url(#grid-uni)" />

      {/* Central Source Component */}
      <rect x="145" y="55" width="110" height="50" rx="8" class="fill-surface-alt/40 stroke-border/40" stroke-width="2.5" />
      <rect x="160" y="68" width="25" height="6" rx="3" class="fill-fg-muted/30" />
      <rect x="190" y="68" width="40" height="6" rx="3" class="fill-fg-muted/15" />
      <rect x="160" y="80" width="60" height="6" rx="3" class="fill-fg-muted/20" />
      <rect x="225" y="80" width="15" height="6" rx="3" class="fill-fg-muted/10" />

      {/* Arrow to Browser (Left) */}
      <path d="M 145 80 L 100 60" class="stroke-border/30" stroke-width="2" />
      <circle cx="100" cy="60" r="3" class="fill-fg-muted/30" />

      {/* Arrow to Server (Right) */}
      <path d="M 255 80 L 300 60" class="stroke-border/30" stroke-width="2" />
      <circle cx="300" cy="60" r="3" class="fill-fg-muted/30" />

      {/* Arrow to Test (Bottom) */}
      <path d="M 200 105 L 200 135" class="stroke-border/30" stroke-width="2" />
      <circle cx="200" cy="135" r="3" class="fill-fg-muted/30" />

      {/* Browser Window (Left) */}
      <rect x="30" y="15" width="100" height="70" rx="6" class="fill-surface stroke-border/30" stroke-width="2" />
      <rect x="30" y="15" width="100" height="18" rx="6" class="fill-surface-alt/40 stroke-border/30" stroke-width="2" />
      <circle cx="42" cy="24" r="3" class="fill-fg-muted/10 stroke-border/20" stroke-width="1" />
      <circle cx="53" cy="24" r="3" class="fill-fg-muted/10 stroke-border/20" stroke-width="1" />
      <circle cx="64" cy="24" r="3" class="fill-fg-muted/10 stroke-border/20" stroke-width="1" />
      <rect x="42" y="42" width="50" height="6" rx="3" class="fill-fg-muted/20" />
      <rect x="42" y="54" width="70" height="4" rx="2" class="fill-fg-muted/10" />
      <rect x="42" y="64" width="40" height="4" rx="2" class="fill-fg-muted/10" />

      {/* Server Terminal (Right) */}
      <rect x="270" y="15" width="100" height="70" rx="6" class="fill-surface stroke-border/30" stroke-width="2" />
      <rect x="270" y="15" width="100" height="18" rx="6" class="fill-surface-alt/40 stroke-border/30" stroke-width="2" />
      <rect x="282" y="21" width="30" height="8" rx="4" class="fill-fg-muted/5" />
      <rect x="282" y="42" width="10" height="5" rx="2" class="fill-fg-muted/30" />
      <rect x="296" y="42" width="50" height="5" rx="2" class="fill-fg-muted/15" />
      <rect x="282" y="52" width="10" height="5" rx="2" class="fill-fg-muted/30" />
      <rect x="296" y="52" width="40" height="5" rx="2" class="fill-fg-muted/15" />
      <rect x="282" y="62" width="10" height="5" rx="2" class="fill-fg-muted/30" />
      <rect x="296" y="62" width="60" height="5" rx="2" class="fill-fg-muted/15" />
      <rect x="282" y="72" width="6" height="5" rx="2" class="fill-fg-muted/30" />

      {/* Test Environment (Bottom) */}
      <rect x="135" y="140" width="130" height="50" rx="6" class="fill-surface stroke-border/30" stroke-width="2" />
      <circle cx="155" cy="158" r="6" class="fill-surface-alt/30 stroke-border/30" stroke-width="2" />
      <path d="M 152 158 L 154 160 L 159 155" class="stroke-fg-muted/40" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="168" y="154" width="50" height="5" rx="2" class="fill-fg-muted/15" />

      <circle cx="155" cy="175" r="6" class="fill-surface-alt/30 stroke-border/30" stroke-width="2" />
      <path d="M 152 175 L 154 177 L 159 172" class="stroke-fg-muted/40" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="168" y="171" width="70" height="5" rx="2" class="fill-fg-muted/15" />
    </svg>
  );
}