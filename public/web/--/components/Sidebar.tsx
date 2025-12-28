import React, { useEffect, useState, useRef } from 'react';
import { Project } from '../types';
import { Plus, BookOpen, Trash2, Film, ChevronRight, FolderOpen, HardDrive, Key, Upload, Edit2, Check, X, Settings } from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onRenameProject?: (id: string, newTitle: string) => void;
  onOpenLocalFolder?: () => Promise<void>;
  onLegacyImport?: (files: FileList) => void; // New prop for fallback
  onOpenGlobalSettings?: () => void; // 新增：打开全局设置
  isLocalConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onRenameProject,
  onOpenLocalFolder,
  onLegacyImport,
  onOpenGlobalSettings,
  isLocalConnected = false
}) => {
  console.log('📋 Sidebar 组件渲染，项目数:', projects.length);
  
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setHasCustomKey(!!localStorage.getItem('custom_gemini_api_key'));
  }, [projects]);

  // 当进入编辑模式时，聚焦输入框
  useEffect(() => {
      if (editingProjectId && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
      }
  }, [editingProjectId]);

  const handleStartRename = (project: Project, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingProjectId(project.id);
      setEditingTitle(project.title);
  };

  const handleSaveRename = async (projectId: string) => {
      if (!editingTitle.trim() || !onRenameProject) {
          return;
      }
      
      try {
          await onRenameProject(projectId, editingTitle.trim());
          // 只有保存成功才清空编辑状态
          setEditingProjectId(null);
          setEditingTitle('');
      } catch (e) {
          // 保存失败，保持编辑状态，让用户重试
          console.error("重命名失败:", e);
      }
  };

  const handleCancelRename = () => {
      setEditingProjectId(null);
      setEditingTitle('');
  };

  const handleKeyDown = async (e: React.KeyboardEvent, projectId: string) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          await handleSaveRename(projectId);
      } else if (e.key === 'Escape') {
          handleCancelRename();
      }
  };

  const handleFolderConnect = async () => {
      // Check environment immediately before async call to preserve user gesture token for fallback
      const isIframe = window.self !== window.top;
      const hasFSAccess = 'showDirectoryPicker' in window;
      
      // If we are in an environment that definitely doesn't support FS Access (like iframes or older browsers),
      // we trigger the fallback input IMMEDIATELY without waiting for an async promise to reject.
      // This ensures the browser doesn't block the file picker dialog.
      if (isIframe || !hasFSAccess || !onOpenLocalFolder) {
          fileInputRef.current?.click();
          return;
      }

      // Try modern API
      try {
          await onOpenLocalFolder();
      } catch (e: any) {
          console.warn("Modern FS API failed, trying legacy fallback:", e);
          // If the async call failed, we try fallback, but note that some browsers might block this
          // if the await took too long. The synchronous check above handles most cases.
          fileInputRef.current?.click();
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0 && onLegacyImport) {
          onLegacyImport(e.target.files);
      }
      // Reset value so we can select same folder again if needed
      if (e.target) e.target.value = '';
  };

  return (
    <div className="w-72 bg-gray-950 border-r border-gray-800 flex flex-col h-screen" style={{ width: '288px', backgroundColor: '#030712', borderRight: '1px solid #1f2937', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-2 text-indigo-400 mb-6">
          <Film className="w-6 h-6" />
          <h1 className="text-xl font-serif font-bold tracking-tight text-white">小说转分镜 (NovelToFilm)</h1>
        </div>
        <button
          onClick={onAddProject}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-lg transition-all duration-200 font-medium shadow-lg shadow-indigo-900/20"
        >
          <Plus className="w-4 h-4" />
          新建项目
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">我的小说库</h3>
        {projects.length === 0 && (
          <div className="text-center text-gray-600 py-8 text-sm">
            暂无项目
          </div>
        )}
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => {
                if (editingProjectId !== project.id) {
                    onSelectProject(project.id);
                }
            }}
            onDoubleClick={(e) => {
                if (onRenameProject) {
                    handleStartRename(project, e);
                }
            }}
            className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 ${
              currentProjectId === project.id
                ? 'bg-gray-800 text-white ring-1 ring-gray-700'
                : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
              <BookOpen className={`w-4 h-4 flex-shrink-0 ${currentProjectId === project.id ? 'text-indigo-400' : 'text-gray-600'}`} />
              {editingProjectId === project.id ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, project.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 bg-gray-900 border border-indigo-500 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-0"
                  />
                  <button
                    onClick={async (e) => {
                        e.stopPropagation();
                        await handleSaveRename(project.id);
                    }}
                    className="p-1 hover:bg-emerald-900/30 text-emerald-400 rounded transition-all"
                    title="保存"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCancelRename();
                    }}
                    className="p-1 hover:bg-red-900/30 text-red-400 rounded transition-all"
                    title="取消"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="truncate text-sm font-medium">{project.title}</span>
                  {onRenameProject && (
                    <button
                      onClick={(e) => handleStartRename(project, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-900/30 text-gray-500 hover:text-indigo-400 rounded transition-all flex-shrink-0"
                      title="重命名项目（或双击）"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
            {currentProjectId === project.id && editingProjectId !== project.id && (
               <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
            )}
            {editingProjectId !== project.id && (
              <button
                onClick={(e) => onDeleteProject(project.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded-md transition-all flex-shrink-0"
                title="删除项目"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-gray-800 space-y-3">
        {/* Hidden fallback input */}
        <input 
            type="file" 
            ref={fileInputRef}
            className="hidden"
            // @ts-ignore - Non-standard attribute for folder selection
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleFileChange}
        />

        <button 
            onClick={handleFolderConnect}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all ${isLocalConnected ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-900/50' : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
        >
            {isLocalConnected ? <HardDrive className="w-4 h-4"/> : <FolderOpen className="w-4 h-4"/>}
            <div className="text-left">
                <div className="font-semibold">{isLocalConnected ? '已连接本地存储' : '连接本地数据文件夹'}</div>
                <div className="text-[10px] opacity-70">
                    {isLocalConnected ? '自动保存中...' : '点击尝试连接 (支持 Iframe)'}
                </div>
            </div>
        </button>

        {/* 全局设置按钮 */}
        {onOpenGlobalSettings && (
          <button 
            onClick={onOpenGlobalSettings}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-sm transition-all bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          >
            <Settings className="w-4 h-4" />
            <div className="text-left">
              <div className="font-semibold">全局设置</div>
              <div className="text-[10px] opacity-70">
                API Key 等全局配置
              </div>
            </div>
          </button>
        )}
        
        {hasCustomKey && (
             <div className="flex items-center gap-2 justify-center text-[10px] text-yellow-500/80 bg-yellow-900/10 border border-yellow-900/20 p-1.5 rounded">
                 <Key className="w-3 h-3" /> 使用自定义 API Key
             </div>
        )}

        <div className="text-xs text-gray-600 text-center">
             v1.3.2 &bull; Gemini 2.5 Flash
        </div>
      </div>
    </div>
  );
};