
import React, { useRef, useState, useEffect, useCallback } from 'react';

const Viewer360: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [velocity, setVelocity] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const frameCount = 60; // Total images in the sequence
  const imagesRef = useRef<HTMLImageElement[]>([]);

  // Preload images
  useEffect(() => {
    let loaded = 0;
    let errored = 0;
    const images: HTMLImageElement[] = [];
    const timeout = setTimeout(() => {
      // 如果 3 秒后还没加载完，停止加载状态（允许图片缺失）
      setIsLoading(false);
    }, 3000);

    // 实际只有 36 张图片，循环使用
    const actualImageCount = 36;
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      // 循环使用 36 张图片 (01.png - 36.png)
      const frameNumber = String((i % actualImageCount) + 1).padStart(2, '0');
      img.src = `/images/360/${frameNumber}.png`;
      img.onload = () => {
        loaded++;
        if (loaded + errored === frameCount) {
          clearTimeout(timeout);
          setIsLoading(false);
        }
      };
      img.onerror = () => {
        errored++;
        // 即使图片加载失败，也继续处理
        if (loaded + errored === frameCount) {
          clearTimeout(timeout);
          setIsLoading(false);
        }
      };
      images.push(img);
    }
    imagesRef.current = images;

    return () => clearTimeout(timeout);
  }, []);

  const renderFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas || imagesRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imagesRef.current[frameIndex % frameCount];
    // 检查图片是否有效：已加载、有有效尺寸、且没有错误
    if (img && img.complete && img.width > 0 && img.height > 0 && img.naturalWidth > 0) {
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const hRatio = canvas.width / img.width;
        const vRatio = canvas.height / img.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShiftX = (canvas.width - img.width * ratio) / 2;
        const centerShiftY = (canvas.height - img.height * ratio) / 2;
        ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
      } catch (error) {
        console.warn('Canvas drawImage error:', error);
        // 如果绘制失败，清除画布并显示占位背景
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      // 如果图片未加载，显示占位背景
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      renderFrame(currentFrame);
    }
  }, [currentFrame, isLoading, renderFrame]);

  // Inertia logic
  useEffect(() => {
    if (isDragging) return;
    if (Math.abs(velocity) < 0.1) return;

    const interval = setInterval(() => {
      setVelocity(prev => prev * 0.95);
      setCurrentFrame(prev => {
        const next = prev + Math.round(velocity);
        return (next + frameCount) % frameCount;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [isDragging, velocity]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setLastX(clientX);
    setVelocity(0);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - lastX;
    
    const sensitivity = 0.5;
    const frameDelta = Math.round(deltaX * sensitivity);
    
    if (frameDelta !== 0) {
      setCurrentFrame(prev => (prev - frameDelta + frameCount) % frameCount);
      setLastX(clientX);
      setVelocity(-frameDelta);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden cursor-grab active:cursor-grabbing bg-black group">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
          <div className="text-white mono text-xs tracking-widest animate-pulse">正在加载交互模型...</div>
        </div>
      )}
      
      <canvas
        ref={canvasRef}
        width={1920}
        height={1080}
        className="w-full h-full object-contain pointer-events-none"
        onMouseDown={(e) => e.preventDefault()}
      />

      <div 
        className="absolute inset-0 z-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />

      <div className="absolute bottom-12 left-12 flex flex-col space-y-2 pointer-events-none select-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
        <h2 className="text-4xl font-bold tracking-tighter uppercase">Apex Vector 2025</h2>
        <div className="flex items-center space-x-4">
          <span className="text-xs mono text-blue-500">[ 360° Web 交互展示 ]</span>
          <span className="text-xs text-gray-500">当前帧: {currentFrame} / 60</span>
        </div>
      </div>

      <div className="absolute top-1/2 right-8 -translate-y-1/2 flex flex-col items-center space-y-4 pointer-events-none">
        <div className="w-1 h-32 bg-white/10 relative">
          <div 
            className="absolute top-0 left-0 w-full bg-blue-500 transition-all duration-100" 
            style={{ height: `${(currentFrame / frameCount) * 100}%` }}
          />
        </div>
        <span className="text-[10px] mono text-gray-400 rotate-90">旋转状态</span>
      </div>
    </div>
  );
};

export default Viewer360;
