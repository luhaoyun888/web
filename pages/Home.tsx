
import React from 'react';
import { Link } from 'react-router-dom';
import Viewer360 from '../components/Viewer360';

const Home: React.FC = () => {
  return (
    <div className="flex flex-col">
      {/* Hero Section with 360 Viewer */}
      <section className="relative">
        <Viewer360 />
      </section>

      {/* Navigation Cards */}
      <section className="max-w-7xl mx-auto px-6 py-24 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Link to="/auto-vision" className="group relative overflow-hidden aspect-[4/5] bg-neutral-900 border border-white/5 rounded-2xl p-8 flex flex-col justify-end transition-all hover:border-blue-500/50">
            <div className="absolute top-8 right-8 text-white/20 text-4xl font-black mono group-hover:text-blue-500/40 transition-colors">01</div>
            <h3 className="text-2xl font-bold tracking-tight mb-2 group-hover:text-blue-400">汽车视觉</h3>
            <p className="text-gray-400 text-sm leading-relaxed">引领实时汽车可视化和交互式车辆体验的前沿技术。</p>
            <div className="mt-6 w-10 h-0.5 bg-white/20 group-hover:w-full transition-all duration-500"></div>
          </Link>

          <Link to="/ai-lab" className="group relative overflow-hidden aspect-[4/5] bg-neutral-900 border border-white/5 rounded-2xl p-8 flex flex-col justify-end transition-all hover:border-purple-500/50">
            <div className="absolute top-8 right-8 text-white/20 text-4xl font-black mono group-hover:text-purple-500/40 transition-colors">02</div>
            <h3 className="text-2xl font-bold tracking-tight mb-2 group-hover:text-purple-400">AI 实验室</h3>
            <p className="text-gray-400 text-sm leading-relaxed">探索 ComfyUI 工作流、神经渲染和生成式技术美术管线。</p>
            <div className="mt-6 w-10 h-0.5 bg-white/20 group-hover:w-full transition-all duration-500"></div>
          </Link>

          <Link to="/dev-log" className="group relative overflow-hidden aspect-[4/5] bg-neutral-900 border border-white/5 rounded-2xl p-8 flex flex-col justify-end transition-all hover:border-emerald-500/50">
            <div className="absolute top-8 right-8 text-white/20 text-4xl font-black mono group-hover:text-emerald-500/40 transition-colors">03</div>
            <h3 className="text-2xl font-bold tracking-tight mb-2 group-hover:text-emerald-400">技术日志</h3>
            <p className="text-gray-400 text-sm leading-relaxed">技术见解、脚本优化以及资产管线自动化开发笔记。</p>
            <div className="mt-6 w-10 h-0.5 bg-white/20 group-hover:w-full transition-all duration-500"></div>
          </Link>
        </div>
      </section>

      {/* Featured Quote */}
      <section className="bg-white/5 py-24 border-y border-white/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-5xl font-light tracking-tight italic text-gray-300 leading-tight">
                "通过 <span className="text-white font-bold not-italic">技术美术</span> 弥合原始计算与审美完美之间的鸿沟。"
            </h2>
        </div>
      </section>
    </div>
  );
};

export default Home;
