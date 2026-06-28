import { useState } from "react";

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
}: {
  beforeUrl: string;
  afterUrl: string;
}) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-black select-none touch-pan-y">
      <img
        src={afterUrl}
        alt="depois"
        className="block w-full h-auto"
        draggable={false}
      />
      <img
        src={beforeUrl}
        alt="antes"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white/90 shadow-soft pointer-events-none"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 h-9 w-9 rounded-full bg-white/95 shadow-soft flex items-center justify-center text-foreground text-xs font-medium">
          ⇆
        </div>
      </div>
      <div className="absolute left-3 top-3 px-2 py-1 rounded-full bg-black/55 text-white text-xs">
        Antes
      </div>
      <div className="absolute right-3 top-3 px-2 py-1 rounded-full bg-black/55 text-white text-xs">
        Depois
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Comparador antes e depois"
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
      />
    </div>
  );
}
