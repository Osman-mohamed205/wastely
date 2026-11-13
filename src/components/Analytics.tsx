import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { useOperationalRecords } from '../hooks/useOperationalRecords';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Department } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Line, PieChart, Pie, Cell, LineChart
} from 'recharts';
import { Filter, Loader2, BarChart3, TrendingUp, Layers, AlertTriangle, CheckCircle2, Info, ArrowUpRight, ArrowDownRight, Zap, Clock, Target, Lightbulb, AlertCircle, DollarSign, Activity } from '../lib/icons';
import { formatCurrency, formatNumber, cn } from '../lib/utils';
import { format, subDays, isValid } from 'date-fns';
import { calculateAdvancedAnalytics } from '../lib/analyticsEngine';
import { AnimatedCounter } from './AnimatedCounter';

const safeFormatDate = (dateStr: string, formatStr: string) => {
  if (!dateStr) return 'Invalid Date';
  const d = new Date(dateStr);
  if (isValid(d)) return format(d, formatStr);
  return dateStr;
};

export default function Analytics() {
  const { user, settings } = useAuth();
  const { records: hookRecords, loading } = useOperationalRecords();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterDept, setFilterDept] = useState<string>('All');
  const [dateRange, setDateRange] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const records = useMemo(() => {
    // Sort by date asc for Analytics
    return [...hookRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [hookRecords]);

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
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
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
        if (!isValid(d)) return true;
        return d >= cutoff;
      });
    }
    if (filterDept !== 'All') {
      filtered = filtered.filter(r => r.department === filterDept);
    }
    return filtered;
  }, [records, filterDept, dateRange, customStartDate, customEndDate]);

  const allUniqueDepartments = useMemo(() => {
    const recordDepts = Array.from(new Set(records.map(r => r.department)));
    const definedDepts = departments.map(d => d.name);
    return Array.from(new Set([...definedDepts, ...recordDepts])).filter(Boolean);
  }, [records, departments]);

  const analytics = useMemo(() => {
    return calculateAdvancedAnalytics(filteredRecords, settings);
  }, [filteredRecords, settings]);

  // Department Cost Breakdown (Stacked Bar)
  const deptCostData = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredRecords.forEach(r => {
      if (!groups[r.department]) {
        groups[r.department] = { 
          department: r.department, 
          laborCost: 0, 
          energyCost: 0, 
          materialCost: 0, 
          miscCost: 0,
          unplannedCost: 0 
        };
      }
      groups[r.department].laborCost += (r.laborCost || 0);
      groups[r.department].energyCost += (r.energyCost || 0);
      groups[r.department].materialCost += (r.materialCost || 0);
      groups[r.department].miscCost += (r.miscCost || 0);
      groups[r.department].unplannedCost += (r.unplannedCost || 0);
    });
    return Object.values(groups).sort((a, b) => 
      (b.laborCost + b.energyCost + b.materialCost) - (a.laborCost + a.energyCost + a.materialCost)
    );
  }, [filteredRecords]);

  // Output vs Energy Efficiency (Composed Chart)
  const efficiencyData = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredRecords.forEach(r => {
      if (!groups[r.date]) {
        groups[r.date] = { date: r.date, outputUnits: 0, energyConsumption: 0 };
      }
      groups[r.date].outputUnits += (r.outputUnits || 0);
      groups[r.date].energyConsumption += (r.energyConsumption || 0);
    });
    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
      </div>
    );
  }

  const renderChangeIndicator = (change: number, reverseColors = false) => {
    const isPositive = change > 0;
    const isNeutral = change === 0;
    
    let colorClass = "text-slate-400 bg-slate-100";
    if (!isNeutral) {
      if (reverseColors) {
        colorClass = isPositive ? "text-red-600 bg-red-100" : "text-green-600 bg-green-100";
      } else {
        colorClass = isPositive ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100";
      }
    }

    return (
      <div className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold", colorClass)}>
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : isNeutral ? null : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Analytics Filters</span>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-teal-500 focus:border-teal-500 block p-2.5 font-bold outline-none"
          >
            <option value="All">All Departments</option>
            {allUniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-teal-500 focus:border-teal-500 block p-2.5 font-bold outline-none"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {!analytics || filteredRecords.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Data Available</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Adjust your filters or add more operational records to view intelligent analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Top Row: Score & Root Cause */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Efficiency Score */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Overall Efficiency</h3>
              <div className="relative w-32 h-32 flex items-center justify-center mb-2">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={cn(
                      "transition-all duration-1000 ease-out",
                      analytics.score >= 80 ? "text-green-500" : analytics.score >= 60 ? "text-yellow-500" : "text-red-500"
                    )}
                    strokeDasharray={`${analytics.score}, 100`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-slate-800">
                    <AnimatedCounter value={analytics.score} decimals={0} duration={800} />
                  </span>
                </div>
              </div>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold",
                analytics.score >= 80 ? "bg-green-100 text-green-700" : 
                analytics.score >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
              )}>
                {analytics.scoreCategory}
              </span>
            </div>

            {/* Top Problem & Root Cause */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-2 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-slate-800">Root Cause Analysis</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Top Issue</p>
                  <p className="text-lg font-bold text-slate-800">{analytics.topProblem}</p>
                  <p className="text-sm text-slate-500 mt-2">Main Driver: <span className="font-bold text-slate-700">{analytics.rootCause}</span></p>
                </div>
                <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-5">
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">Primary Cost Driver</p>
                  <p className="text-lg font-bold text-slate-800">{analytics.primaryCostDriver}</p>
                  <p className="text-sm text-slate-500 mt-2">Accounts for the largest portion of your operational expenses.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Findings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Detailed Insights */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-teal-500" />
                <h3 className="text-base font-bold text-slate-800">Detailed Findings</h3>
              </div>
              {analytics.detailedInsights && analytics.detailedInsights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analytics.detailedInsights.map((insight, i) => (
                    <div key={`insight-${i}`} className="flex gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className={cn(
                        "p-3 rounded-xl h-fit shrink-0",
                        insight.category === 'Cost' ? "bg-red-100 text-red-600" : 
                        insight.category === 'Time' ? "bg-amber-100 text-amber-600" : 
                        insight.category === 'Energy' ? "bg-blue-100 text-blue-600" :
                        "bg-green-100 text-green-600"
                      )}>
                        {insight.category === 'Cost' ? <DollarSign className="w-5 h-5" /> :
                         insight.category === 'Time' ? <Clock className="w-5 h-5" /> : 
                         insight.category === 'Energy' ? <Zap className="w-5 h-5" /> :
                         <Activity className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{insight.title}</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mt-2">{insight.description}</p>
                        {insight.impact && (
                          <p className="text-xs font-medium text-slate-400 mt-3 border-t border-slate-200 pt-3">
                            <span className="font-bold text-slate-600">Impact:</span> {insight.impact}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border border-slate-100">
                  <Info className="w-8 h-8 text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-600">No detailed insights available yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Add more operational data to generate analysis.</p>
                </div>
              )}
            </div>
          </div>

          {/* Comparison Analysis Cards */}
          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Comparison Analysis (Recent vs Previous)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Cost</p>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-black text-slate-800">
                    <AnimatedCounter value={analytics.currentMetrics.totalCost} prefix="RM " decimals={2} duration={750} />
                  </p>
                  {renderChangeIndicator(analytics.changes.cost, true)}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Waste Index</p>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-black text-slate-800">
                    <AnimatedCounter value={analytics.currentMetrics.totalWasteIndex * 100} suffix="%" decimals={1} duration={750} />
                  </p>
                  {renderChangeIndicator(analytics.changes.wasteIndex, true)}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Energy Usage</p>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-black text-slate-800">
                    <AnimatedCounter value={analytics.currentMetrics.totalEnergy} suffix=" kWh" decimals={0} duration={750} />
                  </p>
                  {renderChangeIndicator(analytics.changes.energy, true)}
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Time Waste</p>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-black text-slate-800">
                    <AnimatedCounter value={analytics.currentMetrics.totalTimeWaste} suffix=" min" decimals={0} duration={750} />
                  </p>
                  {renderChangeIndicator(analytics.changes.timeWaste, true)}
                </div>
              </div>
            </div>
          </div>

          {/* Department Comparison */}
          {analytics.departmentComparisons.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Department Comparison</h3>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Department</th>
                        <th className="px-6 py-4">Current Cost</th>
                        <th className="px-6 py-4">Cost Change</th>
                        <th className="px-6 py-4">Current Time Waste</th>
                        <th className="px-6 py-4">Waste Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.departmentComparisons.map((dept, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{dept.department}</td>
                          <td className="px-6 py-4">{formatCurrency(dept.currentCost)}</td>
                          <td className="px-6 py-4">{renderChangeIndicator(dept.costChange, true)}</td>
                          <td className="px-6 py-4">{formatNumber(dept.currentWaste, 0)} min</td>
                          <td className="px-6 py-4">{renderChangeIndicator(dept.wasteChange, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Waste Cost Breakdown */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-slate-800">Waste Cost Breakdown</h3>
              </div>
              <p className="text-xs text-slate-500 mb-6">Distribution of your operational costs.</p>
              <div className="h-[250px]">
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
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trend Analysis */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 lg:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-slate-800">Trend Analysis</h3>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">{analytics.trendMessage}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-6">Time waste and total cost trends over time.</p>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <LineChart data={analytics.trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => safeFormatDate(val, 'MMM d')}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}} 
                      dy={10}
                    />
                    <YAxis 
                      yAxisId="left"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}} 
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(val) => `RM${val}`}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}} 
                    />
                    <Tooltip 
                      labelFormatter={(label) => safeFormatDate(label as string, 'MMMM d, yyyy')}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" />
                    <Line yAxisId="left" type="monotone" dataKey="waste" name="Time Waste (min)" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                    <Line yAxisId="right" type="monotone" dataKey="cost" name="Total Cost" stroke="#8b5cf6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Existing Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Department Cost Breakdown */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Department Cost Structure</h3>
                  <p className="text-xs text-slate-500">Total accumulated costs separated by category per department.</p>
                </div>
                <Layers className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <BarChart data={deptCostData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="department" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} 
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(val) => `RM${val}`}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}} 
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" />
                    <Bar dataKey="laborCost" name="Labor" stackId="a" fill="#f43f5e" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="energyCost" name="Energy" stackId="a" fill="#2dd4bf" />
                    <Bar dataKey="materialCost" name="Material" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="miscCost" name="Misc" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="unplannedCost" name="Unplanned" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Output vs Energy Consumption */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Output vs Energy Consumption</h3>
                  <p className="text-xs text-slate-500">Comparing production output units against energy consumed (kWh).</p>
                </div>
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <ComposedChart data={efficiencyData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => safeFormatDate(val, 'MMM d')}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 12}} 
                      dy={10}
                    />
                    <YAxis 
                      yAxisId="left" 
                      orientation="left" 
                      stroke="#3b82f6" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{fontSize: 12}}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      stroke="#2dd4bf" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{fontSize: 12}}
                    />
                    <Tooltip 
                      labelFormatter={(label) => safeFormatDate(label as string, 'MMMM d, yyyy')}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" />
                    <Bar yAxisId="left" dataKey="outputUnits" name="Output Units" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                    <Line yAxisId="right" type="monotone" dataKey="energyConsumption" name="Energy (kWh)" stroke="#2dd4bf" strokeWidth={3} dot={{r: 4}} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
