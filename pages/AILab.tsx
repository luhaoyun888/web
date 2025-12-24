
import React, { useState } from 'react';

const AILab: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const workflows = [
    { title: "Flux 纹理合成", img: "https://picsum.photos/seed/flux1/800/800", nodeImg: "https://picsum.photos/seed/node1/1000/600", desc: "使用扩散模型生成 8K PBR 材质的复杂图表。" },
    { title: "神经风格迁移 2.0", img: "https://picsum.photos/seed/flux2/800/800", nodeImg: "https://picsum.photos/seed/node2/1000/600", desc: "针对电影视频素材的临时稳定风格迁移。" },
    { title: "程序化景观", img: "https://picsum.photos/seed/flux3/800/800", nodeImg: "https://picsum.photos/seed/node3/1000/600", desc: "通过自定义 ControlNet 钩子自动化环境艺术资产。" },
    { title: "角色骨骼绑定生成", img: "https://picsum.photos/seed/flux4/800/800", nodeImg: "https://picsum.photos/seed/node4/1000/600", desc: "实验使用深度感知机器学习生成权重图。" },
    { title: "汽车 HDRi 生成", img: "https://picsum.photos/seed/flux5/800/800", nodeImg: "https://picsum.photos/seed/node5/1000/600", desc: "为影棚灯光生成高动态范围环境。" },
    { title: "VFX 粒子 AI", img: "https://picsum.photos/seed/flux6/800/800", nodeImg: "https://picsum.photos/seed/node6/1000/600", desc: "利用光流和扩散模型生成的流图。" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="mb-16">
        <div className="flex items-center space-x-4 mb-4">
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
            <h1 className="text-6xl font-black tracking-tighter uppercase">AI 实验室</h1>
        </div>
        <p className="text-gray-400 max-w-2xl text-lg leading-relaxed">
          机器学习与视觉制作的交汇点。探索程序化生成、基于扩散的流水线和自动化工作流的新前沿。
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map((wf, idx) => (
          <div 
            key={idx} 
            className="group relative bg-neutral-900 border border-white/5 rounded-xl overflow-hidden cursor-pointer"
            onClick={() => setSelectedImage(wf.nodeImg)}
          >
            <div className="aspect-square overflow-hidden">
                <img src={wf.img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 grayscale group-hover:grayscale-0" alt={wf.title} />
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-1 group-hover:text-purple-400 transition-colors">{wf.title}</h3>
              <p className="text-xs text-gray-500 mb-4">{wf.desc}</p>
              <div className="flex items-center space-x-2 text-[10px] mono text-gray-400">
                <span className="px-2 py-0.5 border border-white/10 rounded">COMFYUI</span>
                <span className="px-2 py-0.5 border border-white/10 rounded">SDXL</span>
              </div>
            </div>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </div>
            </div>
          </div>
        ))}
      </div>

      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl w-full">
            <img src={selectedImage} className="w-full h-auto rounded-xl border border-white/20 shadow-2xl" alt="Workflow Details" />
            <button className="absolute -top-12 right-0 text-white font-bold mono">关闭查看器 [X]</button>
            <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg text-xs mono text-gray-400 uppercase tracking-widest">
              ComfyUI 节点图: [ {selectedImage.split('/').pop()} ]
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AILab;
