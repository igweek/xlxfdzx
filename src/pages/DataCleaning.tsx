import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Play, 
  Square, 
  Info, 
  Activity, 
  Table as TableIcon, 
  LineChart as LineChartIcon,
  Circle,
  CheckCircle2,
  ChevronRight,
  AlertCircle
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

const METRICS = {
  temp: { label: '水温', unit: '°C', color: '#f87171' },
  do: { label: '溶氧', unit: 'mg/L', color: '#60a5fa' },
  ph: { label: 'pH值', unit: '', color: '#22c55e' },
};

const STEPS = [
  { id: 0, title: '① 原始数据', desc: '包含因设备抖动产生的异常值和网络造成的缺失片段。' },
  { id: 1, title: '② 筛查异常 (3σ + IQR)', desc: '识别出明显的偏离数值（红色标注），确保对偏态和极端值稳健。' },
  { id: 2, title: '③ 缺失插补 (线性)', desc: '利用序列连续性，对空缺与异常点所在时间刻进行线性插补（黄色标注）。' },
  { id: 3, title: '④ 序列平滑', desc: '通过滑动平均滤波，消除微小噪点，还原真实环境的连续波动趋势。' }
];

// --- Processing Algorithms ---
function getBounds(values: (number | null)[]) {
  const valid = values.filter((v): v is number => v !== null && !isNaN(v));
  if (valid.length === 0) return { mean: 0, std: 0, q1: 0, q3: 0, iqr: 0, lower: 0, upper: 0 };
  
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const std = Math.sqrt(valid.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / valid.length);
  const sigmaLower = mean - 3 * std;
  const sigmaUpper = mean + 3 * std;

  const sorted = [...valid].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const iqrLower = q1 - 1.5 * iqr;
  const iqrUpper = q3 + 1.5 * iqr;

  const lower = Math.max(sigmaLower, iqrLower);
  const upper = Math.min(sigmaUpper, iqrUpper);

  return { lower, upper };
}

function interpolate(arr: (number | null)[]) {
  const result = [...arr];
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null) {
      let prevIdx = i - 1;
      while (prevIdx >= 0 && result[prevIdx] === null) prevIdx--;
      let nextIdx = i + 1;
      while (nextIdx < result.length && result[nextIdx] === null) nextIdx++;

      if (prevIdx >= 0 && nextIdx < result.length) {
        const prevVal = result[prevIdx]!;
        const nextVal = result[nextIdx]!;
        const slope = (nextVal - prevVal) / (nextIdx - prevIdx);
        result[i] = +(prevVal + slope * (i - prevIdx)).toFixed(2);
      } else if (prevIdx >= 0) {
        result[i] = result[prevIdx];
      } else if (nextIdx < result.length) {
        result[i] = result[nextIdx];
      }
    }
  }
  return result;
}

function smoothArray(arr: (number | null)[], windowSize = 3) {
  const result = [...arr];
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < arr.length; i++) {
    if (result[i] === null) continue;
    if (i < half || i >= arr.length - half) continue;
    let sum = 0;
    let count = 0;
    for (let j = -half; j <= half; j++) {
      if (arr[i + j] !== null) {
        sum += arr[i + j]!;
        count++;
      }
    }
    if (count > 0) result[i] = +(sum / count).toFixed(2);
  }
  return result;
}

export default function DataCleaning() {
  const [activeStep, setActiveStep] = useState(0);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [isPlaying, setIsPlaying] = useState(false);

  // Generate stable raw data
  const rawDataset = useMemo(() => {
    const data = [];
    const baseT = 27.5;
    const baseD = 6.5;
    const baseP = 7.3;
    const startHour = 14;
    const startMinute = 30;

    for (let i = 0; i < 40; i++) {
      const hh = startHour.toString().padStart(2, '0');
      const mm = startMinute.toString().padStart(2, '0');
      const ss = i.toString().padStart(2, '0');
      const time = `${hh}:${mm}:${ss}`;
      
      let temp: number | null = +(baseT + Math.sin(i * 0.2) + (Math.random() * 0.4 - 0.2)).toFixed(2);
      let d: number | null = +(baseD + Math.sin(i * 0.1) * 0.5 + (Math.random() * 0.2 - 0.1)).toFixed(2);
      let ph: number | null = +(baseP + Math.cos(i * 0.3) * 0.2 + (Math.random() * 0.1 - 0.05)).toFixed(2);

      if (i === 6) temp = null; 
      if (i === 15) temp = 12.3; 
      if (i === 28) temp = 35.1; 
      if (i === 34) temp = null; 

      if (i === 12) d = 2.1; 
      if (i === 19) d = null;
      if (i === 20) d = null;
      if (i === 35) d = 9.8; 

      if (i === 8) ph = null;
      if (i === 22) ph = 9.5;
      if (i === 30) ph = 4.2;

      data.push({ time, temp, do: d, ph });
    }
    return data;
  }, []);

  const processedDataMap = useMemo(() => {
    const process = (metricKey: 'temp' | 'do' | 'ph') => {
      const rawValues = rawDataset.map(d => d[metricKey]);
      const bounds = getBounds(rawValues);

      const points = rawDataset.map(point => {
        const val = point[metricKey];
        const isMissingOriginal = val === null;
        let isAnomaly = false;

        if (val !== null && (val < bounds.lower || val > bounds.upper)) {
          isAnomaly = true;
        }

        return {
          time: point.time,
          raw: val,
          isMissingOriginal,
          isAnomaly,
          value: val,
          isImputed: false,
        };
      });

      if (activeStep >= 2) {
        const valuesForImputation = points.map(d => (d.isAnomaly || d.isMissingOriginal) ? null : d.value);
        const interpolated = interpolate(valuesForImputation);
        
        points.forEach((d, i) => {
          d.value = interpolated[i];
          if (d.isAnomaly || d.isMissingOriginal) {
            d.isImputed = true;
          }
        });

        if (activeStep >= 3) {
          const smoothed = smoothArray(points.map(d => d.value));
          points.forEach((d, i) => {
            d.value = smoothed[i];
          });
        }
      } else {
         points.forEach(d => { d.value = d.raw; });
      }

      return { 
        points, 
        bounds, 
        anomalyCount: points.filter(d => d.isAnomaly).length, 
        missingCount: points.filter(d => d.isMissingOriginal).length 
      };
    };

    return {
      temp: process('temp'),
      do: process('do'),
      ph: process('ph')
    };
  }, [rawDataset, activeStep]);

  const totalAnomalies = useMemo(() => 
    Object.values(processedDataMap).reduce((acc, m) => acc + m.anomalyCount, 0), 
  [processedDataMap]);

  const totalMissing = useMemo(() => 
    Object.values(processedDataMap).reduce((acc, m) => acc + m.missingCount, 0), 
  [processedDataMap]);

  // Autoplay Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setActiveStep(prev => {
          if (prev < STEPS.length - 1) return prev + 1;
          setIsPlaying(false);
          return prev;
        });
      }, 1800);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const chartOptions = (key: keyof typeof METRICS) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1D1D1F',
        bodyColor: '#424245',
        borderColor: '#E5E5E7',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        usePointStyle: true,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#86868B', font: { size: 10 }, maxTicksLimit: 8 },
      },
      y: {
        grid: { color: '#F5F5F7' },
        ticks: { color: '#86868B', font: { size: 10 }, padding: 8, maxTicksLimit: 5 },
      }
    },
    animation: { duration: activeStep === 0 ? 0 : 400 }
  });

  const getChartData = (key: keyof typeof METRICS) => {
    const data = processedDataMap[key];
    const color = METRICS[key].color;
    
    return {
      labels: data.points.map(p => p.time),
      datasets: [
        {
          label: '原始基准',
          data: activeStep >= 2 ? data.points.map(p => p.raw) : [],
          borderColor: '#E5E5E7',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        },
        {
          label: '处理后数据',
          data: data.points.map(p => p.value),
          borderColor: color,
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: (ctx: any) => {
            const p = data.points[ctx.dataIndex];
            if (!p) return 2;
            if (activeStep === 1 && p.isAnomaly) return 4;
            if (activeStep >= 2 && p.isImputed) return 4;
            return 2;
          },
          pointBackgroundColor: (ctx: any) => {
            const p = data.points[ctx.dataIndex];
            if (!p) return color;
            if (activeStep === 1 && p.isAnomaly) return '#EF4444';
            if (activeStep >= 2 && p.isImputed) return '#FACC15';
            return color;
          },
          fill: false,
          spanGaps: activeStep >= 2,
        }
      ]
    };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel */}
        <aside className="lg:col-span-1">
          <div className="bg-white p-6 rounded-3xl border border-[#E5E5E7] shadow-sm flex flex-col h-full min-h-[500px]">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#86868B] mb-6">处理步骤</h2>
            
            <div className="space-y-6 flex-1">
              {STEPS.map((step, idx) => {
                const isActive = activeStep === step.id;
                const isCompleted = activeStep > step.id;
                return (
                  <div 
                    key={step.id}
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveStep(step.id);
                    }}
                    className={cn(
                      "relative pl-8 cursor-pointer transition-all group",
                      isActive ? "opacity-100" : "opacity-40 hover:opacity-100"
                    )}
                  >
                    {idx !== STEPS.length - 1 && (
                      <div className={cn(
                        "absolute left-[9px] top-6 bottom-[-24px] w-0.5 transition-colors",
                        isCompleted ? "bg-[#007AFF]" : "bg-gray-100"
                      )} />
                    )}
                    <div className={cn(
                      "absolute left-0 top-1 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center transition-all z-10",
                      isActive ? "border-[#007AFF] ring-4 ring-blue-50" : isCompleted ? "border-[#007AFF] bg-[#007AFF]" : "border-gray-200"
                    )}>
                      {isCompleted && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <div>
                      <h3 className={cn("text-sm font-semibold mb-1", isActive && "text-[#007AFF]")}>{step.title}</h3>
                      {isActive && <p className="text-[10px] text-[#86868B] leading-relaxed">{step.desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-[#1D1D1F] text-xs font-bold mb-2 pb-2 border-b border-gray-200">
                  <Info size={14} className="text-[#007AFF]" />
                  数据洞察总览
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#86868B]">检测出异常点:</span>
                    <span className="font-bold text-red-500">{totalAnomalies}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#86868B]">数据缺失统计:</span>
                    <span className="font-bold text-orange-500">{totalMissing}</span>
                  </div>
                  {activeStep >= 2 && (
                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="text-[#86868B]">插补修复状态:</span>
                      <span className="font-bold text-green-500 flex items-center gap-1">
                        100% 成功
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={cn(
                  "w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-all active:scale-[0.98]",
                  isPlaying 
                    ? "bg-red-50 text-red-500 hover:bg-red-100" 
                    : "bg-[#007AFF] text-white shadow-lg shadow-blue-500/20 hover:bg-[#0066CC]"
                )}
              >
                {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                {isPlaying ? "停止演示" : "开始测试"}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="lg:col-span-3 bg-white p-8 rounded-[2rem] border border-[#E5E5E7] shadow-sm flex flex-col min-h-[600px]">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-50 text-[#007AFF] rounded-xl">
                <Activity size={24} />
              </div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight">传感器综合数据趋势</h2>
                <div className="flex items-center gap-2">
                   {activeStep >= 1 && (
                     <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded-md">
                        <AlertCircle size={10} /> 异常检测激活
                     </span>
                   )}
                   {activeStep >= 2 && (
                     <span className="text-[10px] font-bold text-yellow-600 uppercase bg-yellow-50 px-2 py-0.5 rounded-md">
                        智能插补
                     </span>
                   )}
                </div>
              </div>
            </div>

            <div className="flex items-center bg-[#F5F5F7] p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('chart')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'chart' ? "bg-white shadow-sm text-[#007AFF]" : "text-[#86868B] hover:text-[#1D1D1F]"
                )}
              >
                <LineChartIcon size={18} />
              </button>
              <button 
                onClick={() => setViewMode('table')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'table' ? "bg-white shadow-sm text-[#007AFF]" : "text-[#86868B] hover:text-[#1D1D1F]"
                )}
              >
                <TableIcon size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {viewMode === 'chart' ? (
              <div className="h-full flex flex-col gap-6">
                {(Object.keys(METRICS) as Array<keyof typeof METRICS>).map((key) => (
                  <div key={key} className="flex-1 bg-white border border-[#E5E5E7] rounded-2xl p-4 relative group">
                    <div className="absolute top-4 left-6 z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: METRICS[key].color }} />
                        <span className="text-xs font-bold text-[#1D1D1F] uppercase tracking-wider">{METRICS[key].label} ({METRICS[key].unit})</span>
                      </div>
                    </div>
                    <div className="h-full pt-6">
                      <Line data={getChartData(key)} options={chartOptions(key)} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full border border-[#E5E5E7] rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 border-b border-[#E5E5E7] z-10">
                      <tr>
                        <th className="px-6 py-4 font-bold text-[#86868B] uppercase tracking-wider">时间刻</th>
                        {Object.keys(METRICS).map(k => (
                          <th key={k} className="px-6 py-4 font-bold text-[#86868B] uppercase tracking-wider">
                            {METRICS[k as keyof typeof METRICS].label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rawDataset.map((raw, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 font-mono font-medium text-[#86868B]">{raw.time}</td>
                          {(Object.keys(METRICS) as Array<keyof typeof METRICS>).map(k => {
                            const p = processedDataMap[k].points[i];
                            return (
                              <td key={k} className="px-6 py-3 font-mono">
                                {p.isImputed && activeStep >= 2 ? (
                                  <span className="text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-lg">{p.value}</span>
                                ) : activeStep >= 1 && p.isAnomaly ? (
                                  <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-lg">{p.raw}</span>
                                ) : p.raw === null ? (
                                  <span className="text-gray-300">null</span>
                                ) : (
                                  <span className="text-[#1D1D1F]">{p.value}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
