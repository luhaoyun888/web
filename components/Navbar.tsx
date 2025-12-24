
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const location = useLocation();
  
  const navItems = [
    { name: '首页', path: '/' },
    { name: '汽车视觉', path: '/auto-vision' },
    { name: 'AI 实验室', path: '/ai-lab' },
    { name: '技术日志', path: '/dev-log' },
    { name: '视觉存档', path: '/archives' },
    { name: '关于我', path: '/about' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tighter hover:text-blue-400 transition-colors">
          TECHART<span className="text-blue-500">NEXUS</span>
        </Link>
        <div className="hidden md:flex items-center space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-medium tracking-wide transition-colors hover:text-white ${
                location.pathname === item.path ? 'text-white' : 'text-gray-400'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>
        <div className="md:hidden">
            <span className="text-gray-400 text-xs">菜单</span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
