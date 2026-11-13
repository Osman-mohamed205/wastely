import React, { useState } from 'react';
import { WastelyIcon, ArrowUpRight, ArrowDownRight, Info, HelpCircle } from '../lib/icons';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { AnimatedCounter } from './AnimatedCounter';
import { Sparkline } from './Sparkline';
import { cn } from '../lib/utils';

export type KPIAccentColor = 'teal' | 'rose' | 'amber' | 'blue' | 'indigo' | 'emerald';

export interface KPICardProps {
  title: string;
  value: number;
  formatType?: 'currency' | 'number' | 'percent' | 'time';
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon: WastelyIcon;
  accentColor?: KPIAccentColor;
  trendChange?: number; // e.g. -5.2 means dropped 5.2%
  trendFavorableDirection?: 'down' | 'up'; // for waste/cost, down is favorable (green); for output, up is favorable
  periodLabel?: string;
  subMetrics?: { label: string; value: string }[];
  tooltipText?: string;
  sparklineData?: number[];
  targetIndicator?: {
    label: string;
    targetVal: number;
    currentVal: number;
    unit: string;
    isHealthy: boolean;
  };
}

const colorMap: Record<KPIAccentColor, {
  bg: string;
  text: string;
  hoverBorder: string;
  hex: string;
  badge: string;
  ring: string;
}> = {
  teal: {
    bg: 'bg-teal-50 dark:bg-teal-900/30',
    text: 'text-teal-600 dark:text-teal-400',
    hoverBorder: 'hover:border-teal-200 dark:hover:border-teal-700/60',
    hex: '#0d9488',
    badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    ring: 'focus-within:ring-teal-500/20',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-900/30',
    text: 'text-rose-600 dark:text-rose-400',
    hoverBorder: 'hover:border-rose-200 dark:hover:border-rose-700/60',
    hex: '#f43f5e',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
    ring: 'focus-within:ring-rose-500/20',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    hoverBorder: 'hover:border-amber-200 dark:hover:border-amber-700/60',
    hex: '#f59e0b',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    ring: 'focus-within:ring-amber-500/20',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    hoverBorder: 'hover:border-blue-200 dark:hover:border-blue-700/60',
    hex: '#3b82f6',
    badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    ring: 'focus-within:ring-blue-500/20',
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    hoverBorder: 'hover:border-indigo-200 dark:hover:border-indigo-700/60',
    hex: '#6366f1',
    badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    ring: 'focus-within:ring-indigo-500/20',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    hoverBorder: 'hover:border-emerald-200 dark:hover:border-emerald-700/60',
    hex: '#10b981',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    ring: 'focus-within:ring-emerald-500/20',
  },
};

export function KPICard({
  title,
  value,
  formatType = 'number',
  prefix,
  suffix,
  decimals,
  icon: Icon,
  accentColor = 'teal',
  trendChange,
  trendFavorableDirection = 'down',
  periodLabel = 'vs prev period',
  subMetrics,
  tooltipText,
  sparklineData = [],
  targetIndicator,
}: KPICardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const color = colorMap[accentColor] || colorMap.teal;

  // Determine prefix, suffix, decimals by formatType if not passed
  let finalPrefix = prefix ?? '';
  let finalSuffix = suffix ?? '';
  let finalDecimals = decimals ?? 0;

  if (formatType === 'currency') {
    finalPrefix = prefix ?? 'RM ';
    finalDecimals = decimals ?? 2;
  } else if (formatType === 'percent') {
    finalSuffix = suffix ?? '%';
    finalDecimals = decimals ?? 1;
  } else if (formatType === 'time') {
    finalSuffix = suffix ?? ' min';
    finalDecimals = decimals ?? 0;
  }

  // Trend color calculations
  const hasTrend = typeof trendChange === 'number' && !isNaN(trendChange);
  const isNeutral = !hasTrend || Math.abs(trendChange!) < 0.05;
  const isUp = hasTrend && trendChange! > 0;
  
  // If favorable direction is "down" (cost/waste), down is green/good, up is red/bad
  const isFavorable = trendFavorableDirection === 'down' ? !isUp : isUp;

  const trendBg = isNeutral 
    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' 
    : isFavorable
      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40'
      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40';

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0.2 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={prefersReducedMotion ? undefined : { y: -2, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
      className={cn(
        "relative group bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700",
        "flex flex-col justify-between transition-shadow hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/40",
        color.hoverBorder
      )}
    >
      {/* Top Header: Icon + Info Tooltip + Trend Badge */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <div className={cn("p-2.5 rounded-2xl transition-transform duration-300 group-hover:scale-105", color.bg, color.text)}>
              <Icon className="w-5 h-5" />
            </div>
            {tooltipText && (
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onFocus={() => setShowTooltip(true)}
                  onBlur={() => setShowTooltip(false)}
                  onClick={() => setShowTooltip(true)}
                  aria-label={`Details about ${title}`}
                  aria-expanded={showTooltip}
                  aria-describedby={showTooltip ? `kpi-tooltip-${title.replace(/\s+/g, '-').toLowerCase()}` : undefined}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
                <AnimatePresence>
                  {showTooltip && (
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: prefersReducedMotion ? 0.2 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                      id={`kpi-tooltip-${title.replace(/\s+/g, '-').toLowerCase()}`}
                      className="absolute left-0 bottom-full mb-2 z-30 w-56 p-2.5 bg-slate-900 text-white text-[11px] leading-snug rounded-xl shadow-xl pointer-events-none"
                    >
                      {tooltipText}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Trend indicator */}
          {hasTrend && (
            <div 
              title={`${trendChange > 0 ? '+' : ''}${trendChange.toFixed(1)}% ${periodLabel}`}
              className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight transition-colors", trendBg)}
            >
              {!isNeutral && (
                isUp ? <ArrowUpRight className="w-3 h-3 stroke-[2.5]" /> : <ArrowDownRight className="w-3 h-3 stroke-[2.5]" />
              )}
              <span>
                {isNeutral ? '0.0%' : `${isUp ? '+' : ''}${trendChange.toFixed(1)}%`}
              </span>
            </div>
          )}
        </div>

        {/* Title & Value */}
        <div className="space-y-1">
          <p className="caption-3 uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
              <AnimatedCounter
                value={value}
                prefix={finalPrefix}
                suffix={finalSuffix}
                decimals={finalDecimals}
                duration={750}
              />
            </h4>
          </div>
        </div>

        {/* Target Benchmark Progress Bar (if provided) */}
        {targetIndicator && (
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
              <span className="text-slate-400 uppercase tracking-widest">{targetIndicator.label}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-md",
                targetIndicator.isHealthy 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
              )}>
                {targetIndicator.isHealthy ? 'Optimal' : 'Needs Action'}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  targetIndicator.isHealthy ? "bg-emerald-500" : "bg-rose-500"
                )}
                style={{ width: `${Math.min(Math.max((targetIndicator.currentVal / (targetIndicator.targetVal * 2)) * 100, 5), 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Sub-metrics breakdown chips */}
        {subMetrics && subMetrics.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
            {subMetrics.map((m, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium"
              >
                <span className="text-slate-400 dark:text-slate-400">{m.label}:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{m.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Smooth Sparkline Footer */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-4 pt-2 border-t border-slate-50 dark:border-slate-700/40">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium mb-1">
            <span>Trend</span>
            <span>{sparklineData.length} pts</span>
          </div>
          <Sparkline
            data={sparklineData}
            color={color.hex}
            height={36}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        </div>
      )}
    </motion.div>
  );
}

export default KPICard;
