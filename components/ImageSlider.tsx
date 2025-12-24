
import React, { useState, useRef, useEffect } from 'react';

interface ImageSliderProps {
  before: string;
  after: string;
  labelBefore?: string;
  labelAfter?: string;
}

const ImageSlider: React.FC<ImageSliderProps> = ({ before, after, labelBefore = "RAW", labelAfter = "RENDER" }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, position)));
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-video overflow-hidden rounded-xl border border-white/10 group cursor-col-resize select-none"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* After Image (Background) */}
      <img src={after} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      
      {/* Before Image (Clip) */}
      <div 
        className="absolute inset-0 w-full h-full border-r-2 border-white/50 z-10"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover" />
        <span className="absolute top-4 left-4 px-2 py-1 bg-black/50 text-[10px] mono backdrop-blur text-white border border-white/20">
          {labelBefore}
        </span>
      </div>

      <span className="absolute top-4 right-4 px-2 py-1 bg-blue-500/50 text-[10px] mono backdrop-blur text-white border border-white/20">
        {labelAfter}
      </span>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center">
          <div className="w-1 h-3 bg-white/80 rounded-full mx-0.5" />
          <div className="w-1 h-3 bg-white/80 rounded-full mx-0.5" />
        </div>
      </div>
    </div>
  );
};

export default ImageSlider;
