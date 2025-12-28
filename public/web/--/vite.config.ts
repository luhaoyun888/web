import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    // 从目录名自动获取项目ID（使用统一规则）
    // 规则：子项目目录名就是项目ID
    const projectId = path.basename(__dirname);
    console.log(`[子网站配置] 项目ID: ${projectId} (从目录名获取)`);
    
    // 从环境变量获取数据文件夹路径（由主项目传递）
    const dataFolderPath = process.env.VITE_DATA_FOLDER_PATH || process.env.DATA_FOLDER_PATH || '';
    console.log(`[子网站配置] 数据文件夹路径: ${dataFolderPath || '(未设置，将使用默认路径)'}`);
    
    // 主项目运行在端口 3000（从环境变量获取，如果没有则使用默认值）
    const mainProjectPort = process.env.MAIN_PROJECT_PORT || '3000';
    const mainProjectUrl = `http://localhost:${mainProjectPort}`;
    console.log(`[子网站配置] 主项目地址: ${mainProjectUrl}`);
    
    return {
      server: {
        port: 4000,
        host: '0.0.0.0',
        // 配置代理，将 /api/* 请求代理到主项目
        proxy: {
          '/api': {
            target: mainProjectUrl,
            changeOrigin: true,
            secure: false,
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.error(`[子项目代理] 代理错误:`, err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log(`[子项目代理] 代理请求: ${req.method} ${req.url} -> ${mainProjectUrl}${req.url}`);
              });
            }
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        // 注入项目ID到环境变量，供前端代码使用
        'import.meta.env.VITE_SITE_ID': JSON.stringify(projectId),
        // 将数据文件夹路径注入到前端代码
        'import.meta.env.VITE_DATA_FOLDER_PATH': JSON.stringify(dataFolderPath),
        'process.env.VITE_DATA_FOLDER_PATH': JSON.stringify(dataFolderPath),
        // 注入主项目地址，供前端代码使用
        'import.meta.env.VITE_MAIN_PROJECT_URL': JSON.stringify(mainProjectUrl)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
