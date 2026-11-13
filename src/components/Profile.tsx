import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { 
  Building2, Mail, Shield, Calendar, CheckCircle2, Sliders, Save, 
  Loader2, Copy, Check, Zap, Clock, Cpu, Target, Briefcase, RefreshCw, Edit3, X
} from '../lib/icons';
import { motion, AnimatePresence } from 'motion/react';
import { format, isValid } from 'date-fns';

export default function Profile() {
  const { user, settings, updateSettings, updateWorkspaceProfile } = useAuth();

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(settings?.workspaceName || user?.displayName || 'OWIS EBRAHIM');
  const [workspaceEmail, setWorkspaceEmail] = useState(settings?.email || user?.email || 'owisebrahim8@gmail.com');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Operational Rates State
  const [laborRate, setLaborRate] = useState<number>(settings?.laborRate ?? 12);
  const [energyTariff, setEnergyTariff] = useState<number>(settings?.energyTariff ?? 0.55);
  const [machineRate, setMachineRate] = useState<number>(settings?.machineRate ?? 25);
  const [targetWasteIndex, setTargetWasteIndex] = useState<number>(settings?.targetWasteIndex ?? 5);
  const [industry, setIndustry] = useState<string>(settings?.industry ?? 'Manufacturing');
  const [isSavingRates, setIsSavingRates] = useState(false);
  const [ratesSuccess, setRatesSuccess] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Sync state if settings update externally
  useEffect(() => {
    if (settings) {
      if (settings.workspaceName) setWorkspaceName(settings.workspaceName);
      if (settings.email) setWorkspaceEmail(settings.email);
      if (typeof settings.laborRate === 'number') setLaborRate(settings.laborRate);
      if (typeof settings.energyTariff === 'number') setEnergyTariff(settings.energyTariff);
      if (typeof settings.machineRate === 'number') setMachineRate(settings.machineRate);
      if (typeof settings.targetWasteIndex === 'number') setTargetWasteIndex(settings.targetWasteIndex);
      if (settings.industry) setIndustry(settings.industry);
    }
  }, [settings]);

  if (!user) return null;

  const creationDate = user.metadata?.creationTime 
    ? (isValid(new Date(user.metadata.creationTime)) ? format(new Date(user.metadata.creationTime), 'MMMM yyyy') : 'April 2026')
    : 'April 2026';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      if (updateWorkspaceProfile) {
        await updateWorkspaceProfile(workspaceName.trim(), workspaceEmail.trim());
      } else {
        await updateSettings({ workspaceName: workspaceName.trim(), email: workspaceEmail.trim() });
      }
      setProfileSuccess(true);
      setIsEditingProfile(false);
      setTimeout(() => setProfileSuccess(false), 3500);
    } catch (err) {
      console.error('Error updating workspace profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveOperationalRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRates(true);
    try {
      await updateSettings({
        laborRate: Number(laborRate),
        energyTariff: Number(energyTariff),
        machineRate: Number(machineRate),
        targetWasteIndex: Number(targetWasteIndex),
        industry,
      });
      setRatesSuccess(true);
      setTimeout(() => setRatesSuccess(false), 3500);
    } catch (err) {
      console.error('Error saving operational rates:', err);
    } finally {
      setIsSavingRates(false);
    }
  };

  const applyPreset = (presetLabor: number, presetEnergy: number, presetMachine: number, presetTarget: number, presetIndustry: string) => {
    setLaborRate(presetLabor);
    setEnergyTariff(presetEnergy);
    setMachineRate(presetMachine);
    setTargetWasteIndex(presetTarget);
    setIndustry(presetIndustry);
  };

  const copyUidToClipboard = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  const currentDisplayName = settings?.workspaceName || user.displayName || 'OWIS EBRAHIM';
  const currentDisplayEmail = settings?.email || user.email || 'owisebrahim8@gmail.com';

  return (
    <div className="space-y-8 pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Workspace & Profile</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Direct instant entry company workspace configuration and operational rates.
          </p>
        </div>

        <button
          onClick={() => {
            const el = document.getElementById('rates-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 rounded-xl text-xs font-bold transition-colors w-fit"
        >
          <Sliders className="w-4 h-4 text-teal-500" />
          <span>Jump to Operational Rates</span>
        </button>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {profileSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-bold shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Workspace profile updated and synchronized successfully!</span>
          </motion.div>
        )}
        {ratesSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-4 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 rounded-2xl text-xs font-bold shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>Operational rates updated! All live KPIs and waste formulas will use these new values.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Workspace Card */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden"
      >
        <div className="h-32 bg-teal-700 relative">
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-800 p-1.5 shadow-xl">
              <div className="w-full h-full rounded-xl bg-teal-700 flex items-center justify-center text-white text-3xl font-semibold">
                {currentDisplayName?.[0]?.toUpperCase() || 'O'}
              </div>
            </div>
          </div>
          <div className="absolute top-4 right-6 flex items-center gap-2 bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-xs font-bold shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Direct Instant Access
          </div>
        </div>
        
        <div className="pt-16 p-8 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Workspace Information</h2>
              <p className="text-xs text-slate-400">Account identity and enterprise credentials</p>
            </div>
            
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-colors bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200"
            >
              {isEditingProfile ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </>
              )}
            </button>
          </div>

          {/* Profile Form / View */}
          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-4 p-5 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. OWIS EBRAHIM"
                    required
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Workspace Email
                  </label>
                  <input
                    type="email"
                    value={workspaceEmail}
                    onChange={(e) => setWorkspaceEmail(e.target.value)}
                    placeholder="e.g. owisebrahim8@gmail.com"
                    required
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>{isSavingProfile ? 'Saving...' : 'Save Workspace'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-teal-500" /> Workspace Name
                </label>
                <p className="text-base font-black text-slate-800 dark:text-white tracking-tight">
                  {currentDisplayName}
                </p>
              </div>

              <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-teal-500" /> Workspace Email
                </label>
                <p className="text-base font-bold text-slate-800 dark:text-white break-all">
                  {currentDisplayEmail}
                </p>
              </div>

              <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-teal-500" /> Access Status
                </label>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <p className="text-base font-bold text-slate-800 dark:text-white">Active (Unrestricted)</p>
                </div>
              </div>

              <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-teal-500" /> Member Since
                </label>
                <p className="text-base font-bold text-slate-800 dark:text-white">
                  {creationDate}
                </p>
              </div>
            </div>
          )}

          {/* Identifier footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Workspace Identifier:</span>
              <code className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-mono text-[11px] select-all">
                {user.uid}
              </code>
              <button
                onClick={copyUidToClipboard}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Copy Identifier"
              >
                {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            
            <button 
              onClick={() => {
                const el = document.getElementById('rates-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-2 px-5 rounded-xl transition-all shadow-md shadow-teal-500/20 text-xs tracking-wider flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" />
              Configure Operational Rates
            </button>
          </div>
        </div>
      </motion.div>

      {/* Operational Rates Configuration Panel */}
      <motion.div 
        id="rates-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Sliders className="w-4 h-4" />
              <span>Operational Rates & Cost Factors</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">Configure Operational Rates</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Modify operational rates to instantly re-calculate waste costs, payroll losses, and energy expenditures.
            </p>
          </div>

          {/* Preset Buttons */}
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

        <form onSubmit={handleSaveOperationalRates} className="space-y-6">
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
                Used to convert waiting & downtime hours into payroll waste.
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
                Standard electricity billing multiplier per kilowatt-hour.
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
                Equipment amortization & opportunity cost per idle machine hour.
              </p>
            </div>

            {/* Target Waste Index */}
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/60">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-500" />
                  <span>Benchmark Waste Target</span>
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
                Acceptable waste threshold (e.g. 5.0% = healthy lean plant).
              </p>
            </div>

            {/* Industry Profile */}
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-100 dark:border-slate-700/60 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Industry Sector Profile</span>
                </label>
              </div>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="Manufacturing">Manufacturing & Assembly</option>
                <option value="Heavy Industrial">Heavy Industrial & Fabrication</option>
                <option value="Restaurant">Food & Beverage (F&B / Central Kitchen)</option>
                <option value="Warehouse">Warehouse & Logistics Fulfillment</option>
                <option value="Retail">Retail & Commerce</option>
                <option value="Packaging">Packaging & Material Converting</option>
              </select>
              <p className="text-[11px] text-slate-400">
                Sets the industry context used by forecasting and efficiency calculations.
              </p>
            </div>
          </div>

          {/* Dynamic Impact Summary Box */}
          <div className="p-4 bg-teal-50 dark:bg-teal-950/40 rounded-xl border border-teal-200 dark:border-teal-900">
            <h4 className="text-xs font-black text-teal-900 dark:text-teal-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Live Rate Impact Preview
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-teal-200/40 dark:border-teal-800/40">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">100h Idle Labor Loss</span>
                <span className="text-sm font-black text-teal-700 dark:text-teal-300">
                  RM {(laborRate * 100).toFixed(2)}
                </span>
              </div>
              <div className="bg-white/70 dark:bg-slate-800/70 p-2.5 rounded-xl border border-teal-200/40 dark:border-teal-800/40">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">1,000 kWh Electricity</span>
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
              Changes apply immediately to Dashboard KPIs, Analytics, and Waste Reports.
            </p>
            <button
              type="submit"
              disabled={isSavingRates}
              className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 text-sm"
            >
              {isSavingRates ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Rates...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Operational Rates</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
