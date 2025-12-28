
import React, { useState, useEffect, useRef } from 'react';
import ImagePreview from '../components/ImagePreview';
import ImageCarouselPreview from '../components/ImageCarouselPreview';

interface WorkflowItem {
  title: string;
  img: string | string[]; // 支持单个图片或多个图片数组
  nodeImg?: string;
  desc: string;
  projectId?: string; // 关联的项目 ID
  port?: number; // 项目端口
  websiteUrl?: string; // 直接指定 URL（优先级最高）
  tags?: string[];
  carouselConfig?: { // 可选：轮播配置
    autoPlay?: boolean;
    interval?: number; // 毫秒
  };
}

interface CardConfig {
  projectId?: string;
  port?: number;
  url?: string;
  isRunning?: boolean;
}

const AILab: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedCarouselImages, setSelectedCarouselImages] = useState<{ images: string[]; initialIndex: number } | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<string | null>(null);
  const [isWebsiteLoading, setIsWebsiteLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [cardConfigs, setCardConfigs] = useState<Record<number, CardConfig>>({});
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);

  // 从 localStorage 加载卡片配置
  useEffect(() => {
    const saved = localStorage.getItem('ai_lab_card_configs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 验证配置格式，确保每个配置项都有正确的结构
        const validatedConfigs: Record<number, CardConfig> = {};
        for (const [key, value] of Object.entries(parsed)) {
          const index = parseInt(key);
          if (!isNaN(index) && value && typeof value === 'object') {
            // 确保配置对象包含所有必要的字段，使用默认值
            validatedConfigs[index] = {
              projectId: (value as any).projectId,
              port: (value as any).port,
              url: (value as any).url,
              isRunning: (value as any).isRunning ?? false
            };
          }
        }
        setCardConfigs(validatedConfigs);
        console.log('[配置] 已加载配置:', validatedConfigs);
      } catch (e) {
        console.error('加载卡片配置失败:', e);
        // 如果加载失败，使用空配置
        setCardConfigs({});
      }
    } else {
      console.log('[配置] 没有保存的配置，使用默认配置');
    }
  }, []);

  // 获取可用项目列表 - 只在组件挂载时执行一次
  useEffect(() => {
    fetchAvailableProjects();
  }, []); // 空依赖数组，只在挂载时执行

  // 心跳检测 - 只在有运行中的项目时执行
  useEffect(() => {
    // 只有在有配置且至少有一个项目可能运行时才开始心跳检测
    const hasRunningProjects = Object.values(cardConfigs).some(
      config => config?.projectId && config?.isRunning
    );
    
    if (hasRunningProjects) {
      // 定期检查项目状态
      const interval = setInterval(() => {
        checkAllProjectStatuses();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [cardConfigs]);

  const fetchAvailableProjects = async () => {
    try {
      console.log('[前端] 开始获取项目列表...');
      const url = '/api/projects/list';
      console.log('[前端] 请求 URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[前端] API 响应状态:', response.status, response.statusText);
      console.log('[前端] 响应头:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('[前端] 获取到的项目列表数据:', data);
        console.log('[前端] 数据成功字段:', data.success);
        console.log('[前端] 项目数量:', data.projects?.length || 0);
        
        if (data.success && data.projects && data.projects.length > 0) {
          console.log('[前端] 项目详情:', data.projects.map((p: any) => ({ id: p.id, name: p.name, port: p.port })));
          setAvailableProjects(data.projects);
          console.log(`[前端] ✓ 成功加载 ${data.projects.length} 个项目`);
        } else {
          console.warn('[前端] ⚠ 项目列表为空或格式不正确');
          console.warn('[前端] 响应数据:', data);
          setAvailableProjects([]);
        }
      } else {
        console.error('[前端] ✗ 获取项目列表失败，状态码:', response.status);
        const errorText = await response.text();
        console.error('[前端] 错误响应内容:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          console.error('[前端] 错误数据:', errorData);
        } catch (e) {
          // 不是 JSON，直接显示文本
        }
        setAvailableProjects([]);
      }
    } catch (error: any) {
      console.error('[前端] ✗ 获取项目列表异常:', error);
      console.error('[前端] 错误类型:', error.name);
      console.error('[前端] 错误消息:', error.message);
      console.error('[前端] 错误堆栈:', error.stack);
      setAvailableProjects([]);
    }
  };

  // 从主项目API检查所有项目状态（不再直接连接子项目）
  const checkAllProjectStatuses = async () => {
    // 异步检查每个项目的实际状态
    const statusPromises = Object.entries(cardConfigs).map(async ([index, cardConfig]) => {
      const config = cardConfig as CardConfig;
      if (config && config.projectId) {
        try {
          // 使用主项目的状态检查API，而不是直接连接子项目
          const statusUrl = `/api/project/status/${encodeURIComponent(config.projectId)}`;
          const response = await fetch(statusUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            // 使用 updateCardConfig 更新状态，保留所有其他字段
            updateCardConfig(parseInt(index), { 
              isRunning: data.running || false,
              port: data.port || config.port,
              url: data.port ? `http://localhost:${data.port}` : config.url
            });
          } else {
            // 状态检查失败，项目可能未运行
            updateCardConfig(parseInt(index), { isRunning: false });
          }
        } catch (error) {
          // 网络错误，项目可能未运行
          console.warn(`[前端] 无法检查项目 ${config.projectId} 状态:`, error);
          updateCardConfig(parseInt(index), { isRunning: false });
        }
      }
    });
    
    // 等待所有状态检查完成
    await Promise.all(statusPromises);
  };

  // 根据配置获取 URL
  const getProjectUrl = (item: WorkflowItem, cardIndex: number): string | null => {
    if (item.websiteUrl) return item.websiteUrl;
    const config = cardConfigs[cardIndex];
    if (config?.url) return config.url;
    if (config?.port) return `http://localhost:${config.port}`;
    if (item.port) return `http://localhost:${item.port}`;
    return null;
  };


  // 更新卡片配置的辅助函数（确保保留所有现有字段并立即保存）
  const updateCardConfig = (cardIndex: number, updates: Partial<CardConfig>) => {
    setCardConfigs(prev => {
      const newConfigs = {
        ...prev,
        [cardIndex]: {
          ...prev[cardIndex], // 保留现有配置
          ...updates // 应用更新
        }
      };
      // 立即保存到 localStorage
      try {
        localStorage.setItem('ai_lab_card_configs', JSON.stringify(newConfigs));
      } catch (e) {
        console.error('保存配置失败:', e);
      }
      return newConfigs;
    });
  };

  // 从子网站读取项目配置（端口等）
  const loadProjectConfig = async (projectId: string) => {
    try {
      // 先从项目列表中查找项目，获取端口信息
      const project = availableProjects.find((p: any) => p.id === projectId);
      if (!project || !project.port) {
        console.error('无法找到项目或项目端口信息:', projectId);
        return null;
      }

      // 尝试从子网站获取信息
      const subsiteUrl = `http://localhost:${project.port}/api/info?projectId=${encodeURIComponent(projectId)}`;
      console.log('[前端] 从子网站获取项目信息:', subsiteUrl);
      
      try {
        const response = await fetch(subsiteUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[前端] 从子网站获取到的项目信息:', data);
          
          if (editingCardIndex !== null) {
            // 使用函数式更新，保留所有现有字段
            setCardConfigs(prev => {
              const newConfigs = {
                ...prev,
                [editingCardIndex]: {
                  ...prev[editingCardIndex], // 保留现有配置（包括 isRunning 等）
                  projectId,
                  port: data.port,
                  url: data.url,
                  // 保留运行状态，如果不存在则设为 false
                  isRunning: prev[editingCardIndex]?.isRunning ?? false
                }
              };
              // 立即保存到 localStorage
              try {
                localStorage.setItem('ai_lab_card_configs', JSON.stringify(newConfigs));
              } catch (e) {
                console.error('保存配置失败:', e);
              }
              return newConfigs;
            });
          }
          return data;
        } else {
          console.warn('[前端] 子网站未运行，使用项目列表中的端口信息作为后备');
          // 子网站未运行，使用项目列表中的信息作为后备
          // 子网站直接运行在端口上，不需要 /web/项目ID 路径
          const fallbackData = {
            port: project.port,
            url: `http://localhost:${project.port}`,
            running: false
          };
          
          if (editingCardIndex !== null) {
            setCardConfigs(prev => {
              const newConfigs = {
                ...prev,
                [editingCardIndex]: {
                  ...prev[editingCardIndex],
                  projectId,
                  port: fallbackData.port,
                  url: fallbackData.url,
                  isRunning: false
                }
              };
              try {
                localStorage.setItem('ai_lab_card_configs', JSON.stringify(newConfigs));
              } catch (e) {
                console.error('保存配置失败:', e);
              }
              return newConfigs;
            });
          }
          return fallbackData;
        }
      } catch (fetchError) {
        console.warn('[前端] 无法连接到子网站，使用项目列表中的端口信息作为后备:', fetchError);
        // 网络错误，使用项目列表中的信息作为后备
        // 子网站直接运行在端口上，不需要 /web/项目ID 路径
        const fallbackData = {
          port: project.port,
          url: `http://localhost:${project.port}`,
          running: false
        };
        
        if (editingCardIndex !== null) {
          setCardConfigs(prev => {
            const newConfigs = {
              ...prev,
              [editingCardIndex]: {
                ...prev[editingCardIndex],
                projectId,
                port: fallbackData.port,
                url: fallbackData.url,
                isRunning: false
              }
            };
            try {
              localStorage.setItem('ai_lab_card_configs', JSON.stringify(newConfigs));
            } catch (e) {
              console.error('保存配置失败:', e);
            }
            return newConfigs;
          });
        }
        return fallbackData;
      }
    } catch (error) {
      console.error('读取项目配置失败:', error);
      return null;
    }
  };

  const workflows: WorkflowItem[] = [

    { 
      title: "小说设定提取", 
      img: ["/images/ai-lab/1.png", "/images/ai-lab/2.png", "/images/ai-lab/3.png", "/images/ai-lab/4.png", "/images/ai-lab/5.png"],
      desc: "这是一个用来提取小说设定得网站，如角色、场景、分镜，点击图片会在内置浏览器中打开。",
      tags: ["WEB", "DEMO"]
    },
    // { 
    //   title: "Flux 纹理合成", 
    //   img: "/images/ai-lab/flux1.jpg", 
    //   nodeImg: "/images/ai-lab/node1.jpg", 
    //   desc: "使用扩散模型生成 8K PBR 材质的复杂图表。",
    //   tags: ["COMFYUI", "SDXL"]
    // },
  ];


  return (
    <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
      <header className="mb-16">
        <div className="flex items-center space-x-4 mb-4">
            <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
            <h1 className="text-6xl font-black tracking-tighter uppercase">AI 实验室</h1>
        </div>
        <p className="text-gray-400 max-w-2xl text-lg leading-relaxed">
          编程思维和AI编程工具得结合。探索程序化生成、基于AI编程和自动化工作流的新前沿。
        </p>
      </header>

      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
        {workflows.map((wf, idx) => {
          const projectUrl = getProjectUrl(wf, idx);
          const config = cardConfigs[idx];
          return (
            <div 
              key={idx} 
              className="group relative bg-neutral-900 border border-white/5 rounded-xl overflow-hidden break-inside-avoid mb-4"
            >
              {/* 设置按钮 - 右上角 */}
              <div 
                className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCardIndex(idx);
                }}
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/80 hover:bg-purple-500 flex items-center justify-center text-white cursor-pointer backdrop-blur-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>

              <div 
                className="aspect-square overflow-hidden bg-neutral-800 cursor-pointer relative"
              >
                {/* 根据图片类型选择显示方式 */}
                {Array.isArray(wf.img) && wf.img.length > 1 ? (
                  // 多个图片：使用轮播组件
                  <ImageCarousel
                    images={wf.img}
                    autoPlay={wf.carouselConfig?.autoPlay !== false}
                    interval={wf.carouselConfig?.interval || 3001}
                    onImageClick={(currentIndex) => {
                      // 点击图片时总是打开预览
                      setSelectedCarouselImages({ images: wf.img, initialIndex: currentIndex });
                    }}
                    className="group"
                  />
                ) : (
                  // 单个图片：保持原有显示方式（兼容字符串或只有一个元素的数组）
                  <img 
                    src={Array.isArray(wf.img) ? wf.img[0] : wf.img} 
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110 grayscale group-hover:grayscale-0 bg-neutral-900 cursor-pointer" 
                    alt={wf.title}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      // 打开图片预览
                      const singleImg = Array.isArray(wf.img) ? wf.img[0] : wf.img;
                      if (singleImg) {
                        setSelectedCarouselImages({ images: [singleImg], initialIndex: 0 });
                      }
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                
                {projectUrl && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <div 
                      className="px-4 py-2 bg-purple-500/80 backdrop-blur-sm rounded-lg text-white text-sm font-bold mono flex items-center space-x-2 pointer-events-auto cursor-pointer hover:bg-purple-500/90 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (projectUrl) {
                          setSelectedWebsite(projectUrl);
                          setIsWebsiteLoading(true);
                        }
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span>点击打开网站</span>
                    </div>
                  </div>
                )}
                {/* 运行状态指示器 */}
                {config?.isRunning && (
                  <div className="absolute top-4 left-4 z-20">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-1 group-hover:text-purple-400 transition-colors">{wf.title}</h3>
                <p className="text-xs text-gray-500 mb-4">{wf.desc}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-[10px] mono text-gray-400">
                    {(wf.tags || ["COMFYUI", "SDXL"]).map((tag, tagIdx) => (
                      <span key={tagIdx} className="px-2 py-0.5 border border-white/10 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
              {wf.nodeImg && (
                <div 
                  className="absolute top-4 right-16 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(wf.nodeImg!);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white hover:bg-purple-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 卡片设置模态框 */}
      {editingCardIndex !== null && (
        <CardSettingsModal
          cardIndex={editingCardIndex}
          cardTitle={workflows[editingCardIndex]?.title}
          config={cardConfigs[editingCardIndex]}
          availableProjects={availableProjects}
          onClose={() => setEditingCardIndex(null)}
          onProjectSelect={async (projectId) => {
            await loadProjectConfig(projectId);
          }}
          onRefreshProjects={fetchAvailableProjects}
          onConfigUpdate={updateCardConfig}
        />
      )}

      {/* 节点图预览模态框 */}
      {selectedImage && (
        <ImagePreview
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
          title={`ComfyUI 节点图: [ ${selectedImage.split('/').pop()} ]`}
        />
      )}
      
      {selectedCarouselImages && (
        <ImageCarouselPreview
          images={selectedCarouselImages.images}
          initialIndex={selectedCarouselImages.initialIndex}
          onClose={() => setSelectedCarouselImages(null)}
          title="图片预览"
        />
      )}

      {/* 内置浏览器窗口 */}
      {selectedWebsite && (
        <WebsiteWindow
          url={selectedWebsite}
          onClose={() => setSelectedWebsite(null)}
          iframeRef={iframeRef}
          isLoading={isWebsiteLoading}
          onLoad={() => setIsWebsiteLoading(false)}
          onError={() => setIsWebsiteLoading(false)}
        />
      )}
    </div>
  );
};

// 卡片设置模态框组件
interface CardSettingsModalProps {
  cardIndex: number;
  cardTitle: string;
  config?: CardConfig;
  availableProjects: any[];
  onClose: () => void;
  onProjectSelect: (projectId: string) => Promise<void>;
  onRefreshProjects: () => void;
  onConfigUpdate?: (cardIndex: number, updates: Partial<CardConfig>) => void;
}

const CardSettingsModal: React.FC<CardSettingsModalProps> = ({
  cardIndex,
  cardTitle,
  config,
  availableProjects,
  onClose,
  onProjectSelect,
  onRefreshProjects,
  onConfigUpdate,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(config?.projectId || '');
  const [loading, setLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [projectStatus, setProjectStatus] = useState<{ running: boolean; port?: number } | null>(null);
  const [startupProgress, setStartupProgress] = useState<string>('');
  const startupCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 从主项目API检查项目状态（不再直接连接子项目）
  const checkProjectStatus = async () => {
    if (!config?.projectId) {
      // 没有项目 ID 时，设置为未启动状态
      setProjectStatus({ running: false });
      return;
    }
    
    try {
      console.log(`[前端] 从主项目API检查项目状态: ${config.projectId}`);
      // 使用主项目的状态检查API，而不是直接连接子项目
      const statusUrl = `/api/project/status/${encodeURIComponent(config.projectId)}`;
      
      try {
        const response = await fetch(statusUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[前端] 从主项目API获取的状态检查结果:`, data);
          // 使用 API 返回的状态，确保默认为 false
          const isRunning = data.running || false;
          setProjectStatus({ running: isRunning, port: data.port || config.port });
          
          // 同步更新父组件的配置
          if (onConfigUpdate) {
            onConfigUpdate(cardIndex, { 
              isRunning, 
              port: data.port || config.port, 
              url: data.port ? `http://localhost:${data.port}` : config.url 
            });
          }
          
          // 如果状态发生变化，输出日志
          if (isRunning) {
            console.log(`[前端] ✓ 项目运行中 (端口: ${data.port || config.port})`);
          } else {
            console.log(`[前端] ✗ 项目未运行 (端口: ${data.port || config.port})`);
          }
        } else {
          console.warn(`[前端] 状态检查失败 (状态码: ${response.status})`);
          // 状态检查失败，设置为未启动状态
          setProjectStatus({ running: false, port: config.port });
          if (onConfigUpdate) {
            onConfigUpdate(cardIndex, { isRunning: false });
          }
        }
      } catch (fetchError) {
        console.warn('[前端] 无法连接到主项目API，项目可能未运行:', fetchError);
        // 网络错误，设置为未启动状态
        setProjectStatus({ running: false, port: config.port });
        if (onConfigUpdate) {
          onConfigUpdate(cardIndex, { isRunning: false });
        }
      }
    } catch (error) {
      console.error('[前端] 检查项目状态异常:', error);
      // 出错时，设置为未启动状态
      setProjectStatus({ running: false, port: config.port });
      if (onConfigUpdate) {
        onConfigUpdate(cardIndex, { isRunning: false });
      }
    }
  };

  // 定期检查项目状态
  useEffect(() => {
    if (config?.projectId) {
      checkProjectStatus();
      const interval = setInterval(() => {
        checkProjectStatus();
      }, 3001);
      return () => clearInterval(interval);
    }
  }, [config?.projectId]);
  
  // 清理启动监控
  useEffect(() => {
    return () => {
      if (startupCheckIntervalRef.current) {
        clearInterval(startupCheckIntervalRef.current);
        startupCheckIntervalRef.current = null;
      }
    };
  }, []);

  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    if (projectId) {
      setLoading(true);
      await onProjectSelect(projectId);
      setLoading(false);
      // 项目选择后检查状态
      setTimeout(checkProjectStatus, 1000);
    }
  };

  const handleStart = async () => {
    if (!config?.projectId) {
      console.error('启动失败: 没有项目ID');
      alert('启动失败: 请先选择项目');
      return;
    }
    
    console.log('[前端] 开始启动项目:', config.projectId);
    setIsStarting(true);
    
    try {
      const url = `/api/project/start/${config.projectId}`;
      console.log('[前端] 发送启动请求到:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[前端] 收到响应，状态码:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[前端] 启动请求失败:', response.status, errorText);
        setIsStarting(false);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('[前端] 启动响应数据:', data);
      
      if (data.success) {
        // 如果响应中标记为 alreadyRunning，立即验证状态
        if (data.alreadyRunning) {
          console.log('[前端] 响应标记项目已运行，立即验证状态...');
          setStartupProgress('验证项目状态...');
          
          try {
            const statusResponse = await fetch(`/api/project/status/${config.projectId}`);
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              console.log('[前端] 状态验证结果:', statusData);
              
              if (statusData.running) {
                // 确认项目真的在运行
                console.log('[前端] ✓ 项目确认运行中！');
                setIsStarting(false);
                setStartupProgress('');
                checkProjectStatus();
                return;
              } else {
                // 状态检查显示未运行，但后端说已运行，可能是状态不同步
                console.warn('[前端] ⚠ 状态检查显示未运行，但后端说已运行，开始监控...');
                // 继续进入监控流程
              }
            }
          } catch (verifyError) {
            console.error('[前端] 状态验证失败:', verifyError);
            // 继续进入监控流程
          }
        }
        
        console.log('[前端] 启动请求已接受，开始监控启动状态...');
        
        // 持续监控启动状态，直到真正成功或失败
        let checkCount = 0;
        const maxChecks = 60; // 最多检查 60 次（30 秒）
        
        // 清理之前的监控
        if (startupCheckIntervalRef.current) {
          clearInterval(startupCheckIntervalRef.current);
        }
        
        if (!data.alreadyRunning) {
          setStartupProgress('正在启动项目...');
        }
        
        let successConfirmed = false; // 用于确认启动成功
        const checkInterval = setInterval(async () => {
          checkCount++;
          const progressPercent = Math.min((checkCount / maxChecks) * 100, 100);
          setStartupProgress(`正在启动... (${checkCount}/${maxChecks}, ${Math.round(progressPercent)}%)`);
          console.log(`[前端] 检查启动状态 (${checkCount}/${maxChecks})...`);
          
          try {
            const statusResponse = await fetch(`/api/project/status/${config.projectId}`);
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              console.log('[前端] 状态检查结果:', statusData);
              
              if (statusData.running) {
                // 项目已启动成功
                if (!successConfirmed) {
                  // 第一次检测到成功，等待一次确认检查
                  console.log('[前端] ✓ 首次检测到项目启动成功，等待确认...');
                  successConfirmed = true;
                  // 继续检查一次以确认
                } else {
                  // 确认成功，停止检查
                  console.log('[前端] ✓ 项目启动成功（已确认）！');
                  clearInterval(checkInterval);
                  startupCheckIntervalRef.current = null;
                  setIsStarting(false);
                  setStartupProgress('');
                  // 立即更新配置
                  if (onConfigUpdate) {
                    onConfigUpdate(cardIndex, { isRunning: true, port: statusData.port || config.port });
                  }
                  checkProjectStatus(); // 更新状态显示
                }
              } else if (successConfirmed) {
                // 之前检测到成功，但现在返回失败，可能是误判，再检查一次
                console.warn('[前端] ⚠ 之前检测到成功但现在返回失败，可能是误判，继续检查...');
                successConfirmed = false; // 重置确认状态
              } else if (checkCount >= maxChecks) {
                // 超时
                console.warn('[前端] ⚠ 启动监控超时');
                clearInterval(checkInterval);
                startupCheckIntervalRef.current = null;
                setIsStarting(false);
                setStartupProgress('');
                checkProjectStatus();
                // 即使超时，也检查一次最终状态，如果实际已启动则不显示错误
                const finalStatusResponse = await fetch(`/api/project/status/${config.projectId}`);
                if (finalStatusResponse.ok) {
                  const finalStatusData = await finalStatusResponse.json();
                  if (finalStatusData.running) {
                    console.log('[前端] ✓ 超时后检查发现项目实际已启动');
                    if (onConfigUpdate) {
                      onConfigUpdate(cardIndex, { isRunning: true, port: finalStatusData.port || config.port });
                    }
                    checkProjectStatus();
                    return; // 不显示错误提示
                  }
                }
                alert('启动监控超时（30秒），项目可能未成功启动。请检查：\n1. 项目依赖是否已安装（npm install）\n2. 端口是否被其他程序占用\n3. 查看服务器控制台获取详细错误信息');
              }
              // 如果还没启动，继续等待
            } else {
              console.error('[前端] 状态检查失败:', statusResponse.status);
              if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                startupCheckIntervalRef.current = null;
                setIsStarting(false);
                setStartupProgress('');
                // 即使状态检查失败，也尝试检查端口是否可访问
                try {
                  const finalStatusResponse = await fetch(`/api/project/status/${config.projectId}`);
                  if (finalStatusResponse.ok) {
                    const finalStatusData = await finalStatusResponse.json();
                    if (finalStatusData.running) {
                      console.log('[前端] ✓ 状态检查失败但项目实际已启动');
                      if (onConfigUpdate) {
                        onConfigUpdate(cardIndex, { isRunning: true, port: finalStatusData.port || config.port });
                      }
                      checkProjectStatus();
                      return; // 不显示错误提示
                    }
                  }
                } catch (e) {
                  // 忽略最终检查的错误
                }
                alert('无法检查项目状态，请手动确认项目是否已启动');
              }
            }
          } catch (statusError) {
            console.error('[前端] 状态检查异常:', statusError);
            if (checkCount >= maxChecks) {
              clearInterval(checkInterval);
              startupCheckIntervalRef.current = null;
              setIsStarting(false);
              setStartupProgress('');
              // 即使状态检查异常，也尝试最后一次检查
              try {
                const finalStatusResponse = await fetch(`/api/project/status/${config.projectId}`);
                if (finalStatusResponse.ok) {
                  const finalStatusData = await finalStatusResponse.json();
                  if (finalStatusData.running) {
                    console.log('[前端] ✓ 状态检查异常但项目实际已启动');
                    if (onConfigUpdate) {
                      onConfigUpdate(cardIndex, { isRunning: true, port: finalStatusData.port || config.port });
                    }
                    checkProjectStatus();
                    return; // 不显示错误提示
                  }
                }
              } catch (e) {
                // 忽略最终检查的错误
              }
              alert('状态检查失败，请手动确认项目是否已启动');
            }
          }
        }, 500); // 每 500ms 检查一次
        
        startupCheckIntervalRef.current = checkInterval;
        
        // 设置超时清理
        setTimeout(() => {
          if (startupCheckIntervalRef.current === checkInterval) {
            clearInterval(checkInterval);
            startupCheckIntervalRef.current = null;
            setIsStarting(false);
            setStartupProgress('');
            checkProjectStatus();
          }
        }, maxChecks * 500 + 1000);
        
      } else {
        console.error('[前端] 启动失败:', data.message);
        setIsStarting(false);
        setStartupProgress('');
        
        // 根据错误类型提供不同的反馈
        let errorMessage = `启动失败: ${data.message}`;
        if (data.details) {
          errorMessage += `\n\n详情:\n${data.details}`;
        }
        if (data.suggestion) {
          errorMessage += `\n\n建议:\n${data.suggestion}`;
        }
        
        // 如果是端口相关错误，提供额外建议
        if (data.message && data.message.includes('端口')) {
          errorMessage += `\n\n提示: 如果端口被其他程序占用，请：\n1. 关闭占用端口的程序\n2. 或修改项目的 vite.config.ts 中的端口号`;
        }
        
        alert(errorMessage);
      }
    } catch (error: any) {
      console.error('[前端] 启动项目异常:', error);
      setIsStarting(false);
      setStartupProgress('');
      
      let errorMessage = `启动失败: ${error.message}`;
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage += '\n\n网络错误，请检查：\n1. 服务器是否正在运行\n2. 网络连接是否正常';
      }
      
      alert(errorMessage);
    }
  };

  const handleStop = async () => {
    if (!config?.projectId) return;
    
    setIsStopping(true);
    try {
      const response = await fetch(`/api/project/stop/${config.projectId}`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setProjectStatus({ running: false, port: config.port });
        // 立即更新配置
        if (onConfigUpdate) {
          onConfigUpdate(cardIndex, { isRunning: false });
        }
        setIsStopping(false);
      } else {
        alert(`停止失败: ${data.message}`);
        setIsStopping(false);
      }
    } catch (error: any) {
      console.error('停止项目失败:', error);
      alert(`停止失败: ${error.message}`);
      setIsStopping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-white/10 rounded-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">卡片设置 - {cardTitle}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">选择项目</label>
            <div className="flex space-x-2">
              <select
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="flex-1 px-4 py-2 bg-neutral-800 border border-white/10 rounded-lg text-white"
                disabled={loading}
              >
                <option value="">-- 选择项目 --</option>
                {availableProjects.length === 0 ? (
                  <option value="" disabled>未找到项目，请检查 public/web 目录</option>
                ) : (
                  availableProjects.map(project => (
                    <option key={project.id} value={project.id}>{project.name} ({project.port})</option>
                  ))
                )}
              </select>
              <button
                onClick={() => {
                  onRefreshProjects();
                  setSelectedProjectId('');
                }}
                className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-white"
                title="刷新项目列表"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            {availableProjects.length === 0 && (
              <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="text-xs text-yellow-400 mb-1">
                  <strong>未找到项目</strong>
                </div>
                <div className="text-xs text-yellow-500/80 space-y-1">
                  <div>1. 检查 <code className="bg-neutral-800 px-1 rounded">public/web</code> 目录下是否有项目文件夹</div>
                  <div>2. 确保项目文件夹中有 <code className="bg-neutral-800 px-1 rounded">package.json</code> 文件</div>
                  <div>3. 点击刷新按钮重新加载项目列表</div>
                </div>
              </div>
            )}
          </div>

          {config && (
            <div>
              <label className="block text-sm font-medium mb-2">项目信息</label>
              <div className="p-3 bg-neutral-800/50 rounded-lg space-y-1 mb-4">
                <div className="text-sm">
                  <span className="text-gray-400">端口:</span> <span className="text-white">{config.port || '未设置'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">地址:</span> <span className="text-white text-xs">{config.url || '未设置'}</span>
                </div>
                <div className="text-sm flex items-center space-x-2">
                  <span className="text-gray-400">状态:</span>
                  <div className={`w-2 h-2 rounded-full ${(projectStatus?.running || config.isRunning) ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-white">{(projectStatus?.running || config.isRunning) ? '运行中' : '未运行'}</span>
                </div>
              </div>
              
              {/* 启动进度提示 */}
              {isStarting && startupProgress && (
                <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="text-xs text-blue-400 flex items-center space-x-2">
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{startupProgress}</span>
                  </div>
                </div>
              )}
              
              {/* 启动/停止按钮 */}
              <div className="flex space-x-2">
                <button
                  onClick={handleStart}
                  disabled={isStarting || isStopping || (projectStatus?.running || config.isRunning)}
                  className="flex-1 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-lg text-green-400 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {isStarting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{startupProgress || '启动中...'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>启动项目</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleStop}
                  disabled={isStarting || isStopping || !(projectStatus?.running || config.isRunning)}
                  className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-400 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                >
                  {isStopping ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>停止中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10h6v4H9z" />
                      </svg>
                      <span>停止项目</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 图片轮播组件
interface ImageCarouselProps {
  images: string[];
  autoPlay?: boolean;
  interval?: number;
  onImageClick?: (currentIndex: number) => void;
  className?: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images,
  autoPlay = true,
  interval = 3000,
  onImageClick,
  className = ''
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 自动播放逻辑
  useEffect(() => {
    if (images.length <= 1 || !autoPlay) return;

    if (!isHovered) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [images.length, autoPlay, interval, isHovered]);

  // 手动切换到上一张
  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // 手动切换到下一张
  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  // 跳转到指定图片
  const goToIndex = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  if (images.length === 0) return null;

  return (
    <div 
      className={`relative w-full h-full overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onImageClick?.(currentIndex)}
    >
      {/* 图片容器 */}
      <div className="relative w-full h-full bg-neutral-900">
        {images.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`Slide ${index + 1}`}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${
              index === currentIndex ? 'opacity-100' : 'opacity-0'
            } grayscale group-hover:grayscale-0`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ))}
      </div>

      {/* 左右箭头（仅在有多张图片时显示） */}
      {images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="上一张"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="下一张"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* 指示器（仅在有多张图片时显示） */}
      {images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 z-10">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => goToIndex(index, e)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white w-4' 
                  : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`跳转到第 ${index + 1} 张`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 网站窗口组件
interface WebsiteWindowProps {
  url: string;
  onClose: () => void;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  isLoading: boolean;
  onLoad: () => void;
  onError: () => void;
}

const WebsiteWindow: React.FC<WebsiteWindowProps> = ({
  url,
  onClose,
  iframeRef,
  isLoading,
  onLoad,
  onError,
}) => {
  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[101] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* 窗口容器 */}
      <div 
        className="bg-neutral-900 border border-white/20 rounded-lg shadow-2xl flex flex-col w-full h-full max-w-[95vw] max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 窗口标题栏 */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-800 border-b border-white/10">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* URL 地址栏 */}
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-neutral-900 rounded-lg border border-white/10 flex-1 min-w-0">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs mono text-gray-300 truncate">{url}</span>
            </div>
          </div>
          
          {/* 关闭按钮 */}
          <button 
            onClick={onClose}
            className="ml-3 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-xs font-medium text-red-400 transition-colors flex items-center space-x-1"
            title="关闭 (ESC)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>关闭</span>
          </button>
        </div>

        {/* iframe 浏览器内容 */}
        <div className="flex-1 relative bg-white overflow-hidden" style={{ minHeight: 0 }}>
          <iframe
            ref={iframeRef}
            src={url}
            className="w-full h-full border-0 bg-white"
            title="内置浏览器"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation allow-presentation allow-downloads allow-pointer-lock"
            allow="file-system-access"
            onLoad={onLoad}
            onError={onError}
          />
          
          {/* 加载状态 */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none z-10">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-white/20 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm mono text-gray-400">正在加载网站...</p>
                <p className="text-xs mono text-gray-500 mt-2 max-w-md truncate">{url}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AILab;
