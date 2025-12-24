
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { SKILLS, TIMELINE } from '../constants';

const About: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
        {/* Left Column: Story */}
        <section>
          <header className="mb-12">
            <h1 className="text-6xl font-black tracking-tighter uppercase mb-8">关于我</h1>
            <div className="flex items-center space-x-6 mb-8">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500 p-1">
                <img src="https://picsum.photos/seed/portrait/200/200" className="w-full h-full object-cover rounded-full" alt="Profile" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Alex Chen</h2>
                <p className="text-blue-500 mono text-sm uppercase">技术美术师 / 工具架构师</p>
              </div>
            </div>
            <p className="text-gray-400 text-lg leading-relaxed mb-6">
              我专注于弥合高端视觉设计与复杂工程管线之间的差距。我的工作集中在实时渲染效率、资产工作流自动化，以及利用生成式 AI 提高创意生产力。
            </p>
            <p className="text-gray-400 text-lg leading-relaxed">
              凭借视觉传达和编程脚本的双重背景，我对如何构建艺术家喜爱且开发者信任的工具和系统有着独特的见解。
            </p>
          </header>

          <div className="space-y-12">
            <h3 className="text-xl font-bold mono uppercase border-b border-white/10 pb-2">职业生涯时间轴</h3>
            <div className="space-y-8">
              {TIMELINE.map((item, idx) => (
                <div key={idx} className="relative pl-8 border-l border-blue-500/30 pb-4">
                  <div className="absolute top-0 left-[-4px] w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs mono text-blue-500 font-bold mb-1 block">{item.year}</span>
                  <h4 className="text-lg font-bold text-white">{item.title}</h4>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Skills & Tech */}
        <section className="space-y-16">
          <div className="bg-neutral-900 border border-white/5 rounded-2xl p-8">
            <h3 className="text-xl font-bold mono uppercase mb-8 text-center">能力光谱</h3>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={SKILLS}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#999', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="能力值"
                    dataKey="A"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.4}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-xs mono text-blue-500 mb-2 font-bold">工具箱_01</h4>
                <p className="text-sm text-gray-300">Blender, Houdini, Substance Designer, Unreal Engine 5</p>
            </div>
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-xs mono text-blue-500 mb-2 font-bold">工具箱_02</h4>
                <p className="text-sm text-gray-300">Python, C++, JavaScript (Three.js), Shader Graph</p>
            </div>
          </div>

          <button className="w-full py-4 border-2 border-white text-white font-black tracking-widest uppercase hover:bg-white hover:text-black transition-all group flex items-center justify-center space-x-4">
            <span>下载个人简历 [PDF]</span>
            <svg className="w-5 h-5 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </section>
      </div>
    </div>
  );
};

export default About;
