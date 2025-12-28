import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ImagePreviewProps {
  imageUrl: string;
  onClose: () => void;
  title?: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ imageUrl, onClose, title }) => {
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

  // 阻止背景页面滚动
  useEffect(() => {
    // 保存原始 overflow 样式
    const originalOverflow = document.body.style.overflow;
    // 禁用背景滚动
    document.body.style.overflow = 'hidden';
    
    return () => {
      // 恢复原始 overflow 样式
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
  }, [onClose, handleZoom, resetTransform]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={(e) => {
        // 阻止滚轮事件传播到背景
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
          
          {/* 关闭按钮 - 更明显 */}
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
            ref={imageRef}
            src={imageUrl} 
            alt="Preview" 
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
        
        {/* 图片信息 */}
        <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-lg text-xs mono text-gray-400 uppercase tracking-widest text-center">
          {title || imageUrl.split('/').pop()}
        </div>
      </div>
    </div>
  );
};

export default ImagePreview;

