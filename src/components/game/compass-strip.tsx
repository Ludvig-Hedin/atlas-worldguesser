"use client";

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const PX_PER_DEG = 2.4;
const WIDTH = 288; // w-72
const CENTER = WIDTH / 2;

// The viewport is centered on heading + 360° with a ±60° visible window, so
// marks must cover up to 359 + 420 = 779° or the strip goes blank on the right
// for headings near north (300–360°).
const MARKS: number[] = [];
for (let deg = 0; deg <= 780; deg += 15) MARKS.push(deg);
const TRACK_DEG = 780;

const MASK = "linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent)";

/** Fortnite-style semi-transparent horizontal compass across the top of the view. */
export function CompassStrip({ heading }: { heading: number }) {
  const h = ((heading % 360) + 360) % 360;
  const translate = CENTER - (h + 360) * PX_PER_DEG;

  return (
    <div className="pointer-events-none absolute left-1/2 top-12 z-20 flex -translate-x-1/2 flex-col items-center sm:top-2">
      <span className="rounded-md bg-black/50 px-1.5 text-[11px] font-semibold tabular text-white backdrop-blur-md [text-shadow:0_1px_2px_rgb(0_0_0_/_0.6)]">
        {Math.round(h)}°
      </span>
      <span className="mt-0.5 size-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-white/90" />
      <div
        className="relative h-7 w-72 overflow-hidden"
        style={{ maskImage: MASK, WebkitMaskImage: MASK }}
      >
        <div
          className="absolute inset-y-0"
          style={{
            transform: `translateX(${translate}px)`,
            width: TRACK_DEG * PX_PER_DEG,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
          }}
        >
          {MARKS.map((deg) => {
            const isCardinal = deg % 45 === 0;
            const label = isCardinal ? CARDINALS[(deg / 45) % 8] : String(deg % 360);
            return (
              <div
                key={deg}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: deg * PX_PER_DEG }}
              >
                <span
                  className={
                    isCardinal
                      ? "text-sm font-semibold leading-none text-white"
                      : "text-[10px] font-medium leading-none text-white/60"
                  }
                >
                  {label}
                </span>
                <span className={isCardinal ? "mt-1 h-2 w-px bg-white/70" : "mt-1 h-1.5 w-px bg-white/35"} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
