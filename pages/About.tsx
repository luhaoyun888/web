
import React from 'react';
import { TimelineItem } from '../types';

// 简历文件路径配置 - 指向 public 目录下的文件
// 文件应放置在：public/resume.pdf
const RESUME_FILE_PATH = '/1_简历.docx';
const RESUME_DOWNLOAD_NAME = '陆文浩_简历.docx';

const About: React.FC = () => {
  const TIMELINE: TimelineItem[] = [
    { year: '2024', title: '懂车帝车型库修图项目', description: '领导视觉制作流水线，负责从需求对接到交付得全流程把控。开发效率工具加速后期进程，利用ai技术完成高效高质量效果图库得制作。场景化头图项目中从一天一张加速到一天3张图片交付。', icon: 'Zap' },
    { year: '2022', title: '游戏资产处理', description: '将游戏资产进行拆分、补图、适配，为动画、特效及程序开发提供高质量素材。', icon: 'Code' },
    { year: '2020', title: '大学毕业', description: '视觉传达设计专业，以优异成绩毕业。', icon: 'PenTool' },
  ];

  const CORE_SKILLS = [
    { name: 'ps脚本开发', icon: '✨', status: 'Proficient', desc: 'JSX' },
    { name: 'Python 批处理软件', icon: '🐍', status: 'Proficient', desc: 'Productivity tools / API applications' },
    { name: '流程规范', icon: '🎨', status: 'Proficient', desc: 'Substance / Procedural Workflows' },
    { name: 'AI 集成', icon: '🤖', status: 'Proficient', desc: 'Stable Diffusion / ComfyUI' },
    { name: '后端开发', icon: '⛓️', status: 'Proficient', desc: 'GO / Python' },
    { name: 'AI前端应用', icon: '🌐', status: 'Proficient', desc: 'Js / Tsx' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-32">
        {/* 左侧：个人故事与履历 */}
        <section className="space-y-16">
          <header className="space-y-8">
            <h1 className="text-7xl font-black tracking-tighter uppercase">关于我</h1>
            <div className="flex items-center space-x-8">
              <div className="relative w-32 h-32">
                <div className="absolute inset-0 bg-blue-500 rounded-full blur-3xl opacity-20 animate-pulse" />
                <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/10 p-1">
                  <img 
                    src="/images/profile/alex.jpg" 
                    className="w-full h-full object-cover rounded-full transition-all duration-700 hover:scale-105" 
                    alt="Profile"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23333" width="300" height="300" rx="150"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-family="monospace" font-size="12"%3E头像%3C/text%3E%3C/svg%3E';
                    }}
                  />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-1">陆文浩</h2>
                <p className="text-blue-500 mono text-sm uppercase tracking-widest">Graphics & Code & AI Applications</p>
                <div className="mt-4 flex space-x-2">
                  <span className="w-6 h-1 rounded-full bg-blue-500"></span>
                  <span className="w-2 h-1 rounded-full bg-blue-500/40"></span>
                  <span className="w-2 h-1 rounded-full bg-blue-500/20"></span>
                </div>
              </div>
            </div>
            <div className="space-y-6 text-gray-400 text-lg leading-relaxed max-w-xl font-light">
              <p>
               期专注于原画处理与AI图像优化，通过精准的拆分、补图与适配，为动画、特效及程序开发提供高质量素材，助力提升游戏性能与用户体验。
              </p>
              <p>
                与懂车帝等重点客户的项目管理与技术支持，负责从需求对接到交付的全流程把控。通过推动工作流自动化与工具开发，显著提升团队协作与出品效率；注重文档沉淀、流程规范与知识分享，持续驱动团队能力提升与业务优化。
              </p>
              <p>
                通过现代AI技术手段，实现视觉资产得量产与优化。
              </p>
            </div>
          </header>

          <div className="space-y-12">
            <h3 className="text-xl font-bold mono uppercase border-b border-white/10 pb-4 flex items-center">
              <span className="w-1 h-6 bg-blue-500 mr-4"></span>
              职业生涯轨迹
            </h3>
            <div className="space-y-10">
              {TIMELINE.map((item, idx) => (
                <div key={idx} className="group relative pl-10 border-l border-white/5 pb-2 hover:border-blue-500/40 transition-colors">
                  <div className="absolute top-0 left-[-5px] w-2 h-2 rounded-full bg-white/20 group-hover:bg-blue-500 transition-all shadow-[0_0_10px_rgba(59,130,246,0)] group-hover:shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  <span className="text-xs mono text-blue-500 font-bold mb-2 block tracking-[0.3em] uppercase">{item.year}</span>
                  <h4 className="text-xl font-bold text-white mb-2 group-hover:translate-x-2 transition-transform duration-500">{item.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed font-light">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 右侧：技术能力与工具 */}
        <section className="space-y-12">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-[3rem] p-12 space-y-16 shadow-2xl relative overflow-hidden">
            {/* 装饰性背景 */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none" />
            
            <h3 className="text-2xl font-black mono uppercase text-center tracking-[0.5em] text-white/80">核心技术矩阵 // CORE_MATRIX</h3>
            
            {/* 模块化能力展示 - 替换进度条 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CORE_SKILLS.map((skill, idx) => (
                <div key={idx} className="group p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-blue-500/40 transition-all duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl opacity-60 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-500">{skill.icon}</span>
                    <span className="text-[10px] mono text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded tracking-tighter group-hover:bg-blue-500 group-hover:text-white transition-all">
                      {skill.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-white mb-2 tracking-tight group-hover:text-blue-400 transition-colors">
                    {skill.name}
                  </h4>
                  <p className="text-[10px] text-gray-500 uppercase mono leading-tight group-hover:text-gray-400 transition-colors">
                    {skill.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* 技术栈详细标签 */}
            <div className="grid grid-cols-1 gap-6 pt-6">
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] hover:border-blue-500/30 transition-all duration-500 group">
                <h4 className="text-[10px] mono text-blue-500 mb-6 font-bold tracking-[0.4em] group-hover:translate-x-1 transition-transform flex items-center">
                  <span className="w-4 h-px bg-current mr-3" />
                  VISUAL_ECOSYSTEM
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['PhotoShop', 'Illustrator', 'After Effects', 'SD', 'ComfyUI'].map(t => (
                    <span key={t} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-gray-400 font-mono hover:text-white hover:bg-white/10 transition-colors">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[2rem] hover:border-blue-500/30 transition-all duration-500 group">
                <h4 className="text-[10px] mono text-blue-500 mb-6 font-bold tracking-[0.4em] group-hover:translate-x-1 transition-transform flex items-center">
                  <span className="w-4 h-px bg-current mr-3" />
                  DEVELOPMENT_STACK
                </h4>
                <div className="flex flex-wrap gap-2">
                  {['Python', 'Go', '易语言'].map(t => (
                    <span key={t} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-gray-400 font-mono hover:text-white hover:bg-white/10 transition-colors">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-6">
            <button 
              onClick={async () => {
                try {
                  // 尝试下载简历文件
                  const response = await fetch(RESUME_FILE_PATH);
                  if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = RESUME_DOWNLOAD_NAME;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  } else {
                    // 如果文件不存在，提示用户
                    alert(`简历文件未找到。\n\n请将简历 PDF 文件放置在以下路径：\npublic/resume.pdf\n\n当前尝试访问：${RESUME_FILE_PATH}`);
                  }
                } catch (error) {
                  console.error('下载失败:', error);
                  alert(`下载失败：${error instanceof Error ? error.message : '未知错误'}\n\n请检查：\n1. 文件是否存在：public/resume.pdf\n2. 网络连接是否正常`);
                }
              }}
              className="group w-full py-7 bg-blue-600 rounded-[2.5rem] text-white font-black tracking-[0.5em] uppercase hover:bg-blue-500 transition-all duration-500 flex items-center justify-center space-x-6 shadow-[0_20px_40px_rgba(59,130,246,0.2)] hover:shadow-[0_25px_50px_rgba(59,130,246,0.3)] hover:-translate-y-1"
            >
              <span>下载完整简历</span>
              <svg className="w-6 h-6 transform group-hover:translate-y-1 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <div className="flex justify-center space-x-16 mono text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em]">
              <span className="flex items-center"><span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-3 animate-pulse"></span>邮箱:1192529877@qq.com</span>
              <span className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-3 animate-pulse"></span>电话:18831228974</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
