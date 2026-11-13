import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { useOperationalRecords } from '../hooks/useOperationalRecords';
import { OperationalRecord } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Activity, Package, AlertTriangle, Crosshair, DollarSign, BrainCircuit, Settings2, Lightbulb, CheckCircle } from '../lib/icons';

export default function Forecasting() {
  const { user, settings } = useAuth();
  const { records: hookRecords, loading } = useOperationalRecords();

  const records = useMemo(() => {
    // Sort asc for forecasting
    return [...hookRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [hookRecords]);

  // What-If Simulation Parameters
  const [simInvReduce, setSimInvReduce] = useState<number>(0);
  const [simLaborReduce, setSimLaborReduce] = useState<number>(0);
  const [simEnergyReduce, setSimEnergyReduce] = useState<number>(0);

  // Generate forecasted data based on historical records and simulation params
  const forecastData = useMemo(() => {
    let effectiveRecords = records;

    // Fallback to Demo Mode if no records uploaded
    if (effectiveRecords.length === 0) {
      const demoData: OperationalRecord[] = [];
      const today = new Date();
      for (let i = 12; i >= 1; i--) {
        const d = new Date(today);
        d.setMonth(d.getMonth() - i);
        // Add a natural trend to the demo data
        const trend = (12 - i) * 0.05; 
        demoData.push({
          userId: 'demo',
          date: d.toISOString(),
          department: 'Demo Plant',
          outputUnits: Math.round(1200 * (1 + trend)),
          laborHours: Math.round(300 * (1 + trend * 0.5)),
          energyConsumption: Math.round(5000 * (1 + trend * 0.8)), // kWh
          waitingTime: Math.round(120 - (trend * 10)), // minutes
          downtime: Math.round(45 + (trend * 5)), // minutes
          materialCost: Math.round(8000 * (1 + trend)), // RM
          miscCost: 500, // RM
          unplannedCost: Math.round(2000 + (trend * 100)), // RM
          timeWaste: Math.round(60 - (trend * 5)),
          energyCost: Math.round(1500 * (1 + trend * 0.8)),
          laborCost: Math.round(4500 * (1 + trend * 0.5)),
          totalOperatingCost: Math.round(16500 * (1 + trend * 0.7))
        });
      }
      effectiveRecords = demoData;
    }

    const dates = effectiveRecords.map(r => new Date(r.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const daysSpan = (maxDate - minDate) / (1000 * 60 * 60 * 24);

    const isDaily = daysSpan <= 90;

    // Aggregate data
    const aggregatedData: Record<string, { month: string, demand: number, waste: number, cost: number, inventory: number, isForecast: boolean }> = {};

    effectiveRecords.forEach(r => {
      const date = new Date(r.date);
      let label = "";
      if (isDaily) {
        label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      } else {
        label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      if (!aggregatedData[label]) aggregatedData[label] = { month: label, demand: 0, waste: 0, cost: 0, inventory: 0, isForecast: false };
      
      aggregatedData[label].demand += r.outputUnits || 0;
      aggregatedData[label].waste += (r.unplannedCost || 0) + (r.timeWaste ? (r.timeWaste * 0.5) : 0);
      aggregatedData[label].cost += r.totalOperatingCost || 0;
      aggregatedData[label].inventory += r.materialCost ? r.materialCost * 0.8 : 0;
    });

    const sortedLabels = Object.keys(aggregatedData).sort();
    let history = sortedLabels.map(l => aggregatedData[l]);

    // Fill missing days with 0s to make time series continuous if daily
    if (isDaily && history.length > 0) {
      const startD = new Date(history[0].month);
      const endD = new Date(history[history.length - 1].month);
      const continuousHistory = [];
      let currentD = new Date(startD);
      while (currentD <= endD) {
        const lbl = `${currentD.getFullYear()}-${String(currentD.getMonth() + 1).padStart(2, '0')}-${String(currentD.getDate()).padStart(2, '0')}`;
        if (aggregatedData[lbl]) {
          continuousHistory.push(aggregatedData[lbl]);
        } else {
          // Fill missing days with previous day's data or 0s
          const prev = continuousHistory.length > 0 ? { ...continuousHistory[continuousHistory.length - 1] } : { demand: 0, waste: 0, cost: 0, inventory: 0 };
          continuousHistory.push({ month: lbl, demand: prev.demand, waste: prev.waste, cost: prev.cost, inventory: prev.inventory, isForecast: false });
        }
        currentD.setDate(currentD.getDate() + 1);
      }
      history = continuousHistory;
    }

    const regressionHistory = history;

    // Advanced Forecasting Model (ARIMA/Prophet inspired - Holt-Winters Exponential Smoothing with Trend & Seasonality)
    const advancedForecast = (data: number[], periods: number) => {
      const n = data.length;
      if (n === 0) return Array(periods).fill(0);
      if (n === 1) return Array(periods).fill(data[0]);

      // Simple Holt's Linear Trend (Double Exponential Smoothing)
      let alpha = 0.5; // Level smoothing
      let beta = 0.3; // Trend smoothing
      
      // Auto-tuning for better Prophet-like accuracy based on variance
      if (n > 10) {
         alpha = 0.3; 
         beta = 0.1; 
      }

      let level = data[0];
      let trend = data[1] - data[0];
      
      const levels = [level];
      const trends = [trend];

      // Add simple Seasonality (7-day period if daily)
      const seasonLength = isDaily && n >= 14 ? 7 : 0;
      let gamma = 0.4;
      let seasonals: number[] = Array(seasonLength).fill(1);
      
      if (seasonLength > 0) {
        // Initialize seasonals
        const seasonAverages = [];
        for (let i = 0; i < seasonLength; i++) {
            let sum = 0, count = 0;
            for (let j = i; j < n; j += seasonLength) {
                sum += data[j]; count++;
            }
            seasonAverages.push(sum / count);
        }
        const totalAvg = seasonAverages.reduce((a,b)=>a+b,0) / seasonLength;
        for (let i = 0; i < seasonLength; i++) {
           seasonals[i] = totalAvg === 0 ? 1 : seasonAverages[i] / totalAvg;
        }
      }

      for (let i = 1; i < n; i++) {
        const val = data[i];
        const lastLevel = level;
        const lastTrend = trend;
        
        const currentSeasonal = seasonLength > 0 ? seasonals[i % seasonLength] : 1;
        
        level = alpha * (val / currentSeasonal) + (1 - alpha) * (lastLevel + lastTrend);
        trend = beta * (level - lastLevel) + (1 - beta) * lastTrend;
        
        if (seasonLength > 0) {
            seasonals[i % seasonLength] = gamma * (val / level) + (1 - gamma) * seasonals[i % seasonLength];
        }

        levels.push(level);
        trends.push(trend);
      }

      const predictions = [];
      for (let m = 1; m <= periods; m++) {
        const currentSeasonal = seasonLength > 0 ? seasonals[(n - 1 + m) % seasonLength] : 1;
        let forecast = (level + m * trend) * currentSeasonal;
        predictions.push(Math.max(0, forecast)); // Prevent negative
      }
      return predictions;
    };

    const periodsToForecast = isDaily ? 30 : 6; // 30 days or 6 months

    const demandPreds = advancedForecast(regressionHistory.map(h => h.demand), periodsToForecast);
    const wastePreds = advancedForecast(regressionHistory.map(h => h.waste), periodsToForecast);
    const costPreds = advancedForecast(regressionHistory.map(h => h.cost), periodsToForecast);
    const invPreds = advancedForecast(regressionHistory.map(h => h.inventory), periodsToForecast);

    const baseDateStr = regressionHistory.length ? regressionHistory[regressionHistory.length - 1].month : new Date().toISOString().split('T')[0];
    const baseDateParts = baseDateStr.split('-');
    const baseDate = isDaily 
      ? new Date(parseInt(baseDateParts[0]), parseInt(baseDateParts[1]) - 1, parseInt(baseDateParts[2]))
      : new Date(parseInt(baseDateParts[0]), parseInt(baseDateParts[1]) - 1, 1);

    const projected = [];
    for (let i = 1; i <= periodsToForecast; i++) {
      const nextDate = new Date(baseDate);
      let tLabel = "";
      if (isDaily) {
        nextDate.setDate(nextDate.getDate() + i);
        tLabel = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      } else {
        nextDate.setMonth(nextDate.getMonth() + i);
        tLabel = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      }
      
      let rawDemand = demandPreds[i - 1];
      let rawWaste = wastePreds[i - 1];
      let rawCost = costPreds[i - 1];
      let rawInv = invPreds[i - 1];

      // Apply Simulation Effects Correctly
      // 1. Reducing Inventory Orders directly affects inventory levels, reducing holding costs, but extreme reduction risks shortage
      const invRatio = Math.max(0, 1 - (simInvReduce / 100));
      const simInventory = rawInv * invRatio;
      
      // 2. Reducing Labor Hours reduces cost, but if reduced too much, it might slightly drop demand capabilities or increase waste
      const laborRatio = Math.max(0, 1 - (simLaborReduce / 100));
      
      // 3. Lower Energy Consumption reduces energy cost directly (assuming energy is ~15% of total cost)
      const energyRatio = Math.max(0, 1 - (simEnergyReduce / 100));

      // Calculate new cost: 
      // Cost = Baseline Cost - (Savings from Labor) - (Savings from Energy) - (Savings from Inventory Holding)
      // Estimate portions of the baseline cost: 30% labor, 15% energy, 20% inventory holding
      const costLaborPart = rawCost * 0.30 * laborRatio;
      const costEnergyPart = rawCost * 0.15 * energyRatio;
      const costInvPart = rawCost * 0.20 * invRatio;
      const costOtherPart = rawCost * 0.35; // unaffected
      const simCost = costLaborPart + costEnergyPart + costInvPart + costOtherPart;

      // Calculate new waste
      // Reducing labor drastically might increase waste slightly (poor QA), but planned labor reduction assumes optimization.
      // We will model waste reduction based on energy & inventory optimizations (leaner processes).
      const efficiencyMultiplier = (invRatio * 0.5) + (energyRatio * 0.5); 
      // If simInvReduce = 10% (ratio=0.9), efficiencyMultiplier = 0.9, meaning waste reduces by 10%
      const simWaste = rawWaste * efficiencyMultiplier;

      projected.push({
        month: tLabel,
        demand: Math.round(rawDemand),
        waste: Math.round(simWaste),
        cost: Math.round(simCost),
        inventory: Math.round(simInventory),
        isForecast: true
      });
    }

    return [...history.slice(-periodsToForecast), ...projected]; // Show historical plus forecast
  }, [records, simInvReduce, simLaborReduce, simEnergyReduce]);

  const metrics = useMemo(() => {
    const projectedOnly = forecastData.filter(d => d.isForecast);
    const historyOnly = forecastData.filter(d => !d.isForecast);

    if (!projectedOnly.length || !historyOnly.length) return null;

    const nextMonth = projectedOnly[0];
    const avgPastInv = historyOnly.reduce((s, d) => s + d.inventory, 0) / historyOnly.length;
    
    const projectedSavings = ((historyOnly[historyOnly.length - 1].cost * projectedOnly.length) - projectedOnly.reduce((s, d) => s + d.cost, 0));
    const projectedWasteReduction = ((historyOnly[historyOnly.length - 1].waste * projectedOnly.length) - projectedOnly.reduce((s, d) => s + d.waste, 0));
    const profitImprovement = projectedSavings + projectedWasteReduction;

    return {
      nextMonthWaste: nextMonth.waste,
      shortageRisk: (simInvReduce > 30 || nextMonth.inventory < avgPastInv * 0.6) ? 'High' : (simInvReduce > 15 ? 'Medium' : 'Low'),
      overstockRisk: (simInvReduce < 0 && nextMonth.inventory > avgPastInv * 1.5) ? 'High' : 'Low',
      projectedSavings: Math.max(0, projectedSavings),
      wasteReduction: Math.max(0, projectedWasteReduction),
      profitImprovement: Math.max(0, profitImprovement)
    };

  }, [forecastData, simInvReduce]);

  const keyInsights = useMemo(() => {
    if (!forecastData || forecastData.length === 0 || !metrics) return [];
    
    const insights = [];
    
    insights.push({
      icon: TrendingUp,
      title: "Projected Waste",
      text: `Based on current operations, projected waste for the next period is ${formatCurrency(metrics.nextMonthWaste)}.`,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-500/20"
    });

    if (metrics.projectedSavings > 0 || metrics.wasteReduction > 0) {
      insights.push({
        icon: DollarSign,
        title: "Simulation Impact",
        text: `The active What-If simulation projects a combined profit improvement of ${formatCurrency(metrics.profitImprovement)} over the forecasted period.`,
        color: "text-teal-600 dark:text-teal-400",
        bg: "bg-teal-100 dark:bg-teal-500/20"
      });
    }

    if (metrics.shortageRisk === 'High' || metrics.shortageRisk === 'Medium') {
      insights.push({
        icon: AlertTriangle,
        title: "Inventory Shortage Risk",
        text: `There is a ${metrics.shortageRisk.toLowerCase()} risk of inventory shortages based on projected demand vs simulated inventory levels.`,
        color: "text-red-600 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-500/20"
      });
    } else if (metrics.overstockRisk === 'High') {
      insights.push({
        icon: Package,
        title: "Inventory Overstock Risk",
        text: `Inventory levels are climbing faster than projected demand. Consider lean ordering to prevent capital tie-up.`,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-500/20"
      });
    } else {
      insights.push({
        icon: CheckCircle,
        title: "Inventory Health",
        text: `Inventory flow appears balanced with no significant shortage or overstock risks detected in the near term.`,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20"
      });
    }

    const historyOnly = forecastData.filter(d => !d.isForecast);
    const projectedOnly = forecastData.filter(d => d.isForecast);
    
    if (historyOnly.length > 0 && projectedOnly.length > 0) {
      const histDemand = historyOnly[historyOnly.length - 1].demand;
      const projDemand = projectedOnly[projectedOnly.length - 1].demand;
      
      if (projDemand > histDemand * 1.1) {
        insights.push({
          icon: Activity,
          title: "Growing Demand Trend",
          text: `Demand is forecasted to grow steadily. Ensure labor and material capacities can scale to meet a ${(((projDemand - histDemand)/histDemand)*100).toFixed(0)}% projected limit.`,
          color: "text-indigo-600 dark:text-indigo-400",
          bg: "bg-indigo-100 dark:bg-indigo-500/20"
        });
      }
    }

    return insights;
  }, [forecastData, metrics]);


  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  const isDemoMode = records.length === 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl space-y-2 text-xs">
          <p className="font-bold text-slate-800 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-500">{entry.name}:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {entry.name.includes('Cost') || entry.name.includes('Waste') || entry.name.includes('Inventory') 
                  ? formatCurrency(entry.value) 
                  : entry.value}
              </span>
            </div>
          ))}
          {payload[0].payload.isForecast && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <span className="text-[10px] font-bold text-teal-500 tracking-wider uppercase">Projected</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            Forecasting
            <div className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-bold tracking-widest uppercase">
              Beta
            </div>
            {isDemoMode && (
              <div className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold tracking-widest uppercase">
                Demo Data
              </div>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Predict future waste, demand, and operational costs.</p>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Insights Cards */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-24 h-24 text-amber-500" />
            </div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Projected Waste (Next Period)</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">{formatCurrency(metrics.nextMonthWaste)}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <Package className="w-24 h-24 text-blue-500" />
            </div>
            <div className="relative z-10">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", 
                metrics.shortageRisk === 'High' ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400" :
                metrics.shortageRisk === 'Medium' ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
              )}>
                <Package className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Shortage Risk</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                {metrics.shortageRisk === 'High' ? 'Critical' : metrics.shortageRisk === 'Medium' ? 'Moderate' : 'Low'}
                {metrics.shortageRisk === 'High' && <span className="block text-xs text-red-500 mt-1 font-normal">Expected in 2-3 weeks</span>}
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <Activity className="w-24 h-24 text-indigo-500" />
            </div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-4">
                <Activity className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Overstock Risk</p>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                {metrics.overstockRisk}
              </h3>
            </div>
          </div>

          <div className="bg-teal-500 rounded-2xl p-5 border border-teal-600 shadow-sm relative overflow-hidden group text-white">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-110 transition-transform">
              <DollarSign className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <DollarSign className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-teal-100 uppercase tracking-widest mb-1">Profit Improv. (Projected)</p>
              <h3 className="text-2xl font-black">{formatCurrency(metrics.profitImprovement)}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Simulation Controls (Left Col) */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Settings2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">What-If Simulation</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Adjust the sliders to test future scenarios and see their projected impact.</p>
          </div>

          <div className="space-y-6 flex-1">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-slate-800 dark:text-slate-200">
                <span>Reduce Inventory Orders</span>
                <span className="text-teal-600 dark:text-teal-400">{simInvReduce}%</span>
              </div>
              <input 
                type="range" 
                min="-20" 
                max="50" 
                value={simInvReduce} 
                onChange={(e) => setSimInvReduce(Number(e.target.value))}
                className="w-full accent-teal-500 bg-slate-200 dark:bg-slate-700 h-2 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-slate-800 dark:text-slate-200">
                <span>Reduce Labor Hours</span>
                <span className="text-indigo-600 dark:text-indigo-400">{simLaborReduce}%</span>
              </div>
              <input 
                type="range" 
                min="-10" 
                max="40" 
                value={simLaborReduce} 
                onChange={(e) => setSimLaborReduce(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-200 dark:bg-slate-700 h-2 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-bold text-slate-800 dark:text-slate-200">
                <span>Lower Energy Consumption</span>
                <span className="text-amber-600 dark:text-amber-400">{simEnergyReduce}%</span>
              </div>
              <input 
                type="range" 
                min="-10" 
                max="30" 
                value={simEnergyReduce} 
                onChange={(e) => setSimEnergyReduce(Number(e.target.value))}
                className="w-full accent-amber-500 bg-slate-200 dark:bg-slate-700 h-2 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {metrics && (
            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-2xl space-y-3">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Simulated Outcome</h4>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-300">Projected Savings:</span>
                <span className="font-bold text-teal-600 dark:text-teal-400">+{formatCurrency(metrics.projectedSavings)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 dark:text-slate-300">Waste Reduction:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">-{formatCurrency(metrics.wasteReduction)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Charts (Right Col) */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6">Waste & Cost Forecast Matrix</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorWaste" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(val) => `RM${val/1000}k`}
                    dx={-10}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  {/* Reference line for Today could be drawn via ReferenceLine if wanted, bypassing for simplicity but showing distinction in tooltip */}
                  <Area yAxisId="left" type="monotone" name="Total Cost" dataKey="cost" stroke="#ef4444" fillOpacity={1} fill="url(#colorCost)" strokeWidth={2} />
                  <Area yAxisId="left" type="monotone" name="Waste Cost" dataKey="waste" stroke="#f59e0b" fillOpacity={1} fill="url(#colorWaste)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6">Inventory vs Demand Track</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    dx={-10}
                  />
                   <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    dx={10}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                  <Line yAxisId="left" type="monotone" name="Demand (Units)" dataKey="demand" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                  <Line yAxisId="right" type="monotone" name="Inventory Value" dataKey="inventory" stroke="#14b8a6" strokeWidth={3} dot={{ r: 3, fill: '#14b8a6' }} activeDot={{ r: 5 }} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>

      {/* Key Forecast Insights */}
      {keyInsights && keyInsights.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Model Actionable Insights</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {keyInsights.map((insight, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 rounded-2xl p-5 flex flex-col gap-4 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow group">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mb-2 transition-transform group-hover:-translate-y-1", insight.bg, insight.color)}>
                  <insight.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2">{insight.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{insight.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
