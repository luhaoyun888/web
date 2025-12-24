
import React from 'react';

const DevLog: React.FC = () => {
  const posts = [
    {
      date: "2024年10月12日",
      title: "优化 WebGL 的网格压缩",
      content: "在处理复杂的汽车 CAD 数据时，Draco 压缩通常是首选。然而，为了实现实时交互，我们发现量化处理...",
      code: "const draco = new DRACOLoader();\ndraco.setDecoderPath('/wasm/');\nloader.setDRACOLoader(draco);",
      tags: ["性能优化", "WebGL", "JS"]
    },
    {
      date: "2024年09月28日",
      title: "针对 ComfyUI API 的 Python 自动化",
      content: "利用 ComfyUI 的 websocket 接口自动化批量生成纹理。该脚本允许我们输入提示词列表并直接获取结果...",
      code: "def queue_prompt(prompt):\n    p = {\"prompt\": prompt}\n    data = json.dumps(p).encode('utf-8')\n    req =  request.Request(\"http://localhost:8188/prompt\", data=data)",
      tags: ["Python", "自动化", "AI"]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-20">
        <h1 className="text-6xl font-black tracking-tighter uppercase mb-4">技术日志</h1>
        <p className="text-gray-400 text-lg mono font-light">
          $ tail -f tech_art_notes.log
        </p>
      </header>

      <div className="space-y-24">
        {posts.map((post, idx) => (
          <article key={idx} className="group">
            <div className="flex items-center space-x-4 mb-4">
              <span className="text-xs mono text-emerald-500 font-bold">{post.date}</span>
              <div className="h-[1px] flex-grow bg-white/10" />
            </div>
            <h2 className="text-3xl font-bold mb-6 group-hover:text-emerald-400 transition-colors">{post.title}</h2>
            <div className="prose prose-invert max-w-none mb-8">
              <p className="text-gray-400 leading-relaxed text-lg">{post.content}</p>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-xl p-6 mb-8 font-mono text-sm overflow-hidden relative">
              <div className="absolute top-4 right-4 text-xs text-white/20 uppercase">代码片段</div>
              <pre className="text-emerald-300">
                <code>{post.code}</code>
              </pre>
            </div>
            <div className="flex items-center space-x-3">
              {post.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] mono border border-emerald-500/30 rounded uppercase">
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default DevLog;
