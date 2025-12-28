
import React, { useState, useEffect, useRef } from 'react';
import ImageSlider from '../components/ImageSlider';
import ImageSequencePlayer from '../components/ImageSequencePlayer';
import ImagePreview from '../components/ImagePreview';

// 车型配置（根据实际文件夹和名称修改）
interface CarType {
  id: string;
  name: string;
  folder: string;
}

const CAR_TYPES: CarType[] = [
  { id: 'car-01', name: '仰望U9', folder: 'car-01' },
  { id: 'car-02', name: '零跑T03', folder: 'car-02' },
  { id: 'car-03', name: 'AION S', folder: 'car-03' },
  { id: 'car-04', name: '熊猫MINI', folder: 'car-04' },
  { id: 'car-05', name: '别克E5', folder: 'car-05' },
  { id: 'car-06', name: '蔚来萤火虫', folder: 'car-06' },
  { id: 'car-07', name: '零跑B10', folder: 'car-07' },
  { id: 'car-08', name: '五菱缤果', folder: 'car-08' },
  { id: 'car-09', name: '小鹏G7', folder: 'car-09' },
  { id: 'car-10', name: '别克GL8', folder: 'car-10' },
  { id: 'car-11', name: '阿维塔06', folder: 'car-11' },
  { id: 'car-12', name: '享界S9', folder: 'car-12' },
  { id: 'car-13', name: '小米YU7', folder: 'car-13' },
];

// 获取图片路径的辅助函数
const getCarImagePath = (carFolder: string, imageName: string) => {
  return `/images/cars/${carFolder}/${imageName}.jpg`;
};

// 获取缩略图路径（用于后备方案）
const getCarThumbnailPath = (carFolder: string, imageName: string) => {
  return `/images/cars/${carFolder}/${imageName}_thumb.jpg`;
};

// 获取缩略图路径
const getThumbnailPath = (carFolder: string, index: number) => {
  return `/images/cars/${carFolder}/thumbnails/${index}.jpg`;
};

const AutoVision: React.FC = () => {
  // 车型列表：直接使用配置的 CAR_TYPES（即使文件夹为空也会显示）
  const [selectedCar, setSelectedCar] = useState<CarType>(CAR_TYPES[0]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [visibleCards, setVisibleCards] = useState<Set<number>>(new Set([0, 1, 2, 3, 4])); // 初始可见的卡片索引
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const leftContentRef = useRef<HTMLDivElement>(null);
  const rightContentRef = useRef<HTMLDivElement>(null);
  
  // 虚拟展厅控制状态
  const [showroomBackground, setShowroomBackground] = useState<string>('#ffffff');
  const [showroomBgImage, setShowroomBgImage] = useState<string>('');
  const [carScale, setCarScale] = useState<number>(1.0);

  // 同步左右两侧高度
  useEffect(() => {
    const syncHeights = () => {
      if (leftContentRef.current && rightContentRef.current) {
        const leftHeight = leftContentRef.current.offsetHeight;
        if (leftHeight > 0) {
          rightContentRef.current.style.height = `${leftHeight}px`;
        }
      }
    };

    // 延迟执行以确保 DOM 已渲染
    const timeoutId = setTimeout(syncHeights, 100);
    window.addEventListener('resize', syncHeights);
    
    // 使用 MutationObserver 监听内容变化
    const observer = new MutationObserver(() => {
      setTimeout(syncHeights, 50);
    });
    
    if (leftContentRef.current) {
      observer.observe(leftContentRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }

    // 使用 ResizeObserver 监听左侧内容大小变化
    let resizeObserver: ResizeObserver | null = null;
    if (leftContentRef.current) {
      resizeObserver = new ResizeObserver(() => {
        syncHeights();
      });
      resizeObserver.observe(leftContentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', syncHeights);
      observer.disconnect();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [showroomBackground, showroomBgImage, carScale]);

  // 使用 Intersection Observer 实现懒加载
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = cardRefs.current.indexOf(entry.target as HTMLButtonElement);
            if (index !== -1) {
              setVisibleCards((prev) => new Set(prev).add(index));
            }
          }
        });
      },
      { rootMargin: '50px' } // 提前50px开始加载
    );

    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => {
      cardRefs.current.forEach((card) => {
        if (card) observer.unobserve(card);
      });
    };
  }, []);

  // 预设背景选项
  const backgroundPresets = [
    { name: '默认白色', value: '#ffffff', type: 'color' },
    { name: '深灰', value: '#1a1a1a', type: 'color' },
    { name: '深蓝', value: '#0a1428', type: 'color' },
    { name: '黑色', value: '#0a0a0a', type: 'color' },
    { name: '自定义图片', value: '', type: 'image' },
  ];

  const handleBackgroundChange = (preset: typeof backgroundPresets[0]) => {
    if (preset.type === 'color') {
      setShowroomBackground(preset.value);
      setShowroomBgImage('');
    } else {
      // 触发文件选择
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setShowroomBgImage(event.target?.result as string);
            setShowroomBackground('#ffffff');
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-24 space-y-48">
      {/* 1. 配置器引擎对比区 */}
      <section className="space-y-16">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-l-4 border-blue-500 pl-8">
          <div className="space-y-4">
            <h1 className="text-6xl font-black tracking-tight uppercase leading-none">
              场景化 <span className="text-blue-500">AI</span>
            </h1>
            <p className="text-gray-400 max-w-xl text-lg font-light leading-relaxed">
              利用 AI 工具，将棚拍汽车处理成外拍图，在效率与效果上达成平衡。
        
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] mono text-blue-500 uppercase tracking-[0.3em] mb-2">SYSTEM_STATUS</span>
            <div className="px-4 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400 mono text-xs">
              SELECTED: {selectedCar.folder} // {selectedCar.name}
            </div>
          </div>
        </header>

        <div className="space-y-12">
          {/* 上方：左右分栏布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* 左侧：对比滑动区域 (1125:1200) */}
            <div className="lg:col-span-2 flex flex-col h-full">
              <div className="group relative rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/5 bg-neutral-900 p-2 h-full">
                <ImageSlider 
                  before={getCarImagePath(selectedCar.folder, 'before')} 
                  after={getCarImagePath(selectedCar.folder, 'after')} 
                  beforeThumb={getCarThumbnailPath(selectedCar.folder, 'before')}
                  afterThumb={getCarThumbnailPath(selectedCar.folder, 'after')}
                  labelBefore="原图"
                  labelAfter="合成图"
                  aspectRatio="1125/1200"
                />
              </div>
            </div>

            {/* 右侧：小图片网格 (5:3) - 3张图片，无标题 */}
            <div className="lg:col-span-1 flex flex-col h-full">
              <div className="grid grid-cols-1 grid-rows-3 gap-2 h-full">
                {[1, 2, 3].map((index) => (
                  <div 
                    key={index}
                    className="relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900 cursor-pointer hover:border-blue-500/50 transition-all group h-full"
                    onClick={() => setPreviewImage(getThumbnailPath(selectedCar.folder, index))}
                  >
                    <img 
                      src={getThumbnailPath(selectedCar.folder, index)} 
                      alt={`Detail ${index}`}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 text-white text-xs mono opacity-0 group-hover:opacity-100 transition-opacity">
                      DETAIL_{index}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 下方：车型选择卡片 - 缩小密集版本 */}
          <div className="relative mt-12">
            <div className="flex overflow-x-auto pb-4 space-x-3 scrollbar-hide snap-x">
              {CAR_TYPES.map((car, index) => (
                <button
                  key={car.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  onClick={() => setSelectedCar(car)}
                  className={`flex-shrink-0 w-32 snap-start p-3 rounded-xl border transition-all duration-500 ${
                    selectedCar.id === car.id 
                    ? 'border-blue-500 bg-blue-500/5 shadow-[0_4px_20px_rgba(59,130,246,0.1)]' 
                    : 'border-white/5 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[8px] mono font-bold tracking-widest ${selectedCar.id === car.id ? 'text-blue-500' : 'text-gray-500'}`}>
                      {car.id.toUpperCase()}
                    </span>
                    {selectedCar.id === car.id && (
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                  <h4 className="font-bold text-sm mb-2 line-clamp-1">{car.name}</h4>
                  <div className="relative aspect-video rounded-md overflow-hidden bg-neutral-800">
                    {visibleCards.has(CAR_TYPES.indexOf(car)) ? (
                      <img 
                        src={getCarImagePath(car.folder, 'main')} 
                        alt={car.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-[#050505] to-transparent pointer-events-none" />
          </div>
        </div>
      </section>

      {/* 图片预览模态框 */}
      {previewImage && (
        <ImagePreview
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
          title={previewImage.split('/').pop() || '图片预览'}
        />
      )}

      {/* 2. 虚拟展厅展示区 */}
      <section className="space-y-16">
        <header className="space-y-4 border-l-4 border-white/20 pl-8">
          <h1 className="text-6xl font-black tracking-tight uppercase leading-none">虚拟展厅</h1>
          <p className="text-gray-400 max-w-xl text-lg font-light leading-relaxed">全方位的车辆细节查验系统。支持 36 张图旋转展示，模拟真实展厅交互逻辑。通过自动脚本大幅加快制作进度，具体交付展示效果可查看懂车帝官网。</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-8 flex flex-col">
            <div className="flex flex-col space-y-6" ref={leftContentRef}>
              <div className="p-2 bg-white/5 border border-white/10 rounded-[3rem] shadow-2xl">
                <ImageSequencePlayer 
                  backgroundColor={showroomBackground}
                  backgroundImage={showroomBgImage}
                  carScale={carScale}
                />
                <div className="p-6 flex justify-between items-center text-[10px] mono text-gray-500 uppercase tracking-widest">
                  <span>INTERACTIVE_360_VIEW</span>
                  <span>DRAG_TO_ROTATE_MESH</span>
                </div>
              </div>

              {/* 控制面板 */}
              <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-6">
              <h3 className="text-lg font-bold mono uppercase tracking-wider">展厅设置</h3>
              
              {/* 背景选择 */}
              <div className="space-y-3">
                <label className="text-sm text-gray-400 mono uppercase">背景设置</label>
                <div className="flex flex-wrap gap-2">
                  {backgroundPresets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleBackgroundChange(preset)}
                      className={`px-4 py-2 rounded-lg border text-xs mono transition-all ${
                        (preset.type === 'color' && showroomBackground === preset.value) ||
                        (preset.type === 'image' && showroomBgImage)
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
                      }`}
                      style={preset.type === 'color' ? { backgroundColor: preset.value } : {}}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                {showroomBgImage && (
                  <button
                    onClick={() => {
                      setShowroomBgImage('');
                      setShowroomBackground('#ffffff');
                    }}
                    className="text-xs text-red-400 hover:text-red-300 mono"
                  >
                    清除自定义背景
                  </button>
                )}
              </div>

              {/* 缩放控制 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-gray-400 mono uppercase">汽车缩放</label>
                  <span className="text-sm mono text-blue-400">{carScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={carScale}
                  onChange={(e) => setCarScale(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mono">
                  <span>0.5x</span>
                  <span>1.0x</span>
                  <span>2.0x</span>
                </div>
                <button
                  onClick={() => setCarScale(1.0)}
                  className="text-xs text-gray-400 hover:text-white mono"
                >
                  重置为默认大小
                </button>
              </div>
            </div>
            </div>
          </div>
          
          <div className="lg:col-span-4 flex flex-col" ref={rightContentRef}>
            <div className="flex flex-col" style={{ height: '100%' }}>
              <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white/20 mb-4 flex-shrink-0">Pipeline_Steps</h3>
              <div className="flex-1 overflow-y-auto pr-6 space-y-10 scroll-smooth" style={{ minHeight: 0, maxHeight: '100%' }}>
                {[
                  { title: 'AI 模型抠图', desc: '利用 AI 模型进行识别使用python代码做成软件，可以批量抠图，识别效果出众。', img: '/images/workflow/ta1.jpg' },
                  { title: 'PS 插件开发', desc: '制作ps脚本，配合ps得功能可以批量处理psd文档。', img: '/images/workflow/ta2.jpg' },
                  { title: '格式化文件结构', desc: '格式化文件结构，方便多个车型同时运行，任意流转交接。', img: '/images/workflow/ta3.jpg' },
                  { title: '自动化动作', desc: 'ps录制匹配动作，各种情况都可一键解决。', img: '/images/workflow/ta4.jpg' },
                ].map((step, idx) => (
                  <div key={idx} className="group relative space-y-4">
                    <div 
                      className="relative aspect-video rounded-3xl overflow-hidden border border-white/10 bg-black transition-all duration-700 group-hover:border-blue-500/30 cursor-pointer"
                      onClick={() => setPreviewImage(step.img)}
                    >
                      <img 
                        src={step.img} 
                        className="w-full h-full object-cover opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-1000" 
                        alt={step.title}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
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
