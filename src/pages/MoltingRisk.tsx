import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ShieldCheck, 
  Zap, 
  AlertCircle, 
  Calendar,
  Play,
  Pause,
  RotateCcw,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertOctagon
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import { cn } from '../lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

const THRESHOLD = 60;

interface Entry {
  date: string;
  isMoltingWindow: boolean;
  rawIntake: number;
  rawActivity: number;
  envDO: number;
  envPH: number;
  envTemp: number;
}

interface ProcessedEntry extends Entry {
  maIntake: number;
  maActivity: number;
  ruleI: boolean;
  ruleA: boolean;
  ruleM: boolean;
  ruleE: boolean;
  warning: boolean;
  crisis: boolean;
}

export default function MoltingRisk() {
  const [maWindow, setMaWindow] = useState(3);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateData = useCallback((): Entry[] => {
    const data: Entry[] = [];
    const startDay = new Date(2024, 7, 15);
    for (let i = 0; i < 20; i++) {
      const d = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate() + i);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      
      let bI = 95, bA = 90;
      if (i >= 6 && i <= 13) {
        const dist = Math.abs(9 - i);
        const drop = 50 - dist * 10;
        bI -= drop;
        bA -= (drop + 15);
      }

      data.push({
        date: dateStr,
        isMoltingWindow: (d.getMonth() === 7 && d.getDate() >= 22 && d.getDate() <= 28),
        rawIntake: Math.max(5, Math.round(bI + (Math.random() * 30 - 15))),
        rawActivity: Math.max(5, Math.round(bA + (Math.random() * 30 - 15))),
        envDO: +(6.8 + (Math.random() * 0.4 - 0.2)).toFixed(1),
        envPH: +(8.0 + (Math.random() * 0.2 - 0.1)).toFixed(1),
        envTemp: +(25.0 + (Math.random() * 1.5 - 0.75)).toFixed(1),
      });
    }
    return data;
  }, []);

  const [rawData, setRawData] = useState<Entry[]>(generateData());

  const processedData: ProcessedEntry[] = useMemo(() => {
    return rawData.map((d, i) => {
      let sumI = 0, sumA = 0, count = 0;
      for (let j = 0; j < maWindow; j++) {
        if (i - j >= 0) {
          sumI += rawData[i - j].rawIntake;
          sumA += rawData[i - j].rawActivity;
          count++;
        }
      }
      const maI = Math.round(sumI / count);
      const maA = Math.round(sumA / count);
      const envNormal = d.envDO >= 5.0 && d.envPH >= 7.5 && d.envPH <= 8.5 && d.envTemp >= 20 && d.envTemp <= 28;

      return {
        ...d,
        maIntake: maI,
        maActivity: maA,
        ruleI: maI < THRESHOLD,
        ruleA: maA < THRESHOLD,
        ruleM: d.isMoltingWindow,
        ruleE: envNormal,
        warning: (maI < THRESHOLD) && (maA < THRESHOLD) && d.isMoltingWindow && envNormal,
        crisis: !envNormal
      };
    });
  }, [rawData, maWindow]);

  const p = processedData[currentIndex];

  const togglePlay = () => {
    if (isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playTimerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= 19) {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const resetData = () => {
    if (isPlaying && playTimerRef.current) {
      clearInterval(playTimerRef.current);
      setIsPlaying(false);
    }
    setRawData(generateData());
    setCurrentIndex(0);
  };

  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, []);

  const chartData = {
    labels: rawData.map(d => d.date),
    datasets: [
      {
        label: '进食连续趋势',
        data: processedData.map((d, i) => i <= currentIndex ? d.maIntake : null),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.1)',
        borderWidth: 3,
        tension: 0.3,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2,
        fill: true,
      },
      {
        label: '活跃连续趋势',
        data: processedData.map((d, i) => i <= currentIndex ? d.maActivity : null),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 3,
        tension: 0.3,
        pointBackgroundColor: 'white',
        pointBorderWidth: 2,
        fill: true,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 } as any,
    scales: {
      y: { 
        beginAtZero: true, 
        max: 140, 
        grid: { color: '#f8fafc' },
        ticks: { font: { size: 10 } }
      },
      x: { 
        grid: { display: false },
        ticks: { font: { size: 10 } }
      }
    },
    plugins: {
      legend: { 
        position: 'top' as const, 
        labels: { boxWidth: 8, usePointStyle: true, font: { size: 10 } } 
      },
      tooltip: { mode: 'index' as const, intersect: false },
      annotation: {
        annotations: {
          moltRange: {
            type: 'box' as const,
            xMin: 7,
            xMax: 13,
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            borderColor: 'transparent',
            label: {
              display: true,
              content: '历史蜕壳观察窗',
              position: 'start' as const,
              backgroundColor: 'rgba(251, 191, 36, 0.8)',
              font: { size: 10, weight: 'bold' as const },
              padding: 4,
              borderRadius: 4,
              yAdjust: -140
            }
          },
          thresholdLine: {
            type: 'line' as const,
            yMin: THRESHOLD,
            yMax: THRESHOLD,
            borderColor: 'rgba(251, 191, 36, 0.8)',
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
              display: true,
              content: '警戒阈值',
              position: 'end' as const,
              font: { size: 9 }
            }
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Logic Gates */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-[#E5E5E7]">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold">蜕壳风险判断</h2>
              <span className="text-sm font-bold text-[#007AFF] bg-blue-50 px-4 py-1.5 rounded-full ring-1 ring-inset ring-blue-100">
                {p?.date}
              </span>
            </div>

            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-2xl border transition-all flex items-center justify-between",
                p?.ruleI ? "bg-green-50 border-green-100" : "bg-white border-gray-100"
              )}>
                <div>
                  <div className="font-bold text-sm">进食趋势走低</div>
                  <div className="text-xs text-[#86868B] mt-1">
                    当前: <span className="text-[#1D1D1F] font-mono">{p?.maIntake}</span> / 阈值: 60
                  </div>
                </div>
                {p?.ruleI ? <CheckCircle2 className="text-green-500" size={20} /> : <XCircle className="text-gray-200" size={20} />}
              </div>

              <div className={cn(
                "p-4 rounded-2xl border transition-all flex items-center justify-between",
                p?.ruleA ? "bg-green-50 border-green-100" : "bg-white border-gray-100"
              )}>
                <div>
                  <div className="font-bold text-sm">活跃度下降</div>
                  <div className="text-xs text-[#86868B] mt-1">
                    当前: <span className="text-[#1D1D1F] font-mono">{p?.maActivity}</span> / 阈值: 60
                  </div>
                </div>
                {p?.ruleA ? <CheckCircle2 className="text-green-500" size={20} /> : <XCircle className="text-gray-200" size={20} />}
              </div>

              <div className={cn(
                "p-4 rounded-2xl border transition-all flex items-center justify-between",
                p?.ruleM ? "bg-green-50 border-green-100" : "bg-white border-gray-100"
              )}>
                <div>
                  <div className="font-bold text-sm">历史蜕壳期</div>
                  <div className="text-xs text-[#86868B] mt-1">窗口期 (08/22 - 08/28)</div>
                </div>
                {p?.ruleM ? <CheckCircle2 className="text-green-500" size={20} /> : <XCircle className="text-gray-200" size={20} />}
              </div>

              <div className={cn(
                "p-4 rounded-2xl border transition-all flex flex-col gap-3",
                p?.ruleE ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
              )}>
                <div className="flex justify-between items-center">
                   <div className="font-bold text-sm">环境指标检核</div>
                   {p?.ruleE ? <CheckCircle2 className="text-green-500" size={20} /> : <AlertOctagon className="text-red-500" size={20} />}
                </div>
                <div className="flex gap-4 text-[10px] font-bold">
                  <span className={cn(p?.envTemp < 20 || p?.envTemp > 28 ? "text-red-600" : "text-[#86868B]")}>水温: {p?.envTemp}°C</span>
                  <span className={cn(p?.envDO < 5 ? "text-red-600" : "text-[#86868B]")}>溶氧: {p?.envDO}</span>
                  <span className={cn(p?.envPH < 7.5 || p?.envPH > 8.5 ? "text-red-600" : "text-[#86868B]")}>pH: {p?.envPH}</span>
                </div>
              </div>
            </div>

            <div className={cn(
              "mt-8 p-6 rounded-2xl border text-center transition-all",
              p?.warning ? "bg-white border-red-500 shadow-lg shadow-red-500/10" : 
              p?.crisis ? "bg-white border-amber-500 shadow-lg shadow-amber-500/10" :
              "bg-white border-green-500 shadow-lg shadow-green-500/10"
            )}>
               <h3 className={cn(
                 "font-black text-xl tracking-tighter mb-2 flex items-center justify-center gap-2",
                 p?.warning ? "text-red-600" : p?.crisis ? "text-amber-600" : "text-green-600"
               )}>
                 {p?.warning ? <><Zap fill="currentColor" size={20} /> 疑似进入群体蜕壳期</> : 
                  p?.crisis ? <><AlertCircle fill="currentColor" size={20} /> 水质环境异常</> : 
                  <><ShieldCheck fill="currentColor" size={20} /> 塘口状态平稳</>}
               </h3>
               <p className="text-xs font-semibold text-[#86868B]">
                 {p?.warning ? "综合判定成立，风险较高，建议加强巡视。" : 
                  p?.crisis ? "部分环境指标越界，需重点关注调控。" : "未达到综合预警触发条件。"}
               </p>
            </div>

            <button 
              onClick={togglePlay}
              className={cn(
                "w-full mt-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95",
                isPlaying ? "bg-[#F5F5F7] text-[#1D1D1F]" : "bg-[#1D1D1F] text-white shadow-xl shadow-black/10"
              )}
            >
              {isPlaying ? <><Pause fill="currentColor" size={18} /> 暂停推演</> : <><Play fill="currentColor" size={18} /> 按日推演数据</>}
            </button>
          </div>

          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-[#E5E5E7]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold flex items-center gap-2">
                <TrendingUp size={18} className="text-[#007AFF]" />
                滑动平均时间窗
              </h3>
              <button 
                onClick={resetData}
                className="p-2 hover:bg-gray-50 rounded-full transition-colors text-[#86868B] hover:text-[#007AFF]"
              >
                <RotateCcw size={18} />
              </button>
            </div>
            
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-[#86868B] uppercase tracking-widest">
                当前窗口: <span className="text-[#007AFF]">{maWindow}天</span>
              </span>
            </div>
            <input 
              type="range" 
              min="1" max="7" value={maWindow} 
              onChange={(e) => setMaWindow(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#007AFF]"
            />
            <div className="flex justify-between text-[10px] text-[#86868B] font-bold mt-2 uppercase">
              <span>灵敏 (1D)</span>
              <span>平滑 (7D)</span>
            </div>
          </div>
        </div>

        {/* Main Chart Column */}
        <div className="lg:col-span-8 bg-white rounded-[2rem] p-8 shadow-sm border border-[#E5E5E7] flex flex-col min-h-[600px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold flex items-center gap-2 text-xl">
              <Calendar className="text-[#007AFF]" size={24} />
              数据推演趋势
            </h3>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
              <span className="flex items-center gap-1.5 text-green-600"><span className="w-2.5 h-0.5 bg-green-600" /> 进食趋势</span>
              <span className="flex items-center gap-1.5 text-blue-600"><span className="w-2.5 h-0.5 bg-blue-600" /> 活跃度</span>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            <Line data={chartData} options={chartOptions as any} />
          </div>
        </div>
      </div>
    </div>
  );
}
