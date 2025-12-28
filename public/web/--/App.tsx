import React, { useState, useEffect, useRef, Component, ReactNode } from 'react';
import type { ErrorInfo } from 'react';
import { Project, AppView } from './types';
import { Sidebar } from './components/Sidebar';
import { EntityExtraction } from './components/EntityExtraction';
import { ChapterManager } from './components/ChapterManager';
import { StoryboardView } from './components/StoryboardView';
import { SettingsView } from './components/SettingsView';
import { ExportManager } from './components/ExportManager';
import { fileSystem } from './services/fileSystemService';
import { analyzeEntitiesWithProgress } from './services/geminiService';
import { GlobalSettings } from './components/GlobalSettings';
import { Upload, FileText, AlertTriangle, Settings, Download, Loader2, X, Key } from 'lucide-react';

// 错误边界组件
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;
  
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('❌ React 错误边界捕获到错误:', error, errorInfo);
    (this as React.Component<ErrorBoundaryProps, ErrorBoundaryState>).setState({ errorInfo });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 text-red-500 p-10">
          <h2 className="text-xl font-bold mb-4">组件渲染错误</h2>
          <pre className="bg-gray-900 p-4 rounded text-sm overflow-auto max-w-2xl mb-4">
            {this.state.error?.message || String(this.state.error)}
          </pre>
          {this.state.errorInfo && (
            <details className="bg-gray-900 p-4 rounded text-xs overflow-auto max-w-2xl mb-4">
              <summary className="cursor-pointer mb-2">错误堆栈</summary>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
          <button 
            onClick={() => {
              (this as React.Component<ErrorBoundaryProps, ErrorBoundaryState>).setState({ 
                hasError: false, 
                error: null, 
                errorInfo: null 
              });
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// EntityExtraction 包装组件，用于错误处理
const EntityExtractionWrapper: React.FC<{
  project: Project;
  onUpdateProject: (p: Project) => void;
  loading: boolean;
  progress: number;
  statusText: string;
  onStartAnalysis: (fullText: string, prompt: string | undefined, delay: number | undefined) => Promise<void>;
  onCancelAnalysis: () => void;
  error: string | null;
}> = (props) => {
  console.log('🎬 EntityExtractionWrapper 渲染', {
    projectId: props.project?.id,
    projectTitle: props.project?.title,
    hasCharacters: !!props.project?.characters?.length,
    hasScenes: !!props.project?.scenes?.length
  });
  
  try {
    return <EntityExtraction {...props} />;
  } catch (error: any) {
    console.error('❌ EntityExtraction 渲染失败:', error);
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 text-red-500 p-10">
        <h2 className="text-xl font-bold mb-4">EntityExtraction 组件错误</h2>
        <pre className="bg-gray-900 p-4 rounded text-sm overflow-auto max-w-2xl">
          {error?.message || String(error)}
        </pre>
      </div>
    );
  }
};

const App: React.FC = () => {
  console.log('📱 App 组件开始渲染');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>(AppView.PROJECT_SELECT);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  
  useEffect(() => {
    console.log('✅ App 组件已挂载，当前项目数:', projects.length);
  }, []);

  // 检查 API Key 状态
  useEffect(() => {
    const checkApiKey = () => {
      const hasEnvKey = !!process.env.API_KEY;
      const hasCustomKey = typeof window !== 'undefined' && !!localStorage.getItem('custom_gemini_api_key');
      setHasApiKey(hasEnvKey || hasCustomKey);
    };
    
    checkApiKey();
    // 监听 localStorage 变化
    const interval = setInterval(checkApiKey, 1000);
    window.addEventListener('storage', checkApiKey);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkApiKey);
    };
  }, []);
  
  // Global Analysis State (Lifted from EntityExtraction)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // File System State
  const [dirHandle, setDirHandle] = useState<any>(null);
  // API连接状态：跟踪是否通过主项目API成功连接
  const [isApiConnected, setIsApiConnected] = useState<boolean>(false);
  
  // 跟踪最后保存的项目状态，避免重复保存
  const lastSavedProjectRef = useRef<{id: string, title: string, dataHash: string} | null>(null);

  // 自动连接默认数据文件夹（应用启动时）
  useEffect(() => {
    const autoConnectDataFolder = async () => {
      // 如果已经通过API连接过，不再自动连接
      if (isApiConnected) {
        return;
      }
      // 如果已经通过File System Access API连接过，不再自动连接
      if (dirHandle) {
        return;
      }
      
      // 获取当前子项目的ID（从环境变量或URL）
      const siteId = (import.meta.env.VITE_SITE_ID as string) || '--';
      let dataFolderPath = '';
      
      // 方案1：优先从主项目的API获取数据文件夹路径（动态、准确）
      try {
        const configResponse = await fetch(`/api/project/config/${encodeURIComponent(siteId)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Site-Id': siteId
          }
        });
        
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.success && configData.dataFolder && configData.dataFolder.path) {
            dataFolderPath = configData.dataFolder.path;
            console.log(`[自动连接] ✓ 从主项目API获取到数据文件夹路径`);
          }
        }
      } catch (apiError) {
        console.warn(`[自动连接] ⚠ 调用主项目API失败:`, apiError);
      }
      
      // 方案2：如果API获取失败，使用环境变量中的路径（后备方案）
      if (!dataFolderPath) {
        dataFolderPath = (import.meta.env.VITE_DATA_FOLDER_PATH as string) || '';
      }
      
      if (dataFolderPath) {
        // 将路径保存到 localStorage，供后续使用
        localStorage.setItem('dataFolderPath', dataFolderPath);
        
        // 尝试通过主项目的文件系统API自动设置数据文件夹路径
        try {
          // 调用主项目的文件系统API设置数据文件夹路径
          const response = await fetch('/api/filesystem/set-directory', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Site-Id': siteId // 传递子项目ID
            },
            body: JSON.stringify({
              directory: dataFolderPath
            })
          });
          
          if (response.ok) {
            // 标记已自动连接，后续可以通过主项目的API访问文件
            localStorage.setItem('dataFolderAutoConnected', 'true');
            localStorage.setItem('dataFolderPath', dataFolderPath);
            
            // 设置API连接状态为true
            setIsApiConnected(true);
            console.log(`[自动连接] ✓ 已通过主项目API连接数据文件夹`);
            
            // 自动加载数据文件夹中的项目
            try {
              const loadedProjects = await loadProjectsFromMainAPI();
              
              if (loadedProjects.length > 0) {
                console.log(`[自动连接] ✓ 自动加载了 ${loadedProjects.length} 个项目`);
                const sanitized = sanitizeProjects(loadedProjects);
                
                // 去重：按项目ID去重
                const uniqueProjects = new Map<string, Project>();
                sanitized.forEach(p => {
                  if (p && p.id) {
                    const existing = uniqueProjects.get(p.id);
                    // 如果已存在相同ID的项目，保留创建时间更早的
                    if (!existing || (p.createdAt && existing.createdAt && p.createdAt < existing.createdAt)) {
                      uniqueProjects.set(p.id, p);
                    }
                  }
                });
                
                const finalProjects = Array.from(uniqueProjects.values());
                console.log(`[自动连接] ✓ 去重后项目数量: ${finalProjects.length}`);
                
                // 更新项目列表
                setProjects(finalProjects);
                
                // 保存到 localStorage（作为备份）
                localStorage.setItem('novelProjects', JSON.stringify(finalProjects));
                
                console.log(`[自动连接] ✓ 项目已自动加载并更新到界面`);
              } else {
                console.log(`[自动连接] ⚠ 数据文件夹中没有找到项目`);
              }
            } catch (loadError) {
              console.error(`[自动连接] ✗ 自动加载项目失败:`, loadError);
              // 加载失败不影响连接状态，但记录错误
            }
          } else {
            console.warn(`[自动连接] ⚠ 设置数据文件夹路径失败，状态码: ${response.status}`);
            const errorText = await response.text();
            console.warn(`[自动连接] 错误响应:`, errorText);
          }
        } catch (error) {
          console.warn(`[自动连接] ⚠ 调用主项目文件系统API失败:`, error);
          // 即使API调用失败，也保存路径信息
          localStorage.setItem('dataFolderPath', dataFolderPath);
        }
      } else {
        console.log('[自动连接] 未检测到数据文件夹路径（API和环境变量都未提供），将使用默认行为');
      }
      
      // 检查浏览器是否支持 File System Access API
      if (!('showDirectoryPicker' in window)) {
        console.warn('浏览器不支持 File System Access API');
        return;
      }

      // 检查是否有保存的目录句柄 ID（浏览器可能支持持久化）
      const savedDirHandleId = localStorage.getItem('savedDirHandleId');
      if (!savedDirHandleId) {
        // 如果有数据文件夹路径且已自动连接，提示用户可以通过主项目API访问
        if (dataFolderPath && localStorage.getItem('dataFolderAutoConnected') === 'true') {
          console.log(`[自动连接] ✓ 数据文件夹已自动连接: ${dataFolderPath}`);
          console.log('[自动连接] 提示：可以通过主项目的文件系统API访问文件');
        } else if (dataFolderPath) {
          console.log(`[自动连接] 数据文件夹路径: ${dataFolderPath}`);
          console.log('[自动连接] 提示：请手动连接数据文件夹，或通过主项目的文件系统API访问');
        } else {
          // 首次使用，提示用户连接
          console.log('首次使用，需要用户手动连接数据文件夹');
        }
        return;
      }

      // 尝试恢复目录句柄（注意：这需要浏览器支持持久化存储）
      // 由于浏览器安全限制，通常无法直接恢复，需要用户重新授权
      // 这里我们只是记录日志，实际仍需要用户手动连接
      console.log('检测到保存的目录句柄 ID，但由于浏览器安全限制，需要用户重新授权');
    };

    // 延迟执行，确保组件已完全加载
    const timer = setTimeout(() => {
      autoConnectDataFolder().catch(error => {
        console.error(`[自动连接] 自动连接函数执行出错:`, error);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [dirHandle, isApiConnected]);

  // 初始化时检查是否已通过API连接（在自动连接之前执行）
  useEffect(() => {
    const isAutoConnected = localStorage.getItem('dataFolderAutoConnected') === 'true';
    if (isAutoConnected) {
      setIsApiConnected(true);
      console.log(`[初始化] ✓ 检测到已通过API自动连接`);
    }
  }, []);

  // Load from local storage on mount (仅在API加载失败时使用)
  useEffect(() => {
    // 检查是否已通过API自动连接
    const isAutoConnected = localStorage.getItem('dataFolderAutoConnected') === 'true';
    
    if (isAutoConnected) {
      // 如果已自动连接，优先尝试从API加载项目
      loadProjectsFromMainAPI()
        .then(loadedProjects => {
          if (loadedProjects.length > 0) {
            const sanitized = sanitizeProjects(loadedProjects);
            setProjects(sanitized);
            localStorage.setItem('novelProjects', JSON.stringify(sanitized));
          } else {
            // API加载失败或没有项目，尝试从 localStorage 加载
            const saved = localStorage.getItem('novelProjects');
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                const sanitized = sanitizeProjects(parsed);
                setProjects(sanitized);
              } catch (e) {
                console.error("[项目初始化] ✗ 从 localStorage 加载项目失败:", e);
              }
            }
          }
        })
        .catch(error => {
          console.error("[项目初始化] ✗ 从API加载项目失败:", error);
          // API加载失败，尝试从 localStorage 加载
          const saved = localStorage.getItem('novelProjects');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const sanitized = sanitizeProjects(parsed);
              setProjects(sanitized);
            } catch (e) {
              console.error("[项目初始化] ✗ 从 localStorage 加载项目失败:", e);
            }
          }
        });
    } else {
      // 未自动连接，从 localStorage 加载（传统方式）
      const saved = localStorage.getItem('novelProjects');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const sanitized = sanitizeProjects(parsed);
          setProjects(sanitized);
        } catch (e) {
          console.error("[项目初始化] ✗ 从 localStorage 加载项目失败:", e);
        }
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (projects.length > 0) {
      console.log('💾 保存项目到 localStorage，项目数:', projects.length);
      localStorage.setItem('novelProjects', JSON.stringify(projects));
    }
  }, [projects]);

  // Auto-save to Disk - 只在项目数据真正变化时保存
  useEffect(() => {
      if (dirHandle && currentProjectId) {
          const project = projects.find(p => p.id === currentProjectId);
          if (project) {
              // 计算数据哈希，避免重复保存
              const dataHash = JSON.stringify({
                  title: project.title,
                  fullText: project.fullText,
                  characters: project.characters,
                  scenes: project.scenes,
                  chapters: project.chapters
              });
              
              const lastSaved = lastSavedProjectRef.current;
              // 如果项目ID、标题和数据都没变化，不保存
              if (lastSaved && 
                  lastSaved.id === project.id && 
                  lastSaved.title === project.title &&
                  lastSaved.dataHash === dataHash) {
                  return;
              }
              
              const timer = setTimeout(() => {
                  // 如果已通过API连接，使用API方式保存；否则使用File System Access API
                  if (isApiConnected) {
                      fileSystem.saveProjectToMainAPI(project)
                          .then(() => {
                              lastSavedProjectRef.current = {
                                  id: project.id,
                                  title: project.title,
                                  dataHash: dataHash
                              };
                          })
                          .catch(err => {
                              console.error("[自动保存] ✗ 通过API保存项目失败:", err);
                          });
                  } else if (dirHandle) {
                      fileSystem.saveProjectToDirectory(dirHandle, project)
                          .then(() => {
                              lastSavedProjectRef.current = {
                                  id: project.id,
                                  title: project.title,
                                  dataHash: dataHash
                              };
                          })
                          .catch(err => console.error("Auto-save failed", err));
                  }
              }, 2000); 
              return () => clearTimeout(timer);
          }
      }
  }, [projects, currentProjectId, dirHandle]);

  // 通过主项目API加载项目列表
  const loadProjectsFromMainAPI = async (): Promise<Project[]> => {
    try {
      // 获取当前子项目的ID
      const siteId = (import.meta.env.VITE_SITE_ID as string) || '--';
      
      // 1. 获取项目列表
      const projectsResponse = await fetch('/api/filesystem/projects', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Site-Id': siteId
        }
      });
      
      if (!projectsResponse.ok) {
        console.warn(`[API加载] ⚠ 获取项目列表失败，状态码: ${projectsResponse.status}`);
        return [];
      }
      
      const projectsData = await projectsResponse.json();
      if (!projectsData.success || !Array.isArray(projectsData.projects)) {
        console.warn(`[API加载] ⚠ 项目列表格式不正确`);
        return [];
      }
      
      // 2. 对每个项目，读取完整的项目数据
      const loadedProjects: Project[] = [];
      
      for (const projectInfo of projectsData.projects) {
        try {
          const projectId = projectInfo.id;
          
          // 并行读取三个文件
          const [settingsResponse, originalResponse, storyboardsResponse] = await Promise.all([
            fetch(`/api/filesystem/read/${encodeURIComponent(projectId)}/settings.json`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Site-Id': siteId
              }
            }),
            fetch(`/api/filesystem/read/${encodeURIComponent(projectId)}/original.json`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Site-Id': siteId
              }
            }).catch(() => null), // original.json 可能不存在
            fetch(`/api/filesystem/read/${encodeURIComponent(projectId)}/storyboards.json`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'X-Site-Id': siteId
              }
            }).catch(() => null) // storyboards.json 可能不存在
          ]);
          
          // 读取 settings.json
          if (!settingsResponse || !settingsResponse.ok) {
            console.warn(`[API加载] ⚠ 无法读取项目 ${projectId} 的 settings.json`);
            continue;
          }
          
          const settingsData = await settingsResponse.json();
          if (!settingsData.success || !settingsData.data) {
            console.warn(`[API加载] ⚠ 项目 ${projectId} 的 settings.json 格式不正确`);
            continue;
          }
          
          const settings = settingsData.data;
          
          // 读取 original.json
          let original: any = null;
          if (originalResponse && originalResponse.ok) {
            try {
              const originalData = await originalResponse.json();
              if (originalData.success && originalData.data) {
                original = originalData.data;
              }
            } catch (e) {
              console.warn(`[API加载] ⚠ 解析项目 ${projectId} 的 original.json 失败:`, e);
            }
          }
          
          // 读取 storyboards.json
          let storyboards: any = null;
          if (storyboardsResponse && storyboardsResponse.ok) {
            try {
              const storyboardsData = await storyboardsResponse.json();
              if (storyboardsData.success && storyboardsData.data) {
                storyboards = storyboardsData.data;
              }
            } catch (e) {
              console.warn(`[API加载] ⚠ 解析项目 ${projectId} 的 storyboards.json 失败:`, e);
            }
          }
          
          // 构建项目对象（与 fileSystem.loadProjectsFromDirectory 的格式一致）
          const project: Project = {
            id: settings.id,
            title: settings.title,
            createdAt: settings.createdAt || Date.now(),
            fullText: original?.fullText || settings.fullText || '',
            characters: Array.isArray(settings.characters) ? settings.characters : [],
            scenes: Array.isArray(settings.scenes) ? settings.scenes : [],
            chapters: Array.isArray(storyboards?.chapters) ? storyboards.chapters : (Array.isArray(settings.chapters) ? settings.chapters : []),
            prompts: settings.prompts,
            debugLog: settings.debugLog
          };
          
          loadedProjects.push(project);
        } catch (error) {
          console.error(`[API加载] ✗ 加载项目 ${projectInfo.id} 失败:`, error);
          // 继续加载其他项目
        }
      }
      
      console.log(`[API加载] ✓ 总共加载了 ${loadedProjects.length} 个项目`);
      return loadedProjects;
    } catch (error) {
      console.error(`[API加载] ✗ 通过主项目API加载项目失败:`, error);
      return [];
    }
  };

  const sanitizeProjects = (parsed: any): Project[] => {
     if (!Array.isArray(parsed)) {
       console.warn('sanitizeProjects: 输入不是数组', parsed);
       return [];
     }
     
     return parsed.map((p: any) => {
       if (!p || !p.id || !p.title) {
         console.warn('sanitizeProjects: 项目数据不完整', p);
         return null;
       }
       
       const sanitized: Project = {
         id: p.id,
         title: p.title,
         createdAt: p.createdAt || Date.now(),
         fullText: p.fullText || '',
         characters: Array.isArray(p.characters) ? p.characters.map((c: any) => {
             // 字段名兼容：visualAge -> age，确保统一使用age字段
             const age = c.age || c.visualAge || '';
             // 移除旧字段（visualAge, actualAge），使用统一字段名
             const { visualAge, actualAge, ...restChar } = c;
             return {
                 ...restChar,
                 age: age, // 统一使用 age 字段
                 aliases: Array.isArray(c.aliases) ? c.aliases : [],
                 clothingStyles: Array.isArray(c.clothingStyles) ? c.clothingStyles.map((cl: any) => ({
                     name: cl.name || '', // 兼容旧数据，如果没有name字段则使用空字符串
                     phase: cl.phase || '',
                     description: cl.description || ''
                 })) : [],
                 weapons: Array.isArray(c.weapons) ? c.weapons : []
             };
         }) : [],
         scenes: Array.isArray(p.scenes) ? p.scenes.map((s: any) => ({
             ...s,
             aliases: Array.isArray(s.aliases) ? s.aliases : []
         })) : [],
         chapters: Array.isArray(p.chapters) ? p.chapters.map((c: any) => ({
            ...c,
            content: c.content || '',
            storyboard: Array.isArray(c.storyboard) ? c.storyboard.map((shot: any) => ({
                ...shot,
                // 确保shot有id字段，兼容uid
                id: shot.id || shot.uid || crypto.randomUUID(),
                uid: shot.uid // 保留uid以兼容旧数据
            })) : []
         })) : [],
         prompts: p.prompts,
         debugLog: p.debugLog
       };
       
       return sanitized;
     }).filter((p): p is Project => p !== null);
  }

  const handleOpenLocalFolder = async () => {
      // 如果已经通过API连接，提示用户并返回
      if (isApiConnected) {
          console.log('[手动连接] 已通过API自动连接，无需手动选择文件夹');
          const dataFolderPath = localStorage.getItem('dataFolderPath');
          if (dataFolderPath) {
              alert(`已通过主项目API自动连接到数据文件夹：\n${dataFolderPath}\n\n项目已自动加载，无需手动连接。`);
          } else {
              alert('已通过主项目API自动连接，项目已自动加载。');
          }
          return;
      }
      
      try {
          const handle = await fileSystem.openDirectory();
          setDirHandle(handle);
          
          // 尝试保存目录句柄的引用（用于显示）
          try {
              // 保存目录名称用于显示
              const dirName = (handle as any).name || '数据文件夹';
              localStorage.setItem('lastConnectedDirName', dirName);
          } catch (e) {
              console.warn('无法保存目录信息:', e);
          }
          
          console.log('📂 开始加载项目数据...');
          const diskProjects = await fileSystem.loadProjectsFromDirectory(handle);
          console.log('📂 从磁盘加载的项目数量:', diskProjects.length);
          
          if (diskProjects.length > 0) {
              console.log(`📥 从磁盘加载了 ${diskProjects.length} 个项目`);
              const sanitized = sanitizeProjects(diskProjects);
              console.log(`🧹 清理后项目数量: ${sanitized.length}`);
              
              // 去重：按项目ID去重，但允许不同文件夹有相同ID的情况（保留所有）
              // 注意：如果多个文件夹有相同的项目ID，可能是同一个项目的不同版本
              const uniqueProjects = new Map<string, Project>();
              sanitized.forEach(p => {
                  if (p && p.id) {
                      const existing = uniqueProjects.get(p.id);
                      // 如果已存在相同ID的项目，保留创建时间更早的（通常是更完整的）
                      if (!existing || (p.createdAt && existing.createdAt && p.createdAt < existing.createdAt)) {
                          uniqueProjects.set(p.id, p);
                      } else {
                          console.log(`⚠️ 跳过重复ID的项目: ${p.title} (${p.id})，已存在: ${existing.title}`);
                      }
                  }
              });
              
              const finalProjects = Array.from(uniqueProjects.values());
              console.log(`📊 去重后项目数量: ${finalProjects.length} (原始: ${sanitized.length})`);
              
              // 详细日志：检查每个项目的角色数据
              finalProjects.forEach(p => {
                  console.log(`📋 项目 "${p.title}" 数据检查:`, {
                      id: p.id,
                      charactersCount: p.characters?.length || 0,
                      scenesCount: p.scenes?.length || 0,
                      firstCharacter: p.characters && p.characters.length > 0 ? {
                          name: p.characters[0].name,
                          age: p.characters[0].age,
                          hasVisualAge: !!(p.characters[0] as any).visualAge
                      } : null
                  });
              });
              
              if (finalProjects.length < sanitized.length) {
                  console.warn(`⚠️ 有 ${sanitized.length - finalProjects.length} 个项目因ID重复被过滤`);
              }
              
              const existingIds = new Set(projects.map(p => p.id));
              const newProjects = finalProjects.filter(p => !existingIds.has(p.id));
              const updatedProjects = finalProjects.filter(p => existingIds.has(p.id));
              
              console.log(`📋 项目分类:`, {
                  新项目: newProjects.length,
                  已存在项目: updatedProjects.length,
                  当前项目总数: projects.length
              });
              
              // 合并新项目和更新已存在的项目
              if (newProjects.length > 0 || updatedProjects.length > 0) {
                  setProjects(prev => {
                      const updated = prev.map(existing => {
                          const updatedProject = finalProjects.find(p => p.id === existing.id);
                          if (updatedProject) {
                              console.log(`🔄 更新项目: ${updatedProject.title}`, {
                                  charactersCount: updatedProject.characters?.length || 0,
                                  scenesCount: updatedProject.scenes?.length || 0
                              });
                              return updatedProject;
                          }
                          return existing;
                      });
                      
                      // 添加新项目
                      const existingIds = new Set(updated.map(p => p.id));
                      const toAdd = finalProjects.filter(p => !existingIds.has(p.id));
                      
                      console.log(`📊 项目更新统计:`, {
                          新项目: toAdd.length,
                          更新项目: updatedProjects.length,
                          最终项目数: updated.length + toAdd.length
                      });
                      
                      return [...updated, ...toAdd];
                  });
                  
                  if (newProjects.length > 0 && updatedProjects.length > 0) {
                      alert(`成功加载目录！\n导入 ${newProjects.length} 个新项目\n更新 ${updatedProjects.length} 个已存在的项目\n总共找到 ${finalProjects.length} 个项目。`);
                  } else if (newProjects.length > 0) {
                      alert(`成功加载目录，导入了 ${newProjects.length} 个新项目。\n总共找到 ${finalProjects.length} 个项目。`);
                  } else {
                      alert(`成功更新 ${updatedProjects.length} 个已存在的项目数据。\n总共找到 ${finalProjects.length} 个项目。`);
                  }
              } else {
                  // 如果项目已存在且没有变化，也要确保项目列表包含这些项目
                  console.log(`ℹ️ 所有项目已存在且无变化`);
                  // 检查是否有项目在磁盘但不在当前列表中
                  const missingProjects = finalProjects.filter(p => !projects.some(existing => existing.id === p.id));
                  if (missingProjects.length > 0) {
                      console.log(`➕ 发现 ${missingProjects.length} 个缺失的项目，添加到列表`);
                      setProjects(prev => {
                          const combined = [...prev, ...missingProjects];
                          console.log(`📊 添加缺失项目后，总项目数: ${combined.length}`);
                          return combined;
                      });
                      alert(`成功加载目录，添加了 ${missingProjects.length} 个缺失的项目。\n总共找到 ${finalProjects.length} 个项目。`);
                  } else {
                      // 即使没有新项目，也要确保项目列表包含所有磁盘项目
                      // 这可以处理项目列表被清空的情况
                      const allProjectIds = new Set(projects.map(p => p.id));
                      const diskOnlyProjects = finalProjects.filter(p => !allProjectIds.has(p.id));
                      if (diskOnlyProjects.length > 0) {
                          console.log(`➕ 发现 ${diskOnlyProjects.length} 个仅在磁盘的项目，添加到列表`);
                          setProjects(prev => [...prev, ...diskOnlyProjects]);
                          alert(`成功加载目录，添加了 ${diskOnlyProjects.length} 个仅在磁盘的项目。\n总共找到 ${finalProjects.length} 个项目。`);
                      } else {
                          alert(`目录连接成功，所有项目已是最新。\n总共找到 ${finalProjects.length} 个项目。`);
                      }
                  }
              }
          } else {
              alert("目录连接成功，但未找到项目数据。\n请确保目录中包含 settings.json 文件或完整的项目 JSON 文件。");
          }
      } catch (e: any) {
          console.error('连接文件夹失败:', e);
          if (e.name === 'AbortError' || e.message?.includes('cancel')) {
              // 用户取消，不显示错误
              return;
          }
          alert(`连接失败: ${e.message || '未知错误'}\n\n请确保：\n1. 选择了正确的数据文件夹\n2. 文件夹中包含 settings.json 文件\n3. 浏览器已授予文件访问权限`);
      }
  };

  const handleLegacyImport = async (files: FileList) => {
      const newProjects: Project[] = [];
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.name.endsWith('.json')) {
              try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  if (data.id && data.title) newProjects.push(data);
              } catch (e) { console.warn(`Failed to parse ${file.name}`); }
          }
      }
      if (newProjects.length > 0) {
          const sanitized = sanitizeProjects(newProjects);
          const existingIds = new Set(projects.map(p => p.id));
          const uniqueProjects = sanitized.filter(p => !existingIds.has(p.id));
          setProjects(prev => [...prev, ...uniqueProjects]);
          alert(`导入了 ${uniqueProjects.length} 个项目。`);
      }
  };

  const currentProject = projects.find(p => p.id === currentProjectId);

  // Auto-switch view when project is selected
  useEffect(() => {
      if (currentProject && view === AppView.PROJECT_SELECT) {
          console.log('🔄 自动切换到 ANALYSIS 视图');
          setView(AppView.ANALYSIS);
      }
  }, [currentProject, view]);

  const handleAddProject = async () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      title: `新项目 ${projects.length + 1}`,
      createdAt: Date.now(),
      fullText: '',
      characters: [],
      scenes: [],
      chapters: []
    };
    
    // 先添加到列表
    setProjects([...projects, newProject]);
    setCurrentProjectId(newProject.id);
    setView(AppView.ANALYSIS);
    
    // 如果已通过API连接，使用API方式保存；否则使用File System Access API
    if (isApiConnected) {
      try {
        await fileSystem.saveProjectToMainAPI(newProject);
        // 更新保存状态，避免自动保存重复保存
        lastSavedProjectRef.current = {
            id: newProject.id,
            title: newProject.title,
            dataHash: JSON.stringify({
                title: newProject.title,
                fullText: newProject.fullText,
                characters: newProject.characters,
                scenes: newProject.scenes,
                chapters: newProject.chapters
            })
        };
      } catch (e: any) {
        console.error("[创建项目] ✗ 通过API保存新项目失败:", e);
        alert(`保存新项目失败: ${e.message || '未知错误'}\n项目已创建，但未保存到磁盘。`);
      }
    } else if (dirHandle) {
      try {
        await fileSystem.saveProjectToDirectory(dirHandle, newProject);
        // 更新保存状态，避免自动保存重复保存
        lastSavedProjectRef.current = {
            id: newProject.id,
            title: newProject.title,
            dataHash: JSON.stringify({
                title: newProject.title,
                fullText: newProject.fullText,
                characters: newProject.characters,
                scenes: newProject.scenes,
                chapters: newProject.chapters
            })
        };
      } catch (e: any) {
        console.error("保存新项目失败:", e);
        alert(`保存新项目失败: ${e.message || '未知错误'}\n项目已创建，但未保存到磁盘。`);
      }
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(!window.confirm("确定要删除这个项目吗？\n\n注意：这将同时删除磁盘上的项目文件夹。")) {
          return;
      }

      // 如果已通过API连接，使用API方式删除；否则使用File System Access API
      if (isApiConnected) {
          try {
              await fileSystem.deleteProjectFromMainAPI(id);
          } catch (e: any) {
              console.error("[删除项目] ✗ 通过API删除项目失败:", e);
              const shouldContinue = window.confirm(
                  `删除项目失败: ${e.message || '未知错误'}\n\n是否继续从列表中删除项目？\n（文件夹可能已被手动删除）`
              );
              if (!shouldContinue) {
                  return; // 用户选择不继续
              }
          }
      } else if (dirHandle) {
          try {
              await fileSystem.deleteProjectFromDirectory(dirHandle, id);
          } catch (e: any) {
              console.error("删除项目文件夹失败:", e);
              const shouldContinue = window.confirm(
                  `删除项目文件夹失败: ${e.message || '未知错误'}\n\n是否继续从列表中删除项目？\n（文件夹可能已被手动删除）`
              );
              if (!shouldContinue) {
                  return; // 用户选择不继续
              }
          }
      }

      // 从列表中删除项目
      setProjects(projects.filter(p => p.id !== id));
      if (currentProjectId === id) {
          setCurrentProjectId(null);
          setView(AppView.PROJECT_SELECT);
      }
      
      // 清除保存状态
      if (lastSavedProjectRef.current?.id === id) {
          lastSavedProjectRef.current = null;
      }
  }

  const handleRenameProject = async (id: string, newTitle: string) => {
      if (!newTitle.trim()) {
          alert("项目名称不能为空");
          return;
      }
      
      const project = projects.find(p => p.id === id);
      if (!project) return;
      
      const oldTitle = project.title;
      const updatedProject = { ...project, title: newTitle.trim() };
      
      // 如果已通过API连接，使用API方式保存；否则使用File System Access API
      if (isApiConnected) {
          try {
              await fileSystem.saveProjectToMainAPI(updatedProject, oldTitle);
              // 保存成功后才更新状态
              setProjects(prev => prev.map(p => 
                  p.id === id ? updatedProject : p
              ));
              // 更新保存状态，避免自动保存重复保存
              lastSavedProjectRef.current = {
                  id: updatedProject.id,
                  title: updatedProject.title,
                  dataHash: JSON.stringify({
                      title: updatedProject.title,
                      fullText: updatedProject.fullText,
                      characters: updatedProject.characters,
                      scenes: updatedProject.scenes,
                      chapters: updatedProject.chapters
                  })
              };
          } catch (e: any) {
              console.error("[重命名项目] ✗ 通过API保存失败:", e);
              alert(`保存项目重命名失败: ${e.message || '未知错误'}`);
          }
      } else if (dirHandle) {
          try {
              await fileSystem.saveProjectToDirectory(dirHandle, updatedProject, oldTitle);
              // 保存成功后才更新状态
              setProjects(prev => prev.map(p => 
                  p.id === id ? updatedProject : p
              ));
              // 更新保存状态，避免自动保存重复保存
              lastSavedProjectRef.current = {
                  id: updatedProject.id,
                  title: updatedProject.title,
                  dataHash: JSON.stringify({
                      title: updatedProject.title,
                      fullText: updatedProject.fullText,
                      characters: updatedProject.characters,
                      scenes: updatedProject.scenes,
                      chapters: updatedProject.chapters
                  })
              };
          } catch (e: any) {
              console.error("保存重命名项目失败:", e);
              alert(`保存项目失败: ${e.message || '未知错误'}`);
              // 保存失败，抛出错误，让 Sidebar 知道保存失败
              throw e;
          }
      } else {
          // 没有连接文件夹，直接更新状态
          setProjects(prev => prev.map(p => 
              p.id === id ? updatedProject : p
          ));
      }
  }

  const handleUpdateProject = (updated: Project) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentProject || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    // 重置文件输入，允许重新选择同一文件
    const fileInput = e.target;
    
    try {
      // 读取文件为 ArrayBuffer，以便尝试不同编码
      const arrayBuffer = await file.arrayBuffer();
      
      // 尝试使用 UTF-8 解码
      let text = '';
      let encoding = 'UTF-8';
      let hasEncodingIssue = false;
      
      try {
        const decoder = new TextDecoder('UTF-8', { fatal: true });
        text = decoder.decode(arrayBuffer);
        console.log('✅ 使用 UTF-8 编码成功读取文件');
      } catch (e) {
        // UTF-8 严格模式失败，尝试非严格模式
        try {
          const decoder = new TextDecoder('UTF-8', { fatal: false });
          text = decoder.decode(arrayBuffer);
          console.warn('⚠️ 使用 UTF-8 非严格模式读取文件，可能有乱码');
          
          // 检查是否包含明显的乱码字符（替换字符）
          if (text.includes('\uFFFD') || /[\uFFFD]/.test(text)) {
            hasEncodingIssue = true;
            const shouldContinue = window.confirm(
              '⚠️ 检测到文件可能不是 UTF-8 编码，可能会出现乱码。\n\n' +
              '建议：\n' +
              '1. 使用文本编辑器（如 Notepad++）将文件转换为 UTF-8 编码后重新上传\n' +
              '2. 或点击"取消"重新选择已转换的文件\n\n' +
              '是否继续上传当前文件？（可能会有乱码）'
            );
            
            if (!shouldContinue) {
              // 用户选择不继续，重置文件输入
              fileInput.value = '';
              return;
            }
          }
        } catch (e2) {
          console.error('文件解码失败:', e2);
          alert('文件读取失败，请确保文件是有效的文本文件。\n\n如果文件是中文编码（如 GBK），请先转换为 UTF-8 编码。');
          fileInput.value = '';
          return;
        }
      }
      
      // 只更新 fullText，不更新标题（避免创建新项目）
      // 如果项目还没有标题，才从文件名提取
      const newTitle = currentProject.title || file.name.replace(/\.txt$/i, '');
      handleUpdateProject({ 
        ...currentProject, 
        title: newTitle,
        fullText: text 
      });
      
      // 重置文件输入，允许重新选择
      fileInput.value = '';
      
      if (hasEncodingIssue) {
        console.warn(`⚠️ 文件上传完成，但可能存在编码问题: ${file.name}`);
      } else {
        console.log(`📄 文件上传成功: ${file.name} (${(file.size / 1024).toFixed(2)} KB, 编码: ${encoding})`);
      }
    } catch (error) {
      console.error('读取文件失败:', error);
      alert('读取文件失败，请检查文件格式。\n\n如果文件是中文编码（如 GBK），请先转换为 UTF-8 编码。');
      // 重置文件输入，允许重新选择
      fileInput.value = '';
    }
  };

  // --- Global Analysis Handler ---
  const handleStartAnalysis = async (fullText: string, prompt: string | undefined, delay: number | undefined) => {
      if (!currentProject) return;
      
      // Cancel previous if exists
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsAnalyzing(true);
      setAnalysisProgress(0);
      setAnalysisStatus("初始化分析引擎...");
      setAnalysisError(null);

      try {
          const result = await analyzeEntitiesWithProgress(
              fullText,
              prompt,
              delay,
              (pct, status) => {
                  setAnalysisProgress(pct);
                  setAnalysisStatus(status);
              },
              controller.signal
          );
          
          // Use callback to get latest state of projects
          setProjects(prev => {
              const updated = prev.map(p => {
                  if (p.id === currentProjectId) {
                      const updatedProject = {
                          ...p,
                          characters: result.characters,
                          scenes: result.scenes,
                          debugLog: result.debugLog // Save debug logs
                      };
                      console.log('✅ 分析完成，更新项目数据:', {
                          projectId: updatedProject.id,
                          charactersCount: updatedProject.characters.length,
                          scenesCount: updatedProject.scenes.length
                      });
                      return updatedProject;
                  }
                  return p;
              });
              return updated;
          });
      } catch (e: any) {
          if (e.message === 'Analysis cancelled' || e.name === 'AbortError') {
              setAnalysisStatus("已取消");
              setAnalysisError(null);
          } else {
              console.error(e);
              setAnalysisError(e.message || "分析失败");
          }
      } finally {
          // Only stop loading if the current controller is the one that finished/cancelled
          if (abortControllerRef.current === controller) {
              setIsAnalyzing(false);
              setAnalysisProgress(0);
              setAnalysisStatus("");
              abortControllerRef.current = null;
          }
      }
  };

  const handleCancelAnalysis = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          setAnalysisStatus("正在取消...");
      }
  };


  const renderContent = () => {
    console.log('📄 renderContent 被调用', {
      view,
      currentProjectId,
      currentProject: currentProject ? {
        id: currentProject.id,
        title: currentProject.title,
        hasFullText: !!currentProject.fullText,
        fullTextLength: currentProject.fullText?.length || 0,
        chaptersCount: currentProject.chapters?.length || 0
      } : null,
      projectsCount: projects.length
    });
    
    // Handle PROJECT_SELECT view
    if (view === AppView.PROJECT_SELECT || !currentProject) {
      console.log('显示项目选择界面');
      if (!currentProject && currentProjectId) {
        console.error('❌ 项目未找到！', {
          currentProjectId,
          availableProjectIds: projects.map(p => p.id)
        });
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 text-gray-500" style={{ backgroundColor: '#030712', minHeight: '100vh' }}>
           <FileText className="w-16 h-16 opacity-20 mb-4" />
           <p className="text-lg" style={{ color: '#9ca3af' }}>请选择或创建一个项目。</p>
           <p className="text-sm text-gray-600 mt-2" style={{ color: '#4b5563' }}>在左侧边栏中点击"新建项目"开始</p>
        </div>
      );
    }

    if (!currentProject.fullText) {
      console.log('项目没有 fullText，显示上传界面');
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 p-10">
           <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center shadow-2xl">
              <Upload className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-2">上传小说文件</h2>
              <p className="text-gray-400 mb-8">支持格式：.txt</p>
              <label className="inline-flex cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-8 rounded-lg transition-all shadow-lg">
                 <span>选择文件</span>
                 <input type="file" accept=".txt" className="hidden" onChange={handleFileUpload} />
              </label>
           </div>
        </div>
      );
    }

    try {
      switch (view) {
        case AppView.STORYBOARD:
          if (selectedChapterId) {
              return <StoryboardView project={currentProject} chapterId={selectedChapterId} onBack={() => setView(AppView.CHAPTERS)} onUpdateProject={handleUpdateProject} />;
          }
          return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 text-gray-500">
              <p>未选择章节</p>
            </div>
          );
        case AppView.EXPORT:
          return (
              <div className="flex-1 overflow-hidden bg-gray-950">
                  <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between bg-gray-950 z-10">
                     <h2 className="text-xl font-bold text-white">导出中心</h2>
                     <button onClick={() => setView(AppView.ANALYSIS)} className="text-gray-400 hover:text-white">关闭</button>
                  </div>
                  <ExportManager project={currentProject} />
              </div>
          );
        case AppView.SETTINGS:
         return (
           <div className="flex-1 overflow-hidden bg-gray-950">
               <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between bg-gray-950 z-10">
                  <h2 className="text-xl font-bold text-white">项目设置</h2>
                  <button onClick={() => setView(AppView.ANALYSIS)} className="text-gray-400 hover:text-white">关闭</button>
               </div>
               <SettingsView project={currentProject} onUpdateProject={handleUpdateProject} />
           </div>
         );
        
        case AppView.ANALYSIS:
        case AppView.CHAPTERS:
        default:
        return (
          <div className="flex-1 flex flex-col bg-gray-950 h-screen overflow-hidden">
            {/* Top Nav */}
            <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between bg-gray-950 z-10">
              <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{currentProject.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{(currentProject.fullText?.length || 0).toLocaleString()} 字</p>
              </div>
              <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                  <button onClick={() => setView(AppView.ANALYSIS)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === AppView.ANALYSIS ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>1. 设定提取</button>
                  <button onClick={() => setView(AppView.CHAPTERS)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === AppView.CHAPTERS ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>2. 章节 & 分镜</button>
              </div>
              <div className="flex items-center gap-1">
                  <button onClick={() => setView(AppView.EXPORT)} className="p-2 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-gray-800" title="导出数据"><Download className="w-5 h-5" /></button>
                  <button onClick={() => setView(AppView.SETTINGS)} className="p-2 rounded-lg transition-colors text-gray-400 hover:text-white hover:bg-gray-800" title="Prompt 设置"><Settings className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-6 relative">
              {view === AppView.ANALYSIS && (
                <React.Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  </div>
                }>
                  <EntityExtractionWrapper 
                    project={currentProject} 
                    onUpdateProject={handleUpdateProject}
                    loading={isAnalyzing}
                    progress={analysisProgress}
                    statusText={analysisStatus}
                    onStartAnalysis={handleStartAnalysis}
                    onCancelAnalysis={handleCancelAnalysis}
                    error={analysisError}
                  />
                </React.Suspense>
              )}
              {view === AppView.CHAPTERS && (
                <ChapterManager 
                    project={currentProject} 
                    onUpdateProject={handleUpdateProject} 
                    onSelectChapter={(id) => { setSelectedChapterId(id); setView(AppView.STORYBOARD); }}
                />
              )}
            </div>
          </div>
        );
      }
    } catch (error: any) {
      console.error('❌ renderContent 渲染错误:', error);
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-950 text-red-500 p-10">
          <h2 className="text-xl font-bold mb-4">渲染错误</h2>
          <pre className="bg-gray-900 p-4 rounded text-sm overflow-auto max-w-2xl">
            {error?.message || String(error)}
          </pre>
          <button 
            onClick={() => {
              setView(AppView.PROJECT_SELECT);
              setCurrentProjectId(null);
            }}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            返回项目列表
          </button>
        </div>
      );
    }
  };

  console.log('🎨 App 组件渲染中', {
    view,
    currentProjectId,
    projectsCount: projects.length,
    projectIds: projects.map(p => p.id),
    currentProjectTitle: currentProject?.title
  });

  return (
    <ErrorBoundary>
      <div className="flex h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden font-sans" style={{ minHeight: '100vh', backgroundColor: '#030712' }}>
        <Sidebar 
          projects={projects}
          currentProjectId={currentProjectId}
          onSelectProject={(id) => { 
            console.log('🖱️ 选择项目:', id);
            setCurrentProjectId(id); 
            setView(AppView.ANALYSIS); 
          }}
          onAddProject={handleAddProject}
          onDeleteProject={handleDeleteProject}
          onRenameProject={handleRenameProject}
          onOpenLocalFolder={handleOpenLocalFolder}
          onLegacyImport={handleLegacyImport}
          onOpenGlobalSettings={() => setShowGlobalSettings(true)}
          isLocalConnected={!!dirHandle || isApiConnected}
        />
        <main className="flex-1 flex flex-col relative" style={{ backgroundColor: '#030712', minHeight: '100vh' }}>
          {!hasApiKey && (
            <div className="absolute top-0 left-0 w-full bg-red-600/20 border-b border-red-500/50 text-red-200 px-4 py-2 text-center text-sm z-50 flex items-center justify-center gap-3">
              <AlertTriangle className="w-4 h-4" /> 
              <span>检测到缺少 API Key，功能可能无法正常使用。</span>
              <button
                onClick={() => setShowGlobalSettings(true)}
                className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-xs font-medium flex items-center gap-1"
              >
                <Key className="w-3 h-3" />
                前往设置
              </button>
            </div>
          )}
          
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>

        {/* Global Persistent Progress Indicator (Visible when analyzing but NOT in Analysis View) */}
        {isAnalyzing && view !== AppView.ANALYSIS && (
            <div className="absolute bottom-6 right-6 z-50 bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-2xl w-80 animate-slide-up">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-white flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500"/> 后台分析中...
                    </span>
                    <div className="flex items-center gap-2">
                         <span className="text-xs text-indigo-400">{analysisProgress}%</span>
                         <button onClick={handleCancelAnalysis} className="text-gray-500 hover:text-white">
                             <X className="w-3.5 h-3.5" />
                         </button>
                    </div>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden mb-2">
                   <div className="bg-indigo-500 h-full transition-all duration-300" style={{width: `${analysisProgress}%`}}></div>
                </div>
                <p className="text-[10px] text-gray-500 truncate">{analysisStatus}</p>
            </div>
        )}
        </main>

        {/* 全局设置模态框 */}
        <GlobalSettings 
          isOpen={showGlobalSettings}
          onClose={() => setShowGlobalSettings(false)}
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;