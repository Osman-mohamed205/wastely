import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../App';
import { useOperationalRecords } from '../hooks/useOperationalRecords';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Department } from '../types';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { 
  FileText, Download, Loader2, TrendingDown, DollarSign, Clock, Zap, Activity, CheckCircle2, AlertTriangle,
  Filter, ArrowUpRight, ArrowDownRight, Target, Lightbulb, FileSpreadsheet
} from '../lib/icons';
import { formatCurrency, formatNumber, cn } from '../lib/utils';
import { format, subDays, isValid, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { calculateAdvancedAnalytics } from '../lib/analyticsEngine';

const safeFormatDate = (dateStr: string, formatStr: string) => {
  if (!dateStr) return 'Invalid Date';
  const d = new Date(dateStr);
  if (isValid(d)) return format(d, formatStr);
  return dateStr;
};

type ReportType = 'daily' | 'weekly' | 'monthly' | 'all' | 'custom';

export default function WasteReports() {
  const { user, settings } = useAuth();
  const { records, loading } = useOperationalRecords();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const reportRef = useRef<HTMLDivElement>(null);

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

  const allUniqueDepartments = useMemo(() => {
    const recordDepts = Array.from(new Set(records.map(r => r.department)));
    const definedDepts = departments.map(d => d.name);
    return Array.from(new Set([...definedDepts, ...recordDepts])).filter(Boolean);
  }, [records, departments]);

  const filteredRecords = useMemo(() => {
    let filtered = records;
    
    // Date Filter
    if (reportType === 'custom') {
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
    } else if (reportType !== 'all') {
      const days = reportType === 'daily' ? 1 : reportType === 'weekly' ? 7 : 30;
      const cutoff = subDays(new Date(), days);
      filtered = filtered.filter(r => {
        const d = new Date(r.date);
        if (!isValid(d)) return true;
        return d >= cutoff;
      });
    }

    // Department Filter
    if (filterDept !== 'All') {
      filtered = filtered.filter(r => r.department === filterDept);
    }
    
    return filtered;
  }, [records, filterDept, reportType, customStartDate, customEndDate]);

  const analytics = useMemo(() => {
    return calculateAdvancedAnalytics(filteredRecords, settings);
  }, [filteredRecords, settings]);

  const generatePDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const dataUrl = await toPng(reportRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: { margin: '0' }
      });
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (reportRef.current.offsetHeight * pdfWidth) / reportRef.current.offsetWidth;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Wastely_${reportType.charAt(0).toUpperCase() + reportType.slice(1)}_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const exportCSV = () => {
    if (filteredRecords.length === 0) return;

    const headers = ['Date', 'Department', 'Output Units', 'Labor Hours', 'Energy (kWh)', 'Waiting Time (min)', 'Downtime (min)', 'Material Cost (RM)', 'Misc Cost (RM)', 'Unplanned Cost (RM)', 'Total Cost (RM)', 'Waste Index'];
    
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r => [
        r.date,
        `"${r.department}"`,
        r.outputUnits,
        r.laborHours,
        r.energyConsumption,
        r.waitingTime,
        r.downtime,
        r.materialCost,
        r.miscCost,
        r.unplannedCost,
        r.totalOperatingCost,
        (r.laborHours || 0) > 0 ? (((r.waitingTime || 0) + (r.downtime || 0)) / ((r.laborHours || 0) * 60)).toFixed(4) : 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Wastely_Data_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    
    let colorClass = "text-slate-400";
    if (!isNeutral) {
      if (reverseColors) {
        colorClass = isPositive ? "text-red-500" : "text-green-500";
      } else {
        colorClass = isPositive ? "text-green-500" : "text-red-500";
      }
    }

    return (
      <div className={cn("flex items-center gap-1 text-xs font-bold", colorClass)}>
        {isPositive ? <ArrowUpRight className="w-3 h-3" /> : isNeutral ? null : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Waste Reports</h2>
            <p className="text-sm text-slate-500">Generate detailed operational reports and export data.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportCSV}
              disabled={filteredRecords.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </button>
            <button 
              onClick={generatePDF}
              disabled={isGeneratingPDF || filteredRecords.length === 0 || !analytics}
              className="flex items-center gap-2 px-6 py-2 bg-teal-500 text-white rounded-xl font-bold text-sm shadow-md shadow-teal-500/20 hover:bg-teal-600 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Report Settings</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select 
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-teal-500 focus:border-teal-500 block p-2.5 font-bold outline-none"
            >
              <option value="daily">Daily Report (Last 24h)</option>
              <option value="weekly">Weekly Report (Last 7 Days)</option>
              <option value="monthly">Monthly Report (Last 30 Days)</option>
              <option value="all">All Time Data</option>
              <option value="custom">Custom Range</option>
            </select>
            {reportType === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-teal-500 focus:border-teal-500 block p-2.5 font-bold outline-none"
                />
                <span className="text-slate-400 text-xs font-bold">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-teal-500 focus:border-teal-500 block p-2.5 font-bold outline-none"
                />
              </div>
            )}
          </div>
          <select 
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:ring-teal-500 focus:border-teal-500 block p-2.5 font-bold outline-none"
          >
            <option value="All">All Departments</option>
            {allUniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {!analytics || filteredRecords.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">No Data Available</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            No records found for the selected filters. Adjust your date range or department.
          </p>
        </div>
      ) : (
        <div className="bg-slate-100 p-4 sm:p-8 rounded-3xl overflow-x-auto">
          {/* Report Preview Container (This is what gets captured by PDF) */}
          <div 
            ref={reportRef} 
            className="bg-white w-[210mm] min-h-[297mm] mx-auto p-10 sm:p-12 shadow-xl relative"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Header */}
            <div className="border-b-2 border-slate-100 pb-6 mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-1">Wastely</h1>
                <h2 className="text-xl font-bold text-slate-500">
                  {reportType === 'daily' ? 'Daily' : reportType === 'weekly' ? 'Weekly' : reportType === 'monthly' ? 'Monthly' : 'Comprehensive'} Operational Report
                </h2>
                {filterDept !== 'All' && <p className="text-sm font-bold text-teal-600 mt-1">Department: {filterDept}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">Generated on</p>
                <p className="text-sm text-slate-500">{format(new Date(), 'MMMM d, yyyy')}</p>
                <p className="text-xs text-slate-400 mt-1">{filteredRecords.length} records analyzed</p>
              </div>
            </div>

            {/* 1. Summary Section */}
            <div className="mb-10">
              <h3 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-teal-500 pl-3">Performance Summary</h3>
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Efficiency Score</p>
                  <p className={cn("text-2xl font-black", analytics.score >= 80 ? "text-green-500" : analytics.score >= 60 ? "text-amber-500" : "text-red-500")}>
                    {analytics.score}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">{analytics.scoreCategory}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Cost</p>
                  <p className="text-xl font-black text-slate-800">{formatCurrency(analytics.currentMetrics.totalCost)}</p>
                  <div className="mt-1">{renderChangeIndicator(analytics.changes.cost, true)}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Time Waste</p>
                  <p className="text-xl font-black text-slate-800">{formatNumber(analytics.currentMetrics.totalTimeWaste, 0)}m</p>
                  <div className="mt-1">{renderChangeIndicator(analytics.changes.timeWaste, true)}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Energy Cost</p>
                  <p className="text-xl font-black text-slate-800">{formatCurrency(analytics.currentMetrics.energyCost)}</p>
                  <div className="mt-1">{renderChangeIndicator(analytics.changes.energy, true)}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Waste Index</p>
                  <p className="text-xl font-black text-slate-800">{formatNumber(analytics.currentMetrics.totalWasteIndex * 100, 1)}%</p>
                  <div className="mt-1">{renderChangeIndicator(analytics.changes.wasteIndex, true)}</div>
                </div>
              </div>
            </div>

            {/* 2. Detailed Analysis & Breakdown */}
            <div className="grid grid-cols-2 gap-8 mb-10">
              {/* Detailed Analysis Text */}
              <div>
                <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-teal-500 pl-3">Detailed Analysis</h3>
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-red-500" />
                      <h4 className="text-xs font-bold text-slate-700 uppercase">Top Issue Detected</h4>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{analytics.topProblem}</p>
                    <p className="text-xs text-slate-500 mt-1">Root Cause: {analytics.rootCause}</p>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold text-slate-700 uppercase">Primary Cost Driver</h4>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{analytics.primaryCostDriver}</p>
                    <p className="text-xs text-slate-500 mt-1">This category represents the largest portion of your operational waste expenses.</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-blue-500" />
                      <h4 className="text-xs font-bold text-slate-700 uppercase">Trend Overview</h4>
                    </div>
                    <p className="text-sm font-bold text-slate-800">{analytics.trendMessage}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Compared to the previous period, overall costs have {analytics.changes.cost > 0 ? 'increased' : 'decreased'} by {Math.abs(analytics.changes.cost).toFixed(1)}%.
                    </p>
                  </div>
                </div>
              </div>

              {/* Waste Breakdown Chart */}
              <div>
                <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-teal-500 pl-3">Waste Cost Breakdown</h3>
                <div className="h-64 bg-slate-50 rounded-2xl p-4 border border-slate-100">
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
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 3. Trend Analysis Chart */}
            <div className="mb-10">
              <h3 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wider border-l-4 border-teal-500 pl-3">Waste Trend Analysis</h3>
              <div className="h-64 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <LineChart data={analytics.trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => safeFormatDate(val, 'MMM d')}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}} 
                      dy={10}
                    />
                    <YAxis 
                      yAxisId="left"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}} 
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(val) => `RM${val}`}
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10}} 
                    />
                    <Tooltip 
                      labelFormatter={(label) => safeFormatDate(label as string, 'MMMM d, yyyy')}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="waste" name="Time Waste (min)" stroke="#f43f5e" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="cost" name="Total Cost" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-12 left-12 right-12 border-t-2 border-slate-100 pt-6 flex justify-between items-center text-xs text-slate-400">
              <p>Generated by Wastely Analytics Engine</p>
              <p>Confidential & Proprietary</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
