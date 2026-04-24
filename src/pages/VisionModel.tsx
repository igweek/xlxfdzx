import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  Target, 
  Info, 
  Video, 
  Play, 
  Pause, 
  Activity,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

type TabType = 'feed' | 'crab';

interface Crab {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  distance: number;
}

const TEST_STAGES = [
  { nodeName: 'T=0 投喂初始', mult: 1.0, wait: 2500, seconds: 1 },
  { nodeName: 'T=60分钟 重点观察区', mult: 0.45, wait: 2500, seconds: 3600 },
  { nodeName: 'T=120分钟 判定节点', mult: 0.12, wait: 2500, seconds: 7200 },
  { nodeName: '次日清晨 复核检测', mult: 0.0, wait: 3000, seconds: 36000 },
];

const CAM_PIXELS = 4000000;
const BASE_RATIO = 0.1258;

export default function VisionModel() {
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  
  // Feed Simulation State
  const [isAutoFeedRunning, setIsAutoFeedRunning] = useState(false);
  const [isAutoFeedPaused, setIsAutoFeedPaused] = useState(false);
  const [testStageIndex, setTestStageIndex] = useState(0);
  const [feedSizeMultiplier, setFeedSizeMultiplier] = useState(1.0);
  const feedSimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Crab Tracking State
  const [isPlaying, setIsPlaying] = useState(true);
  const [crabs, setCrabs] = useState<Crab[]>([]);
  const requestRef = useRef<number | null>(null);

  // --- Feed Logic ---
  const stopAutoFeed = useCallback(() => {
    setIsAutoFeedRunning(false);
    setIsAutoFeedPaused(false);
    if (feedSimTimerRef.current) clearTimeout(feedSimTimerRef.current);
    setFeedSizeMultiplier(1.0);
    setTestStageIndex(0);
  }, []);

  const runFeedSequence = useCallback((index: number) => {
    if (index >= TEST_STAGES.length) {
      stopAutoFeed();
      return;
    }

    const stage = TEST_STAGES[index];
    setFeedSizeMultiplier(stage.mult);
    setTestStageIndex(index);

    feedSimTimerRef.current = setTimeout(() => {
      runFeedSequence(index + 1);
    }, stage.wait);
  }, [stopAutoFeed]);

  const toggleAutoFeed = () => {
    if (!isAutoFeedRunning) {
      setIsAutoFeedRunning(true);
      setIsAutoFeedPaused(false);
      runFeedSequence(0);
    } else {
      if (isAutoFeedPaused) {
        setIsAutoFeedPaused(false);
        runFeedSequence(testStageIndex);
      } else {
        setIsAutoFeedPaused(true);
        if (feedSimTimerRef.current) clearTimeout(feedSimTimerRef.current);
      }
    }
  };

  // --- Crab Logic ---
  const spawnCrab = (): Crab => {
    const id = Math.floor(Math.random() * 9000) + 1000;
    const edge = Math.floor(Math.random() * 4);
    let x = 50, y = 50, vx = 0, vy = 0;
    if (edge === 0) { x = Math.random() * 80 + 10; y = -10; vx = (Math.random() - 0.5); vy = Math.random() * 0.5 + 0.2; }
    else if (edge === 1) { x = 110; y = Math.random() * 80 + 10; vx = -(Math.random() * 0.5 + 0.2); vy = (Math.random() - 0.5); }
    else if (edge === 2) { x = Math.random() * 80 + 10; y = 110; vx = (Math.random() - 0.5); vy = -(Math.random() * 0.5 + 0.2); }
    else { x = -10; y = Math.random() * 80 + 10; vx = Math.random() * 0.5 + 0.2; vy = (Math.random() - 0.5); }
    
    return {
      id, x, y, vx, vy,
      w: 35 + Math.random() * 15,
      h: 35 + Math.random() * 15,
      distance: 0
    };
  };

  useEffect(() => {
    const initialCrabs = Array.from({ length: 5 }, () => ({
      id: Math.floor(Math.random() * 9000) + 1000,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      w: 35 + Math.random() * 15,
      h: 35 + Math.random() * 15,
      distance: Math.random() * 5
    }));
    setCrabs(initialCrabs);
  }, []);

  const animate = useCallback(() => {
    if (isPlaying) {
      setCrabs(prevCrabs => prevCrabs.map(crab => {
        let nextVx = crab.vx + (Math.random() - 0.5) * 0.1; 
        let nextVy = crab.vy + (Math.random() - 0.5) * 0.1;
        
        const currentSpeed = Math.sqrt(nextVx * nextVx + nextVy * nextVy);
        if (currentSpeed > 1.2) {
          nextVx *= 0.8;
          nextVy *= 0.8;
        }

        let nextX = crab.x + nextVx;
        let nextY = crab.y + nextVy;

        if (nextX < -10 || nextX > 110 || nextY < -10 || nextY > 110) {
          return spawnCrab();
        }

        const displacement = Math.sqrt(Math.pow(nextX - crab.x, 2) + Math.pow(nextY - crab.y, 2));

        return {
          ...crab,
          x: nextX,
          y: nextY,
          vx: nextVx,
          vy: nextVy,
          distance: crab.distance + displacement
        };
      }));
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isPlaying]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Derived Values
  const currentRatio = (BASE_RATIO * (feedSizeMultiplier * feedSizeMultiplier) * 100).toFixed(2);
  const currentPx = Math.round(CAM_PIXELS * BASE_RATIO * (feedSizeMultiplier * feedSizeMultiplier));
  
  let pxPerSecond = 0;
  if (isAutoFeedRunning && testStageIndex > 0) {
    const prevAreaPx = Math.round(CAM_PIXELS * BASE_RATIO * (TEST_STAGES[0].mult * TEST_STAGES[0].mult));
    const currentAreaPx = currentPx;
    const pxDiff = prevAreaPx - currentAreaPx; 
    pxPerSecond = pxDiff / TEST_STAGES[testStageIndex].seconds;
  }

  const totalSpeed = crabs.reduce((sum, c) => sum + Math.sqrt(c.vx * c.vx + c.vy * c.vy), 0);
  const activeCount = crabs.filter(c => Math.sqrt(c.vx * c.vx + c.vy * c.vy) > 0.3).length;
  const totalAvgSpeed = (totalSpeed / (crabs.length || 1)).toFixed(2);
  const activeRatioNum = crabs.length > 0 ? activeCount / crabs.length : 0;
  const activityScore = Math.min(100, Math.round(((parseFloat(totalAvgSpeed) * 30) + (activeRatioNum * 50))));

  return (
    <div className="space-y-8">
      {/* Tab Switcher */}
      <div className="flex bg-white border border-[#E5E5E7] p-1 rounded-2xl w-fit shadow-sm relative">
        <motion.div
          layoutId="tab-slider"
          animate={{ x: activeTab === 'feed' ? 0 : '100%' }}
          className="absolute inset-y-1 w-1/2 bg-[#F5F5F7] border border-[#E5E5E7] rounded-xl z-0"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
        <button 
          onClick={() => setActiveTab('feed')}
          className={cn(
            "relative z-10 flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-xl transition-colors",
            activeTab === 'feed' ? "text-[#007AFF]" : "text-[#86868B] hover:text-[#1D1D1F]"
          )}
        >
          <Layers size={18} />
          残饵识别与量化
        </button>
        <button 
          onClick={() => setActiveTab('crab')}
          className={cn(
            "relative z-10 flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-xl transition-colors",
            activeTab === 'crab' ? "text-[#007AFF]" : "text-[#86868B] hover:text-[#1D1D1F]"
          )}
        >
          <Target size={18} />
          大闸蟹跟踪与活跃度
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'feed' ? (
          <motion.div
            key="feed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Theory */}
            <div className="space-y-6">
              <div className="bg-white border border-[#E5E5E7] rounded-3xl p-8 shadow-sm">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Info size={20} className="text-[#007AFF]" />
                  算法原理
                </h3>
                <div className="space-y-4 text-sm text-[#86868B] leading-relaxed">
                  <p>系统弃用逐帧连续检测，改用<strong className="text-[#1D1D1F]">分时段采样法</strong>以避开聚堆遮挡：</p>
                  <ul className="space-y-3">
                    <li className="flex gap-2">
                      <span className="text-[#007AFF] font-bold">T=0</span>
                      <span>投喂开始，记录初始残饵面积占比。</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#007AFF] font-bold">1H</span>
                      <span>选取低遮挡典型帧计算面积，并提取阶段变化率。</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#007AFF] font-bold">2H</span>
                      <span>设定为投喂效果的判定节点。</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-[#007AFF] font-bold">AM</span>
                      <span>次日清晨底端残饵复核检测，确保判断稳定性。</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <button 
                onClick={toggleAutoFeed}
                className={cn(
                  "w-full py-4 text-sm font-bold rounded-2xl border transition-all duration-300 shadow-lg",
                  isAutoFeedRunning && !isAutoFeedPaused
                    ? "bg-amber-50 text-amber-600 border-amber-200"
                    : "bg-[#007AFF] text-white border-[#007AFF] shadow-blue-500/20 hover:bg-[#0066CC]"
                )}
              >
                {isAutoFeedRunning ? (isAutoFeedPaused ? '恢复测试' : '点击暂停测试') : '开始模型测试'}
              </button>
            </div>

            {/* Simulation */}
            <div className="lg:col-span-2 space-y-6">
              <div className="relative aspect-video bg-[#F5F5F7] rounded-[2rem] border border-[#E5E5E7] overflow-hidden shadow-sm">
                <div className="absolute top-4 left-4 flex gap-2 items-center z-10 text-[10px] font-mono font-bold tracking-tighter">
                  <span className="bg-red-500 px-2 py-0.5 rounded text-white flex items-center gap-1">
                    <Video size={10} /> REC
                  </span>
                  <span className="text-[#86868B] bg-white/80 px-2 py-0.5 rounded backdrop-blur border border-[#E5E5E7]">CAM-01 (投喂区)</span>
                </div>
                
                <div className="absolute bottom-4 right-4 z-10 text-[10px] font-mono text-[#007AFF] font-bold">
                  YOLO26 Inference: 12ms | FPS: 45
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: isAutoFeedRunning ? feedSizeMultiplier : 1 }}
                    className="relative"
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                  >
                    {feedSizeMultiplier > 0.01 && (
                      <>
                        <div 
                          className="bg-amber-500/80 rounded-full blur-[2px] transition-all"
                          style={{ width: 210, height: 150, boxShadow: '0 0 20px rgba(245,158,11,0.4)' }}
                        />
                        <div className="absolute inset-0 border-2 border-amber-400 rounded-full flex items-center justify-center">
                           <span className="absolute -top-10 bg-amber-500 text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                             Residual Feed: {Math.round(feedSizeMultiplier * 100)}%
                           </span>
                        </div>
                      </>
                    )}
                  </motion.div>
                </div>

                <div className="absolute inset-8 border-2 border-[#E5E5E7] border-dashed rounded-3xl pointer-events-none flex items-end justify-center pb-2">
                  <span className="text-[#86868B] text-[10px] font-bold tracking-widest uppercase opacity-40">Target Feeding Zone</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 shadow-sm">
                  <span className="text-[#86868B] text-[10px] font-bold uppercase mb-1 block">当前推演采样节点</span>
                  <span className="text-sm font-bold text-[#1D1D1F]">
                    {isAutoFeedRunning ? TEST_STAGES[testStageIndex].nodeName : '等待启动...'}
                  </span>
                </div>
                <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 shadow-sm">
                  <span className="text-[#86868B] text-[10px] font-bold uppercase mb-1 block">采样面积占比</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono">{currentRatio}</span>
                    <span className="text-xs text-[#86868B] font-bold">%</span>
                  </div>
                  <span className="text-[10px] text-[#86868B] font-mono mt-1 block">{currentPx.toLocaleString()} px²</span>
                </div>
                <div className="bg-white border border-[#E5E5E7] rounded-2xl p-5 shadow-sm">
                  <span className="text-[#86868B] text-[10px] font-bold uppercase mb-1 block">累积消耗速度</span>
                  <span className={cn("text-xl font-bold font-mono", pxPerSecond > 0 ? "text-[#007AFF]" : "text-[#86868B]")}>
                    {pxPerSecond > 0 ? `${pxPerSecond.toFixed(2)} px²/s` : '--'}
                  </span>
                  <span className="text-[10px] text-[#86868B] font-mono mt-1 block">基于 T=0 基准</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="crab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="space-y-6">
              <div className="bg-white border border-[#E5E5E7] rounded-3xl p-8 shadow-sm">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Target size={20} className="text-[#007AFF]" />
                  跟踪原理
                </h3>
                <div className="space-y-4 text-sm text-[#86868B] leading-relaxed">
                   <div className="space-y-1">
                     <p className="font-bold text-[#1D1D1F]">1. 目标检测</p>
                     <p>YOLO 实时提取个体坐标。</p>
                   </div>
                   <div className="space-y-1">
                     <p className="font-bold text-[#1D1D1F]">2. MOT 跟踪</p>
                     <p>分配稳定ID,提取中心点轨迹。</p>
                   </div>
                   <div className="space-y-1">
                     <p className="font-bold text-[#1D1D1F]">3. 活跃度算力</p>
                     <p>综合位移距离、速度与运动频率。</p>
                   </div>
                </div>
              </div>

              <div className="bg-[#007AFF] text-white rounded-3xl p-8 shadow-xl shadow-blue-500/20 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-6">实时活跃度池评分</h3>
                  <div className="flex items-end gap-3 mb-8">
                    <span className="text-7xl font-black tracking-tighter leading-none">{activityScore}</span>
                    <span className="text-sm opacity-60 font-bold mb-1">/ 100 分</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                      <span className="text-xs font-medium opacity-80">平均位移速度</span>
                      <span className="font-mono text-xs font-bold uppercase">{totalAvgSpeed} px/f</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                      <span className="text-xs font-medium opacity-80">活跃比例</span>
                      <span className="font-mono text-xs font-bold uppercase">{Math.round(activeRatioNum * 100)}%</span>
                    </div>
                  </div>
                </div>
                <Activity className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10" />
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="relative aspect-video bg-white rounded-[2rem] border border-[#E5E5E7] overflow-hidden shadow-sm">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #000 1px, transparent 0)', backgroundSize: '32px 32px' }} />
                
                <div className="absolute top-4 left-4 flex gap-2 items-center z-30 text-[10px] font-mono font-bold">
                  <span className="bg-red-500 px-2 py-0.5 rounded text-white flex items-center gap-1">
                    <Video size={10} /> REC
                  </span>
                  <span className="text-[#86868B] bg-white/80 px-2 py-0.5 rounded backdrop-blur border border-[#E5E5E7]">CAM-02 (跟踪区)</span>
                </div>

                <div className="absolute top-4 right-4 z-40">
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] p-2.5 rounded-full shadow-lg transition-colors border border-[#E5E5E7]"
                  >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  </button>
                </div>
                
                <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
                  {crabs.map((crab) => (
                    <div 
                      key={crab.id}
                      className="absolute transition-all duration-100 ease-linear"
                      style={{ 
                        left: `${crab.x}%`, 
                        top: `${crab.y}%`, 
                        width: crab.w, 
                        height: crab.h,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div className={cn(
                        "w-full h-full border-2 transition-colors flex flex-col",
                        Math.sqrt(crab.vx*crab.vx + crab.vy*crab.vy) > 0.3 
                          ? "border-[#007AFF] bg-[#007AFF]/10" 
                          : "border-[#86868B] bg-gray-100/50"
                      )}>
                        <div className={cn(
                          "absolute -top-5 left-0 px-1.5 py-0.5 text-[8px] font-black text-white whitespace-nowrap",
                          Math.sqrt(crab.vx*crab.vx + crab.vy*crab.vy) > 0.3 ? "bg-[#007AFF]" : "bg-[#86868B]"
                        )}>
                          ID: {crab.id}
                        </div>
                        <div className="m-auto w-1.5 h-1.5 rounded-full bg-current opacity-40" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-8 border-2 border-[#E5E5E7] border-dashed rounded-3xl pointer-events-none" />
              </div>

              <div className="bg-white border border-[#E5E5E7] rounded-[2rem] overflow-hidden shadow-sm">
                <div className="grid grid-cols-4 bg-[#F5F5F7] px-6 py-4 text-[10px] font-bold text-[#86868B] uppercase tracking-wider">
                  <div>Track ID</div>
                  <div>实时状态</div>
                  <div>累计距离 (m)</div>
                  <div>当前速度 (px/f)</div>
                </div>
                <div className="divide-y divide-gray-50 h-[240px] overflow-y-auto">
                  {crabs.map(crab => {
                    const speed = Math.sqrt(crab.vx*crab.vx + crab.vy*crab.vy);
                    const isActive = speed > 0.3;
                    return (
                      <div key={crab.id} className="grid grid-cols-4 px-6 py-3.5 text-xs font-mono items-center hover:bg-gray-50 transition-colors">
                        <div className="font-black text-[#007AFF]">#{crab.id}</div>
                        <div>
                          {isActive 
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded-lg text-[9px] font-bold border border-green-100">MOVING</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 text-gray-400 rounded-lg text-[9px] font-bold border border-gray-100">IDLE</span>
                          }
                        </div>
                        <div className="text-[#86868B]">{(crab.distance / 10).toFixed(1)}m</div>
                        <div className="font-bold">{speed.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

