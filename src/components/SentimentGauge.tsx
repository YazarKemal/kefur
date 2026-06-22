import { Shield, ThumbsUp, ThumbsDown, Zap } from 'lucide-react';

interface SentimentGaugeProps {
  score: number; // 0 to 100
  label: string;
  lang?: 'en' | 'tr';
}

export default function SentimentGauge({ score, label, lang = 'en' }: SentimentGaugeProps) {
  // Convert 0-100 score to degrees for needle rotation (e.g. -90deg to +90deg for semi-circle)
  const degrees = (score / 100) * 180 - 90;

  // Determine indicator color theme
  let colorClass = 'text-gray-400';
  let bgClass = 'bg-gray-500/10 border-gray-500/20';
  let indicatorIcon = Shield;
  
  if (score >= 70) {
    colorClass = 'text-emerald-400';
    bgClass = 'bg-emerald-500/10 border-emerald-500/20';
    indicatorIcon = ThumbsUp;
  } else if (score >= 50) {
    colorClass = 'text-amber-400';
    bgClass = 'bg-amber-500/10 border-amber-500/20';
    indicatorIcon = Zap;
  } else {
    colorClass = 'text-red-400';
    bgClass = 'bg-red-500/10 border-red-500/20';
    indicatorIcon = ThumbsDown;
  }

  const IconComponent = indicatorIcon;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5 text-center flex flex-col items-center" id="sentiment-gauge-box">
      <div className="w-full flex items-center justify-between mb-3.5" id="gauge-lbl-area">
        <span className="text-[9px] uppercase font-bold tracking-[0.2em] text-white/40 font-mono">
          {lang === 'tr' ? 'Uzman Görüşü' : 'Expert Sentiment'}
        </span>
        <span className="text-[9px] font-mono font-bold text-white/70 bg-white/10 px-2 py-0.5 rounded border border-white/5">
          {lang === 'tr' ? 'YZ Destekli' : 'Grounded AI'}
        </span>
      </div>

      {/* SVG Sentiment Ring and Needle */}
      <div className="relative w-40 h-[100px] flex items-end justify-center overflow-hidden" id="gauge-arc-wrapper">
        <svg width="150" height="85" className="absolute top-1" id="gauge-arc-svg">
          <defs>
            <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" /> {/* Red */}
              <stop offset="50%" stopColor="#f59e0b" /> {/* Orange/Yellow */}
              <stop offset="100%" stopColor="#10b981" /> {/* Emerald */}
            </linearGradient>
          </defs>

          {/* Background Arc Ring */}
          <path
            d="M 15 80 A 60 60 0 0 1 135 80"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Active Colored Arc Ring */}
          <path
            d="M 15 80 A 60 60 0 0 1 135 80"
            fill="none"
            stroke="url(#gauge-grad)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Pivot Node Core */}
          <circle cx="75" cy="80" r="7" fill="#0A0A0A" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1.5" />
          <circle cx="75" cy="80" r="3" fill="#F0F0F0" />

          {/* Needle Node Pointer */}
          <g transform={`translate(75, 80) rotate(${degrees})`} style={{ transition: 'transform 1.2s cubic-bezier(0.19, 1, 0.22, 1)' }}>
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-56"
              stroke="#F0F0F0"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="drop-shadow-lg"
            />
          </g>
        </svg>

        {/* Floating Digital Meter */}
        <div className="z-10 bg-[#0A0A0A] px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5" id="gauge-meter-box">
          <IconComponent className={`w-3 h-3 ${colorClass}`} />
          <span className="text-xs font-bold text-[#F0F0F0] font-mono">{score}%</span>
        </div>
      </div>

      {/* Sentiment labels */}
      <div className={`mt-3.5 px-3 py-1 rounded-md border text-[10px] font-mono font-bold uppercase tracking-widest ${bgClass} ${colorClass}`} id="gauge-lbl-tag">
        {label}
      </div>

      {/* Axis guidelines */}
      <div className="w-full flex justify-between text-[8px] text-white/30 font-mono mt-2.5 px-3 tracking-widest" id="gauge-axis-bounds">
        <span>{lang === 'tr' ? 'AYI / DÜŞÜŞ' : 'BEARISH'}</span>
        <span>{lang === 'tr' ? 'NÖTR' : 'NEUTRAL'}</span>
        <span>{lang === 'tr' ? 'BOĞA / YÜKSELİŞ' : 'BULLISH'}</span>
      </div>
    </div>
  );
}
