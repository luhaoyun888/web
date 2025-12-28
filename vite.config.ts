import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync, accessSync, constants } from 'fs';
import { spawn, exec } from 'child_process';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 存储运行中的项目进程
const runningProjects = new Map<string, any>();

// 存储文件系统基础目录路径（按子网站ID索引）
const fsBaseDirectories = new Map<string, string>();

// 查找 public/web 目录的辅助函数
function findWebDirectory(): string | null {
  const cwd = process.cwd();
  const possiblePaths = [
    path.join(cwd, 'public', 'web'),
    path.resolve(cwd, 'public', 'web'),
  ];
  
  try {
    possiblePaths.push(
      path.join(__dirname, '..', 'public', 'web'),
      path.resolve(__dirname, '..', 'public', 'web')
    );
  } catch (e) {
    // __dirname 不可用，跳过
  }
  
  for (const testPath of possiblePaths) {
    try {
      const stat = statSync(testPath);
      if (stat.isDirectory()) {
        return testPath;
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}

// ==================== 路径解析工具函数（统一规则） ====================

/**
 * 获取子项目根目录
 * 规则：public/web/{子项目ID}
 */
function getSubsiteRoot(subsiteId: string): string {
  const webDir = findWebDirectory();
  if (!webDir) {
    // 如果找不到web目录，使用默认规则
    return path.join(process.cwd(), 'public', 'web', subsiteId);
  }
  return path.join(webDir, subsiteId);
}

/**
 * 获取子项目数据目录
 * 规则：public/web/{子项目ID}/data
 */
function getSubsiteDataDir(subsiteId: string): string {
  return path.join(getSubsiteRoot(subsiteId), 'data');
}

/**
 * 获取子项目配置文件路径
 * 规则：public/web/{子项目ID}/vite.config.ts
 */
function getSubsiteConfigPath(subsiteId: string): string {
  return path.join(getSubsiteRoot(subsiteId), 'vite.config.ts');
}

/**
 * 获取子项目package.json路径
 * 规则：public/web/{子项目ID}/package.json
 */
function getSubsitePackagePath(subsiteId: string): string {
  return path.join(getSubsiteRoot(subsiteId), 'package.json');
}

// ==================== 配置读取工具函数 ====================

/**
 * 从vite.config.ts中提取端口号
 * 支持多种格式：server: { port: 数字 }、const port = 数字等
 */
function extractPortFromConfig(configPath: string): number | null {
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    
    // 尝试多种端口匹配模式
    const portMatch = configContent.match(/server:\s*\{[^}]*port:\s*(\d+)/s) ||
                     configContent.match(/port:\s*(\d+)/) ||
                     configContent.match(/(?:const|let|var)\s+port\s*=\s*(\d+)/) ||
                     configContent.match(/port\s*=\s*(\d+)/);
    
    if (portMatch) {
      return parseInt(portMatch[1]);
    }
  } catch (e: any) {
    console.error(`[路径工具] 读取配置文件失败 ${configPath}:`, e.message);
  }
  
  return null;
}

// ==================== 原有函数 ====================

// 读取子网站配置文件
function readSiteConfig(siteId: string): { dataDirectory?: string } | null {
  const webDir = findWebDirectory();
  if (!webDir) {
    return null;
  }
  
  const siteConfigPath = path.join(webDir, siteId, 'site.config.json');
  
  if (!existsSync(siteConfigPath)) {
    return null;
  }
  
  try {
    const configContent = readFileSync(siteConfigPath, 'utf-8');
    const config = JSON.parse(configContent);
    console.log(`[文件系统API] 读取到子网站配置 (${siteId}):`, config);
    return config;
  } catch (e: any) {
    console.warn(`[文件系统API] 读取子网站配置失败 (${siteId}):`, e.message);
    return null;
  }
}

// ==================== 动态子项目发现 ====================

/**
 * 子项目信息接口
 */
interface SubsiteInfo {
  id: string;
  port: number | null;
  path: string;
  packagePath: string;
  configPath: string;
  dataDir: string;
  name?: string;
}

/**
 * 动态发现所有子项目
 * 规则：扫描 public/web 目录，查找有 package.json 的目录
 */
function discoverSubsites(): SubsiteInfo[] {
  const webDir = findWebDirectory();
  if (!webDir) {
    console.warn('[子项目发现] 未找到 public/web 目录');
    return [];
  }
  
  const subsites: SubsiteInfo[] = [];
  
  try {
    const entries = readdirSync(webDir, { withFileTypes: true });
    
    for (const entry of entries) {
      // 跳过隐藏文件和特殊目录
      if (entry.name.startsWith('.') || entry.name === 'README.md') {
        continue;
      }
      
      if (!entry.isDirectory()) {
        continue;
      }
      
      const subsiteId = entry.name;
      const subsiteRoot = getSubsiteRoot(subsiteId);
      const packagePath = getSubsitePackagePath(subsiteId);
      const configPath = getSubsiteConfigPath(subsiteId);
      const dataDir = getSubsiteDataDir(subsiteId);
      
      // 检查是否有 package.json（判断是否为有效子项目）
      if (!existsSync(packagePath)) {
        console.log(`[子项目发现] 跳过 ${subsiteId}（缺少 package.json）`);
        continue;
      }
      
      // 读取 package.json 获取项目名称
      let projectName: string | undefined;
      try {
        const packageContent = readFileSync(packagePath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        projectName = packageJson.name;
      } catch (e) {
        // 忽略解析错误
      }
      
      // 读取端口配置
      const port = extractPortFromConfig(configPath);
      
      subsites.push({
        id: subsiteId,
        port,
        path: subsiteRoot,
        packagePath,
        configPath,
        dataDir,
        name: projectName
      });
      
      console.log(`[子项目发现] ✓ 发现子项目: ${subsiteId} (${projectName || '未命名'}) - 端口: ${port || '未配置'}`);
    }
    
    console.log(`[子项目发现] 共发现 ${subsites.length} 个子项目`);
  } catch (e: any) {
    console.error('[子项目发现] ✗ 扫描失败:', e.message);
  }
  
  return subsites;
}

// ==================== 原有函数 ====================

// 获取子网站的数据目录
function getDataDirectoryForSite(siteId: string): string {
  // 如果已缓存，直接返回
  if (fsBaseDirectories.has(siteId)) {
    return fsBaseDirectories.get(siteId)!;
  }
  
  // 优先级1: 读取 site.config.json 配置
  const siteConfig = readSiteConfig(siteId);
  if (siteConfig?.dataDirectory) {
    const webDir = findWebDirectory();
    let configDir: string;
    
    if (path.isAbsolute(siteConfig.dataDirectory)) {
      // 绝对路径，直接使用
      configDir = siteConfig.dataDirectory;
    } else {
      // 相对路径，相对于子网站目录或项目根目录
      if (webDir) {
        // 相对于子网站目录
        configDir = path.resolve(webDir, siteId, siteConfig.dataDirectory);
      } else {
        // 相对于项目根目录
        configDir = path.join(process.cwd(), siteConfig.dataDirectory);
      }
    }
    
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
      console.log(`[文件系统API] 已创建配置的数据目录: ${configDir}`);
    }
    
    fsBaseDirectories.set(siteId, configDir);
    console.log(`[文件系统API] 使用配置的数据目录 (${siteId}): ${configDir}`);
    return configDir;
  }
  
  // 优先级2: 子网站内部 data/ 目录（默认路径）
  const webDir = findWebDirectory();
  if (webDir) {
    const internalDataDir = path.join(webDir, siteId, 'data');
    if (!existsSync(internalDataDir)) {
      mkdirSync(internalDataDir, { recursive: true });
      console.log(`[文件系统API] 已创建子网站内部数据目录: ${internalDataDir}`);
    }
    
    fsBaseDirectories.set(siteId, internalDataDir);
    console.log(`[文件系统API] 使用子网站内部数据目录 (${siteId}): ${internalDataDir}`);
    return internalDataDir;
  }
  
  // 回退: 项目根目录下的 public/web/子网站ID/data
  const fallbackDataDir = path.join(process.cwd(), 'public', 'web', siteId, 'data');
  if (!existsSync(fallbackDataDir)) {
    mkdirSync(fallbackDataDir, { recursive: true });
    console.log(`[文件系统API] 已创建回退数据目录: ${fallbackDataDir}`);
  }
  
  fsBaseDirectories.set(siteId, fallbackDataDir);
  console.warn(`[文件系统API] 使用回退数据目录 (${siteId}): ${fallbackDataDir}`);
  return fallbackDataDir;
}

// 从请求中识别子网站ID（子项目文件夹名称）
// 规则：子项目目录名就是项目ID
function getSiteIdFromRequest(req: any): string {
  console.log(`[getSiteIdFromRequest] ========== 识别子项目ID ==========`);
  console.log(`[getSiteIdFromRequest] 请求URL: ${req.url}`);
  console.log(`[getSiteIdFromRequest] 请求头:`, {
    'x-site-id': req.headers['x-site-id'],
    'referer': req.headers.referer,
    'origin': req.headers.origin
  });
  
  // 方法1: 优先从请求头获取（最可靠）
  const siteIdHeader = req.headers['x-site-id'];
  if (siteIdHeader && typeof siteIdHeader === 'string' && siteIdHeader.trim() !== '') {
    const siteId = siteIdHeader.trim();
    console.log(`[getSiteIdFromRequest] ✓ 从请求头获取: ${siteId}`);
    return siteId;
  }
  
  // 方法2: 从Referer中解析（适用于通过主站代理访问的情况）
  const referer = req.headers.referer || req.headers.origin || '';
  if (referer) {
    const refererMatch = referer.match(/\/web\/([^\/]+)/);
    if (refererMatch && refererMatch[1]) {
      const siteId = refererMatch[1];
      console.log(`[getSiteIdFromRequest] ✓ 从Referer获取: ${siteId}`);
      return siteId;
    }
  }
  
  // 方法3: 从URL路径中解析（如果路径包含 /web/子项目ID）
  if (req.url) {
    const urlMatch = req.url.match(/\/web\/([^\/]+)/);
    if (urlMatch && urlMatch[1]) {
      const siteId = urlMatch[1];
      console.log(`[getSiteIdFromRequest] ✓ 从URL路径获取: ${siteId}`);
      return siteId;
    }
  }
  
  // 如果无法识别，返回空字符串（不再使用默认值，避免自动创建目录）
  // 注意：调用方需要检查返回值，如果为空应返回错误响应
  console.warn(`[getSiteIdFromRequest] ⚠ 无法识别子项目ID`);
  console.warn(`[getSiteIdFromRequest] 请确保子网站发送正确的 X-Site-Id 请求头`);
  return '';
}

// 获取默认数据目录（向后兼容，使用默认子网站ID）
function getDefaultDataDirectory(): string {
  return getDataDirectoryForSite('--main');
}

// 在主项目中扫描子项目的 data 文件夹
function scanSubsiteDataFolder(siteId: string): {
  path: string;
  exists: boolean;
  projectCount: number;
  projects: Array<{
    id: string;
    title: string;
    folderName: string;
    folderPath: string;
    createdAt?: number;
  }>;
} {
  const dataDir = getSubsiteDataDir(siteId);
  const result = {
    path: dataDir,
    exists: existsSync(dataDir),
    projectCount: 0,
    projects: [] as Array<{
      id: string;
      title: string;
      folderName: string;
      folderPath: string;
      createdAt?: number;
    }>
  };
  
  if (result.exists) {
    try {
      const entries = readdirSync(dataDir, { withFileTypes: true });
      const projectDirs = entries.filter(entry => entry.isDirectory());
      result.projectCount = projectDirs.length;
      
      for (const projectDir of projectDirs) {
        try {
          const projectPath = path.join(dataDir, projectDir.name);
          const settingsPath = path.join(projectPath, 'settings.json');
          
          if (existsSync(settingsPath)) {
            const settingsContent = readFileSync(settingsPath, 'utf-8');
            const settings = JSON.parse(settingsContent);
            
            if (settings.id && settings.title) {
              result.projects.push({
                id: settings.id,
                title: settings.title,
                folderName: projectDir.name,
                folderPath: projectPath,
                createdAt: settings.createdAt
              });
            }
          }
        } catch (e) {
          // 忽略单个项目读取错误
          console.warn(`[扫描数据文件夹] 无法读取项目 ${projectDir.name}:`, (e as any).message);
        }
      }
    } catch (e) {
      // 忽略扫描错误
      console.warn(`[扫描数据文件夹] 扫描 ${siteId} 的 data 文件夹失败:`, (e as any).message);
    }
  }
  
  return result;
}


// 检查端口是否被占用
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Windows: 使用 netstat 检查端口，更精确的匹配
      // 检查 TCP 和 UDP 端口，确保匹配 LISTENING 状态
      exec(`netstat -ano | findstr /C:":${port}"`, (error, stdout) => {
        if (error) {
          // 命令执行失败或没有找到，返回false
          resolve(false);
          return;
        }
        // 检查输出中是否包含端口号且状态为 LISTENING
        const lines = stdout.split('\n').filter(line => line.trim().length > 0);
        const portInUse = lines.some(line => {
          const trimmed = line.trim();
          // 检查是否包含 :端口号 且状态为 LISTENING（TCP）或包含端口号（UDP）
          return (trimmed.includes(`:${port}`) && trimmed.includes('LISTENING')) ||
                 (trimmed.includes(`:${port}`) && trimmed.includes('UDP'));
        });
        resolve(portInUse);
      });
    } else {
      // Unix/Linux: 使用 lsof 检查端口
      exec(`lsof -i :${port}`, (error, stdout) => {
        resolve(stdout.trim().length > 0);
      });
    }
  });
}

// Vite 插件：读取项目列表
function projectListPlugin(): Plugin {
  return {
    name: 'project-list',
    configureServer(server) {
      // 读取项目列表 API - 放在最前面确保优先处理
      server.middlewares.use('/api/projects/list', (req, res, next) => {
        console.log(`[项目列表API] ========== 收到请求 ==========`);
        console.log(`[项目列表API] 方法: ${req.method}, URL: ${req.url}`);
        
        if (req.method !== 'GET') {
          console.log(`[项目列表API] 方法不匹配，跳过: ${req.method}`);
          return next();
        }

        // 使用统一规则：通过discoverSubsites()发现所有子项目
        (async () => {
          try {
            console.log(`[项目列表API] ========== 开始扫描子项目 ==========`);
            
            // 使用统一规则发现所有子项目
            const subsites = discoverSubsites();
            
            if (subsites.length === 0) {
              console.warn(`[项目列表API] ⚠ 未找到任何子项目`);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ 
                success: true, 
                message: '未找到子项目',
                projects: []
              }));
              return;
            }
            
            console.log(`[项目列表API] ✓ 发现 ${subsites.length} 个子项目`);
            
            // 使用 Promise.all 并行处理所有子项目
            const projectPromises = subsites.map(async (subsite) => {
              try {
                console.log(`[项目列表API] 处理子项目: ${subsite.id} (${subsite.name || '未命名'})`);
                
                // 使用统一规则：从discoverSubsites()已经获取了基本信息
                const projectName = subsite.name || subsite.id;
                const port = subsite.port;
                
                // 如果端口未配置，使用默认值（不应该发生，因为discoverSubsites已经处理了）
                if (!port) {
                  console.warn(`[项目列表API] ⚠ 子项目 ${subsite.id} 端口未配置`);
                  return null;
                }
                
                // 在主项目中直接扫描子项目的 data 文件夹
                const dataFolderInfo = scanSubsiteDataFolder(subsite.id);
                console.log(`[项目列表API] ✓ 扫描子项目数据文件夹 (${subsite.id}): 找到 ${dataFolderInfo.projectCount} 个项目`);
                
                // 通过检查端口是否开放来判断子项目是否运行
                const isRunning = await checkPort(port);
                console.log(`[项目列表API] 子项目 ${subsite.id} 端口 ${port} 状态: ${isRunning ? '运行中' : '未运行'}`);
                
                const finalPort = port;
                const finalUrl = `http://localhost:${finalPort}`;

                return {
                  id: subsite.id,
                  name: projectName,
                  path: subsite.path,
                  port: finalPort,
                  url: finalUrl,
                  dataFolder: dataFolderInfo,
                  running: isRunning,
                  infoSource: '文件系统'
                };
              } catch (error: any) {
                console.error(`[项目列表API] ✗ 处理子项目 ${subsite.id} 时出错:`, error.message);
                console.error(`[项目列表API] 错误堆栈:`, error.stack);
                return null;
              }
            });

            // 等待所有项目处理完成
            const projectResults = await Promise.all(projectPromises);
            
            // 过滤掉 null 值
            const projects = projectResults.filter((p): p is NonNullable<typeof p> => p !== null);
            
            console.log(`[项目列表API] ========== 扫描完成 ==========`);
            console.log(`[项目列表API] 共找到 ${projects.length} 个项目`);
            if (projects.length > 0) {
              console.log(`[项目列表API] 项目列表详情:`);
              projects.forEach((p, index) => {
                console.log(`[项目列表API]   ${index + 1}. ${p.id} (${p.name}) - 端口: ${p.port}, 来源: ${p.infoSource}`);
              });
            } else {
              console.warn(`[项目列表API] ⚠ 未找到任何项目！`);
              console.warn(`[项目列表API] 请检查: 1) public/web 目录是否存在 2) 子目录是否有 package.json 文件`);
            }

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            const response = { success: true, projects };
            console.log(`[项目列表API] 返回响应:`, JSON.stringify(response, null, 2));
            console.log(`[项目列表API] =================================`);
            res.end(JSON.stringify(response));
          } catch (error: any) {
            console.error('[项目列表API] ✗ 读取项目列表失败:', error);
            console.error('[项目列表API] 错误堆栈:', error.stack);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ 
              success: false, 
              message: error.message,
              stack: error.stack,
              projects: []
            }));
          }
        })();
      });

      // 读取项目配置（端口等）- 使用统一规则
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/project/config/') && req.method === 'GET') {
          try {
            // 解析 projectId
            const urlPath = req.url.replace('/api/project/config/', '');
            const projectId = decodeURIComponent(urlPath.split('?')[0]);
            
            console.log(`[项目配置API] 请求URL: ${req.url}`);
            console.log(`[项目配置API] 解析的projectId: ${projectId}`);
            
            // 使用统一规则获取子项目信息
            const subsite = discoverSubsites().find(s => s.id === projectId);
            
            if (!subsite) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: false, message: '子项目不存在' }));
              return;
            }
            
            // 使用统一规则获取端口
            const port = subsite.port;
            if (!port) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: false, message: '子项目端口未配置' }));
              return;
            }

            // 使用统一规则构造地址（子网站直接运行在端口上）
            const projectUrl = `http://localhost:${port}`;
            
            // 获取数据文件夹路径
            const dataFolderPath = subsite.dataDir;
            const dataFolderInfo = scanSubsiteDataFolder(projectId);
            
            console.log(`[项目配置API] 返回配置 - 端口: ${port}, URL: ${projectUrl}, 数据文件夹: ${dataFolderPath}`);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              success: true,
              port: port,
              url: projectUrl,
              path: subsite.path,
              dataFolder: {
                path: dataFolderPath,
                exists: dataFolderInfo.exists,
                projectCount: dataFolderInfo.projectCount,
                projects: dataFolderInfo.projects
              }
            }));
          } catch (error: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: false, message: error.message }));
          }
        } else {
          next();
        }
      });

      // 启动项目 API
      server.middlewares.use((req, res, next) => {
        // 添加调试日志
        if (req.url?.includes('/api/project/start/')) {
          console.log(`[启动API] 收到请求: ${req.method} ${req.url}`);
        }
        
        if (req.url?.startsWith('/api/project/start/') && req.method === 'POST') {
          const projectId = req.url.split('/').pop() || '';
          console.log(`[启动API] 处理启动请求，项目ID: ${projectId}`);
          
          // 使用统一规则获取子项目信息
          const subsite = discoverSubsites().find(s => s.id === projectId);
          
          if (!subsite) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: false, message: '子项目不存在' }));
            return;
          }
          
          const projectPath = subsite.path;
          const port = subsite.port;
          
          if (!port) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: false, message: '子项目端口未配置' }));
            return;
          }
          
          console.log(`[启动API] 项目路径: ${projectPath}, 端口: ${port}`);

          // 检查是否已经在运行
          if (runningProjects.has(projectId)) {
            const proc = runningProjects.get(projectId);
            if (proc && !proc.killed) {
              checkPort(port).then((portInUse) => {
                if (portInUse) {
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, message: '项目已在运行', port }));
                } else {
                  runningProjects.delete(projectId);
                  startProjectProcess(projectId, projectPath, port, res);
                }
              });
              return;
            }
          }

          // 检查端口是否被占用
          console.log(`[启动API] 检查端口 ${port} 是否被占用...`);
          checkPort(port).then((portInUse) => {
            console.log(`[启动API] 端口 ${port} 占用状态: ${portInUse}`);
            if (portInUse) {
              // 端口被占用，检查是否有我们的进程记录
              if (runningProjects.has(projectId)) {
                const proc = runningProjects.get(projectId);
                if (proc && !proc.killed) {
                  console.log(`[启动API] 端口被占用且进程记录存在，项目已在运行`);
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ 
                    success: true, 
                    message: '项目已在运行', 
                    port,
                    pid: proc.pid,
                    alreadyRunning: true
                  }));
                  return;
                } else {
                  // 进程记录存在但进程已死，清理记录
                  console.log(`[启动API] 进程记录存在但进程已死，清理记录并重新启动`);
                  runningProjects.delete(projectId);
                }
              }
              
              // 端口被占用但没有我们的进程记录，可能是其他程序占用
              // 或者项目之前启动但进程记录丢失了
              // 为了安全，我们仍然尝试启动项目（可能会失败，但会给出明确错误）
              console.log(`[启动API] 端口被占用但没有进程记录，尝试启动项目（可能会失败）`);
              console.log(`[启动API] 警告：如果端口被其他程序占用，启动将失败`);
              startProjectProcess(projectId, projectPath, port, res);
            } else {
              console.log(`[启动API] 端口未被占用，开始启动项目进程...`);
              startProjectProcess(projectId, projectPath, port, res);
            }
          });
        } else {
          next();
        }
      });

      // 启动项目进程的辅助函数（立即返回，后台监控）
      function startProjectProcess(projectId: string, projectPath: string, port: number, res: any) {
        console.log(`[启动进程] ========== 开始启动项目 ==========`);
        console.log(`[启动进程] 项目ID: ${projectId}`);
        console.log(`[启动进程] 项目路径: ${projectPath}`);
        console.log(`[启动进程] 使用端口: ${port}`);
        
        // 验证工作目录是否存在
        if (!existsSync(projectPath)) {
          const errorMsg = `项目路径不存在: ${projectPath}`;
          console.error(`[启动进程] ✗ ${errorMsg}`);
          if (!res.headersSent) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ 
              success: false, 
              message: errorMsg 
            }));
          }
          return;
        }
        
        // 验证是否为目录
        try {
          const stat = statSync(projectPath);
          if (!stat.isDirectory()) {
            const errorMsg = `项目路径不是目录: ${projectPath}`;
            console.error(`[启动进程] ✗ ${errorMsg}`);
            if (!res.headersSent) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ 
                success: false, 
                message: errorMsg 
              }));
            }
            return;
          }
        } catch (e: any) {
          const errorMsg = `无法访问项目路径: ${projectPath} - ${e.message}`;
          console.error(`[启动进程] ✗ ${errorMsg}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ 
              success: false, 
              message: errorMsg 
            }));
          }
          return;
        }
        
        // 验证 package.json 是否存在
        const packageJsonPath = path.join(projectPath, 'package.json');
        if (!existsSync(packageJsonPath)) {
          const errorMsg = `package.json 不存在: ${packageJsonPath}`;
          console.error(`[启动进程] ✗ ${errorMsg}`);
          if (!res.headersSent) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ 
              success: false, 
              message: errorMsg 
            }));
          }
          return;
        }
        
        // 验证 package.json 中是否有 dev 脚本
        try {
          const packageContent = readFileSync(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageContent);
          if (!packageJson.scripts || !packageJson.scripts.dev) {
            const errorMsg = `package.json 中缺少 dev 脚本`;
            console.error(`[启动进程] ✗ ${errorMsg}`);
            console.error(`[启动进程] package.json 内容:`, JSON.stringify(packageJson, null, 2));
            if (!res.headersSent) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ 
                success: false, 
                message: errorMsg 
              }));
            }
            return;
          }
          console.log(`[启动进程] ✓ package.json 验证通过，dev 脚本: ${packageJson.scripts.dev}`);
        } catch (e: any) {
          const errorMsg = `无法读取或解析 package.json: ${e.message}`;
          console.error(`[启动进程] ✗ ${errorMsg}`);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ 
              success: false, 
              message: errorMsg 
            }));
          }
          return;
        }
        
        // 在 Windows 上使用 shell: true 确保命令能正确执行
        // 在 Unix 系统上也可以使用 shell: true 以获得更好的兼容性
        let command: string;
        let args: string[];
        let useShell: boolean;
        
        if (process.platform === 'win32') {
          // Windows: 使用 shell: true 执行 npm 命令
          command = 'npm';
          args = ['run', 'dev'];
          useShell = true;
          console.log(`[启动进程] Windows 平台，使用 shell: true`);
        } else {
          // Unix/Linux/Mac: 直接使用 npm 命令
          command = 'npm';
          args = ['run', 'dev'];
          useShell = true; // 也使用 shell 以获得更好的兼容性
          console.log(`[启动进程] Unix 平台，使用 shell: true`);
        }
        
        // 获取子项目的数据文件夹路径
        const dataFolderPath = getSubsiteDataDir(projectId);
        console.log(`[启动进程] 数据文件夹路径: ${dataFolderPath}`);
        
        console.log(`[启动进程] 执行命令: ${command} ${args.join(' ')}`);
        console.log(`[启动进程] 工作目录: ${projectPath}`);
        console.log(`[启动进程] 平台: ${process.platform}`);
        console.log(`[启动进程] 使用 shell: ${useShell}`);
        console.log(`[启动进程] 环境变量 PATH: ${process.env.PATH}`);
        
        try {
          // 将数据文件夹路径和主项目端口号作为环境变量传递给子项目
          const proc = spawn(command, args, {
            cwd: projectPath,
            shell: useShell,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { 
              ...process.env, 
              PATH: process.env.PATH,
              VITE_DATA_FOLDER_PATH: dataFolderPath, // 传递数据文件夹路径给子项目
              DATA_FOLDER_PATH: dataFolderPath, // 备用环境变量名
              MAIN_PROJECT_PORT: '3000' // 传递主项目端口号
            }
          });
          
          console.log(`[启动进程] 进程已创建，PID: ${proc.pid}`);
          
          // 立即将进程添加到 runningProjects（即使还没完全启动）
          runningProjects.set(projectId, proc);
          console.log(`[启动进程] ✓ 进程已添加到运行列表 (PID: ${proc.pid})`);
          
          // 立即返回响应，告知前端正在启动
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ 
              success: true, 
              message: '项目正在启动中', 
              port,
              pid: proc.pid,
              starting: true
            }));
            console.log(`[启动进程] ✓ 已立即返回响应，启动监控将在后台进行`);
          }
          
          // 检查进程是否立即退出
          proc.once('spawn', () => {
            console.log(`[启动进程] ✓ 进程已成功启动 (PID: ${proc.pid})`);
          });

          let output = '';
          let errorOutput = '';
          let isResolved = false;

          proc.stdout?.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log(`[${projectId}] STDOUT: ${text}`);
          });

          proc.stderr?.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;
            console.error(`[${projectId}] STDERR: ${text}`);
          });

          proc.on('error', (error) => {
            if (isResolved) return;
            const errorDetails = {
              name: error.name,
              message: error.message,
              code: (error as any).code,
              stack: error.stack,
              output: output.substring(Math.max(0, output.length - 1000)), // 只保留最后1000字符
              errorOutput: errorOutput.substring(Math.max(0, errorOutput.length - 1000))
            };
            
            console.error(`[${projectId}] ✗ 启动项目失败 - 错误类型: ${error.name}`);
            console.error(`[${projectId}] 错误消息: ${error.message}`);
            console.error(`[${projectId}] 错误代码: ${(error as any).code}`);
            console.error(`[${projectId}] 错误堆栈:`, error.stack);
            console.error(`[${projectId}] 标准输出 (最后1000字符):`, errorDetails.output);
            console.error(`[${projectId}] 错误输出 (最后1000字符):`, errorDetails.errorOutput);
            
            runningProjects.delete(projectId);
            isResolved = true;
            
            // 尝试通过状态检查API通知前端（如果可能）
            console.error(`[${projectId}] 项目启动失败详情:`, JSON.stringify(errorDetails, null, 2));
            console.error(`[${projectId}] 前端将通过状态检查API获取错误信息`);
          });

          proc.on('exit', (code, signal) => {
            if (isResolved) return;
            console.log(`[${projectId}] 进程退出事件 - 代码: ${code}, 信号: ${signal}`);
            if (code !== null && code !== 0) {
              console.error(`[${projectId}] ✗ 项目进程异常退出`);
              console.error(`[${projectId}] 退出代码: ${code}, 信号: ${signal}`);
              console.error(`[${projectId}] 标准输出:`, output);
              console.error(`[${projectId}] 错误输出:`, errorOutput);
              
              runningProjects.delete(projectId);
              isResolved = true;
              // 响应已立即返回，这里只记录日志
              console.error(`[${projectId}] 项目启动失败，前端将通过状态检查API获取错误信息`);
            }
          });

          // 等待项目启动（检测到端口被占用或输出包含 "ready"）
          let checkCount = 0;
          const maxChecks = 60; // 30秒（60 * 500ms），增加等待时间
          
          console.log(`[${projectId}] 开始监控项目启动状态，最多等待 ${maxChecks * 0.5} 秒...`);
          
          const checkInterval = setInterval(async () => {
            if (isResolved) {
              clearInterval(checkInterval);
              return;
            }
            
            checkCount++;
            
            // 检查进程是否还在运行
            let procRunning = false;
            try {
              if (process.platform === 'win32') {
                // Windows: 使用 tasklist 检查进程
                await new Promise<void>((resolve) => {
                  exec(`tasklist /FI "PID eq ${proc.pid}"`, (error, stdout) => {
                    procRunning = stdout && stdout.includes(String(proc.pid));
                    resolve();
                  });
                });
              } else {
                // Unix: 使用 kill -0 检查进程
                try {
                  process.kill(proc.pid!, 0);
                  procRunning = true;
                } catch (e) {
                  procRunning = false;
                }
              }
            } catch (e) {
              procRunning = false;
            }
            
            if (!procRunning && checkCount > 5) {
              // 进程已退出，但还没收到 exit 事件
              console.error(`[${projectId}] ✗ 进程已退出（PID: ${proc.pid}）`);
              clearInterval(checkInterval);
              if (!isResolved) {
                isResolved = true;
                runningProjects.delete(projectId);
                // 响应已立即返回，这里只记录日志
                console.error(`[${projectId}] 项目启动失败，前端将通过状态检查API获取错误信息`);
              }
              return;
            }
            
            const portInUse = await checkPort(port);
            
            // 检查输出中是否包含启动成功的标志（更全面的检测）
            const hasReady = output.includes('ready') || 
                            output.includes('Local:') || 
                            output.includes(`:${port}`) || 
                            output.includes('VITE') ||
                            output.includes('vite') ||
                            output.includes('localhost') ||
                            output.includes('http://');
            
            if (checkCount % 10 === 0) {
              console.log(`[${projectId}] 检查中... (${checkCount}/${maxChecks})`);
              console.log(`[${projectId}]   - 进程运行: ${procRunning}`);
              console.log(`[${projectId}]   - 端口占用: ${portInUse}`);
              console.log(`[${projectId}]   - 输出包含ready: ${hasReady}`);
              console.log(`[${projectId}]   - 输出长度: ${output.length} 字符`);
            }
            
            // 如果端口被占用且进程还在运行，认为启动成功
            if (portInUse && procRunning) {
              clearInterval(checkInterval);
              if (!isResolved) {
                isResolved = true;
                // 确保进程已添加到 runningProjects Map
                runningProjects.set(projectId, proc);
                console.log(`[${projectId}] ✓ 项目启动成功！（端口已占用且进程运行中）`);
                console.log(`[${projectId}] 进程 ID: ${proc.pid}`);
                console.log(`[${projectId}] 端口: ${port}`);
                console.log(`[${projectId}] 已更新 runningProjects Map`);
                console.log(`[${projectId}] 启动输出片段:`, output.substring(Math.max(0, output.length - 500)));
                // 响应已立即返回，这里只记录日志
              }
            } else if (hasReady && procRunning) {
              // 输出包含 ready 标志且进程运行中
              clearInterval(checkInterval);
              if (!isResolved) {
                isResolved = true;
                // 确保进程已添加到 runningProjects Map
                runningProjects.set(projectId, proc);
                console.log(`[${projectId}] ✓ 项目启动成功！（输出包含 ready 标志）`);
                console.log(`[${projectId}] 进程 ID: ${proc.pid}`);
                console.log(`[${projectId}] 端口: ${port}`);
                console.log(`[${projectId}] 已更新 runningProjects Map`);
                console.log(`[${projectId}] 启动输出片段:`, output.substring(Math.max(0, output.length - 500)));
                // 响应已立即返回，这里只记录日志
              }
            } else if (checkCount >= maxChecks) {
              clearInterval(checkInterval);
              if (!isResolved) {
                isResolved = true;
                // 检查进程是否还在运行
                try {
                  if (process.platform === 'win32') {
                    exec(`tasklist /FI "PID eq ${proc.pid}"`, (error, stdout) => {
                      if (stdout && stdout.includes(String(proc.pid))) {
                        runningProjects.set(projectId, proc);
                        console.log(`[${projectId}] ⚠ 项目启动超时，但进程仍在运行 (PID: ${proc.pid})`);
                        console.log(`[${projectId}] 输出片段:`, output.substring(Math.max(0, output.length - 500)));
                        // 响应已立即返回，这里只记录日志
                      } else {
                        console.error(`[${projectId}] ✗ 项目启动超时，进程已退出`);
                        console.error(`[${projectId}] 标准输出:`, output);
                        console.error(`[${projectId}] 错误输出:`, errorOutput);
                        runningProjects.delete(projectId);
                        // 响应已立即返回，这里只记录日志
                      }
                    });
                  } else {
                    // Unix 系统上使用 kill -0 检查进程
                    try {
                      process.kill(proc.pid!, 0);
                      runningProjects.set(projectId, proc);
                      console.log(`[${projectId}] ⚠ 项目启动超时，但进程仍在运行 (PID: ${proc.pid})`);
                      console.log(`[${projectId}] 输出片段:`, output.substring(Math.max(0, output.length - 500)));
                      // 响应已立即返回，这里只记录日志
                    } catch (killErr) {
                      console.error(`[${projectId}] ✗ 项目启动超时，进程已退出`);
                      console.error(`[${projectId}] 标准输出:`, output);
                      console.error(`[${projectId}] 错误输出:`, errorOutput);
                      runningProjects.delete(projectId);
                      // 响应已立即返回，这里只记录日志
                    }
                  }
                } catch (err) {
                  console.error(`[${projectId}] 检查进程状态时出错:`, err);
                  runningProjects.delete(projectId);
                  // 响应已立即返回，这里只记录日志
                }
              }
            }
          }, 500);
        } catch (spawnError: any) {
          console.error(`[${projectId}] ✗ 创建进程失败:`, spawnError);
          runningProjects.delete(projectId);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ 
              success: false, 
              message: `创建进程失败: ${spawnError.message}`
            }));
          }
        }
      }

      // 停止项目 API
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/project/stop/') && req.method === 'POST') {
          const projectId = req.url.split('/').pop() || '';
          const proc = runningProjects.get(projectId);
          
          if (!proc) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: false, message: '项目未运行' }));
            return;
          }

          try {
            // Windows 上需要终止进程树
            if (process.platform === 'win32') {
              exec(`taskkill /F /T /PID ${proc.pid}`, (error) => {
                if (error) {
                  console.error(`停止项目 ${projectId} 失败:`, error);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: false, message: error.message }));
                } else {
                  runningProjects.delete(projectId);
                  res.setHeader('Content-Type', 'application/json');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(JSON.stringify({ success: true, message: '项目已停止' }));
                }
              });
            } else {
              proc.kill('SIGTERM');
              runningProjects.delete(projectId);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, message: '项目已停止' }));
            }
          } catch (error: any) {
            console.error(`停止项目 ${projectId} 失败:`, error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: false, message: error.message }));
          }
        } else {
          next();
        }
      });

      // 检查项目状态 API - 使用统一规则
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/project/status/') && req.method === 'GET') {
          const projectId = req.url.split('/').pop() || '';
          
          // 使用统一规则获取子项目信息
          const subsite = discoverSubsites().find(s => s.id === projectId);
          
          if (!subsite) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: false, message: '子项目不存在' }));
            return;
          }
          
          const port = subsite.port;
          if (!port) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: false, message: '子项目端口未配置' }));
            return;
          }

          // 检查进程和端口状态
          const proc = runningProjects.get(projectId);
          
          // 同时检查进程和端口
          Promise.all([
            // 检查进程是否存在
            new Promise<boolean>((resolve) => {
              if (proc) {
                // 如果进程在Map中，检查进程是否还在运行
                if (process.platform === 'win32') {
                  exec(`tasklist /FI "PID eq ${proc.pid}"`, (error, stdout) => {
                    if (error) {
                      // 命令执行失败，可能是进程不存在，但也可能是命令问题
                      // 不立即移除，等待端口检查结果
                      console.warn(`[状态检查] 检查进程 ${proc.pid} 时出错:`, error.message);
                      resolve(false);
                      return;
                    }
                    const procExists = stdout && stdout.includes(String(proc.pid));
                    if (!procExists) {
                      // 进程不存在，从 Map 中移除
                      console.log(`[状态检查] 进程 ${proc.pid} 不存在，从 Map 中移除`);
                      runningProjects.delete(projectId);
                    }
                    resolve(procExists);
                  });
                } else {
                  try {
                    process.kill(proc.pid!, 0);
                    resolve(true);
                  } catch (e) {
                    // 进程不存在，从 Map 中移除
                    console.log(`[状态检查] 进程 ${proc.pid} 不存在，从 Map 中移除`);
                    runningProjects.delete(projectId);
                    resolve(false);
                  }
                }
              } else {
                // 进程不在Map中，返回false（但会检查端口）
                resolve(false);
              }
            }),
            // 检查端口是否被占用
            checkPort(port)
          ]).then(([procExists, portInUse]) => {
            // 判断项目是否运行：
            // 1. 如果进程在Map中且进程检查成功，认为在运行（即使端口检查失败，可能是延迟）
            // 2. 如果端口被占用，认为在运行（即使进程不在Map中或检查失败）
            // 3. 如果进程在Map中但检查失败，但端口被占用，也认为在运行（可能是检查延迟）
            const running = procExists || portInUse;
            
            console.log(`[状态检查] 项目 ${projectId}: 进程在Map=${!!proc}, 进程存在=${procExists}, 端口占用=${portInUse}, 运行中=${running}`);
            
            // 如果进程在Map中但进程检查失败，但端口被占用，说明项目在运行（可能是检查延迟）
            if (proc && !procExists && portInUse) {
              // 端口被占用但进程检查失败，可能是检查延迟，保留进程记录
              console.log(`[状态检查] 端口被占用但进程检查失败，可能是检查延迟，保留进程记录，返回运行中`);
            }
            
            // 如果进程不在Map中但端口被占用，可能是其他方式启动的项目，也认为在运行
            if (!proc && portInUse) {
              console.log(`[状态检查] 进程不在Map中但端口被占用，项目可能在运行（可能是其他方式启动）`);
            }
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({
              success: true,
              running: running,
              port: port,
              procExists: procExists,
              portInUse: portInUse
            }));
          }).catch((error) => {
            console.error(`[状态检查] 检查项目 ${projectId} 状态时出错:`, error);
            // 出错时，至少检查端口
            checkPort(port).then((portInUse) => {
              console.log(`[状态检查] 出错后检查端口: ${portInUse}`);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({
                success: true,
                running: portInUse,
                port: port,
                portInUse: portInUse
              }));
            });
          });
        } else {
          next();
        }
      });

      // ========== 文件系统 API ==========
      
      // 设置基础目录 API
      server.middlewares.use('/api/filesystem/set-directory', (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const siteId = getSiteIdFromRequest(req);
            console.log(`[文件系统API] 设置目录 - 识别到的子项目ID: ${siteId}`);
            
            // 检查是否成功识别子项目ID
            if (!siteId || siteId.trim() === '') {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: '无法识别子项目ID，请确保子网站发送正确的 X-Site-Id 请求头' }));
              return;
            }
            
            const { directory } = JSON.parse(body);
            console.log(`[文件系统API] 设置目录 - 请求参数: directory="${directory}"`);
            
            // 支持空字符串或 'default' 表示使用默认路径
            let finalDirectory: string;
            if (!directory || directory === '' || directory === 'default') {
              // 使用默认路径（根据子项目ID）
              // 规则：public/web/{子项目ID}/data
              finalDirectory = getDataDirectoryForSite(siteId);
              console.log(`[文件系统API] 使用默认路径（根据子项目ID ${siteId}）: ${finalDirectory}`);
            } else if (typeof directory !== 'string') {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: '无效的目录路径' }));
              return;
            } else {
              finalDirectory = directory;
            }

            // 如果目录不存在，自动创建
            if (!existsSync(finalDirectory)) {
              mkdirSync(finalDirectory, { recursive: true });
              console.log(`[文件系统API] 已创建目录: ${finalDirectory}`);
            }

            // 验证目录是否存在且可访问
            try {
              const stat = statSync(finalDirectory);
              if (!stat.isDirectory()) {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: '路径不是目录' }));
                return;
              }
              
              // 检查读写权限
              accessSync(finalDirectory, constants.R_OK | constants.W_OK);
              
              fsBaseDirectories.set(siteId, finalDirectory);
              console.log(`[文件系统API] 基础目录已设置 (${siteId}): ${finalDirectory}`);
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, directory: finalDirectory }));
            } catch (e: any) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: `目录访问失败: ${e.message}` }));
            }
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: `解析请求失败: ${e.message}` }));
          }
        });
      });

      // 获取基础目录 API
      server.middlewares.use('/api/filesystem/get-directory', (req, res, next) => {
        if (req.method !== 'GET') {
          return next();
        }

        const siteId = getSiteIdFromRequest(req);
        
        // 检查是否成功识别子项目ID
        if (!siteId || siteId.trim() === '') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: '无法识别子项目ID，请确保子网站发送正确的 X-Site-Id 请求头' }));
          return;
        }
        
        const directory = getDataDirectoryForSite(siteId);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ 
          success: true, 
          directory: directory,
          isSet: true,
          siteId: siteId
        }));
      });

      // 列出所有项目 API
      server.middlewares.use('/api/filesystem/projects', (req, res, next) => {
        if (req.method !== 'GET') {
          return next();
        }

        const siteId = getSiteIdFromRequest(req);
        
        // 检查是否成功识别子项目ID
        if (!siteId || siteId.trim() === '') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: '无法识别子项目ID，请确保子网站发送正确的 X-Site-Id 请求头' }));
          return;
        }
        
        const fsBaseDirectory = getDataDirectoryForSite(siteId);

        try {
          console.log(`[文件系统API] 列出项目 (${siteId}) - 基础目录: ${fsBaseDirectory}`);
          console.log(`[文件系统API] 扫描目录: ${fsBaseDirectory}`);
          const projects: any[] = [];
          const entries = readdirSync(fsBaseDirectory, { withFileTypes: true });
          console.log(`[文件系统API] 找到 ${entries.length} 个条目`);

          for (const entry of entries) {
            if (entry.isDirectory()) {
              const projectDir = path.join(fsBaseDirectory, entry.name);
              const settingsPath = path.join(projectDir, 'settings.json');
              console.log(`[文件系统API] 检查目录: ${entry.name}, settings.json 路径: ${settingsPath}`);

              if (existsSync(settingsPath)) {
                try {
                  const settingsContent = readFileSync(settingsPath, 'utf-8');
                  const settings = JSON.parse(settingsContent);
                  console.log(`[文件系统API] 找到项目: ${settings.title} (${settings.id}) 在目录: ${entry.name}`);
                  
                  if (settings.id && settings.title) {
                    projects.push({
                      id: settings.id,
                      title: settings.title,
                      folderName: entry.name,
                      folderPath: projectDir
                    });
                    console.log(`[文件系统API] ✓ 已添加到项目列表: ${settings.title}`);
                  } else {
                    console.warn(`[文件系统API] ⚠ 项目缺少 id 或 title:`, settings);
                  }
                } catch (e) {
                  console.warn(`[文件系统API] 无法读取项目 ${entry.name}:`, e);
                }
              } else {
                console.log(`[文件系统API] 目录 ${entry.name} 中没有 settings.json`);
              }
            }
          }
          
          console.log(`[文件系统API] 总共找到 ${projects.length} 个项目`);

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ success: true, projects }));
        } catch (e: any) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: `读取项目列表失败: ${e.message}` }));
        }
      });

      // 读取文件 API
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/filesystem/read/') && req.method === 'GET') {
          const siteId = getSiteIdFromRequest(req);
          
          // 检查是否成功识别子项目ID
          if (!siteId || siteId.trim() === '') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: '无法识别子项目ID，请确保子网站发送正确的 X-Site-Id 请求头' }));
            return;
          }
          
          const fsBaseDirectory = getDataDirectoryForSite(siteId);

          try {
            const parts = req.url.split('/');
            const projectId = parts[4];
            const filename = parts[5];

            console.log(`[文件系统API] 读取文件 (${siteId}) - 项目ID: ${projectId}, 文件名: ${filename}`);
            console.log(`[文件系统API] 基础目录: ${fsBaseDirectory}`);

            if (!projectId || !filename) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: '缺少项目ID或文件名' }));
              return;
            }

            // 查找项目目录
            console.log(`[文件系统API] 开始查找项目目录...`);
            let projectDir: string | null = null;
            const entries = readdirSync(fsBaseDirectory, { withFileTypes: true });
            console.log(`[文件系统API] 扫描 ${entries.length} 个目录查找项目 ${projectId}`);
            
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const dirPath = path.join(fsBaseDirectory, entry.name);
                const settingsPath = path.join(dirPath, 'settings.json');
                
                if (existsSync(settingsPath)) {
                  try {
                    const settingsContent = readFileSync(settingsPath, 'utf-8');
                    const settings = JSON.parse(settingsContent);
                    console.log(`[文件系统API] 检查目录 ${entry.name}: 项目ID=${settings.id}, 标题=${settings.title}`);
                    
                    if (settings.id === projectId) {
                      projectDir = dirPath;
                      console.log(`[文件系统API] ✓ 找到项目目录: ${projectDir}`);
                      break;
                    }
                  } catch (e) {
                    console.warn(`[文件系统API] 无法读取 ${entry.name}/settings.json:`, e);
                    continue;
                  }
                }
              }
            }

            if (!projectDir) {
              console.error(`[文件系统API] ✗ 未找到项目ID为 ${projectId} 的目录`);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: '项目未找到' }));
              return;
            }

            // 验证文件名，防止路径遍历攻击
            const allowedFiles = ['settings.json', 'original.json', 'storyboards.json'];
            if (!allowedFiles.includes(filename)) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: '不允许的文件名' }));
              return;
            }

            const filePath = path.join(projectDir, filename);
            console.log(`[文件系统API] 读取文件: ${filePath}`);
            
            if (!existsSync(filePath)) {
              console.error(`[文件系统API] ✗ 文件不存在: ${filePath}`);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: '文件未找到' }));
              return;
            }

            const content = readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            const contentPreview = JSON.stringify(data).substring(0, 200);
            console.log(`[文件系统API] 文件内容摘要 (${content.length} 字符): ${contentPreview}...`);

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, data }));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: `读取文件失败: ${e.message}` }));
          }
        } else {
          next();
        }
      });

      // 写入文件 API
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/filesystem/write/') && req.method === 'POST') {
          const siteId = getSiteIdFromRequest(req);
          
          // 检查是否成功识别子项目ID
          if (!siteId || siteId.trim() === '') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: '无法识别子项目ID，请确保子网站发送正确的 X-Site-Id 请求头' }));
            return;
          }
          
          const fsBaseDirectory = getDataDirectoryForSite(siteId);

          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });

          req.on('end', () => {
            try {
              const parts = req.url.split('/');
              const projectId = parts[4];
              const filename = parts[5];

              if (!projectId || !filename) {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: '缺少项目ID或文件名' }));
                return;
              }

              // 验证文件名，防止路径遍历攻击
              const allowedFiles = ['settings.json', 'original.json', 'storyboards.json'];
              if (!allowedFiles.includes(filename)) {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: '不允许的文件名' }));
                return;
              }

              const { content } = JSON.parse(body);
              
              if (!content) {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: '缺少文件内容' }));
                return;
              }

              // 查找项目目录
              console.log(`[文件系统API] 写入文件 (${siteId}) - 项目ID: ${projectId}, 文件名: ${filename}`);
              console.log(`[文件系统API] 基础目录: ${fsBaseDirectory}`);
              let projectDir: string | null = null;
              const entries = readdirSync(fsBaseDirectory, { withFileTypes: true });
              console.log(`[文件系统API] 扫描 ${entries.length} 个目录查找项目 ${projectId}`);
              
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const dirPath = path.join(fsBaseDirectory, entry.name);
                  const settingsPath = path.join(dirPath, 'settings.json');
                  
                  if (existsSync(settingsPath)) {
                    try {
                      const settingsContent = readFileSync(settingsPath, 'utf-8');
                      const settings = JSON.parse(settingsContent);
                      console.log(`[文件系统API] 检查目录 ${entry.name}: 项目ID=${settings.id}`);
                      
                      if (settings.id === projectId) {
                        projectDir = dirPath;
                        console.log(`[文件系统API] ✓ 找到项目目录: ${projectDir}`);
                        break;
                      }
                    } catch (e) {
                      console.warn(`[文件系统API] 无法读取 ${entry.name}/settings.json:`, e);
                      continue;
                    }
                  }
                }
              }

              if (!projectDir) {
                console.error(`[文件系统API] ✗ 未找到项目ID为 ${projectId} 的目录`);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.statusCode = 404;
                res.end(JSON.stringify({ success: false, error: '项目未找到' }));
                return;
              }

              const filePath = path.join(projectDir, filename);
              console.log(`[文件系统API] 写入文件: ${filePath}`);
              
              // 确保目录存在
              if (!existsSync(projectDir)) {
                mkdirSync(projectDir, { recursive: true });
                console.log(`[文件系统API] 已创建项目目录: ${projectDir}`);
              }

              // 写入文件
              writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
              console.log(`[文件系统API] ✓ 文件写入成功: ${filePath}`);

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true }));
            } catch (e: any) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: `写入文件失败: ${e.message}` }));
            }
          });
        } else {
          next();
        }
      });

      // 删除项目 API
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/filesystem/delete-project/') && req.method === 'DELETE') {
          const siteId = getSiteIdFromRequest(req);
          
          // 检查是否成功识别子项目ID
          if (!siteId || siteId.trim() === '') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: '无法识别子项目ID，请确保子网站发送正确的 X-Site-Id 请求头' }));
            return;
          }
          
          const fsBaseDirectory = getDataDirectoryForSite(siteId);
          
          try {
            const parts = req.url.split('/');
            const projectId = parts[4];
            
            if (!projectId) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: '缺少项目ID' }));
              return;
            }
            
            console.log(`[文件系统API] 删除项目 (${siteId}) - 项目ID: ${projectId}`);
            console.log(`[文件系统API] 基础目录: ${fsBaseDirectory}`);
            
            // 查找项目目录
            let projectDir: string | null = null;
            const entries = readdirSync(fsBaseDirectory, { withFileTypes: true });
            console.log(`[文件系统API] 扫描 ${entries.length} 个目录查找项目 ${projectId}`);
            
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const dirPath = path.join(fsBaseDirectory, entry.name);
                const settingsPath = path.join(dirPath, 'settings.json');
                
                if (existsSync(settingsPath)) {
                  try {
                    const settingsContent = readFileSync(settingsPath, 'utf-8');
                    const settings = JSON.parse(settingsContent);
                    console.log(`[文件系统API] 检查目录 ${entry.name}: 项目ID=${settings.id}`);
                    
                    if (settings.id === projectId) {
                      projectDir = dirPath;
                      console.log(`[文件系统API] ✓ 找到项目目录: ${projectDir}`);
                      break;
                    }
                  } catch (e) {
                    console.warn(`[文件系统API] 无法读取 ${entry.name}/settings.json:`, e);
                    continue;
                  }
                }
              }
            }
            
            if (!projectDir) {
              console.error(`[文件系统API] ✗ 未找到项目ID为 ${projectId} 的目录`);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: '项目未找到' }));
              return;
            }
            
            // 删除项目目录
            const { rmSync } = require('fs');
            rmSync(projectDir, { recursive: true, force: true });
            console.log(`[文件系统API] ✓ 已删除项目目录: ${projectDir}`);
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, message: '项目已删除' }));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: `删除项目失败: ${e.message}` }));
          }
        } else {
          next();
        }
      });

      // 创建项目目录 API
      server.middlewares.use('/api/filesystem/create-project', (req, res, next) => {
        if (req.method !== 'POST') {
          return next();
        }

        const siteId = getSiteIdFromRequest(req);
        
        // 检查是否成功识别子项目ID
        if (!siteId || siteId.trim() === '') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: '无法识别子项目ID，请确保子网站发送正确的 X-Site-Id 请求头' }));
          return;
        }
        
        const fsBaseDirectory = getDataDirectoryForSite(siteId);

        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', () => {
          try {
            const { projectId, folderName } = JSON.parse(body);
            
            if (!projectId || !folderName) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: '缺少项目ID或文件夹名' }));
              return;
            }

            // 验证文件夹名，防止路径遍历攻击
            const safeFolderName = folderName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
            const projectDir = path.join(fsBaseDirectory, safeFolderName);

            // 检查是否已存在
            if (existsSync(projectDir)) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: '项目目录已存在' }));
              return;
            }

            // 创建目录
            mkdirSync(projectDir, { recursive: true });

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, folderPath: projectDir }));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: `创建项目目录失败: ${e.message}` }));
          }
        });
      });

      // 列出项目目录 API
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/filesystem/list/') && req.method === 'GET') {
          const siteId = getSiteIdFromRequest(req);
          const fsBaseDirectory = getDataDirectoryForSite(siteId);

          try {
            const projectId = req.url.split('/').pop() || '';

            console.log(`[文件系统API] 列出项目目录 (${siteId}) - 项目ID: ${projectId}`);
            console.log(`[文件系统API] 基础目录: ${fsBaseDirectory}`);

            if (!projectId) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: '缺少项目ID' }));
              return;
            }

            // 查找项目目录
            let projectDir: string | null = null;
            const entries = readdirSync(fsBaseDirectory, { withFileTypes: true });
            console.log(`[文件系统API] 扫描 ${entries.length} 个目录查找项目 ${projectId}`);
            
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const dirPath = path.join(fsBaseDirectory, entry.name);
                const settingsPath = path.join(dirPath, 'settings.json');
                
                if (existsSync(settingsPath)) {
                  try {
                    const settingsContent = readFileSync(settingsPath, 'utf-8');
                    const settings = JSON.parse(settingsContent);
                    console.log(`[文件系统API] 检查目录 ${entry.name}: 项目ID=${settings.id}`);
                    
                    if (settings.id === projectId) {
                      projectDir = dirPath;
                      console.log(`[文件系统API] ✓ 找到项目目录: ${projectDir}`);
                      break;
                    }
                  } catch (e) {
                    console.warn(`[文件系统API] 无法读取 ${entry.name}/settings.json:`, e);
                    continue;
                  }
                }
              }
            }

            if (!projectDir) {
              console.error(`[文件系统API] ✗ 未找到项目ID为 ${projectId} 的目录`);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: '项目未找到' }));
              return;
            }

            const files = readdirSync(projectDir, { withFileTypes: true });
            console.log(`[文件系统API] 项目目录 ${projectDir} 中有 ${files.length} 个文件/目录`);
            const fileList = files.map(file => ({
              name: file.name,
              isFile: file.isFile(),
              isDirectory: file.isDirectory()
            }));

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, files: fileList }));
          } catch (e: any) {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: `列出目录失败: ${e.message}` }));
          }
        } else {
          next();
        }
      });
    }
  };
}

// ==================== 动态生成代理配置 ====================

/**
 * 动态生成子项目代理配置
 * 规则：/web/{子项目ID}/* -> http://localhost:{子项目端口}/*
 */
function generateProxyConfig(): Record<string, any> {
  console.log(`[代理配置] ========== 开始生成代理配置 ==========`);
  
  let subsites: SubsiteInfo[] = [];
  try {
    subsites = discoverSubsites();
    console.log(`[代理配置] ✓ 发现 ${subsites.length} 个子项目`);
  } catch (error: any) {
    console.error(`[代理配置] ✗ 发现子项目失败:`, error.message);
    console.error(`[代理配置] 错误堆栈:`, error.stack);
    // 即使发现失败，也返回空配置，不影响主站启动
    console.warn(`[代理配置] 将使用空代理配置，主站仍可正常启动`);
    return {};
  }
  
  const proxyConfig: Record<string, any> = {};
  
  for (const subsite of subsites) {
    // 如果端口未配置，跳过代理配置
    if (!subsite.port) {
      console.warn(`[代理配置] ⚠ 跳过 ${subsite.id}（端口未配置）`);
      continue;
    }
    
    const proxyPath = `/web/${subsite.id}`;
    const target = `http://localhost:${subsite.port}`;
    
    // 转义特殊字符用于正则表达式
    const escapedProxyPath = proxyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    proxyConfig[proxyPath] = {
      target,
      changeOrigin: true,
      rewrite: (path: string) => {
        const newPath = path.replace(new RegExp(`^${escapedProxyPath}`), '');
        console.log(`[代理] ${path} -> ${newPath} (目标: ${target})`);
        return newPath;
      },
      configure: (proxy: any, _options: any) => {
        proxy.on('error', (err: any, _req: any, _res: any) => {
          console.error(`[代理错误] ${subsite.id}:`, err);
          console.error(`[代理错误] 请求URL: ${_req?.url}`);
          console.error(`[代理错误] 目标: ${target}`);
        });
        proxy.on('proxyReq', (proxyReq: any, req: any, res: any) => {
          console.log(`[代理请求] ${subsite.id}: ${req.method} ${req.url} -> ${proxyReq.path} (目标: ${target})`);
        });
        proxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
          console.log(`[代理响应] ${subsite.id}: ${proxyRes.statusCode} ${req.url}`);
        });
      }
    };
    
    console.log(`[代理配置] ✓ 已配置 ${proxyPath} -> ${target}`);
  }
  
  console.log(`[代理配置] ========== 代理配置生成完成 ==========`);
  console.log(`[代理配置] 共配置 ${Object.keys(proxyConfig).length} 个子项目代理`);
  if (Object.keys(proxyConfig).length > 0) {
    console.log(`[代理配置] 代理路径列表:`, Object.keys(proxyConfig));
  }
  return proxyConfig;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // 动态生成代理配置
    const proxyConfig = generateProxyConfig();
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: proxyConfig
      },
      plugins: [
        react(),
        projectListPlugin()
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
