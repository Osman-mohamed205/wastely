import { OperationalRecord, UserSettings } from '../types';
import { differenceInDays, subDays, format, parseISO } from 'date-fns';

export interface DepartmentComparison {
  department: string;
  currentCost: number;
  prevCost: number;
  costChange: number;
  currentWaste: number;
  prevWaste: number;
  wasteChange: number;
}

export interface DetailedInsight {
  category: 'Cost' | 'Time' | 'Energy' | 'Efficiency' | 'Material';
  title: string;
  description: string;
  impact: string;
  actionable: boolean;
}

export interface AdvancedAnalytics {
  currentMetrics: {
    totalCost: number;
    totalWasteIndex: number;
    totalEnergy: number;
    totalTimeWaste: number;
    totalOutput: number;
    timeWasteCost: number;
    energyCost: number;
    materialCost: number;
    unplannedCost: number;
  };
  prevMetrics: {
    totalCost: number;
    totalWasteIndex: number;
    totalEnergy: number;
    totalTimeWaste: number;
  };
  changes: {
    cost: number;
    wasteIndex: number;
    energy: number;
    timeWaste: number;
  };
  score: number;
  scoreCategory: 'Excellent' | 'Good' | 'Needs Improvement';
  topProblem: string;
  rootCause: string;
  primaryCostDriver: string;
  alerts: { title: string; type: 'critical' | 'warning' | 'info'; message: string }[];
  detailedInsights: DetailedInsight[];
  trendMessage: string;
  costBreakdown: { name: string; value: number; color: string }[];
  trendData: { date: string; waste: number; cost: number; wasteIndex: number }[];
  departmentComparisons: DepartmentComparison[];
}

export function calculateAdvancedAnalytics(records: OperationalRecord[], settings: UserSettings | null): AdvancedAnalytics | null {
  if (!records.length || !settings) return null;

  // Sort records by date descending
  const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Find the latest date in the dataset to act as "today" for referencing
  const latestDate = new Date(sorted[0].date);
  
  // 1. Comparison Analysis (Last 30 days vs Previous 30 days from the latest record)
  const last30Days = sorted.filter(r => differenceInDays(latestDate, new Date(r.date)) <= 30);
  const prev30Days = sorted.filter(r => {
    const diff = differenceInDays(latestDate, new Date(r.date));
    return diff > 30 && diff <= 60;
  });

  // If we don't have enough data in the periods, split the available data in half
  let currentData = last30Days;
  let prevData = prev30Days;

  if (last30Days.length === 0 || prev30Days.length === 0) {
    if (sorted.length >= 2) {
      const half = Math.floor(sorted.length / 2);
      currentData = sorted.slice(0, half);
      prevData = sorted.slice(half, half * 2);
    } else {
      currentData = sorted;
      prevData = sorted;
    }
  }

  const calcMetrics = (data: OperationalRecord[]) => {
    const totalCost = data.reduce((sum, r) => sum + (r.totalOperatingCost || 0), 0);
    const totalEnergy = data.reduce((sum, r) => sum + (r.energyConsumption || 0), 0);
    const totalTimeWaste = data.reduce((sum, r) => sum + (r.timeWaste || ((r.waitingTime || 0) + (r.downtime || 0))), 0);
    const totalLaborMinutes = data.reduce((sum, r) => sum + (r.laborHours || 0) * 60, 0);
    const totalOutput = data.reduce((sum, r) => sum + (r.outputUnits || 0), 0);
    
    // Cost breakdown
    const timeWasteCost = data.reduce((sum, r) => sum + ((r.timeWaste || 0) / 60) * settings.laborRate, 0);
    const energyCost = data.reduce((sum, r) => sum + (r.energyConsumption || 0) * settings.energyTariff, 0);
    const materialCost = data.reduce((sum, r) => sum + (r.materialCost || 0), 0);
    const unplannedCost = data.reduce((sum, r) => sum + (r.unplannedCost || 0), 0);
    const miscCost = data.reduce((sum, r) => sum + (r.miscCost || 0), 0);

    const totalWasteCost = timeWasteCost + unplannedCost + miscCost;
    const totalWasteIndex = totalCost > 0 ? (totalWasteCost / totalCost) : 0;

    return { totalCost, totalWasteIndex, totalEnergy, totalTimeWaste, totalOutput, timeWasteCost, energyCost, materialCost, unplannedCost };
  };

  const currentMetrics = calcMetrics(currentData);
  const prevMetrics = calcMetrics(prevData);

  // Normalize by record count to prevent wildly inflated percentage changes if counts differ
  const getChange = (currentTotal: number, prevTotal: number, currentCount: number = 1, prevCount: number = 1) => {
    if (prevCount === 0 || prevTotal === 0) return 0;
    if (currentData === prevData) return 0; // Same data fallback means 0% change
    
    const currentAvg = currentTotal / (currentCount || 1);
    const prevAvg = prevTotal / (prevCount || 1);
    return ((currentAvg - prevAvg) / prevAvg) * 100;
  };

  const changes = {
    cost: getChange(currentMetrics.totalCost, prevMetrics.totalCost, currentData.length, prevData.length),
    wasteIndex: getChange(currentMetrics.totalWasteIndex, prevMetrics.totalWasteIndex, 1, 1), // It's already averaged
    energy: getChange(currentMetrics.totalEnergy, prevMetrics.totalEnergy, currentData.length, prevData.length),
    timeWaste: getChange(currentMetrics.totalTimeWaste, prevMetrics.totalTimeWaste, currentData.length, prevData.length),
  };

  // Department Comparison
  const deptMap: Record<string, { currentCost: number; prevCost: number; currentWaste: number; prevWaste: number }> = {};
  
  currentData.forEach(r => {
    if (!deptMap[r.department]) deptMap[r.department] = { currentCost: 0, prevCost: 0, currentWaste: 0, prevWaste: 0 };
    deptMap[r.department].currentCost += (r.totalOperatingCost || 0);
    deptMap[r.department].currentWaste += (r.timeWaste || 0);
  });
  
  prevData.forEach(r => {
    if (!deptMap[r.department]) deptMap[r.department] = { currentCost: 0, prevCost: 0, currentWaste: 0, prevWaste: 0 };
    deptMap[r.department].prevCost += (r.totalOperatingCost || 0);
    deptMap[r.department].prevWaste += (r.timeWaste || 0);
  });

  const departmentComparisons: DepartmentComparison[] = Object.entries(deptMap).map(([department, data]) => ({
    department,
    currentCost: data.currentCost,
    prevCost: data.prevCost,
    costChange: getChange(data.currentCost, data.prevCost),
    currentWaste: data.currentWaste,
    prevWaste: data.prevWaste,
    wasteChange: getChange(data.currentWaste, data.prevWaste),
  })).sort((a, b) => b.currentCost - a.currentCost);

  // 5. Efficiency Score (0-100)
  let score = 100;
  const avgWasteIndex = currentMetrics.totalWasteIndex;
  if (avgWasteIndex > 0.05) {
    score -= (avgWasteIndex - 0.05) * 100 * 2; // Deduct 2 points for every 1% over 5%
  }
  
  const unplannedRatio = currentMetrics.totalCost > 0 ? currentMetrics.unplannedCost / currentMetrics.totalCost : 0;
  if (unplannedRatio > 0.1) {
    score -= (unplannedRatio - 0.1) * 100;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let scoreCategory: 'Excellent' | 'Good' | 'Needs Improvement' = 'Needs Improvement';
  if (score >= 80) scoreCategory = 'Excellent';
  else if (score >= 60) scoreCategory = 'Good';

  // 3. Root Cause Analysis & 8. Top Problem Identification
  let topProblem = 'No major issues detected';
  let rootCause = 'Operations are running smoothly';
  
  const costs = [
    { name: 'Time Waste', value: currentMetrics.timeWasteCost, color: '#f43f5e' },
    { name: 'Energy', value: currentMetrics.energyCost, color: '#2dd4bf' },
    { name: 'Material', value: currentMetrics.materialCost, color: '#3b82f6' },
    { name: 'Unplanned', value: currentMetrics.unplannedCost, color: '#f59e0b' },
  ].sort((a, b) => b.value - a.value);

  const primaryCostDriver = costs[0].value > 0 ? costs[0].name : 'None';

  const deptWaste: Record<string, number> = {};
  currentData.forEach(r => {
    deptWaste[r.department] = (deptWaste[r.department] || 0) + (r.timeWaste || 0);
  });
  const worstDept = Object.entries(deptWaste).sort((a, b) => b[1] - a[1])[0];

  if (worstDept && worstDept[1] > 0) {
    topProblem = `Time waste in ${worstDept[0]}`;
    
    const deptRecords = currentData.filter(r => r.department === worstDept[0]);
    const totalDowntime = deptRecords.reduce((sum, r) => sum + (r.downtime || 0), 0);
    const totalWaiting = deptRecords.reduce((sum, r) => sum + (r.waitingTime || 0), 0);
    
    if (totalDowntime > totalWaiting) {
      rootCause = `High downtime in ${worstDept[0]}`;
    } else {
      rootCause = `Excessive waiting time in ${worstDept[0]}`;
    }
  }

  // 4. Alerts and Detailed Insights
  const alerts: { title: string; type: 'critical' | 'warning' | 'info'; message: string }[] = [];
  const detailedInsights: DetailedInsight[] = [];

  if (changes.wasteIndex > 10) {
    alerts.push({ title: 'High Waste Detected', type: 'critical', message: `Waste index increased by ${changes.wasteIndex.toFixed(1)}% compared to previous period.` });
    detailedInsights.push({
      category: 'Efficiency',
      title: 'Significant Drop in Efficiency',
      description: `The overall waste index has surged by ${changes.wasteIndex.toFixed(1)}%. This indicates a systemic issue in recent operations compared to the previous period.`,
      impact: 'High impact on overall profitability and throughput.',
      actionable: true
    });
  } else if (changes.wasteIndex < -5) {
    alerts.push({ title: 'Waste Improving', type: 'info', message: `Waste index decreased by ${Math.abs(changes.wasteIndex).toFixed(1)}%. Keep it up!` });
    detailedInsights.push({
      category: 'Efficiency',
      title: 'Efficiency is Improving',
      description: `The overall waste index has dropped by ${Math.abs(changes.wasteIndex).toFixed(1)}%, showing that recent process improvements or operational changes are working.`,
      impact: 'Positive impact on margins.',
      actionable: false
    });
  }

  if (changes.energy > 15) {
    alerts.push({ title: 'High Energy Usage', type: 'warning', message: `Energy consumption is up ${changes.energy.toFixed(1)}%.` });
    detailedInsights.push({
      category: 'Energy',
      title: 'Energy Consumption Spike',
      description: `Energy usage has increased by ${changes.energy.toFixed(1)}% without a proportional increase in output.`,
      impact: `Directly increases operational costs by approximately RM${(currentMetrics.energyCost - prevMetrics.energyCost).toFixed(2)}.`,
      actionable: true
    });
  }

  if (changes.cost > 20) {
    alerts.push({ title: 'Sudden Cost Increase', type: 'critical', message: `Total operating costs jumped by ${changes.cost.toFixed(1)}%.` });
    detailedInsights.push({
      category: 'Cost',
      title: 'Rapid Cost Escalation',
      description: `Total operating costs have jumped by ${changes.cost.toFixed(1)}% compared to the previous period.`,
      impact: 'Severe impact on budget and expected margins.',
      actionable: true
    });
  }

  if (currentMetrics.unplannedCost > currentMetrics.totalCost * 0.15) {
    detailedInsights.push({
      category: 'Cost',
      title: 'High Unplanned Expenses',
      description: `Unplanned costs account for ${((currentMetrics.unplannedCost / currentMetrics.totalCost) * 100).toFixed(1)}% of total costs. This is usually due to machine breakdowns or emergency maintenance.`,
      impact: 'Reduces predictability of operational budget.',
      actionable: true
    });
  }

  if (primaryCostDriver === 'Time Waste') {
    detailedInsights.push({
      category: 'Time',
      title: 'Time Waste is the Primary Cost Driver',
      description: `Time waste (downtime and waiting time) is costing you RM${currentMetrics.timeWasteCost.toFixed(2)}, making it the largest source of financial loss.`,
      impact: 'Reduces overall output capacity and inflates labor costs.',
      actionable: true
    });
  } else if (primaryCostDriver === 'Energy') {
    detailedInsights.push({
      category: 'Energy',
      title: 'Energy is the Primary Cost Driver',
      description: `Energy consumption is your highest variable cost at RM${currentMetrics.energyCost.toFixed(2)}.`,
      impact: 'High vulnerability to energy tariff fluctuations.',
      actionable: true
    });
  }

  if (worstDept && worstDept[1] > 0) {
    detailedInsights.push({
      category: 'Time',
      title: `${worstDept[0]} is the Least Efficient Department`,
      description: `The ${worstDept[0]} department accumulated ${worstDept[1]} minutes of time waste, the highest among all departments.`,
      impact: 'Creates bottlenecks that affect downstream processes.',
      actionable: true
    });
  }

  // 2. Trend Analysis
  const trendMessage = changes.wasteIndex > 5 ? "Waste is increasing over the recent period" : 
                       changes.wasteIndex < -5 ? "Waste is decreasing over the recent period" : 
                       "Waste levels are stable";

  // Trend Data for Line Chart
  const trendDataMap: Record<string, { timeWaste: number, laborMinutes: number, cost: number, wasteCost: number }> = {};
  currentData.forEach(r => {
    if (!trendDataMap[r.date]) trendDataMap[r.date] = { timeWaste: 0, laborMinutes: 0, cost: 0, wasteCost: 0 };
    const timeWaste = (r.timeWaste || ((r.waitingTime || 0) + (r.downtime || 0)));
    const laborMinutes = (r.laborHours || 0) * 60;
    const timeWasteCost = (timeWaste / 60) * settings.laborRate;
    const wasteCost = timeWasteCost + (r.unplannedCost || 0) + (r.miscCost || 0);

    trendDataMap[r.date].timeWaste += timeWaste;
    trendDataMap[r.date].laborMinutes += laborMinutes;
    trendDataMap[r.date].cost += (r.totalOperatingCost || 0);
    trendDataMap[r.date].wasteCost += wasteCost;
  });
  
  const trendData = Object.entries(trendDataMap)
    .map(([date, data]) => ({ 
      date, 
      waste: data.timeWaste, 
      cost: data.cost,
      wasteIndex: data.cost > 0 ? (data.wasteCost / data.cost) * 100 : 0
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentMetrics,
    prevMetrics,
    changes,
    score,
    scoreCategory,
    topProblem,
    rootCause,
    primaryCostDriver,
    alerts,
    detailedInsights,
    trendMessage,
    costBreakdown: costs.filter(c => c.value > 0),
    trendData,
    departmentComparisons
  };
}
