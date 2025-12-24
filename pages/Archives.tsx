
import React, { useState } from 'react';

const ARCHIVE_DATA = {
  "早期写生": [
    { id: 1, url: 'https://picsum.photos/seed/sketch1/400/600' },
    { id: 2, url: 'https://picsum.photos/seed/sketch2/400/400' },
    { id: 3, url: 'https://picsum.photos/seed/sketch3/400/550' },
    { id: 4, url: 'https://picsum.photos/seed/sketch4/400/700' },
    { id: 5, url: 'https://picsum.photos/seed/sketch5/400/300' },
    { id: 6, url: 'https://picsum.photos/seed/sketch6/400/500' },
  ],
  "UI 原型探索": [
    { id: 7, url: 'https://picsum.photos/seed/ui1/400/400' },
    { id: 8, url: 'https://picsum.photos/seed/ui2/400/600' },
    { id: 9, url: 'https://picsum.photos/seed/ui3/400/300' },
    { id: 10, url: 'https://picsum.photos/seed/ui4/400/450' },
  ],
  "视觉传达项目": [
    { id: 11, url: 'https://picsum.photos/seed/vc1/400/700' },
    { id: 12, url: 'https://picsum.photos/seed/vc2/400/400' },
    { id: 13, url: 'https://picsum.photos/seed/vc3/400/500' },
    { id: 14, url: 'https://picsum.photos/seed/vc4/400/350' },
    { id: 15, url: 'https://picsum.photos/seed/vc5/400/600' },
  ]
};

const Archives: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<keyof typeof ARCHIVE_DATA>("早期写生");

  return (
    <div className="max-w-7xl mx-auto px-6 py-24">
      <header className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
        <div className="space-y-4">
          <h1 className="text-6xl font-black tracking-tighter uppercase">视觉存档</h1>
          <p className="text-gray-400 text-lg mono font-light">Vault of visual evolution.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {Object.keys(ARCHIVE_DATA).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as keyof typeof ARCHIVE_DATA)}
              className={`px-6 py-2 rounded-full text-xs mono uppercase transition-all ${
                activeCategory === cat 
                ? 'bg-blue-500 text-white' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {/* 瀑布流布局 */}
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
        {ARCHIVE_DATA[activeCategory].map((item) => (
          <div 
            key={item.id} 
            className="break-inside-avoid group relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900"
          >
            <img 
              src={item.url} 
              alt="Archive" 
              className="w-full h-auto grayscale group-hover:grayscale-0 transition-all duration-700 hover:scale-105" 
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-[10px] mono text-white font-bold border border-white/20 px-3 py-1 bg-black/50 backdrop-blur">
                REF_IDX_{item.id}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Archives;
