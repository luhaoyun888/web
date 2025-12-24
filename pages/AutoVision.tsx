
import React, { useState } from 'react';
import ImageSlider from '../components/ImageSlider';
import ImageSequencePlayer from '../components/ImageSequencePlayer';

const CAR_MODELS = [
  { id: 'cyber-01', name: '赛博跑车 V2', before: 'https://picsum.photos/seed/cyber_raw/1200/675', after: 'https://picsum.photos/seed/cyber_final/1200/675', tag: 'High-Poly', specs: '1.2M Tris / 8K Textures' },
  { id: 'lunar-01', name: '月球探险者', before: 'https://picsum.photos/seed/lunar_raw/1200/675', after: 'https://picsum.photos/seed/lunar_final/1200/675', tag: 'Custom PBR', specs: '850K Tris / Procedural' },
  { id: 'neon-01', name: '霓虹都市 Z', before: 'https://picsum.photos/seed/neon_raw/1200/675', after: 'https://picsum.photos/seed/neon_final/1200/675', tag: 'RTX Ready', specs: 'Raytraced / Volumetric' },
  { id: 'gt-01', name: 'GT 概念版', before: 'https://picsum.photos/seed/gt_raw/1200/675', after: 'https://picsum.photos/seed/gt_final/1200/675', tag: 'Web-Optimized', specs: '300K Tris / Dracos' },
  { id: 'suv-01', name: '全地形概念', before: 'https://picsum.photos/seed/suv_raw/1200/675', after: 'https://picsum.photos/seed/suv_final/1200/675', tag: 'Realtime', specs: 'Hybrid Lighting' },
  { id: 'sport-01', name: '竞技烈焰', before: 'https://picsum.photos/seed/sp_raw/1200/675', after: 'https://picsum.photos/seed/sp_final/1200/675', tag: 'VFX Lead', specs: 'Nishita Sky / AO' },
];

const AutoVision: React.FC = () => {
  const [selectedCar, setSelectedCar] = useState(CAR_MODELS[0]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-24 space-y-48">
      {/* 1. 配置器引擎对比区 */}
      <section className="space-y-16">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-l-4 border-blue-500 pl-8">
          <div className="space-y-4">
            <h1 className="text-6xl font-black tracking-tight uppercase leading-none">
              配置器引擎 <span className="text-blue-500">V2</span>
            </h1>
            <p className="text-gray-400 max-w-xl text-lg font-light leading-relaxed">
              基于 WebGL 的实时渲染引擎演示。我们通过自定义着色器模拟复杂的菲涅尔反射、碳纤维纹理以及物理精确的车漆涂层。
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] mono text-blue-500 uppercase tracking-[0.3em] mb-2">SYSTEM_STATUS</span>
            <div className="px-4 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400 mono text-xs">
              SELECTED: {selectedCar.id} // {selectedCar.specs}
            </div>
          </div>
        </header>

        <div className="space-y-12">
          <div className="group relative rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/5 bg-neutral-900">
            <ImageSlider 
              before={selectedCar.before} 
              after={selectedCar.after} 
              labelBefore="VIEWPORT_UNLIT"
              labelAfter="PHYSICAL_RENDER"
            />
          </div>

          <div className="relative">
            <div className="flex overflow-x-auto pb-8 space-x-6 scrollbar-hide snap-x no-scrollbar">
              {CAR_MODELS.map(car => (
                <button
                  key={car.id}
                  onClick={() => setSelectedCar(car)}
                  className={`flex-shrink-0 w-72 snap-start p-8 rounded-[2rem] border transition-all duration-500 ${
                    selectedCar.id === car.id 
                    ? 'border-blue-500 bg-blue-500/5 shadow-[0_10px_40px_rgba(59,130,246,0.1)]' 
                    : 'border-white/5 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-center mb-6">
                    <span className={`text-[10px] mono font-bold tracking-widest ${selectedCar.id === car.id ? 'text-blue-500' : 'text-gray-500'}`}>
                      {car.tag}
                    </span>
                    {selectedCar.id === car.id && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <h4 className="font-bold text-2xl mb-2">{car.name}</h4>
                  <p className="text-[10px] text-gray-500 uppercase mono tracking-tighter">{car.specs}</p>
                </button>
              ))}
            </div>
            <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-[#050505] to-transparent pointer-events-none" />
          </div>
        </div>
      </section>

      {/* 2. 虚拟展厅展示区 */}
      <section className="space-y-16">
        <header className="space-y-4 border-l-4 border-white/20 pl-8">
          <h1 className="text-6xl font-black tracking-tight uppercase leading-none">虚拟展厅工作室</h1>
          <p className="text-gray-400 max-w-xl text-lg font-light leading-relaxed">全方位的车辆细节查验系统。支持 36 帧高采样旋转展示，模拟真实展厅交互逻辑。</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-8">
            <div className="p-2 bg-white/5 border border-white/10 rounded-[3rem] shadow-2xl">
              <ImageSequencePlayer />
              <div className="p-6 flex justify-between items-center text-[10px] mono text-gray-500 uppercase tracking-widest">
                <span>INTERACTIVE_360_VIEW</span>
                <span>DRAG_TO_ROTATE_MESH</span>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-4 space-y-12 h-full">
            <div className="space-y-4">
              <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white/20">Pipeline_Steps</h3>
              <div className="h-[520px] overflow-y-auto pr-6 space-y-10 no-scrollbar scroll-smooth">
                {[
                  { title: '高精建模重拓扑', desc: '采用工业级网格优化算法，在保证曲面法线完美的同时减少 90% 的渲染开销。', img: 'https://picsum.photos/seed/ta1/300/200' },
                  { title: '物理材质开发', desc: '定制清漆层、底漆与颗粒感三层车漆 Shader，实现真实的各向异性高光。', img: 'https://picsum.photos/seed/ta2/300/200' },
                  { title: '照明方案设计', desc: '模拟专业汽车摄影棚，使用 4K IBL 与动态辅助光，捕捉每一处车身流线。', img: 'https://picsum.photos/seed/ta3/300/200' },
                  { title: '着色器调优', desc: '针对移动端与 Web 端优化的 GLSL 代码，确保在低端设备上亦有流畅体验。', img: 'https://picsum.photos/seed/ta4/300/200' },
                  { title: '后期特效调优', desc: '集成 SSAO、SSR 与自定义 Tonemapping，复刻顶级商业广告视觉质感。', img: 'https://picsum.photos/seed/ta5/300/200' },
                ].map((step, idx) => (
                  <div key={idx} className="group relative space-y-4">
                    <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black transition-all duration-700 group-hover:border-blue-500/30">
                      <img src={step.img} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000" alt={step.title} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-4 left-6 text-white font-bold text-sm tracking-widest">STEP_{idx+1}</div>
                    </div>
                    <div className="pl-2">
                      <h5 className="font-bold text-xl mb-2 group-hover:text-blue-400 transition-colors">{step.title}</h5>
                      <p className="text-sm text-gray-500 leading-relaxed font-light">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AutoVision;
