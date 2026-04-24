import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Activity as ActivityIcon, 
  Thermometer, 
  Droplets, 
  Waves, 
  Percent, 
  Fish, 
  Cpu, 
  Play, 
  Square, 
  GitBranch, 
  TrendingUp 
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { cn } from '../lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// Constants from the user's HTML logic
const FEATURES = [
  { id: 'temp', name: '水温', min: 10, max: 35, unit: '℃' },
  { id: 'ph', name: 'pH', min: 6.0, max: 9.0, unit: '' },
  { id: 'doValue', name: '溶氧', min: 3, max: 10, unit: 'mg/L' },
  { id: 'leftover', name: '残饵', min: 0, max: 50, unit: '%' },
  { id: 'activity', name: '活跃', min: 0, max: 100, unit: '' }
];

function getWeightedFeature() {
  const r = Math.random();
  if (r < 0.40) return FEATURES[3]; // 残饵
  if (r < 0.80) return FEATURES[4]; // 活跃度
  if (r < 0.88) return FEATURES[0]; // 水温
  if (r < 0.94) return FEATURES[1]; // pH
  return FEATURES[2]; // 溶氧
}

function genCond() {
  const feat = getWeightedFeature();
  let threshold = (Math.random() * (feat.max - feat.min) + feat.min).toFixed(1);
  if (feat.id === 'leftover' || feat.id === 'activity') threshold = Math.round(Number(threshold)).toString();
  
  let isGreater = true;
  if (feat.id === 'leftover') isGreater = false;
  
  return {
    featId: feat.id,
    text: `${feat.name}${isGreater ? '≥' : '<'}${threshold}`,
    operator: isGreater ? '>=' : '<',
    val: parseFloat(threshold),
    rawFeatName: feat.name
  };
}

// Decision Tree Component
const DecisionTree = ({ config, envData }: { config: any, envData: any }) => {
  const evaluate = () => {
    const { nodes } = config;
    const a = [0];
    const e: string[] = [];
    let res = 0;

    const evalNode = (node: any) => {
      const val = envData[node.cond.featId as keyof typeof envData];
      if (node.cond.operator === '>=') return val >= node.cond.val;
      return val < node.cond.val;
    };

    if (evalNode(nodes[0])) {
      e.push('0-1'); a.push(1);
      if (evalNode(nodes[1])) { e.push('1-3'); a.push(3); res = nodes[3].res; } 
      else { e.push('1-4'); a.push(4); res = nodes[4].res; }
    } else {
      e.push('0-2'); a.push(2);
      if (evalNode(nodes[2])) { e.push('2-5'); a.push(5); res = nodes[5].res; } 
      else { e.push('2-6'); a.push(6); res = nodes[6].res; }
    }

    return { a, e, res };
  };

  const { a, e } = evaluate();

  const edges = [
    { from: 0, to: 1, id: '0-1' },
    { from: 0, to: 2, id: '0-2' },
    { from: 1, to: 3, id: '1-3' },
    { from: 1, to: 4, id: '1-4' },
    { from: 2, to: 5, id: '2-5' },
    { from: 2, to: 6, id: '2-6' },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col relative shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]">
      <div className="text-center mb-1">
        <h3 className="text-slate-700 font-bold text-[10px] tracking-tight truncate">{config.name}</h3>
        <p className="text-[8px] text-indigo-500/80 font-semibold mt-0.5 tracking-wider truncate">
          {config.msg}
        </p>
      </div>
      <div className="relative w-full aspect-[300/160]">
        <svg viewBox="0 0 300 160" className="w-full h-full absolute inset-0 overflow-visible">
          {edges.map(edge => {
            const n1 = config.nodes[edge.from];
            const n2 = config.nodes[edge.to];
            const isActive = e.includes(edge.id);
            return (
              <line 
                key={edge.id}
                x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} 
                stroke={isActive ? '#10b981' : '#e2e8f0'} 
                strokeWidth={isActive ? 2.5 : 1} 
                className="transition-all duration-300"
              />
            );
          })}
          {config.nodes.map((n: any) => {
            const w = n.isLeaf ? 46 : 64;
            const h = 22;
            const isActive = a.includes(n.id);
            const isLeafActive = isActive && n.isLeaf;
            
            return (
              <g key={n.id} transform={`translate(${n.x - w/2}, ${n.y - h/2})`}>
                <rect 
                  width={w} height={h} rx="4" 
                  fill={isLeafActive ? '#10b981' : isActive ? '#ecfdf5' : '#ffffff'} 
                  stroke={isActive ? '#10b981' : '#cbd5e1'} 
                  strokeWidth={isActive ? 1.5 : 0.5}
                  className="transition-all duration-300 shadow-sm"
                />
                <text 
                  x={w/2} y={h/2 + 3.5} 
                  textAnchor="middle" 
                  fontSize="8" 
                  fill={isLeafActive ? '#ffffff' : isActive ? '#047857' : '#64748b'} 
                  className={cn("font-sans transition-all duration-300", isActive ? "font-bold" : "font-medium")}
                >
                  {n.text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default function SmartFeeding() {
  const [isTesting, setIsTesting] = useState(false);
  const [currentEnv, setCurrentEnv] = useState({
    temp: 24.0,
    ph: 7.5,
    doValue: 6.5,
    leftover: 15,
    activity: 80
  });

  const [history, setHistory] = useState<any[]>([]);
  const tickPhase = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate 100 Trees once
  const treesConfig = useMemo(() => {
    const configs = [];
    for (let i = 1; i <= 100; i++) {
      const c0 = genCond();
      const c1 = genCond();
      const c2 = genCond();
      const leafBase = Math.floor(Math.random() * 20) + 30;
      
      configs.push({
        id: i,
        name: `决策树 #${i}`,
        msg: `特征: [${c0.rawFeatName}, ${c1.rawFeatName}, ${c2.rawFeatName}]`,
        nodes: [
          { id: 0, text: c0.text, cond: c0, x: 150, y: 20 },
          { id: 1, text: c1.text, cond: c1, x: 75, y: 75 },
          { id: 2, text: c2.text, cond: c2, x: 225, y: 75 },
          { id: 3, text: `${leafBase + 75}g`, res: leafBase + 75, x: 37, y: 130, isLeaf: true },
          { id: 4, text: `${leafBase + 40}g`, res: leafBase + 40, x: 113, y: 130, isLeaf: true },
          { id: 5, text: `${leafBase + 15}g`, res: leafBase + 15, x: 187, y: 130, isLeaf: true },
          { id: 6, text: `${Math.max(5, leafBase - 15)}g`, res: Math.max(5, leafBase - 15), x: 263, y: 130, isLeaf: true }
        ]
      });
    }
    return configs;
  }, []);

  const finalVal = useMemo(() => {
    const results = treesConfig.map(tree => {
      const { nodes } = tree;
      const evalNode = (node: any) => {
        const val = currentEnv[node.cond.featId as keyof typeof currentEnv];
        if (node.cond.operator === '>=') return val >= node.cond.val;
        return val < node.cond.val;
      };
      if (evalNode(nodes[0])) {
        return evalNode(nodes[1]) ? nodes[3].res : nodes[4].res;
      } else {
        return evalNode(nodes[2]) ? nodes[5].res : nodes[6].res;
      }
    });
    return Math.round(results.reduce((a, b) => a + b, 0) / 100);
  }, [treesConfig, currentEnv]);

  // Update history for chart
  useEffect(() => {
    setHistory(prev => {
      const newHistory = [...prev, { ...currentEnv, finalVal }];
      if (newHistory.length > 30) newHistory.shift();
      return newHistory;
    });
  }, [currentEnv, finalVal]);

  const toggleAutoFeed = () => {
    if (!isTesting) {
      setIsTesting(true);
      intervalRef.current = setInterval(() => {
        tickPhase.current += 0.15;
        const cycle = Math.sin(tickPhase.current);
        const targetActivity = 50 + cycle * 40;
        const targetLeftover = 25 - cycle * 20;

        setCurrentEnv(prev => ({
          ...prev,
          activity: prev.activity + (targetActivity - prev.activity) * 0.4,
          leftover: prev.leftover + (targetLeftover - prev.leftover) * 0.4,
          temp: prev.temp + (Math.random() - 0.5) * 0.5,
          ph: prev.ph + (Math.random() - 0.5) * 0.1,
          doValue: prev.doValue + (Math.random() - 0.5) * 0.2
        }));
      }, 1200);
    } else {
      setIsTesting(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const chartData = {
    labels: Array(history.length).fill(''),
    datasets: [
      {
        label: '投喂量(g/m²)',
        data: history.map(h => h.finalVal),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: 'y'
      },
      {
        label: '活跃度(%)',
        data: history.map(h => h.activity),
        borderColor: '#10b981',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: 'y1'
      },
      {
        label: '残饵量(%)',
        data: history.map(h => h.leftover),
        borderColor: '#f97316',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0.4,
        pointRadius: 0,
        yAxisID: 'y1'
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { 
        display: true, 
        position: 'top' as const, 
        align: 'end' as const, 
        labels: { boxWidth: 8, usePointStyle: true, font: {size: 10} } 
      }, 
      tooltip: { enabled: false } 
    },
    scales: {
      x: { display: false },
      y: { 
        type: 'linear' as const,
        display: true, 
        position: 'left' as const,
        min: 0, 
        max: 150, 
        border: { display: false },
        grid: { color: 'rgba(99, 102, 241, 0.1)', borderDash: [4, 4] as number[] },
        ticks: { color: '#4f46e5', font: { size: 9 }, stepSize: 30 },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        min: 0,
        max: 100,
        border: { display: false },
        grid: { drawOnChartArea: false },
        ticks: { color: '#64748b', font: { size: 9 }, stepSize: 25 },
      }
    },
    animation: { duration: 0 }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 h-full">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full min-h-[700px]">
        {/* Left Monitor Section */}
        <div className="xl:col-span-3">
          <div className="bg-white border border-[#E5E5E7] rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col h-full">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />
            <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
              <ActivityIcon className="text-[#007AFF] w-5 h-5" /> 实时数据监控
            </h2>
            
            <div className="space-y-8 flex-1">
              <section>
                <h3 className="text-[10px] font-bold text-[#86868B] mb-4 tracking-widest uppercase">环境特征探测器</h3>
                
                <div className="space-y-4">
                  {[
                    { label: '水温', val: currentEnv.temp, unit: '℃', icon: Thermometer, color: 'blue' as const },
                    { label: 'pH值', val: currentEnv.ph, unit: '', icon: Droplets, color: 'cyan' as const },
                    { label: '溶氧量', val: currentEnv.doValue, unit: 'mg/L', icon: Waves, color: 'teal' as const },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center group">
                      <label className="text-sm font-medium text-[#1D1D1F] flex items-center gap-2">
                        <span className={cn(
                          "p-1.5 rounded-lg border",
                          item.color === 'blue' && "bg-blue-50 text-blue-600 border-blue-100",
                          item.color === 'cyan' && "bg-cyan-50 text-cyan-600 border-cyan-100",
                          item.color === 'teal' && "bg-teal-50 text-teal-600 border-teal-100"
                        )}>
                          <item.icon size={14} />
                        </span>
                        {item.label}
                      </label>
                      <span className={cn(
                        "text-sm font-mono font-bold px-3 py-1.5 rounded-xl border shadow-sm min-w-[80px] text-right",
                        item.color === 'blue' && "border-blue-200 bg-blue-50 text-blue-700",
                        item.color === 'cyan' && "border-cyan-200 bg-cyan-50 text-cyan-700",
                        item.color === 'teal' && "border-teal-200 bg-teal-50 text-teal-700"
                      )}>
                        {item.val.toFixed(1)}<span className="text-[10px] ml-1 opacity-50">{item.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pt-6 border-t border-gray-100">
                <h3 className="text-[10px] font-bold text-[#86868B] mb-4 tracking-widest uppercase">行为视觉提取</h3>
                
                <div className="space-y-4">
                  {[
                    { label: '残饵量', val: currentEnv.leftover, unit: '%', icon: Percent, color: 'orange' as const },
                    { label: '活跃度', val: currentEnv.activity, unit: '/100', icon: Fish, color: 'emerald' as const },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center group">
                      <label className="text-sm font-medium text-[#1D1D1F] flex items-center gap-2">
                        <span className={cn(
                          "p-1.5 rounded-lg border",
                          item.color === 'orange' && "bg-orange-50 text-orange-600 border-orange-100",
                          item.color === 'emerald' && "bg-emerald-50 text-emerald-600 border-emerald-100"
                        )}>
                          <item.icon size={14} />
                        </span>
                        {item.label}
                      </label>
                      <span className={cn(
                        "text-sm font-mono font-bold px-3 py-1.5 rounded-xl border shadow-sm min-w-[80px] text-right",
                        item.color === 'orange' && "border-orange-200 bg-orange-50 text-orange-700",
                        item.color === 'emerald' && "border-emerald-200 bg-emerald-50 text-emerald-700"
                      )}>
                        {Math.round(item.val)}<span className="text-[10px] ml-1 opacity-50">{item.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mt-6 flex items-center justify-between relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-6 opacity-10 text-emerald-600 transition-transform group-hover:scale-110 duration-500">
                <Cpu size={100} />
              </div>
              <div className="text-emerald-800 font-bold text-sm z-10">模型输出决策</div>
              <div className="flex items-baseline gap-1 z-10">
                <span className="text-5xl font-black font-mono text-emerald-600 tracking-tighter">{finalVal}</span>
                <span className="text-emerald-600 font-bold text-xs uppercase opacity-80">g/m²</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 bg-[#F5F5F7] -mx-6 -mb-6 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-[#86868B] uppercase tracking-wider">系统状态:</span>
                <span className={cn(
                  "text-[10px] font-bold flex items-center gap-2 transition-colors uppercase",
                  isTesting ? "text-emerald-600" : "text-[#86868B]"
                )}>
                  <span className={cn("w-2.5 h-2.5 rounded-full shadow-inner", isTesting ? "bg-emerald-500 animate-pulse" : "bg-gray-300")} />
                  {isTesting ? "推演运行中" : "模型就绪"}
                </span>
              </div>
              <button 
                onClick={toggleAutoFeed}
                className={cn(
                  "w-full py-4 px-6 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95",
                  isTesting 
                    ? "bg-white text-red-500 border border-red-100 shadow-red-500/5" 
                    : "bg-[#007AFF] text-white shadow-blue-500/20 hover:bg-[#0066CC]"
                )}
              >
                {isTesting ? (
                  <><Square size={16} fill="currentColor" /> 停止运行</>
                ) : (
                  <><Play size={16} fill="currentColor" /> 在线运行模型</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Extensive Forest Simulation */}
        <div className="xl:col-span-9 bg-white border border-[#E5E5E7] rounded-3xl p-8 flex flex-col shadow-sm relative overflow-hidden">
          <h2 className="text-xl font-bold text-[#1D1D1F] flex items-center gap-2 mb-6 border-b border-gray-50 pb-6 relative z-10">
            <GitBranch className="text-[#007AFF] w-6 h-6" /> 并发决策森林模型
            <span className="ml-4 text-[10px] font-bold text-[#86868B] bg-gray-100 px-3 py-1 rounded-full uppercase tracking-widest">
              Live Neural Simulation (100 Trees)
            </span>
          </h2>

          {/* 100 Trees Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8 relative z-10 overflow-y-auto max-h-[535px] pr-2 custom-scrollbar">
            {treesConfig.map(tree => (
              <DecisionTree key={tree.id} config={tree} envData={currentEnv} />
            ))}
          </div>

          {/* Aggregation area */}
          <div className="mt-auto relative z-10 h-[240px]">
            <div className="bg-[#F5F5F7] border border-[#E5E5E7] rounded-[2rem] p-6 flex flex-col shadow-inner relative h-full overflow-hidden">
              <div className="flex justify-between items-center mb-4 relative z-10">
                <h3 className="text-xs font-black text-[#1D1D1F] uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#007AFF]" />
                  最终决策集成输出曲线
                </h3>
                <div className="flex gap-4 text-[9px] font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 text-[#4f46e5]"><span className="w-2 h-0.5 bg-[#4f46e5]" /> 投喂量</span>
                  <span className="flex items-center gap-1.5 text-[#10b981]"><span className="w-2 h-0.5 bg-[#10b981]" /> 活跃度</span>
                  <span className="flex items-center gap-1.5 text-[#f97316]"><span className="w-2 h-0.5 border-t border-dashed border-[#f97316]" /> 残饵量</span>
                </div>
              </div>
              <div className="flex-1 w-full relative z-10">
                <Line data={chartData} options={chartOptions as any} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

