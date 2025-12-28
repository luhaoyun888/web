
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 添加调试信息
console.log('React 应用正在启动...');
console.log('Root element:', rootElement);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
    <App />
    </ErrorBoundary>
  </React.StrictMode>
);

console.log('React 应用已挂载');
