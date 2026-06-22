import React, { useState, useRef, useMemo } from 'react';
import { TrendingUp, TrendingDown, Clock, Activity } from 'lucide-react';
import { Asset } from '../types';

interface TrendChartProps {
  asset: Asset;
  lang?: 'en' | 'tr';
}

type Period = '1D' | '1W' | '1M' | '1Y';

export default function TrendChart({ asset, lang = 'en' }: TrendChartProps) {
  const [period, setPeriod] = useState<Period>('1D');
  const [activePoint, setActivePoint] = useState<{ index: number; value: number } | null>(null);
  const chartRef = useRef<SVGSVGElement | null>(null);

  // Currency helper!
  const getDisplayPrice = (val: number) => {
    if (lang === 'en') {
      if (asset.symbol === 'BIST100') {
        return `${val.toLocaleString(undefined, { maximumFractionDigits: 0 })} TL`;
      }
      return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const convVal = asset.symbol === 'BIST100' ? val : val * 34;
      return `₺${convVal.toLocaleString(undefined, {
        minimumFractionDigits: asset.symbol === 'BIST100' ? 0 : 2,
        maximumFractionDigits: asset.symbol === 'BIST100' ? 0 : 2
      })}`;
    }
  };

  const getDisplayPriceRaw = (val: number) => {
    if (lang === 'en') {
      if (asset.symbol === 'BIST100') {
        return `${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      }
      return `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const convVal = asset.symbol === 'BIST100' ? val : val * 34;
      return `${convVal.toLocaleString(undefined, {
        minimumFractionDigits: asset.symbol === 'BIST100' ? 0 : 2,
        maximumFractionDigits: asset.symbol === 'BIST100' ? 0 : 2
      })}`;
    }
  };

  // Generate varied trend data depending on timeframe select
  const dataPoints = useMemo(() => {
    const base = asset.history;
    // Generate simulated histories depending on selected period
    if (period === '1D') {
      return [...base];
    } else if (period === '1W') {
      // 7 points
      return base.slice(-7);
    } else if (period === '1M') {
      // expand into 20 points
      const expanded: number[] = [];
      let current = base[0] * 0.96;
      for (let i = 0; i < 20; i++) {
        const factor = (asset.change24h > 0 ? 1.004 : 0.999) + (Math.sin(i / 1.5) * 0.012);
        current = current * factor;
        expanded.push(current);
      }
      expanded.push(asset.price);
      return expanded;
    } else {
      // 1Y - expand into 30 points
      const expanded: number[] = [];
      let current = asset.price * (asset.change24h > 0 ? 0.72 : 1.15);
      for (let i = 0; i < 30; i++) {
        const factor = 1.006 + (Math.cos(i / 2) * 0.02) + (Math.sin(i / 4) * 0.005);
        current = current * factor;
        expanded.push(current);
      }
      expanded.push(asset.price);
      return expanded;
    }
  }, [asset.history, asset.price, asset.change24h, period]);

  const maxVal = Math.max(...dataPoints) * 1.01;
  const minVal = Math.min(...dataPoints) * 0.99;
  const range = maxVal - minVal;

  const width = 340;
  const height = 150;

  // Map coordinates to SVG pixels
  const svgPoints = useMemo(() => {
    return dataPoints.map((val, idx) => {
      const x = (idx / (dataPoints.length - 1)) * (width - 24) + 12;
      const y = height - ((val - minVal) / (range || 1)) * (height - 24) - 12;
      return { x, y, val };
    });
  }, [dataPoints, minVal, range]);

  // Construct SVG Polyline and Area path
  const linePath = useMemo(() => {
    if (svgPoints.length === 0) return '';
    return svgPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [svgPoints]);

  const areaPath = useMemo(() => {
    if (svgPoints.length === 0) return '';
    const pointsStr = svgPoints.map(p => `L ${p.x} ${p.y}`).join(' ');
    const firstP = svgPoints[0];
    const lastP = svgPoints[svgPoints.length - 1];
    return `M ${firstP.x} ${height} L ${firstP.x} ${firstP.y} ${pointsStr} L ${lastP.x} ${height} Z`;
  }, [svgPoints]);

  // Handle Hover interaction to display cursor coordinates
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const ratioX = clientX / rect.width;
    
    // Find closest index
    const closestIndex = Math.min(
      Math.max(Math.round(ratioX * (dataPoints.length - 1)), 0),
      dataPoints.length - 1
    );

    setActivePoint({
      index: closestIndex,
      value: dataPoints[closestIndex]
    });
  };

  const handleMouseLeave = () => {
    setActivePoint(null);
  };

  const isUp = asset.change24h >= 0;
  const strokeColor = isUp ? '#10b981' : '#ef4444'; // emerald vs red
  const fillColorId = `grad_${asset.symbol}_${period}`;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4.5" id={`chart-container-${asset.symbol}`}>
      {/* Chart Period Selector and Info */}
      <div className="flex items-center justify-between mb-4" id={`chart-header-${asset.symbol}`}>
        <div id="chart-price-display">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/40 font-mono flex items-center gap-1.5" id="chart-lbl">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            {lang === 'tr' ? 'CANLI PİYASA AKIŞI' : 'LIVE MARKET CONDUIT'} ({period})
          </p>
          <p className="text-2xl font-light font-serif tracking-tight text-white mt-1" id="chart-main-price">
            {activePoint ? (
              <span className="text-[#F0F0F0]">
                {getDisplayPrice(activePoint.value)}
              </span>
            ) : (
              <span>
                {getDisplayPrice(asset.price)}
              </span>
            )}
          </p>
        </div>

        {/* Period Pills */}
        <div className="flex bg-black/40 rounded-lg p-1 border border-white/10" id="chart-period-tabs">
          {(['1D', '1W', '1M', '1Y'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[9px] font-bold font-mono tracking-widest px-2.5 py-1 rounded transition-all duration-200 uppercase ${
                period === p
                  ? 'bg-white text-black font-extrabold'
                  : 'text-white/40 hover:text-[#F0F0F0]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative h-[150px] mb-2 cursor-crosshair overflow-hidden" id="chart-svg-wrapper">
        <svg
          ref={chartRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="overflow-visible"
          id={`chart-svg-${asset.symbol}`}
        >
          <defs>
            <linearGradient id={fillColorId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.20" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.00" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* SVG horizontal background lines */}
          <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="0" y1={height * 0.50} x2={width} y2={height * 0.50} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="0.5" strokeDasharray="3 3" />

          {/* Render Area Gradient */}
          <path d={areaPath} fill={`url(#${fillColorId})`} />

          {/* Render Line Stroke */}
          <path
            d={linePath}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
          />

          {/* Active Hover Coordinate indicator crosshairs */}
          {activePoint && svgPoints[activePoint.index] && (
            <>
              {/* Vertical dotted crosshair */}
              <line
                x1={svgPoints[activePoint.index].x}
                y1={0}
                x2={svgPoints[activePoint.index].x}
                y2={height}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              {/* Pulsing focal node point */}
              <circle
                cx={svgPoints[activePoint.index].x}
                cy={svgPoints[activePoint.index].y}
                r="5"
                fill={strokeColor}
                stroke="#0A0A0A"
                strokeWidth="2.5"
              />
            </>
          )}
        </svg>

        {/* Dynamic Price floating badge at cursor index */}
        {activePoint && svgPoints[activePoint.index] && (
          <div
            className="absolute bg-[#0D0D0D] border border-white/10 px-2 py-0.5 rounded text-[9px] font-bold font-mono text-[#F0F0F0] select-none shadow-lg tracking-wider z-30 pointer-events-none"
            style={{
              left: `${Math.min(
                Math.max(svgPoints[activePoint.index].x - 45, 4),
                width - 94
              )}px`,
              top: `${Math.min(Math.max(svgPoints[activePoint.index].y - 28, 4), height - 24)}px`
            }}
            id="focal-price-tool-tag"
          >
            {getDisplayPriceRaw(activePoint.value)}
          </div>
        )}
      </div>

      {/* Mini Trend Statistics */}
      <div className="flex items-center justify-between text-[10px] font-mono text-white/40 border-t border-white/5 pt-3" id="chart-metrics-row">
        <div className="flex items-center gap-1.5" id="metric-high">
          <span className="text-[9px] bg-white/5 text-white/60 px-1 py-0.5 rounded border border-white/5 font-bold">
            {lang === 'tr' ? 'EN YÜKSEK' : 'HIGH'}
          </span>
          <span className="text-white font-semibold">
            {getDisplayPrice(dataPoints.length > 0 ? Math.max(...dataPoints) : asset.price)}
          </span>
        </div>
        <div className="flex items-center gap-1.5" id="metric-low">
          <span className="text-[9px] bg-white/5 text-white/60 px-1 py-0.5 rounded border border-white/5 font-bold">
            {lang === 'tr' ? 'EN DÜŞÜK' : 'LOW'}
          </span>
          <span className="text-white font-semibold">
            {getDisplayPrice(dataPoints.length > 0 ? Math.min(...dataPoints) : asset.price)}
          </span>
        </div>
        <div className={`flex items-center gap-1 font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`} id="metric-trend-percentage font-medium">
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isUp ? '+' : ''}{asset.change24h}%
        </div>
      </div>
    </div>
  );
}
