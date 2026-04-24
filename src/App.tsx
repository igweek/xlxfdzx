/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home as HomeIcon, 
  Database, 
  Eye, 
  Zap, 
  AlertTriangle, 
  Activity,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';
import { cn } from './lib/utils';

// Import Page Components (to be created)
import Home from './pages/Home';
import DataCleaning from './pages/DataCleaning';
import VisionModel from './pages/VisionModel';
import SmartFeeding from './pages/SmartFeeding';
import WaterQuality from './pages/WaterQuality';
import MoltingRisk from './pages/MoltingRisk';

const TABS = [
  { id: 'home', label: '首页', icon: HomeIcon, component: Home },
  { id: 'cleaning', label: '数据清洗', icon: Database, component: DataCleaning },
  { id: 'vision', label: '视觉模型', icon: Eye, component: VisionModel },
  { id: 'feeding', label: '智能投喂', icon: Zap, component: SmartFeeding },
  { id: 'water', label: '水质预警', icon: AlertTriangle, component: WaterQuality },
  { id: 'molting', label: '蜕壳风险', icon: Activity, component: MoltingRisk },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || Home;

  return (
    <div className="flex h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-100">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="relative flex flex-col bg-white border-r border-[#E5E5E7] z-20"
      >
        <div className="p-6 flex items-center justify-between">
          <div className={cn("flex items-center gap-3 transition-opacity duration-300", !isSidebarOpen && "opacity-0 invisible")}>
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white font-bold">B</div>
            <span className="font-semibold text-lg tracking-tight">北斗智效</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-[#007AFF] text-white shadow-lg shadow-blue-500/20" 
                    : "text-[#86868B] hover:bg-gray-50 hover:text-[#1D1D1F]"
                )}
              >
                <Icon size={20} className={cn("shrink-0", isActive ? "text-white" : "group-hover:text-[#007AFF]")} />
                {isSidebarOpen && (
                  <span className="font-medium text-sm transition-opacity duration-200">
                    {tab.label}
                  </span>
                )}
                {isActive && isSidebarOpen && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute right-2 text-white/50"
                  >
                    <ChevronRight size={14} />
                  </motion.div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E5E5E7]">
          <div className={cn("flex items-center gap-3 transition-opacity duration-300", !isSidebarOpen && "opacity-0 invisible")}>
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="flex flex-col">
              <span className="text-xs font-medium">管理员</span>
              <span className="text-[10px] text-[#86868B]">在线终端: 01</span>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between px-8 bg-white/80 backdrop-blur-xl border-bottom border-[#E5E5E7] shrink-0 sticky top-0 z-10">
          <h2 className="text-xl font-semibold tracking-tight">
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#86868B] bg-gray-100 px-2 py-1 rounded-full px-4">
              状态: 系统运行中
            </span>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              className="h-full"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
