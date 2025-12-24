
import React, { useRef, useState, useEffect, useCallback } from 'react';

const ImageSequencePlayer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const frameCount = 36; // 每10度一张
  const imagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    let loaded = 0;
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      // 使用 seed 模拟 36 个不同的角度图片
      img.src = `https://picsum.photos/seed/car_360_deg_${i}/1200/800`;
      img.onload = () => {
        loaded++;
        if (loaded === frameCount) setIsLoading(false);
      };
      images.push(img);
    }
    imagesRef.current = images;
  }, []);

  const renderFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas || imagesRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imagesRef.current[frameIndex % frameCount];
    if (img && img.complete) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const hRatio = canvas.width / img.width;
      const vRatio = canvas.height / img.height;
      const ratio = Math.max(hRatio, vRatio);
      const centerShiftX = (canvas.width - img.width * ratio) / 2;
      const centerShiftY = (canvas.height - img.height * ratio) / 2;
      ctx.drawImage(img, 0, 0, img.width, img.height, centerShiftX, centerShiftY, img.width * ratio, img.height * ratio);
    }
  }, []);

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
