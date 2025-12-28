import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ImageCarouselPreviewProps {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  title?: string;
}

const ImageCarouselPreview: React.FC<ImageCarouselPreviewProps> = ({ 
  images, 
  initialIndex = 0, 
  onClose, 
  title 
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  const positionRef = useRef(position);

  // 同步 ref 和 state
  useEffect(() => {
    scaleRef.current = scale;
    positionRef.current = position;
  }, [scale, position]);

  // 切换图片时重置缩放和位置
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // 重置缩放和位置
  const resetTransform = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 缩放函数
  const handleZoom = useCallback((delta: number, centerX?: number, centerY?: number) => {
    setScale(prevScale => {
      const newScale = Math.max(0.5, Math.min(5, prevScale + delta));
      
      // 如果提供了中心点，围绕该点缩放
      if (centerX !== undefined && centerY !== undefined && imageRef.current) {
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          const relativeX = centerX - containerRect.left - containerRect.width / 2;
          const relativeY = centerY - containerRect.top - containerRect.height / 2;
          const scaleChange = newScale / prevScale;
          setPosition(prevPos => ({
            x: prevPos.x - relativeX * (scaleChange - 1),
            y: prevPos.y - relativeY * (scaleChange - 1)
          }));
        }
      }
      
      return newScale;
    });
  }, []);

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoom(delta, e.clientX, e.clientY);
  };

  // 拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scaleRef.current > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - positionRef.current.x,
        y: e.clientY - positionRef.current.y
      });
    }
  };

  // 拖拽中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scaleRef.current > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  // 拖拽结束
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 切换到上一张
  const goToPrevious = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // 切换到下一张
  const goToNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  // 阻止背景页面滚动
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoom(0.1);
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoom(-0.1);
      } else if (e.key === '0') {
        e.preventDefault();
        resetTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleZoom, resetTransform, images.length]);

  if (images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={(e) => {
        e.stopPropagation();
      }}
      style={{ overflow: 'hidden' }}
    >
      <div 
        className="relative max-w-7xl w-full max-h-[90vh] flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* 工具栏 - 顶部固定 */}
        <div className="absolute top-4 right-4 flex items-center space-x-3 z-20 flex-wrap gap-2">
          {/* 缩放控制 */}
          <div className="flex items-center space-x-2 bg-black/70 backdrop-blur-md rounded-lg px-3 py-2 border border-white/20 shadow-lg">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoom(-0.1);
              }}
              className="text-white hover:text-blue-400 transition-colors px-2 py-1"
              title="缩小 (或按 -)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            </button>
            <span className="text-xs mono text-gray-300 min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoom(0.1);
              }}
              className="text-white hover:text-blue-400 transition-colors px-2 py-1"
              title="放大 (或按 +)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetTransform();
              }}
              className="text-white hover:text-blue-400 transition-colors px-2 py-1 text-xs mono"
              title="重置 (或按 0)"
            >
              重置
            </button>
          </div>
          
          {/* 关闭按钮 */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-white font-bold mono hover:text-white transition-all px-4 py-2 bg-red-500/80 hover:bg-red-500 border border-red-400/50 rounded-lg backdrop-blur-sm shadow-lg hover:scale-105"
            title="关闭 (或按 ESC)"
          >
            关闭 [X]
          </button>
        </div>

        {/* 左右切换箭头 */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => goToPrevious(e)}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md flex items-center justify-center text-white z-20 border border-white/20 shadow-lg transition-all hover:scale-110"
              title="上一张 (或按 ←)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => goToNext(e)}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md flex items-center justify-center text-white z-20 border border-white/20 shadow-lg transition-all hover:scale-110"
              title="下一张 (或按 →)"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        
        {/* 图片容器 */}
        <div 
          ref={containerRef}
          className="relative w-full h-full flex items-center justify-center bg-black/50 rounded-xl border border-white/20 overflow-hidden"
          style={{ maxHeight: '90vh' }}
          onWheel={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleWheel(e);
          }}
        >
          <img 
            key={currentIndex}
            ref={imageRef}
            src={currentImage} 
            alt={`Preview ${currentIndex + 1}`} 
            className="max-w-full max-h-[90vh] w-auto h-auto object-contain select-none"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            onMouseDown={handleMouseDown}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect fill="%23333" width="800" height="600"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-family="monospace" font-size="14"%3E图片加载失败%3C/text%3E%3C/svg%3E';
            }}
            draggable={false}
          />
        </div>
        
        {/* 图片信息和索引 */}
        <div className="mt-4 flex items-center justify-between">
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-xs mono text-gray-400 uppercase tracking-widest flex-1 text-center">
            {title || currentImage.split('/').pop()}
          </div>
          {images.length > 1 && (
            <div className="ml-4 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs mono text-gray-300">
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageCarouselPreview;

