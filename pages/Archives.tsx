
import React from 'react';

const Archives: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="mb-16">
        <h1 className="text-6xl font-black tracking-tighter uppercase mb-4">视觉存档</h1>
        <p className="text-gray-400 max-w-2xl text-lg leading-relaxed italic">
          "基础艺术、早期 UI 原型和概念草图的宝库。这是技术执行力的种子。"
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {Array.from({ length: 24 }).map((_, idx) => (
          <div 
            key={idx} 
            className="aspect-square bg-neutral-900 border border-white/5 overflow-hidden group relative grayscale hover:grayscale-0 transition-all cursor-crosshair"
          >
            <img src={`https://picsum.photos/seed/archive${idx}/400/400`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Archive item" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                <span className="text-[10px] mono text-white font-bold mb-1">文件_{idx + 2400}</span>
                <span className="text-[8px] text-gray-400">概念草图</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-12 text-center">
        <button className="text-xs mono text-gray-500 hover:text-white transition-colors uppercase tracking-widest border-b border-gray-500 hover:border-white pb-1">
          加载更多历史数据
        </button>
      </div>
    </div>
  );
};

export default Archives;
