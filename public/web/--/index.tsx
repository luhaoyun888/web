import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('🚀 index.tsx 开始加载');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ 找不到 root 元素');
  throw new Error("Could not find root element to mount to");
}

console.log('✅ 找到 root 元素，开始渲染 React 应用');

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('✅ React 应用已成功挂载');
} catch (error) {
  console.error('❌ React 应用挂载失败:', error);
  // 显示错误信息到页面
  rootElement.innerHTML = `
    <div style="padding: 20px; color: red; background: #1a1a1a; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
      <h1 style="color: red;">应用加载失败</h1>
      <pre style="color: #ff6b6b; margin-top: 20px; white-space: pre-wrap;">${error instanceof Error ? error.message : String(error)}</pre>
      <p style="color: #999; margin-top: 20px;">请查看浏览器控制台获取更多信息</p>
    </div>
  `;
}