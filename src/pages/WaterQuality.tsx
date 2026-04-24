import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  TreePine, 
  AlertTriangle, 
  Info, 
  Play, 
  RotateCcw, 
  Activity,
  Trees
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Point {
  x: number;
  y: number;
  type: 'normal' | 'anomaly';
  label?: string;
}

interface Cut {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export default function WaterQuality() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [targetPoint, setTargetPoint] = useState<Point | null>(null);
  const [bounds, setBounds] = useState<Bounds>({ minX: 0, maxX: 600, minY: 0, maxY: 600 });
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [cutCount, setCutCount] = useState(0);
  const [isCutting, setIsCutting] = useState(false);
  const [isLiveSimulating, setIsLiveSimulating] = useState(false);
  const [msg, setMsg] = useState('等待选择目标点');
  
  // Live simulation states
  const [liveScore, setLiveScore] = useState(0);
  const [liveStatus, setLiveStatus] = useState('等待演示');
  const [driftPoint, setDriftPoint] = useState<{ x: number, y: number, color: string } | null>(null);
  const driftTrailRef = useRef<{ x: number, y: number, color: string }[]>([]);
  const [warningPoint, setWarningPoint] = useState<{ x: number, y: number } | null>(null);
  const [severePoint, setSeverePoint] = useState<{ x: number, y: number } | null>(null);

  const initData = useCallback(() => {
    const newPoints: Point[] = [];
    // Normal points (Gaussian cluster)
    for (let i = 0; i < 200; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1 || 1e-10)) * Math.cos(2.0 * Math.PI * u2);
      const z1 = Math.sqrt(-2.0 * Math.log(u1 || 1e-10)) * Math.sin(2.0 * Math.PI * u2);
      newPoints.push({ x: 300 + z0 * 35, y: 300 + z1 * 35, type: 'normal' });
    }
    // Anomalies
    newPoints.push({ x: 100, y: 150, type: 'anomaly', label: '低pH，高溶氧' });
    newPoints.push({ x: 520, y: 120, type: 'anomaly', label: '高pH，高溶氧' });
    newPoints.push({ x: 150, y: 500, type: 'anomaly', label: '低pH，低溶氧' });
    newPoints.push({ x: 550, y: 480, type: 'anomaly', label: '高pH，低溶氧' });
    newPoints.push({ x: 250, y: 60, type: 'anomaly' });
    
    setPoints(newPoints);
    setTargetPoint(null);
    setCuts([]);
    setCutCount(0);
    setBounds({ minX: 0, maxX: 600, minY: 0, maxY: 600 });
    setMsg('等待选择目标点');
    setDriftPoint(null);
    driftTrailRef.current = [];
    setWarningPoint(null);
    setSeverePoint(null);
    setLiveScore(0);
    setLiveStatus('等待演示');
  }, []);

  useEffect(() => {
    initData();
  }, [initData]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 600, 600);
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(0, 0, 600, 600);

    // Active space
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

    // Grid lines
    ctx.strokeStyle = '#cbd5e1';
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    cuts.forEach(c => {
      ctx.beginPath();
      ctx.moveTo(c.x1, c.y1);
      ctx.lineTo(c.x2, c.y2);
      ctx.stroke();
    });

    // Points
    points.forEach(p => {
      const inBounds = p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY;
      ctx.beginPath();
      ctx.arc(p.x, p.y, targetPoint === p ? 6 : 4, 0, Math.PI * 2);
      if (p.type === 'normal') {
        ctx.fillStyle = inBounds ? '#22c55e' : 'rgba(34, 197, 94, 0.2)';
      } else {
        ctx.fillStyle = inBounds ? '#ef4444' : 'rgba(239, 68, 68, 0.2)';
      }
      ctx.fill();

      if (targetPoint === p) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = inBounds ? '#0ea5e9' : 'rgba(14, 165, 233, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // Drift Trail
    if (driftTrailRef.current.length > 1) {
      ctx.lineWidth = 2;
      for (let i = 1; i < driftTrailRef.current.length; i++) {
        ctx.beginPath();
        ctx.moveTo(driftTrailRef.current[i - 1].x, driftTrailRef.current[i - 1].y);
        ctx.lineTo(driftTrailRef.current[i].x, driftTrailRef.current[i].y);
        ctx.strokeStyle = driftTrailRef.current[i].color;
        ctx.stroke();
      }
    }

    // Status symbols
    if (warningPoint) {
      ctx.fillStyle = '#EAB308';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('预警点', warningPoint.x + 8, warningPoint.y - 8);
    }
    if (severePoint) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('异常点', severePoint.x + 8, severePoint.y - 8);
    }

    // Drift Point
    if (driftPoint) {
      ctx.beginPath();
      ctx.arc(driftPoint.x, driftPoint.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = driftPoint.color;
      ctx.fill();
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(driftPoint.x, driftPoint.y, 14 + Math.sin(Date.now() / 150) * 4, 0, Math.PI * 2);
      ctx.strokeStyle = driftPoint.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('实时采样', driftPoint.x, driftPoint.y - 25);
    }

    // Axes
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('水温 / pH', 580, 580);
    ctx.textAlign = 'left';
    ctx.fillText('溶解氧', 20, 20);

    if (isLiveSimulating) {
      requestAnimationFrame(draw);
    }
  }, [points, targetPoint, bounds, cuts, driftPoint, isLiveSimulating, warningPoint, severePoint]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isCutting || isLiveSimulating) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (600 / rect.width);
    const y = (e.clientY - rect.top) * (600 / rect.height);

    let closest = null;
    let minDist = Infinity;
    points.forEach(p => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) {
        minDist = d;
        closest = p;
      }
    });

    if (minDist < 25) {
      setTargetPoint(closest);
      setBounds({ minX: 0, maxX: 600, minY: 0, maxY: 600 });
      setCuts([]);
      setCutCount(0);
      setMsg(closest?.type === 'anomaly' ? '已锁定 边缘 区域的数据点。' : '已锁定 核心 区域的数据点。');
    }
  };

  const simulateCutsForPoint = (px: number, py: number, numTrees = 100) => {
    let totalCuts = 0;
    for (let i = 0; i < numTrees; i++) {
      let b = { minX: 0, maxX: 600, minY: 0, maxY: 600 };
      let c = 0;
      let curPts = [...points];

      while (true) {
        let ptsInBounds = curPts.filter(p => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY);
        if (ptsInBounds.length === 0) break;

        let axis = Math.random() < 0.5 ? 'x' : 'y';
        let vals = ptsInBounds.map(p => p[axis === 'x' ? 'x' : 'y']);
        vals.push(axis === 'x' ? px : py);
        let minVal = Math.min(...vals);
        let maxVal = Math.max(...vals);

        if (maxVal - minVal < 1e-4) {
          axis = axis === 'x' ? 'y' : 'x';
          vals = ptsInBounds.map(p => p[axis === 'x' ? 'x' : 'y']);
          vals.push(axis === 'x' ? px : py);
          minVal = Math.min(...vals);
          maxVal = Math.max(...vals);
        }
        if (maxVal - minVal < 1e-4) break;

        let split = minVal + Math.random() * (maxVal - minVal);
        if (axis === 'x') {
          if (px < split) b.maxX = split;
          else b.minX = split;
        } else {
          if (py < split) b.maxY = split;
          else b.minY = split;
        }
        c++;
        if (c > 30) break;
      }
      totalCuts += c;
    }
    return totalCuts / numTrees;
  };

  const startCutting = () => {
    if (!targetPoint) return;
    setIsCutting(true);
    setMsg("正在运行 随机树 采样...");
    let tempBounds = { minX: 0, maxX: 600, minY: 0, maxY: 600 };
    let tempCutCount = 0;
    
    const interval = setInterval(() => {
      const ptsInBounds = points.filter(p =>
        p.x >= tempBounds.minX && p.x <= tempBounds.maxX &&
        p.y >= tempBounds.minY && p.y <= tempBounds.maxY
      );

      if (ptsInBounds.length <= 1) {
        clearInterval(interval);
        setIsCutting(false);
        return;
      }

      let axis: 'x' | 'y' = Math.random() < 0.5 ? 'x' : 'y';
      let vals = ptsInBounds.map(p => p[axis]);
      let minVal = Math.min(...vals);
      let maxVal = Math.max(...vals);

      if (maxVal - minVal < 1e-4) {
        axis = axis === 'x' ? 'y' : 'x';
        vals = ptsInBounds.map(p => p[axis]);
        minVal = Math.min(...vals);
        maxVal = Math.max(...vals);
      }

      if (maxVal - minVal < 1e-4) {
        clearInterval(interval);
        setIsCutting(false);
        return;
      }

      const split = minVal + Math.random() * (maxVal - minVal);
      const newCut: Cut = axis === 'x' 
        ? { x1: split, y1: tempBounds.minY, x2: split, y2: tempBounds.maxY }
        : { x1: tempBounds.minX, y1: split, x2: tempBounds.maxX, y2: split };

      if (axis === 'x') {
        if (targetPoint.x < split) tempBounds.maxX = split;
        else tempBounds.minX = split;
      } else {
        if (targetPoint.y < split) tempBounds.maxY = split;
        else tempBounds.minY = split;
      }

      setCuts(prev => [...prev, newCut]);
      setBounds({ ...tempBounds });
      tempCutCount++;
      setCutCount(tempCutCount);
    }, 200);
  };

  const startLiveSim = () => {
    initData();
    setIsLiveSimulating(true);
    setLiveStatus('预警模拟中...');

    let progress = 0;
    const targetX = 80;
    const targetY = 150;
    
    // Using a Ref for driftTrail to avoid re-drawing entire trail on every step if needed, 
    // but here we just use it to track history.
    
    const interval = setInterval(() => {
      progress += 0.005;
      if (progress >= 1) {
        clearInterval(interval);
        setIsLiveSimulating(false);
        return;
      }

      const curX = 300 + (targetX - 300) * progress + (Math.random() - 0.5) * 12;
      const curY = 300 + (targetY - 300) * progress + (Math.random() - 0.5) * 12;

      const avgCuts = simulateCutsForPoint(curX, curY, 50);
      const rawScore = (13 - avgCuts) * (100 / 8);
      const finalScore = Math.max(0, Math.min(100, rawScore));

      setLiveScore(finalScore);
      let color = '#22C55E';
      if (finalScore < 75) {
        setLiveStatus('当前状态: 正常');
      } else if (finalScore < 95) {
        color = '#EAB308';
        setLiveStatus('当前状态: 指标恶化 (关注期)');
        setWarningPoint(prev => prev || { x: curX, y: curY });
      } else {
        color = '#ef4444';
        setLiveStatus('当前状态: 触达 5% 污染率线');
        setSeverePoint(prev => prev || { x: curX, y: curY });
      }

      setDriftPoint({ x: curX, y: curY, color });
      driftTrailRef.current.push({ x: curX, y: curY, color });
    }, 50);
  };

  return (
    <div className="flex h-full gap-8 overflow-hidden">
      {/* Left Panel */}
      <div className="w-[400px] flex flex-col bg-white border border-[#E5E5E7] p-8 rounded-[2rem] shadow-sm overflow-y-auto custom-scrollbar">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          孤立森林算法模型
        </h2>

        <div className="flex gap-2 mb-6">
          <span className="text-[10px] font-bold px-2.5 py-1 bg-[#F5F5F7] border border-[#E5E5E7] text-[#86868B] rounded-lg uppercase tracking-tight flex items-center gap-1.5">
            <Trees size={12} /> n_estimators = 100
          </span>
          <span className="text-[10px] font-bold px-2.5 py-1 bg-red-50 border border-red-100 text-red-500 rounded-lg uppercase tracking-tight flex items-center gap-1.5">
            <AlertTriangle size={12} /> contamination = 0.05
          </span>
        </div>

        <p className="text-sm text-[#86868B] leading-relaxed mb-6">
          聚集在一起的绿色点，是根据历史数据训练出来的正常范围。异常点因为本身就偏离正常范围，通常几次切分就能被分离出来。
        </p>

        <div className="bg-[#F1F6FF] border-l-4 border-[#007AFF] p-4 rounded-xl text-sm font-medium mb-6 flex items-start gap-3">
          <Info size={18} className="text-[#007AFF] shrink-0 mt-0.5" />
          <p>操作：在右侧散点图中点击选取任意数据点作为切分目标。</p>
        </div>

        <div className={cn(
          "p-8 rounded-2xl border transition-all text-center mb-6",
          !targetPoint ? "bg-[#F5F5F7] border-[#E5E5E7]" : 
          targetPoint.type === 'anomaly' ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
        )}>
          <h3 className="text-3xl font-black font-mono tracking-tighter mb-2 text-[#1D1D1F]">
            切分深度: {cutCount}
          </h3>
          <p className="text-xs font-bold text-[#86868B] uppercase tracking-widest">{msg}</p>
        </div>

        <div className="flex gap-3 mb-8">
          <button 
            onClick={startCutting}
            disabled={!targetPoint || isCutting || isLiveSimulating}
            className="flex-1 bg-[#007AFF] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 transition-all active:scale-95"
          >
            <Play size={16} fill="currentColor" /> 开始随机切分
          </button>
          <button 
            onClick={initData}
            disabled={isCutting || isLiveSimulating}
            className="px-4 border border-[#E5E5E7] bg-white text-[#1D1D1F] py-3 rounded-xl font-bold hover:bg-gray-50 flex items-center justify-center transition-all disabled:opacity-50"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="pt-8 border-t border-[#E5E5E7] mt-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#86868B]">动态演练模拟</span>
            <span className={cn(
               "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase",
               liveScore > 95 ? "bg-red-50 text-red-500" : liveScore > 75 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-500"
            )}>
               {liveStatus}
            </span>
          </div>
          
          <div className="flex justify-between items-baseline mb-3">
             <span className="text-xs font-medium text-[#86868B]">实时异常分数</span>
             <span className="text-xl font-black font-mono tracking-tighter">{(liveScore / 100).toFixed(2)}</span>
          </div>

          <div className="h-2.5 bg-[#F5F5F7] rounded-full overflow-hidden relative mb-6 border border-[#E5E5E7]">
             <div className="absolute inset-0 flex">
                <div className="h-full bg-green-500/10" style={{ width: '75%' }} />
                <div className="h-full bg-amber-500/10" style={{ width: '20%' }} />
                <div className="h-full bg-red-500/10" style={{ width: '5%' }} />
             </div>
             <div className="absolute right-[5%] inset-y-0 w-[1px] bg-red-500 z-10" />
             <div 
               className="absolute left-0 inset-y-0 bg-[#007AFF] transition-all duration-100" 
               style={{ width: `${liveScore}%` }} 
             />
          </div>

          <button 
            onClick={startLiveSim}
            disabled={isCutting || isLiveSimulating}
            className="w-full bg-[#1D1D1F] text-white py-4 rounded-2xl font-bold text-sm tracking-tight flex items-center justify-center gap-2 hover:bg-black active:scale-95 disabled:bg-gray-400 transition-all shadow-lg shadow-black/10"
          >
            <Activity size={18} /> 模型实战测试
          </button>
        </div>
      </div>

      {/* Right Plot */}
      <div className="flex-1 bg-white border border-[#E5E5E7] p-8 rounded-[2rem] shadow-sm flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.4] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        <div className="mb-6 flex justify-center gap-8 relative z-10">
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-widest">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> 正常状态采样
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-[#86868B] uppercase tracking-widest">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> 传感器偏离异常
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative backdrop-blur-[1px]">
          <div className="relative group">
            <canvas 
              ref={canvasRef}
              width={600}
              height={600}
              onClick={handleCanvasClick}
              className="bg-white border border-[#E5E5E7] rounded-[2rem] cursor-crosshair shadow-2xl shadow-black/5"
              style={{ width: 600, height: 600 }}
            />
            {!targetPoint && !isLiveSimulating && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                    <div className="bg-white/80 backdrop-blur-md px-6 py-4 rounded-2xl border border-[#E5E5E7] shadow-xl text-center">
                        <p className="text-sm font-bold text-[#1D1D1F]">点击任意点锁定目标</p>
                        <p className="text-xs text-[#86868B] mt-1">分析孤立路径深度</p>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
