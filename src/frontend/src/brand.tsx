// Bottega Sabauda brand: the Mole Antonelliana whose dome is a gianduiotto (public/logo.svg, also the favicon)
// plus the "Bottega Sabauda" wordmark. public/logo-lockup.svg is the same lockup as a single file for slides/docs.
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return <img src="/logo.svg" width={size} height={size} className={`shrink-0 ${className}`} alt="" aria-hidden />;
}

// Header version, on the dark cocoa bar: mark on a cream disc so the chocolate dome stays readable
export function Brand() {
  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap" aria-label="Bottega Sabauda">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cream">
        <LogoMark size={38} />
      </span>
      <div className="leading-none">
        <div className="font-display text-xl font-extrabold tracking-tight">
          <span className="text-cream">Bottega</span> <span className="text-[oklch(0.78_0.09_255)]">Sabauda</span>
        </div>
        <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-hazel uppercase">Company Brain · Torino</div>
      </div>
    </div>
  );
}

// Large lockup on light backgrounds (e.g. empty chat)
export function Lockup({ size = 96 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3" aria-label="Bottega Sabauda">
      <LogoMark size={size} />
      <div className="text-left leading-[0.95]">
        <div className="font-display text-4xl font-extrabold tracking-tight text-cocoa">Bottega</div>
        <div className="font-display text-4xl font-extrabold tracking-tight text-savoia">Sabauda</div>
        <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-brand uppercase">
          <span className="h-[3px] w-8 rounded-full bg-hazel" />Gianduiotti · Torino
        </div>
      </div>
    </div>
  );
}
