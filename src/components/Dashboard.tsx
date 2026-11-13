import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { useOperationalRecords } from '../hooks/useOperationalRecords';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Department } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingDown, TrendingUp, Clock, Zap, DollarSign, Activity, 
  Filter, Calendar, ChevronDown, Lightbulb, AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText as FilePdf, Loader2,
  Info, ArrowUpRight, ArrowDownRight, MoreHorizontal, Eye, Upload, Trash2, FileInput, Building2, HelpCircle
} from '../lib/icons';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatNumber, cn } from '../lib/utils';
import { format, subDays, isWithinInterval, startOfDay, endOfDay, isValid, parseISO } from 'date-fns';
import Markdown from 'react-markdown';
import { calculateAdvancedAnalytics } from '../lib/analyticsEngine';
import { KPICard } from './KPICard';
import { AnimatedCounter } from './AnimatedCounter';

// Safe date formatter
const safeFormatDate = (dateStr: string, formatStr: string) => {
  if (!dateStr) return 'Invalid Date';
  const d = new Date(dateStr);
  if (isValid(d)) return format(d, formatStr);
  return dateStr; // Fallback to raw string if invalid
};

const navigateToInput = (inputMode: 'manual' | 'excel') => {
  window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'input', inputMode } }));
};

export default function Dashboard() {
  const { user, settings } = useAuth();
  const { records, loading } = useOperationalRecords();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterDept, setFilterDept] = useState<string>('All');
  const [dateRange, setDateRange] = useState<string>('all'); // days
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchDepts = async () => {
      try {
        const dq = query(collection(db, 'departments'), where('userId', '==', user.uid));
        const dSnapshot = await getDocs(dq);
        const dData = dSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
        setDepartments(dData);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };
    fetchDepts();
  }, [user]);

  const filteredRecords = useMemo(() => {
    let filtered = records;
    if (dateRange === 'custom') {
      if (customStartDate && customEndDate) {
        const start = startOfDay(new Date(customStartDate));
        const end = endOfDay(new Date(customEndDate));
        filtered = filtered.filter(r => {
          const d = new Date(r.date);
          if (!isValid(d)) return true;
          return d >= start && d <= end;
        });
      }
    } else if (dateRange !== 'all') {
      const days = parseInt(dateRange);
      const cutoff = subDays(new Date(), days);
      filtered = filtered.filter(r => {
        const d = new Date(r.date);
        if (!isValid(d)) return true; // Include records with invalid dates so they don't disappear
        return d >= cutoff;
      });
    }
    if (filterDept !== 'All') {
      filtered = filtered.filter(r => r.department === filterDept);
    }
    return filtered;
  }, [records, filterDept, dateRange, customStartDate, customEndDate]);

  const analytics = useMemo(() => {
    return calculateAdvancedAnalytics(filteredRecords, settings);
  }, [filteredRecords, settings]);
  const wasteTarget = settings?.targetWasteIndex ?? 5;
  const hasInvalidCustomRange = dateRange === 'custom' && Boolean(customStartDate && customEndDate && customStartDate > customEndDate);
  const hasActiveFilters = filterDept !== 'All' || dateRange !== 'all';

  // Compute clean, normalized daily sparkline arrays for each primary KPI
  const sparklineSeries = useMemo(() => {
    const sorted = [...filteredRecords].sort((a, b) => a.date.localeCompare(b.date));
    const dayMap: Record<string, { cost: number; wasteMins: number; energyCost: number; wasteIndex: number }> = {};
    
    sorted.forEach(r => {
      const d = r.date ? r.date.split('T')[0] : 'unknown';
      if (!dayMap[d]) {
        dayMap[d] = { cost: 0, wasteMins: 0, energyCost: 0, wasteIndex: 0 };
      }
      const timeWaste = (r.timeWaste || ((r.waitingTime || 0) + (r.downtime || 0)));
      const laborCost = (r.laborHours || 0) * (settings?.laborRate || 12);
      const energyCost = (r.energyCost ?? (r.energyConsumption || 0) * (settings?.energyTariff || 0.55));
      const totalCost = (r.totalOperatingCost ?? (energyCost + laborCost + (r.materialCost || 0) + (r.miscCost || 0) + (r.unplannedCost || 0)));
      const timeWasteCost = (timeWaste / 60) * (settings?.laborRate || 12);
      const totalWasteCost = timeWasteCost + (r.unplannedCost || 0) + (r.miscCost || 0);

      dayMap[d].cost += totalCost;
      dayMap[d].wasteMins += timeWaste;
      dayMap[d].energyCost += energyCost;
      dayMap[d].wasteIndex = totalCost > 0 ? (totalWasteCost / totalCost) * 100 : 0;
    });

    const dates = Object.keys(dayMap).sort();
    return {
      cost: dates.map(d => dayMap[d].cost),
      timeWaste: dates.map(d => dayMap[d].wasteMins),
      energy: dates.map(d => dayMap[d].energyCost),
      wasteIndex: dates.map(d => dayMap[d].wasteIndex),
    };
  }, [filteredRecords, settings]);

  const deptData = useMemo(() => {
    const recordDepts = Array.from(new Set(filteredRecords.map(r => r.department)));
    const allDepts = Array.from(new Set([...(departments.map(d => d.name)), ...recordDepts]));
    const deptNames = allDepts.length > 0 ? allDepts : ['Operations', 'Sales', 'Admin'];
    
    return deptNames.map(dept => {
      const deptRecords = filteredRecords.filter(r => r.department === dept);
      const waste = deptRecords.reduce((sum, r) => sum + (r.timeWaste || 0), 0);
      return { name: dept, waste };
    });
  }, [filteredRecords, departments]);

  const trendData = useMemo(() => {
    const sorted = [...filteredRecords].sort((a, b) => a.date.localeCompare(b.date));
    const groups: Record<string, { waste: number, laborMins: number, count: number }> = {};
    sorted.forEach(r => {
      if (!groups[r.date]) groups[r.date] = { waste: 0, laborMins: 0, count: 0 };
      const timeWaste = (r.timeWaste || ((r.waitingTime || 0) + (r.downtime || 0)));
      const laborMins = (r.laborHours || 0) * 60;
      groups[r.date].waste += timeWaste;
      groups[r.date].laborMins += laborMins;
      groups[r.date].count += 1;
    });
    return Object.entries(groups).map(([date, data]) => ({ 
      date, 
      waste: data.waste,
      wasteIndex: data.laborMins > 0 ? (data.waste / data.laborMins) * 100 : 0
    }));
  }, [filteredRecords]);

  // Get all unique departments for the filter dropdown
  const allUniqueDepartments = useMemo(() => {
    const recordDepts = Array.from(new Set(records.map(r => r.department)));
    const definedDepts = departments.map(d => d.name);
    return Array.from(new Set([...definedDepts, ...recordDepts])).filter(Boolean);
  }, [records, departments]);

  // Handle clearing all records with confirmation
  const handleClearAllRecords = async () => {
    if (!user) return;
    setIsClearing(true);
    try {
      const q = query(collection(db, 'records'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
      setShowClearConfirm(false);
      setActionSuccessMessage('Dashboard cleared.');
      setTimeout(() => setActionSuccessMessage(null), 3500);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'records');
    } finally {
      setIsClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12" role="status" aria-label="Loading dashboard">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
          <div className="h-72 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" ref={dashboardRef}>
      {/* Action Notification Toast */}
      <AnimatePresence>
        {actionSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & Action Toolbar */}
      {records.length > 0 && <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <Filter aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Filter dashboard</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Choose a department and reporting period</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          {/* Department Filter */}
          <select 
            aria-label="Filter by department"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 sm:flex-none"
          >
            <option value="All">All Departments</option>
            {allUniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <select 
              aria-label="Filter by date range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="min-h-11 min-w-0 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 sm:flex-none"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
            {dateRange === 'custom' && (
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate || undefined}
                  aria-label="Start date"
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 sm:flex-none"
                />
                <span className="text-xs font-medium text-slate-500">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  aria-label="End date"
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 sm:flex-none"
                />
              </div>
            )}
          </div>

          {/* Log Record Quick Navigation */}
          <button 
            type="button"
            onClick={() => navigateToInput('manual')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 active:scale-[0.98] dark:focus-visible:ring-offset-slate-800"
          >
            <FileInput aria-hidden="true" className="h-4 w-4" />
            <span>Add record</span>
          </button>

          {/* Import Data Navigation */}
          <button 
            type="button"
            onClick={() => navigateToInput('excel')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Upload aria-hidden="true" className="h-4 w-4" />
            <span>Import data</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setFilterDept('All');
                setDateRange('all');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Clear filters
            </button>
          )}

          {/* Clear Data / Reset Confirmation */}
          {records.length > 0 && (
            <div>
              {showClearConfirm ? (
                <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 p-1 rounded-xl">
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-300 px-1.5">Clear {records.length} records?</span>
                  <button
                    onClick={handleClearAllRecords}
                    disabled={isClearing}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                  >
                    {isClearing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Reset'}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 text-xs font-bold py-2.5 px-2.5 rounded-xl transition-colors"
                  title="Clear all workspace records"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>}

      {hasInvalidCustomRange && (
        <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">
          Choose an end date on or after the start date.
        </p>
      )}

      {analytics ? (
        <>
          {/* Real & Smooth Primary KPI Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard 
              title="Total Operational Cost" 
              value={analytics.currentMetrics.totalCost} 
              formatType="currency"
              icon={DollarSign}
              accentColor="teal"
              trendChange={analytics.changes.cost} 
              trendFavorableDirection="down"
              subMetrics={[
                { label: 'Energy', value: formatCurrency(analytics.currentMetrics.energyCost) },
                { label: 'Time Loss', value: formatCurrency(analytics.currentMetrics.timeWasteCost) },
                { label: 'Unplanned', value: formatCurrency(analytics.currentMetrics.unplannedCost) }
              ]}
              tooltipText={`Total expenditure encompassing labor wages (RM ${settings?.laborRate || 12}/h), energy tariffs (RM ${settings?.energyTariff || 0.55}/kWh), material inputs, and downtime loss.`}
              sparklineData={sparklineSeries.cost}
            />
            <KPICard 
              title="Time Waste" 
              value={analytics.currentMetrics.totalTimeWaste} 
              formatType="time"
              icon={Clock}
              accentColor="rose"
              trendChange={analytics.changes.timeWaste} 
              trendFavorableDirection="down"
              subMetrics={[
                { label: 'Equivalent', value: `${(analytics.currentMetrics.totalTimeWaste / 60).toFixed(1)} hrs` },
                { label: 'Labor Loss', value: formatCurrency(analytics.currentMetrics.timeWasteCost) }
              ]}
              tooltipText="Unproductive hours lost to equipment breakdowns, slow setups, and idle operator waiting time."
              sparklineData={sparklineSeries.timeWaste}
            />
            <KPICard 
              title="Energy Cost" 
              value={analytics.currentMetrics.energyCost} 
              formatType="currency"
              icon={Zap}
              accentColor="blue"
              trendChange={analytics.changes.energy} 
              trendFavorableDirection="down"
              subMetrics={[
                { label: 'Usage', value: `${formatNumber(analytics.currentMetrics.totalEnergy, 0)} kWh` },
                { label: 'Tariff', value: `RM ${settings?.energyTariff || 0.55}/kWh` }
              ]}
              tooltipText="Electricity charges derived from factory machinery, lighting, and HVAC kilowatt-hours multiplied by tariff rate."
              sparklineData={sparklineSeries.energy}
            />
            <KPICard 
              title="Operational Waste Index" 
              value={analytics.currentMetrics.totalWasteIndex * 100} 
              formatType="percent"
              decimals={1}
              icon={Activity}
              accentColor="amber"
              trendChange={analytics.changes.wasteIndex} 
              trendFavorableDirection="down"
              targetIndicator={{
                label: 'Benchmark Target',
                targetVal: wasteTarget,
                currentVal: analytics.currentMetrics.totalWasteIndex * 100,
                unit: '%',
                isHealthy: (analytics.currentMetrics.totalWasteIndex * 100) <= wasteTarget
              }}
              subMetrics={[
                { label: 'Status', value: (analytics.currentMetrics.totalWasteIndex * 100) <= wasteTarget ? 'On target' : (analytics.currentMetrics.totalWasteIndex * 100) <= wasteTarget * 2 ? 'Above target' : 'Needs attention' },
                { label: 'Lost Capital', value: formatCurrency(analytics.currentMetrics.timeWasteCost + analytics.currentMetrics.unplannedCost) }
              ]}
              tooltipText="Percentage of overall company budget consumed by avoidable operational friction (time waste + unplanned breakdowns)."
              sparklineData={sparklineSeries.wasteIndex}
            />
          </div>

          {/* Middle Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Info Card */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 relative overflow-hidden group">
              <div className="flex-1 flex flex-col justify-between z-10 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg">
                      <Activity className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Operational Health</p>
                  </div>
                  
                  <div className="flex items-end gap-3 mb-4">
                    <h3 className="text-6xl font-black text-slate-800 tracking-tighter">
                      <AnimatedCounter value={analytics.score} decimals={0} duration={800} />
                      <span className="text-2xl text-slate-300 font-bold">/100</span>
                    </h3>
                    <div className={cn("px-3 py-1 rounded-full text-[10px] font-bold mb-2 uppercase tracking-widest", 
                      analytics.score >= 80 ? "bg-emerald-100 text-emerald-700" : 
                      analytics.score >= 60 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {analytics.scoreCategory}
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
                    {analytics.topProblem !== 'No major issues detected' ? 
                      `Focus on reducing ${analytics.topProblem.toLowerCase()} to improve profitability and overall efficiency.` :
                      "Your operations are running smoothly with no major issues detected."
                    }
                  </p>
                </div>

                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'analytics' }))}
                  className="w-fit flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md shadow-slate-900/20"
                >
                  View Detailed Analytics <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="w-full md:w-[280px] bg-teal-700 rounded-2xl p-6 relative overflow-hidden text-white flex flex-col justify-between">
                <div className="relative z-10">
                  <p className="text-teal-100 text-xs font-semibold mb-1">Illustrative savings scenario</p>
                  <h4 className="text-3xl font-black">
                    <AnimatedCounter
                      value={(analytics.currentMetrics.unplannedCost + analytics.currentMetrics.timeWasteCost) * 0.15}
                      prefix="RM "
                      decimals={2}
                      duration={850}
                    />
                  </h4>
                </div>
                
                <div className="relative z-10 mt-8 space-y-4">
                   <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
                     <p className="text-[10px] text-teal-50 font-medium leading-relaxed">
                       Savings scenario based on a 15% reduction in avoidable time and unplanned costs.
                     </p>
                   </div>
                </div>
              </div>
            </div>

            {/* Right Info Card - Operational Insights */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col h-full min-h-[320px]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-amber-50 text-amber-500 rounded-lg">
                     <Lightbulb className="w-4 h-4" />
                   </div>
                   <h3 className="text-sm font-bold text-slate-800">Operational Insights</h3>
                </div>
              </div>
              <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {analytics.detailedInsights && analytics.detailedInsights.length > 0 ? (
                  <>
                    {analytics.detailedInsights.map((insight, i) => (
                      <div key={`insight-${i}`} className="flex gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className={cn(
                          "p-2 rounded-xl h-fit shrink-0",
                          insight.category === 'Cost' ? "bg-red-100 text-red-600" : 
                          insight.category === 'Time' ? "bg-amber-100 text-amber-600" : 
                          insight.category === 'Energy' ? "bg-blue-100 text-blue-600" :
                          "bg-green-100 text-green-600"
                        )}>
                          {insight.category === 'Cost' ? <DollarSign className="w-4 h-4" /> :
                           insight.category === 'Time' ? <Clock className="w-4 h-4" /> : 
                           insight.category === 'Energy' ? <Zap className="w-4 h-4" /> :
                           <Activity className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">{insight.title}</h4>
                          <p className="text-[10px] text-slate-500 leading-relaxed mt-1">{insight.description}</p>
                          {insight.impact && (
                            <p className="text-[10px] font-medium text-slate-400 mt-2 border-t border-slate-200 pt-2">
                              <span className="font-bold text-slate-600">Impact:</span> {insight.impact}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <Info className="w-8 h-8 text-slate-200 mb-2" />
                    <p className="text-xs text-slate-400">No detailed insights available yet. Add more data to generate analysis.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Chart Card - Waste by Department */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-bold text-slate-800">Waste by Department</h4>
                <BarChart3Icon className="w-4 h-4 text-slate-400" />
              </div>
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <BarChart data={deptData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="waste" fill="#2dd4bf" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <SmallStat icon={Activity} label="Records" value={records.length} color="bg-teal-400" progress={70} />
                <SmallStat icon={Zap} label="Avg Waste" value={`${formatNumber(analytics.currentMetrics.totalWasteIndex * 100, 0)}%`} color="bg-teal-400" progress={45} />
                <SmallStat icon={DollarSign} label="Total Cost" value={formatNumber(analytics.currentMetrics.totalCost / 1000, 1) + 'k'} color="bg-teal-400" progress={85} />
              </div>
            </div>

            {/* Right Chart Card - Waste Trend */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Waste Trend Over Time</h4>
                  <p className="text-[10px] text-slate-400">Tracking daily waste index performance</p>
                </div>
                <TrendingUp className="w-4 h-4 text-teal-500" />
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontSize: 10}} 
                      dy={10}
                      tickFormatter={(val) => safeFormatDate(val, 'MMM d')}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingBottom: '20px' }} />
                    <Line 
                      name="Waste Index (%)"
                      type="monotone" 
                      dataKey="wasteIndex" 
                      stroke="#2dd4bf" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#2dd4bf', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line 
                      name="Total Waste (min)"
                      type="monotone" 
                      dataKey="waste" 
                      stroke="#0f172a" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Data Table Card */}
            <div className="lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Operational Data Table</h4>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-500" />
                    <span className="font-bold text-teal-500">{records.length} records</span> in total
                  </p>
                </div>
                <button className="p-2 text-slate-300 hover:text-slate-500 transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labor Hours</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time Waste</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Energy</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(showAllRecords ? filteredRecords : filteredRecords.slice(0, 8)).map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">{safeFormatDate(record.date, 'MMM d, yyyy')}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">{record.department}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">{record.laborHours}h</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">{record.timeWaste}m</td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-medium">{record.energyConsumption} kWh</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-800">{formatCurrency(record.totalOperatingCost || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRecords.length > 8 && (
                <div className="p-4 border-t border-slate-50 text-center">
                  <button 
                    onClick={() => setShowAllRecords(!showAllRecords)}
                    className="text-xs font-bold text-teal-500 hover:text-teal-600 transition-colors"
                  >
                    {showAllRecords ? 'Show Less' : `View All ${filteredRecords.length} Records`}
                  </button>
                </div>
              )}
              {filteredRecords.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-sm text-slate-400">No data available for the selected period.</p>
                </div>
              )}
            </div>

            {/* Active Metrics & Cost Breakdown */}
            <div className="lg:col-span-4 space-y-6">
              {/* Cost Breakdown Donut Chart */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold text-slate-800">Cost Breakdown</h4>
                  <DollarSign className="w-4 h-4 text-teal-500" />
                </div>
                <div className="h-48 relative">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie
                        data={analytics.costBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {analytics.costBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                    <p className="text-sm font-black text-slate-800">{formatCurrency(analytics.currentMetrics.totalCost)}</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {analytics.costBreakdown.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] font-bold text-slate-600">{item.name}</span>
                      <span className="text-[10px] font-medium text-slate-400 ml-auto">
                        {formatNumber((item.value / analytics.currentMetrics.totalCost) * 100, 0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold text-slate-800">Active Metrics</h4>
                  <Activity className="w-4 h-4 text-teal-500" />
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Records</p>
                      <p className="text-lg font-bold text-slate-800">{records.length}</p>
                    </div>
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <FileSpreadsheet className="w-5 h-5 text-teal-500" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Avg Waste</p>
                      <p className="text-lg font-bold text-slate-800">{formatNumber(analytics.currentMetrics.totalWasteIndex * 100, 1)}%</p>
                    </div>
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : records.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:px-8" aria-live="polite">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            <Filter aria-hidden="true" className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">No records match these filters</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
            Try a different department or date range to see matching operational records.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterDept('All');
              setDateRange('all');
              setCustomStartDate('');
              setCustomEndDate('');
            }}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
          >
            Clear filters
          </button>
        </section>
      ) : (
        <div className="space-y-6 pb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">Your workspace is ready</p>
              <h1 className="heading-5 mt-1 text-slate-900 dark:text-white">Start with your first record</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Add a daily log or import an existing spreadsheet. Wastely will organize your costs, time loss, and energy use here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigateToInput('manual')}
                className="button-sm inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                <FileInput aria-hidden="true" className="h-4 w-4" /> Add first record
              </button>
              <button
                type="button"
                onClick={() => navigateToInput('excel')}
                className="button-sm inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Upload aria-hidden="true" className="h-4 w-4" /> Import data
              </button>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              type="button"
              onClick={() => navigateToInput('manual')}
              className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <FileInput aria-hidden="true" className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2 group-hover:text-teal-600 transition-colors">
                1. Manual Daily Entry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Quickly submit daily operational inputs including output units, labor hours, and stoppage minutes.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400">
                Open Form <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigateToInput('excel')}
              className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <FileSpreadsheet aria-hidden="true" className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                2. Excel & CSV Import
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Upload existing manufacturing logs or operational spreadsheets with auto column mapping and templates.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                Import Spreadsheet <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'departments' }))}
              className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Building2 aria-hidden="true" className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white mb-2 group-hover:text-indigo-600 transition-colors">
                3. Organize Departments
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Structure your company departments (Production, Assembly, Packaging, Logistics) for segmented tracking.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Manage Departments <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>

          {/* Workflow Explanation for SME */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-700/60">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6 uppercase tracking-wider">
              How to use Wastely
            </h3>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-xs">
                  <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-[11px]">1</span>
                  Cost & Waste Conversion
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Converts lost hours into exact Ringgit costs using your labor rate (RM {settings?.laborRate || 12}/h) and electricity tariff (RM {settings?.energyTariff || 0.55}/kWh).
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function SmallStat({ icon: Icon, label, value, color, progress }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-lg text-white", color)}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-[10px] font-bold text-slate-400">{label}</span>
      </div>
      <p className="text-xs font-bold text-slate-800">{value}</p>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function OverviewItem({ icon: Icon, title, value, time, color, isLast }: any) {
  return (
    <div className="flex items-start gap-4 pb-6 relative">
      {!isLast && (
        <div className="absolute top-10 left-4 w-px h-full bg-slate-100 -translate-x-1/2" />
      )}
      <div className="relative z-10">
        <div className={cn("p-2 rounded-xl bg-white shadow-sm border border-slate-50", color)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <h5 className="text-xs font-bold text-slate-800">{title}</h5>
        <p className="text-[10px] text-slate-400 mb-1">{time}</p>
        <p className="text-xs font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function BarChart3Icon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  )
}
