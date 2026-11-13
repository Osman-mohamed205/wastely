import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, writeBatch, deleteDoc, onSnapshot, doc } from 'firebase/firestore';
import { 
  Save, CheckCircle2, Trash2, AlertTriangle, Loader2, Building2, 
  Sliders, Mail, Clock, Zap, Cpu, Target, Briefcase, RefreshCw, Check, Palette
} from '../lib/icons';
import { motion, AnimatePresence } from 'motion/react';
import { Department } from '../types';

export default function Settings() {
  const { user, settings, updateSettings, updateWorkspaceProfile } = useAuth();
  const theme = settings?.theme || 'light';
  const themes = [
    { id: 'light', name: 'Light', note: 'Default', swatch: 'bg-[#f7f8f7] border-[#d8dfda]' },
    { id: 'dark', name: 'Dark', note: 'Low light', swatch: 'bg-[#202a28] border-[#3d4b47]' },
    { id: 'blue', name: 'Blue', note: 'Cool tone', swatch: 'bg-[#315c78] border-[#24465e]' },
    { id: 'burgundy', name: 'Burgundy', note: 'Warm tone', swatch: 'bg-[#783e4e] border-[#60303f]' },
  ] as const;
  
  // Workspace Info State
  const [workspaceName, setWorkspaceName] = useState(settings?.workspaceName || user?.displayName || 'OWIS EBRAHIM');
  const [workspaceEmail, setWorkspaceEmail] = useState(settings?.email || user?.email || 'owisebrahim8@gmail.com');

  // Operational Rates State
  const [energyTariff, setEnergyTariff] = useState(settings?.energyTariff ?? 0.55);
  const [laborRate, setLaborRate] = useState(settings?.laborRate ?? 12);
  const [machineRate, setMachineRate] = useState(settings?.machineRate ?? 25);
  const [targetWasteIndex, setTargetWasteIndex] = useState(settings?.targetWasteIndex ?? 5);
  const [industry, setIndustry] = useState(settings?.industry || 'Manufacturing');

  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isDeletingDept, setIsDeletingDept] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.workspaceName) setWorkspaceName(settings.workspaceName);
      if (settings.email) setWorkspaceEmail(settings.email);
      if (typeof settings.energyTariff === 'number') setEnergyTariff(settings.energyTariff);
      if (typeof settings.laborRate === 'number') setLaborRate(settings.laborRate);
      if (typeof settings.machineRate === 'number') setMachineRate(settings.machineRate);
      if (typeof settings.targetWasteIndex === 'number') setTargetWasteIndex(settings.targetWasteIndex);
      if (settings.industry) setIndustry(settings.industry);
    }
  }, [settings]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'departments'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
      setDepartments(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    try {
      if (updateWorkspaceProfile) {
        await updateWorkspaceProfile(workspaceName.trim(), workspaceEmail.trim());
      }
      await updateSettings({
        workspaceName: workspaceName.trim(),
        email: workspaceEmail.trim(),
        energyTariff: Number(energyTariff),
        laborRate: Number(laborRate),
        machineRate: Number(machineRate),
        targetWasteIndex: Number(targetWasteIndex),
        industry,
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3500);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (presetLabor: number, presetEnergy: number, presetMachine: number, presetTarget: number, presetIndustry: string) => {
    setLaborRate(presetLabor);
    setEnergyTariff(presetEnergy);
    setMachineRate(presetMachine);
    setTargetWasteIndex(presetTarget);
    setIndustry(presetIndustry);
  };

  const handleDeleteAllData = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const q = query(collection(db, 'records'), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((document) => {
        batch.delete(document.ref);
      });
      
      await batch.commit();
      
      setShowDeleteConfirm(false);
      setDeleteSuccess(true);
      setTimeout(() => setDeleteSuccess(false), 3500);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'records');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    if (!user || !deptId) return;
    setIsDeletingDept(deptId);
    try {
      await deleteDoc(doc(db, 'departments', deptId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `departments/${deptId}`);
    } finally {
      setIsDeletingDept(null);
    }
  };

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">System Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure operational rates, financial conversion tariffs, and workspace parameters.
        </p>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Settings and operational rates saved successfully! Calculations updated across the app.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg"><Palette className="w-5 h-5" /></div>
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">Appearance</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Choose a color mood for your workspace.</p>
          </div>
        </div>
        <div role="group" aria-label="Color mood" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={theme === option.id}
              onClick={() => updateSettings({ theme: option.id })}
              className={`text-left rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${theme === option.id ? 'border-teal-700 ring-1 ring-teal-700' : 'border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-400'}`}
            >
              <span className={`block h-12 rounded-md border ${option.swatch}`} aria-hidden="true" />
              <span className="mt-2 block text-sm font-semibold text-slate-800 dark:text-white">{option.name}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{option.note}</span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Workspace Identity Section */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6"
        >
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="p-2 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Workspace Profile</h2>
              <p className="text-xs text-slate-400">Account identity and enterprise credentials</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-teal-500" />
                <span>Workspace Name</span>
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="OWIS EBRAHIM"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
              <p className="text-[11px] text-slate-400">Appears on reports, invoices, and executive exports</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-teal-500" />
                <span>Workspace Email</span>
              </label>
              <input
                type="email"
                value={workspaceEmail}
                onChange={(e) => setWorkspaceEmail(e.target.value)}
                placeholder="owisebrahim8@gmail.com"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
              />
              <p className="text-[11px] text-slate-400">Primary contact for notifications and automated waste alerts</p>
            </div>
          </div>
        </motion.div>

        {/* Operational Rates Section */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Configure Operational Rates</h2>
                <p className="text-xs text-slate-400">Used by analytics engine to convert downtime and energy into currency</p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase hidden sm:inline">Presets:</span>
              <button
                type="button"
                onClick={() => applyPreset(12, 0.55, 25, 5, 'Manufacturing')}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-slate-600 dark:text-slate-300 hover:text-teal-600 text-[11px] font-bold rounded-lg transition-colors"
              >
                Manufacturing
              </button>
              <button
                type="button"
                onClick={() => applyPreset(25, 0.65, 50, 4, 'Heavy Industrial')}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-slate-600 dark:text-slate-300 hover:text-teal-600 text-[11px] font-bold rounded-lg transition-colors"
              >
                Heavy
              </button>
              <button
                type="button"
                onClick={() => applyPreset(10, 0.48, 15, 6, 'Restaurant')}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-slate-600 dark:text-slate-300 hover:text-teal-600 text-[11px] font-bold rounded-lg transition-colors"
              >
                F&B
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Labor Rate */}
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-500" />
                  <span>Labor Hourly Rate</span>
                </label>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-teal-900/40 px-2 py-0.5 rounded-full">
                  RM / Hour
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">RM</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={laborRate}
                  onChange={(e) => setLaborRate(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Converts idle minutes and operator waiting into lost payroll.
              </p>
            </div>

            {/* Energy Tariff */}
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Energy Tariff</span>
                </label>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                  RM / kWh
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">RM</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={energyTariff}
                  onChange={(e) => setEnergyTariff(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Standard electricity rate per kilowatt-hour.
              </p>
            </div>

            {/* Machine Downtime Rate */}
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  <span>Machine Downtime Cost</span>
                </label>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                  RM / Hour
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">RM</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={machineRate}
                  onChange={(e) => setMachineRate(Number(e.target.value))}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Opportunity loss per hour when critical machinery is down.
              </p>
            </div>

            {/* Target Waste Index */}
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-500" />
                  <span>Benchmark Target</span>
                </label>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/40 px-2 py-0.5 rounded-full">
                  % Ratio
                </span>
              </div>
              <div className="relative">
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={targetWasteIndex}
                  onChange={(e) => setTargetWasteIndex(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-black text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Target waste threshold (under 5% indicates optimal operations).
              </p>
            </div>

            {/* Industry Profile */}
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/60 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Industry Profile</span>
                </label>
              </div>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="Manufacturing">Manufacturing & Assembly</option>
                <option value="Heavy Industrial">Heavy Industrial & Fabrication</option>
                <option value="Restaurant">Food & Beverage (F&B / Kitchen)</option>
                <option value="Warehouse">Warehouse & Logistics Fulfillment</option>
                <option value="Retail">Retail & Commerce</option>
                <option value="Packaging">Packaging & Material Converting</option>
              </select>
              <p className="text-[11px] text-slate-400">
                Sets the industry context used by forecasting and efficiency calculations.
              </p>
            </div>
          </div>

          {/* Dynamic Rate Impact Preview */}
          <div className="p-4 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-900">
            <h4 className="text-xs font-black text-teal-900 dark:text-teal-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Live Rate Impact Preview
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-teal-200/40 dark:border-teal-800/40">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">100h Idle Labor Cost</span>
                <span className="text-sm font-black text-teal-700 dark:text-teal-300">
                  RM {(laborRate * 100).toFixed(2)}
                </span>
              </div>
              <div className="bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-teal-200/40 dark:border-teal-800/40">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">1,000 kWh Tariff Bill</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                  RM {(energyTariff * 1000).toFixed(2)}
                </span>
              </div>
              <div className="bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-teal-200/40 dark:border-teal-800/40">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">50h Machine Stoppage</span>
                <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                  RM {(machineRate * 50).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-400">
              Configured rates are synced across all dashboards and reports.
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Operational Parameters</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </form>

      {/* Departments Section */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Active Departments</h2>
              <p className="text-xs text-slate-400">Operational divisions currently registered in this workspace</p>
            </div>
          </div>
          
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'departments' }))}
            className="text-xs font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline"
          >
            Manage Departments →
          </button>
        </div>
        
        {departments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {departments.map((dept) => (
              <div key={dept.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/40 rounded-xl border border-slate-100 dark:border-slate-700">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-200">{dept.name}</span>
                <button
                  onClick={() => handleDeleteDepartment(dept.id)}
                  disabled={isDeletingDept === dept.id}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors disabled:opacity-50"
                  title="Remove Department"
                >
                  {isDeletingDept === dept.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No custom departments registered yet. You can add them under <span className="font-bold text-teal-600 dark:text-teal-400 cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'departments' }))}>Departments</span> or during data import.
          </p>
        )}
      </motion.div>

      {/* Clear All Data Section */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-red-100 dark:border-red-950/60 p-8 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              <span>Data Management & Reset</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
              Reset your operational log collection to start with a fresh clean workspace. This permanently deletes your logged batch records.
            </p>
          </div>
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors w-fit shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Operational Data
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting...' : 'Confirm Reset'}</span>
              </button>
            </div>
          )}
        </div>

        {deleteSuccess && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-3 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 rounded-xl flex items-center gap-2 text-xs font-bold"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>All records cleared. The dashboard is now in a pristine zero-state ready for live entries.</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
