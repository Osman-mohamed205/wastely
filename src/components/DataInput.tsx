import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { OperationalRecord, Department } from '../types';
import { Save, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from '../lib/icons';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateDemoData } from '../lib/demoData';

interface DataInputProps {
  onComplete: () => void;
}

export default function DataInput({ onComplete }: DataInputProps) {
  const { user, settings } = useAuth();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepts, setIsLoadingDepts] = useState(true);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  
  const [formData, setFormData] = useState<Partial<OperationalRecord>>({
    date: new Date().toISOString().split('T')[0],
    department: '',
    outputUnits: 0,
    laborHours: 0,
    energyConsumption: 0,
    waitingTime: 0,
    downtime: 0,
    materialCost: 0,
    miscCost: 0,
    unplannedCost: 0,
  });

  useEffect(() => {
    const fetchDepts = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, 'departments'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const depts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Department[];
        setDepartments(depts);
        if (depts.length > 0) {
          setFormData(prev => ({ ...prev, department: depts[0].name }));
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setIsLoadingDepts(false);
      }
    };
    fetchDepts();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Math.max(0, Number(value)) : value
    }));
  };

  const calculateWaste = (data: Partial<OperationalRecord>) => {
    if (!settings) return data;

    const timeWaste = (data.waitingTime || 0) + (data.downtime || 0);
    const energyCost = (data.energyConsumption || 0) * settings.energyTariff;
    const laborCost = (data.laborHours || 0) * settings.laborRate;
    const totalOperatingCost = energyCost + laborCost + (data.materialCost || 0) + (data.miscCost || 0) + (data.unplannedCost || 0);
    
    const timeWasteCost = (timeWaste / 60) * settings.laborRate;
    const wasteCost = timeWasteCost + (data.unplannedCost || 0) + (data.miscCost || 0);
    const wasteIndex = totalOperatingCost > 0 ? (wasteCost / totalOperatingCost) : 0;

    return {
      ...data,
      timeWaste,
      energyCost,
      laborCost,
      totalOperatingCost,
      wasteIndex,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settings) return;

    setIsSaving(true);
    try {
      const finalData = calculateWaste(formData);
      await addDoc(collection(db, 'records'), {
        ...finalData,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onComplete();
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'records');
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    { id: 1, title: 'Basic Information', description: 'Department and date' },
    { id: 2, title: 'Performance Data', description: 'Output and labor' },
    { id: 3, title: 'Time Waste', description: 'Waiting and downtime' },
    { id: 4, title: 'Costs', description: 'Materials and other costs' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Operational Data Entry</h1>
          <p className="text-slate-500">Record your daily operational data to track performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => {
              const csvContent = 'Date,Department,Output Units,Labor Hours,Energy (kWh),Waiting Time (minutes),Downtime (minutes),Material Cost (RM),Misc Cost (RM),Unplanned Cost (RM)\n' + 
                '2024-03-20,Production,500,40,120,15,30,250.50,50,0\n' +
                '2024-03-20,Packaging,800,24,45,10,5,120.00,20,15.50';
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              const url = URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', 'operational_template.csv');
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
          >
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
            <span>Download CSV Template</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between max-w-3xl mx-auto mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300",
                step >= s.id ? "bg-teal-400 text-white shadow-lg shadow-teal-400/20" : "bg-slate-200 text-slate-500"
              )}>
                {step > s.id ? <CheckCircle2 className="w-6 h-6" /> : s.id}
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-widest", step >= s.id ? "text-slate-800" : "text-slate-400")}>
                {s.title}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-1 mx-4 rounded-full transition-all duration-300", step > s.id ? "bg-teal-400" : "bg-slate-200")} />
            )}
          </React.Fragment>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-10 max-w-3xl mx-auto"
      >
        <form onSubmit={handleSubmit} className="space-y-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Department</label>
                  {isLoadingDepts ? (
                    <div className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-2 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </div>
                  ) : departments.length === 0 ? (
                    <div className="w-full px-5 py-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Please add a department first.
                    </div>
                  ) : (
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                      required
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Output Units</label>
                  <input
                    type="number"
                    name="outputUnits"
                    value={formData.outputUnits}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Labor Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    name="laborHours"
                    value={formData.laborHours}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Energy Consumption (kWh)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="energyConsumption"
                    value={formData.energyConsumption}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Waiting Time (minutes)</label>
                  <input
                    type="number"
                    name="waitingTime"
                    value={formData.waitingTime}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Downtime (minutes)</label>
                  <input
                    type="number"
                    name="downtime"
                    value={formData.downtime}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Material Cost (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="materialCost"
                    value={formData.materialCost}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Miscellaneous Cost (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="miscCost"
                    value={formData.miscCost}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Unplanned Cost (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="unplannedCost"
                    value={formData.unplannedCost}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-teal-400/20 focus:border-teal-400 outline-none transition-all font-bold text-slate-700"
                    required
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-10 border-t border-slate-50">
            <button
              type="button"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              className="flex items-center gap-2 px-8 py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 disabled:opacity-30 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(s => Math.min(4, s + 1))}
                className="flex items-center gap-3 bg-teal-400 text-white font-bold py-4 px-10 rounded-2xl hover:bg-teal-500 transition-all shadow-lg shadow-teal-400/20 uppercase text-xs tracking-widest"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-3 bg-green-500 text-white font-bold py-4 px-10 rounded-2xl hover:bg-green-600 disabled:opacity-50 transition-all shadow-lg shadow-green-500/20 uppercase text-xs tracking-widest"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Complete Entry
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </motion.div>

      {showSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50"
        >
          <CheckCircle2 className="w-6 h-6" />
          <span className="font-bold">Record saved successfully!</span>
        </motion.div>
      )}
    </div>
  );
}
