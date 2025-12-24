
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import AutoVision from './pages/AutoVision';
import AILab from './pages/AILab';
import DevLog from './pages/DevLog';
import Archives from './pages/Archives';
import About from './pages/About';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow pt-16">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auto-vision" element={<AutoVision />} />
            <Route path="/ai-lab" element={<AILab />} />
            <Route path="/dev-log" element={<DevLog />} />
            <Route path="/archives" element={<Archives />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
        <footer className="border-t border-white/10 py-8 px-6 text-center text-sm text-gray-500 bg-black">
          <p>© {new Date().getFullYear()} TechArt Nexus. 匠心构建，追求极致。</p>
        </footer>
      </div>
    </Router>
  );
};

export default App;
