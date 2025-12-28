
import React, { useState, useRef, useEffect } from 'react';

interface ImageSliderProps {
  before: string;
  after: string;
  labelBefore?: string;
  labelAfter?: string;
  aspectRatio?: string; // 自定义比例支持
  beforeThumb?: string; // 原图缩略图（后备方案）
  afterThumb?: string; // 合成图缩略图（后备方案）
}

const ImageSlider: React.FC<ImageSliderProps> = ({ 
  before, 
  after, 
  labelBefore = "RAW", 
  labelAfter = "RENDER",
  aspectRatio = "16/9", // 默认 16:9
  beforeThumb,
  afterThumb
}) => {
  const [sliderPos, setSliderPos] = useState(50);
  const [imagesLoaded, setImagesLoaded] = useState({ before: false, after: false });
  const [imageErrors, setImageErrors] = useState({ before: false, after: false });
  const [imageTimeouts, setImageTimeouts] = useState({ before: false, after: false });
  const [useThumbnails, setUseThumbnails] = useState({ before: false, after: false });
  const [errorMessages, setErrorMessages] = useState({ before: '', after: '' });
  const [loadingPaths, setLoadingPaths] = useState({ before: '', after: '' });
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRefs = useRef<{ before: NodeJS.Timeout | null; after: NodeJS.Timeout | null }>({ before: null, after: null });

  // 预加载图片，带超时处理
  useEffect(() => {
    // 清除之前的超时
    if (timeoutRefs.current.before) clearTimeout(timeoutRefs.current.before);
    if (timeoutRefs.current.after) clearTimeout(timeoutRefs.current.after);
    
    // 重置状态
    setImagesLoaded({ before: false, after: false });
    setImageErrors({ before: false, after: false });
    setImageTimeouts({ before: false, after: false });
    setUseThumbnails({ before: false, after: false });
    setErrorMessages({ before: '', after: '' });
    setLoadingPaths({ before: before, after: after });

    const beforeImg = new Image();
    const afterImg = new Image();
    
    // 设置超时（15秒）
    const LOAD_TIMEOUT = 15000;
    
    console.log('开始加载图片:', { before, after, beforeThumb, afterThumb });
    
    // 加载 before 图片
    const beforeTimeout = setTimeout(() => {
      if (!beforeImg.complete) {
        console.warn('Before 图片加载超时:', before);
        setImageTimeouts(prev => ({ ...prev, before: true }));
        setErrorMessages(prev => ({ ...prev, before: `加载超时: ${before}` }));
        // 如果超时且有缩略图，尝试加载缩略图
        if (beforeThumb) {
          console.log('超时后尝试加载 Before 缩略图:', beforeThumb);
          setLoadingPaths(prev => ({ ...prev, before: beforeThumb }));
          const thumbImg = new Image();
          thumbImg.onload = () => {
            console.log('Before 缩略图加载成功（超时后）:', beforeThumb);
            setUseThumbnails(prev => ({ ...prev, before: true }));
            setImagesLoaded(prev => ({ ...prev, before: true }));
            setImageTimeouts(prev => ({ ...prev, before: false }));
            setErrorMessages(prev => ({ ...prev, before: '' }));
          };
          thumbImg.onerror = (thumbError) => {
            console.error('Before 缩略图加载失败（超时后）:', beforeThumb, thumbError);
            setImageErrors(prev => ({ ...prev, before: true }));
            setErrorMessages(prev => ({ ...prev, before: `原图超时，缩略图也加载失败` }));
          };
          thumbImg.src = beforeThumb;
        }
      }
    }, LOAD_TIMEOUT);
    
    beforeImg.onload = () => {
      clearTimeout(beforeTimeout);
      console.log('Before 图片加载成功:', before);
      setImagesLoaded(prev => ({ ...prev, before: true }));
      setImageTimeouts(prev => ({ ...prev, before: false }));
      setErrorMessages(prev => ({ ...prev, before: '' }));
    };
    
    beforeImg.onerror = (error) => {
      clearTimeout(beforeTimeout);
      console.error('Before 图片加载失败:', before, error);
      const errorMsg = `无法加载: ${before}`;
      setErrorMessages(prev => ({ ...prev, before: errorMsg }));
      
      // 如果原图加载失败且有缩略图，尝试加载缩略图
      if (beforeThumb) {
        console.log('尝试加载 Before 缩略图:', beforeThumb);
        setLoadingPaths(prev => ({ ...prev, before: beforeThumb }));
        const thumbImg = new Image();
        thumbImg.onload = () => {
          console.log('Before 缩略图加载成功:', beforeThumb);
          setUseThumbnails(prev => ({ ...prev, before: true }));
          setImagesLoaded(prev => ({ ...prev, before: true }));
          setErrorMessages(prev => ({ ...prev, before: '' }));
        };
        thumbImg.onerror = (thumbError) => {
          console.error('Before 缩略图也加载失败:', beforeThumb, thumbError);
          setImageErrors(prev => ({ ...prev, before: true }));
          setErrorMessages(prev => ({ ...prev, before: `原图和缩略图都加载失败` }));
        };
        thumbImg.src = beforeThumb;
      } else {
        setImageErrors(prev => ({ ...prev, before: true }));
      }
      setImageTimeouts(prev => ({ ...prev, before: false }));
    };
    
    // 加载 after 图片
    const afterTimeout = setTimeout(() => {
      if (!afterImg.complete) {
        console.warn('After 图片加载超时:', after);
        setImageTimeouts(prev => ({ ...prev, after: true }));
        setErrorMessages(prev => ({ ...prev, after: `加载超时: ${after}` }));
        // 如果超时且有缩略图，尝试加载缩略图
        if (afterThumb) {
          console.log('超时后尝试加载 After 缩略图:', afterThumb);
          setLoadingPaths(prev => ({ ...prev, after: afterThumb }));
          const thumbImg = new Image();
          thumbImg.onload = () => {
            console.log('After 缩略图加载成功（超时后）:', afterThumb);
            setUseThumbnails(prev => ({ ...prev, after: true }));
            setImagesLoaded(prev => ({ ...prev, after: true }));
            setImageTimeouts(prev => ({ ...prev, after: false }));
            setErrorMessages(prev => ({ ...prev, after: '' }));
          };
          thumbImg.onerror = (thumbError) => {
            console.error('After 缩略图加载失败（超时后）:', afterThumb, thumbError);
            setImageErrors(prev => ({ ...prev, after: true }));
            setErrorMessages(prev => ({ ...prev, after: `原图超时，缩略图也加载失败` }));
          };
          thumbImg.src = afterThumb;
        }
      }
    }, LOAD_TIMEOUT);
    
    afterImg.onload = () => {
      clearTimeout(afterTimeout);
      console.log('After 图片加载成功:', after);
      setImagesLoaded(prev => ({ ...prev, after: true }));
      setImageTimeouts(prev => ({ ...prev, after: false }));
      setErrorMessages(prev => ({ ...prev, after: '' }));
    };
    
    afterImg.onerror = (error) => {
      clearTimeout(afterTimeout);
      console.error('After 图片加载失败:', after, error);
      const errorMsg = `无法加载: ${after}`;
      setErrorMessages(prev => ({ ...prev, after: errorMsg }));
      
      // 如果原图加载失败且有缩略图，尝试加载缩略图
      if (afterThumb) {
        console.log('尝试加载 After 缩略图:', afterThumb);
        setLoadingPaths(prev => ({ ...prev, after: afterThumb }));
        const thumbImg = new Image();
        thumbImg.onload = () => {
          console.log('After 缩略图加载成功:', afterThumb);
          setUseThumbnails(prev => ({ ...prev, after: true }));
          setImagesLoaded(prev => ({ ...prev, after: true }));
          setErrorMessages(prev => ({ ...prev, after: '' }));
        };
        thumbImg.onerror = (thumbError) => {
          console.error('After 缩略图也加载失败:', afterThumb, thumbError);
          setImageErrors(prev => ({ ...prev, after: true }));
          setErrorMessages(prev => ({ ...prev, after: `原图和缩略图都加载失败` }));
        };
        thumbImg.src = afterThumb;
      } else {
        setImageErrors(prev => ({ ...prev, after: true }));
      }
      setImageTimeouts(prev => ({ ...prev, after: false }));
    };
    
    // 开始加载
    beforeImg.src = before;
    afterImg.src = after;
    
    timeoutRefs.current.before = beforeTimeout;
    timeoutRefs.current.after = afterTimeout;

    return () => {
      clearTimeout(beforeTimeout);
      clearTimeout(afterTimeout);
    };
  }, [before, after, beforeThumb, afterThumb]);

  // 重试加载图片
  const retryLoad = (type: 'before' | 'after') => {
    console.log(`重试加载 ${type} 图片`);
    setImageErrors(prev => ({ ...prev, [type]: false }));
    setImageTimeouts(prev => ({ ...prev, [type]: false }));
    setImagesLoaded(prev => ({ ...prev, [type]: false }));
    setUseThumbnails(prev => ({ ...prev, [type]: false }));
    setErrorMessages(prev => ({ ...prev, [type]: '' }));
    
    const src = type === 'before' ? before : after;
    const thumbSrc = type === 'before' ? beforeThumb : afterThumb;
    setLoadingPaths(prev => ({ ...prev, [type]: src }));
    
    const img = new Image();
    const timeout = setTimeout(() => {
      if (!img.complete) {
        console.warn(`${type} 图片重试加载超时:`, src);
        setImageTimeouts(prev => ({ ...prev, [type]: true }));
        setErrorMessages(prev => ({ ...prev, [type]: `重试加载超时: ${src}` }));
        // 如果有缩略图，尝试加载缩略图
        if (thumbSrc) {
          console.log(`重试加载 ${type} 缩略图:`, thumbSrc);
          setLoadingPaths(prev => ({ ...prev, [type]: thumbSrc }));
          const thumbImg = new Image();
          thumbImg.onload = () => {
            setUseThumbnails(prev => ({ ...prev, [type]: true }));
            setImagesLoaded(prev => ({ ...prev, [type]: true }));
            setImageTimeouts(prev => ({ ...prev, [type]: false }));
            setErrorMessages(prev => ({ ...prev, [type]: '' }));
          };
          thumbImg.onerror = () => {
            setImageErrors(prev => ({ ...prev, [type]: true }));
            setErrorMessages(prev => ({ ...prev, [type]: `重试失败，缩略图也加载失败` }));
          };
          thumbImg.src = thumbSrc;
        }
      }
    }, 15000);
    
    img.onload = () => {
      clearTimeout(timeout);
      console.log(`${type} 图片重试加载成功:`, src);
      setImagesLoaded(prev => ({ ...prev, [type]: true }));
      setImageTimeouts(prev => ({ ...prev, [type]: false }));
      setErrorMessages(prev => ({ ...prev, [type]: '' }));
    };
    
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.error(`${type} 图片重试加载失败:`, src, error);
      setImageErrors(prev => ({ ...prev, [type]: true }));
      setImageTimeouts(prev => ({ ...prev, [type]: false }));
      setErrorMessages(prev => ({ ...prev, [type]: `重试失败: ${src}` }));
      // 如果有缩略图，尝试加载缩略图
      if (thumbSrc) {
        console.log(`重试加载 ${type} 缩略图:`, thumbSrc);
        setLoadingPaths(prev => ({ ...prev, [type]: thumbSrc }));
        const thumbImg = new Image();
        thumbImg.onload = () => {
          setUseThumbnails(prev => ({ ...prev, [type]: true }));
          setImagesLoaded(prev => ({ ...prev, [type]: true }));
          setErrorMessages(prev => ({ ...prev, [type]: '' }));
        };
        thumbImg.onerror = () => {
          setImageErrors(prev => ({ ...prev, [type]: true }));
          setErrorMessages(prev => ({ ...prev, [type]: `重试失败，缩略图也加载失败` }));
        };
        thumbImg.src = thumbSrc;
      }
    };
    
    img.src = src;
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.min(100, Math.max(0, position)));
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-white/10 group cursor-col-resize select-none"
      style={{ aspectRatio }} // 使用自定义比例
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {/* After Image (Background) */}
      {imagesLoaded.after ? (
        <>
          <img 
            src={useThumbnails.after && afterThumb ? afterThumb : after} 
            alt="After" 
            className="absolute inset-0 w-full h-full object-contain" 
            onError={(e) => {
              setImageErrors(prev => ({ ...prev, after: true }));
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {useThumbnails.after && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-[10px] mono text-yellow-400">
              已加载缩略图（原图过大）
            </div>
          )}
        </>
      ) : imageErrors.after || imageTimeouts.after ? (
        <div className="absolute inset-0 bg-neutral-800 flex flex-col items-center justify-center gap-3 px-4">
          <div className="text-red-400 text-xs mono text-center">
            {errorMessages.after || (imageTimeouts.after ? '图片加载超时（文件可能过大）' : '图片加载失败')}
          </div>
          {loadingPaths.after && (
            <div className="text-gray-500 text-[10px] mono text-center max-w-full break-all">
              路径: {loadingPaths.after}
            </div>
          )}
          <button
            onClick={() => retryLoad('after')}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-xs mono text-blue-400 transition-colors"
          >
            重试加载
          </button>
        </div>
      ) : (
        <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            <div className="text-xs mono text-gray-400">加载中...</div>
            {loadingPaths.after && (
              <div className="text-gray-600 text-[10px] mono text-center max-w-full break-all px-4">
                {loadingPaths.after}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Before Image (Clip) */}
      <div 
        className="absolute inset-0 w-full h-full border-r-2 border-white/50 z-10"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        {imagesLoaded.before ? (
          <>
            <img 
              src={useThumbnails.before && beforeThumb ? beforeThumb : before} 
              alt="Before" 
              className="absolute inset-0 w-full h-full object-contain" 
              onError={(e) => {
                setImageErrors(prev => ({ ...prev, before: true }));
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            {useThumbnails.before && (
              <div className="absolute top-4 left-4 px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-[10px] mono text-yellow-400">
                已加载缩略图
              </div>
            )}
          </>
        ) : imageErrors.before || imageTimeouts.before ? (
          <div className="absolute inset-0 bg-neutral-800 flex flex-col items-center justify-center gap-3 px-4">
            <div className="text-red-400 text-xs mono text-center">
              {errorMessages.before || (imageTimeouts.before ? '图片加载超时（文件可能过大）' : '图片加载失败')}
            </div>
            {loadingPaths.before && (
              <div className="text-gray-500 text-[10px] mono text-center max-w-full break-all">
                路径: {loadingPaths.before}
              </div>
            )}
            <button
              onClick={() => retryLoad('before')}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-xs mono text-blue-400 transition-colors"
            >
              重试加载
            </button>
          </div>
        ) : (
          <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              {loadingPaths.before && (
                <div className="text-gray-600 text-[10px] mono text-center max-w-full break-all px-4">
                  {loadingPaths.before}
                </div>
              )}
            </div>
          </div>
        )}
        <span className="absolute top-4 left-4 px-2 py-1 bg-black/50 text-[10px] mono backdrop-blur text-white border border-white/20">
          {labelBefore}
        </span>
      </div>

      <span className="absolute top-4 right-4 px-2 py-1 bg-blue-500/50 text-[10px] mono backdrop-blur text-white border border-white/20">
        {labelAfter}
      </span>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center">
          <div className="w-1 h-3 bg-white/80 rounded-full mx-0.5" />
          <div className="w-1 h-3 bg-white/80 rounded-full mx-0.5" />
        </div>
      </div>
    </div>
  );
};

export default ImageSlider;
