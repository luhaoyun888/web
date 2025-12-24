
import React from 'react';
import ImageSlider from '../components/ImageSlider';

const AutoVision: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="mb-16">
        <h1 className="text-6xl font-black tracking-tighter uppercase mb-4">汽车视觉</h1>
        <p className="text-gray-400 max-w-2xl text-lg leading-relaxed">
          高保真汽车可视化项目。专注于 WebGL 配置器、材质真实感和实时光照系统。
        </p>
      </header>

      <section className="grid grid-cols-1 gap-24">
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold mono uppercase tracking-widest text-blue-500">配置器引擎 V2</h2>
            <span className="text-xs px-3 py-1 border border-blue-500/30 rounded-full text-blue-400 uppercase">交互案例</span>
          </div>
          <ImageSlider 
            before="https://picsum.photos/seed/car_raw/1200/675" 
            after="https://picsum.photos/seed/car_final/1200/675" 
            labelBefore="原始视口"
            labelAfter="最终渲染"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                <h4 className="font-bold text-white mb-2">PBR 优化</h4>
                <p className="text-sm text-gray-400">为实时环境定制的漆面亮片效果和清漆层折射着色器。</p>
            </div>
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                <h4 className="font-bold text-white mb-2">Delta 光照</h4>
                <p className="text-sm text-gray-400">实现了一种结合了烘焙 AO 和动态光线追踪阴影的混合光照系统。</p>
            </div>
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                <h4 className="font-bold text-white mb-2">自动化 LOD</h4>
                <p className="text-sm text-gray-400">开发了 Python 流水线，将 1000 万面 CAD 模型优化至 30 万面以便网页展示。</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-bold mono uppercase tracking-widest text-blue-500">虚拟展厅工作室</h2>
          <div className="aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-white/10 relative group">
            <img src="https://picsum.photos/seed/showroom/1200/800" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" alt="Showroom" />
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="px-8 py-3 bg-white text-black font-bold tracking-tighter uppercase hover:bg-blue-500 hover:text-white transition-colors">
                启动完整查看器
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AutoVision;
