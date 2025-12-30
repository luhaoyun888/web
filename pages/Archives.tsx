
import React, { useState } from 'react';
import ImagePreview from '../components/ImagePreview';

const ARCHIVE_DATA = {

  "UI 原型探索": [
    { id: 7, url: '/images/archives/ui/1.jpg' },
    { id: 8, url: '/images/archives/ui/2.jpg' },
    { id: 9, url: '/images/archives/ui/3.jpg' },
    { id: 10, url: '/images/archives/ui/4.jpg' },
    { id: 7, url: '/images/archives/ui/5.jpg' },
    { id: 8, url: '/images/archives/ui/6.jpg' },
    { id: 9, url: '/images/archives/ui/7.jpg' },
    { id: 10, url: '/images/archives/ui/8.jpg' },
    { id: 10, url: '/images/archives/ui/9.jpg' },
  ],
  "视觉传达项目": [
    { id: 11, url: '/images/archives/vc/1.jpg' },
    { id: 12, url: '/images/archives/vc/2.jpg' },
    { id: 13, url: '/images/archives/vc/3.jpg' },
    { id: 14, url: '/images/archives/vc/4.jpg' },
    { id: 15, url: '/images/archives/vc/5.jpg' },
    { id: 16, url: '/images/archives/vc/6.jpg' },
    { id: 17, url: '/images/archives/vc/7.jpg' },
    { id: 18, url: '/images/archives/vc/8.jpg' },
    { id: 19, url: '/images/archives/vc/9.jpg' },
    { id: 20, url: '/images/archives/vc/10.jpg' },
    { id: 21, url: '/images/archives/vc/11.jpg' },
    { id: 22, url: '/images/archives/vc/12.jpg' },
    { id: 21, url: '/images/archives/vc/14.jpg' },
    { id: 22, url: '/images/archives/vc/15.jpg' },
  ],
  "早期写生": [
    { id: 1, url: '/images/archives/sketch/1.jpg' },
    { id: 2, url: '/images/archives/sketch/2.jpg' },

  ]
};

const Archives: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<keyof typeof ARCHIVE_DATA>("UI 原型探索");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

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
        {ARCHIVE_DATA[activeCategory].map((item, index) => (
          <div 
            key={`${activeCategory}-${item.id}-${index}`} 
            className="break-inside-avoid group relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900 cursor-pointer"
            onClick={() => setPreviewImage(item.url)}
          >
            <img 
              src={item.url} 
              alt="Archive" 
              className="w-full h-auto transition-all duration-700 hover:scale-105" 
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23222" width="400" height="400"/%3E%3Ctext fill="%23666" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-family="monospace" font-size="12"%3E图片未找到%3C/text%3E%3C/svg%3E';
              }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-[10px] mono text-white font-bold border border-white/20 px-3 py-1 bg-black/50 backdrop-blur">
                REF_IDX_{item.id}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 图片预览模态框 */}
      {previewImage && (
        <ImagePreview
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
          title={`REF_IDX_${ARCHIVE_DATA[activeCategory].find(item => item.url === previewImage)?.id || ''}`}
        />
      )}
    </div>
  );
};

export default Archives;
