
import React from 'react';
import { Link } from 'react-router-dom';
import InteractiveBackground from '../components/InteractiveBackground';

const ChipCard = ({ to, num, title, desc, accentColor, glowColor }: any) => {
  return (
    <Link 
      to={to} 
      className="group relative block w-full aspect-[4/5] bg-[#080808] rounded-2xl overflow-hidden border border-white/5 transition-all duration-700 hover:-translate-y-4 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]"
    >
      {/* 边框流光效果 */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700`}>
        <div className={`absolute inset-0 bg-gradient-to-r ${glowColor} opacity-10`} />
        <div className={`absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-current to-transparent ${accentColor} animate-[scan_2s_linear_infinite]`} />
        <div className={`absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-current to-transparent ${accentColor} animate-[scan_2s_linear_infinite_reverse]`} />
      </div>

      {/* 芯片线路背景 */}
      <div className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-all duration-700 group-hover:scale-110">
        <svg className="w-full h-full" viewBox="0 0 400 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 400L100 400L150 450" stroke="currentColor" className={accentColor} strokeWidth="0.5" />
          <path d="M400 100L300 100L250 50" stroke="currentColor" className={accentColor} strokeWidth="0.5" />
          <rect x="50" y="50" width="300" height="400" stroke="currentColor" className={accentColor} strokeWidth="0.2" strokeDasharray="4 4" />
          <circle cx="150" cy="450" r="2" className={`fill-current ${accentColor}`} />
          <circle cx="250" cy="50" r="2" className={`fill-current ${accentColor}`} />
        </svg>
      </div>

      {/* 核心扫描线 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`w-full h-1/2 bg-gradient-to-b from-transparent ${accentColor.replace('text-', 'via-')}/5 to-transparent absolute -top-full group-hover:top-full transition-all duration-[1.5s] ease-in-out`} />
      </div>

      {/* 顶部指示灯 */}
      <div className="absolute top-8 left-8 flex space-x-1.5 z-20">
        {[1, 2, 3].map(i => (
          <div 
            key={i} 
            className={`w-1.5 h-1.5 rounded-full ${accentColor.replace('text-', 'bg-')} shadow-[0_0_10px_currentColor] animate-pulse`} 
            style={{ animationDelay: `${i * 0.4}s` }} 
          />
        ))}
      </div>

      {/* 编号 */}
      <div className="absolute top-6 right-8 text-6xl font-black italic mono text-white/[0.03] group-hover:text-white/[0.08] transition-colors duration-700">
        {num}
      </div>

      {/* 底部内容区 */}
      <div className="absolute inset-x-8 bottom-10 z-20">
        <div className="flex items-center space-x-2 mb-4">
          <div className={`h-px w-8 ${accentColor.replace('text-', 'bg-')} group-hover:w-16 transition-all duration-500`} />
          <span className={`text-[10px] mono tracking-[0.3em] ${accentColor}`}>MODULE_INIT</span>
        </div>
        
        <h3 className="text-4xl font-bold tracking-tighter text-white mb-4 group-hover:translate-x-2 transition-transform duration-500">
          {title}
        </h3>
        
        <p className="text-gray-500 text-sm leading-relaxed max-w-[240px] group-hover:text-gray-300 transition-colors duration-500">
          {desc}
        </p>

        <div className="mt-10 flex items-center justify-between opacity-40 group-hover:opacity-100 transition-all duration-500">
          <div className="flex -space-x-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-4 h-1 border border-white/20 ${i <= 2 ? accentColor.replace('text-', 'bg-') : ''}`} />
            ))}
          </div>
          <div className="flex items-center text-[10px] mono tracking-widest text-white">
            <span>ACCESS</span>
            <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </div>
      </div>

      {/* 装饰内切角 */}
      <div className={`absolute top-0 right-0 w-12 h-12 bg-white/5 group-hover:${accentColor.replace('text-', 'bg-')}/20 transition-colors duration-500`} style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
    </Link>
  );
};

const Home: React.FC = () => {
  // 添加调试信息
  React.useEffect(() => {
    console.log('Home 组件已渲染');
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">
      <style>{`
        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      
      <InteractiveBackground />
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/90 pointer-events-none z-[1]" />

      <div className="relative z-10 pt-40 pb-24 px-6 max-w-7xl mx-auto flex flex-col min-h-screen">
        <div className="mb-24 animate-in fade-in slide-in-from-bottom-12 duration-1000">
          <div className="inline-flex items-center space-x-3 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 mono text-[10px] tracking-[0.4em] uppercase mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span>ALREADY_DEPLOYED_ONLINE // v2.5.0</span>
          </div>
          
          <h1 className="text-8xl md:text-[10rem] font-black tracking-tighter uppercase leading-[0.85] mb-8">
            陆文浩<br/>
            <span className="text-transparent md:text-[8rem] bg-clip-text bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-500">在线简历</span>
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-end">
            <p className="text-gray-400 text-xl md:text-2xl leading-relaxed max-w-2xl font-light">
            擅长原画及AI生成图像的后期处理，包括图像拆分、补图与优化，以适配动画、特效及程序开发需求；后主导与懂车帝项目的全流程管理，负责需求对接、进度把控与自动化流程搭建，有效提升团队效率与交付质量。
            </p>
            <div className="flex flex-wrap gap-12 text-base mono uppercase text-gray-500 tracking-[0.2em]">
              <div className="space-y-2">
                <span className="text-white/30 block">Location</span>
                <span className="text-white">河北省保定市</span>
              </div>
              <div className="space-y-2">
                <span className="text-white/30 block">Telephone</span>
                <span className="text-white">18831228974</span>
              </div>
              <div className="space-y-2">
                <span className="text-white/30 block">Email</span>
                <span className="text-white animate-pulse">1192529877@qq.com</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mt-auto mb-16">
          <ChipCard 
            to="/auto-vision" 
            num="01" 
            title="商业汽车视觉" 
            desc="高精度场景合成与 Web 360° 交互展示。将 4A 级商业美图标准与前端开发技术结合，打造沉浸式看车体验。" 
            accentColor="text-blue-500"
            glowColor="from-blue-500/20"
          />
          <ChipCard 
            to="/ai-lab" 
            num="02" 
            title="AI 实验室" 
            desc="基于资产定义的可控图像与视频生成。利用AI工具与制作工作流，实现视觉资产的自动化量产。" 
            accentColor="text-purple-500"
            glowColor="from-purple-500/20"
          />
          <ChipCard 
            to="/archives" 
            num="03" 
            title="视觉存档" 
            desc="早期概念探索与 UI 演化过程。记录从 0 到 1 的审美构建逻辑。" 
            accentColor="text-emerald-500"
            glowColor="from-emerald-500/20"
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
