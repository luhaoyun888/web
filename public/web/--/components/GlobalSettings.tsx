import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Save, ShieldCheck, X } from 'lucide-react';

interface GlobalSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSettings: React.FC<GlobalSettingsProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load API Key from local storage
      const savedKey = localStorage.getItem('custom_gemini_api_key');
      if (savedKey) {
        setApiKey(savedKey);
        setKeySaved(true);
      } else {
        setApiKey('');
        setKeySaved(false);
      }
    }
  }, [isOpen]);

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      localStorage.removeItem('custom_gemini_api_key');
      setKeySaved(false);
      alert("API Key 已清除。");
      // 触发 storage 事件，让其他组件知道 API Key 已更新
      window.dispatchEvent(new Event('storage'));
      return;
    }
    localStorage.setItem('custom_gemini_api_key', apiKey.trim());
    setKeySaved(true);
    alert("API Key 已保存！");
    // 触发 storage 事件，让其他组件知道 API Key 已更新
    window.dispatchEvent(new Event('storage'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-gray-900 w-full max-w-md rounded-xl border border-gray-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-bold text-white">全局设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Key className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold text-white">Gemini API Key</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              API Key 是全局设置，所有项目将共享使用。请确保您的 API Key 安全。
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input 
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setKeySaved(false); }}
                  placeholder="Enter Gemini API Key..."
                  className={`w-full bg-gray-950 border ${keySaved ? 'border-green-900/50 text-green-100' : 'border-gray-700 text-white'} rounded-lg px-4 py-2.5 outline-none focus:border-indigo-500 transition-all`}
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
              </div>
              <button 
                onClick={handleSaveApiKey}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${keySaved ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {keySaved ? <ShieldCheck className="w-4 h-4"/> : <Save className="w-4 h-4"/>}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              提示：API Key 存储在浏览器本地，不会上传到服务器。
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-950 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

