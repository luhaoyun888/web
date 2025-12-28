
import React, { useRef, useState, useEffect, useCallback } from 'react';

interface ImageSequencePlayerProps {
  backgroundColor?: string;      // 背景颜色
  backgroundImage?: string;       // 背景图片 URL
  carScale?: number;             // 汽车缩放比例 (0.5 - 2.0)
}

const ImageSequencePlayer: React.FC<ImageSequencePlayerProps> = ({
  backgroundColor = '#0a0a0a',
  backgroundImage,
  carScale = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [bgImageLoaded, setBgImageLoaded] = useState<HTMLImageElement | null>(null);
  
  const frameCount = 36; // 每10度一张
  const imagesRef = useRef<HTMLImageElement[]>([]);

  // 加载背景图片
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = backgroundImage;
      img.onload = () => {
        setBgImageLoaded(img);
      };
      img.onerror = () => {
        setBgImageLoaded(null);
      };
    } else {
      setBgImageLoaded(null);
    }
  }, [backgroundImage]);

  useEffect(() => {
    let loaded = 0;
    let errored = 0;
    const images: HTMLImageElement[] = new Array(frameCount).fill(null);
    const timeout = setTimeout(() => {
      // 如果 3 秒后还没加载完，停止加载状态（允许图片缺失）
      setIsLoading(false);
    }, 3000);

    // 优先加载关键帧（0°, 90°, 180°, 270°）
    const priorityFrames = [0, 9, 18, 27];
    let priorityLoaded = 0;

    // 加载关键帧
    priorityFrames.forEach((frameIndex) => {
      const img = new Image();
      const frameNumber = String(frameIndex + 1).padStart(2, '0');
      img.src = `/images/360/${frameNumber}.png`;
      img.onload = () => {
        loaded++;
        priorityLoaded++;
        images[frameIndex] = img;
        // 关键帧加载完成后，允许开始渲染
        if (priorityLoaded === priorityFrames.length) {
          setIsLoading(false);
        }
        if (loaded + errored === frameCount) {
          clearTimeout(timeout);
        }
      };
      img.onerror = () => {
        errored++;
        if (loaded + errored === frameCount) {
          clearTimeout(timeout);
        }
        if (priorityLoaded === priorityFrames.length - errored) {
          setIsLoading(false);
        }
      };
    });

    // 延迟加载其他帧（分批加载，避免一次性加载太多）
    const loadRemainingFrames = () => {
      for (let i = 0; i < frameCount; i++) {
        if (priorityFrames.includes(i)) continue; // 跳过已加载的关键帧
        
        const img = new Image();
        const frameNumber = String(i + 1).padStart(2, '0');
        img.src = `/images/360/${frameNumber}.png`;
        img.onload = () => {
          loaded++;
          images[i] = img;
          if (loaded + errored === frameCount) {
            clearTimeout(timeout);
          }
        };
        img.onerror = () => {
          errored++;
          if (loaded + errored === frameCount) {
            clearTimeout(timeout);
          }
        };
      }
    };

    // 关键帧加载完成后，延迟100ms再加载其他帧
    const checkAndLoadRemaining = setInterval(() => {
      if (priorityLoaded >= priorityFrames.length || loaded + errored >= priorityFrames.length) {
        clearInterval(checkAndLoadRemaining);
        setTimeout(loadRemainingFrames, 100);
      }
    }, 50);

    imagesRef.current = images;

    return () => {
      clearTimeout(timeout);
      clearInterval(checkAndLoadRemaining);
    };
  }, []);

  const renderFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas || imagesRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. 先绘制背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (bgImageLoaded) {
      // 绘制背景图片（填充整个画布）
      ctx.drawImage(bgImageLoaded, 0, 0, canvas.width, canvas.height);
    } else {
      // 绘制纯色背景
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. 绘制缩放后的汽车图片
    const img = imagesRef.current[frameIndex % frameCount];
    if (img && img.complete && img.width > 0 && img.height > 0 && img.naturalWidth > 0) {
      try {
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.max(hRatio, vRatio) * carScale; // 应用缩放
        
        const scaledWidth = img.width * ratio;
        const scaledHeight = img.height * ratio;
        const centerShiftX = (canvas.width - scaledWidth) / 2;
        const centerShiftY = (canvas.height - scaledHeight) / 2;
        
        ctx.drawImage(
          img, 
          0, 0, img.width, img.height, 
          centerShiftX, centerShiftY, 
          scaledWidth, scaledHeight
        );
      } catch (error) {
        console.warn('Canvas drawImage error:', error);
      }
    }
  }, [backgroundColor, bgImageLoaded, carScale]);

  useEffect(() => {
    if (!isLoading) renderFrame(currentFrame);
  }, [currentFrame, isLoading, renderFrame]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setLastX(clientX);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - lastX;
    
    // 旋转灵敏度
    const sensitivity = 5;
    const frameDelta = Math.floor(deltaX / sensitivity);
    
    if (Math.abs(frameDelta) >= 1) {
      setCurrentFrame(prev => (prev - Math.sign(frameDelta) + frameCount) % frameCount);
      setLastX(clientX);
    }
  };

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden cursor-col-resize bg-[#0a0a0a] border border-white/10">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-blue-500 mono text-xs tracking-widest animate-pulse">正在缓存 360° 视口资源 [36帧]...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="w-full h-full object-contain pointer-events-none"
      />
      <div 
        className="absolute inset-0 z-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={() => setIsDragging(false)}
      />
      <div className="absolute bottom-6 right-6 px-3 py-1 bg-black/50 backdrop-blur border border-white/10 rounded-full text-[10px] mono text-gray-400">
        视角: {currentFrame * 10}° / 360°
      </div>
    </div>
  );
};

export default ImageSequencePlayer;
