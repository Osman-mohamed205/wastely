import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, writeBatch, doc, getDocs, query, where } from 'firebase/firestore';
import { OperationalRecord } from '../types';
import { Upload, FileText, CheckCircle2, AlertCircle, X, ArrowRight, Table, Download, Loader2, FileSpreadsheet, Settings2, RefreshCw } from '../lib/icons';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { format, isValid, parse } from 'date-fns';

interface CSVImportProps {
  onComplete: () => void;
}

const IMPORT_FIELDS = [
  { key: 'Date', keywords: ['date', 'day', 'time', 'timestamp'], required: true },
  { key: 'Department', keywords: ['dept', 'department', 'section', 'area'], required: true },
  { key: 'Output Units', keywords: ['output', 'units', 'production', 'qty', 'quantity', 'yield'], required: true },
  { key: 'Labor Hours', keywords: ['labor', 'hours', 'man hours', 'work', 'worker'], required: true },
  { key: 'Energy (kWh)', keywords: ['energy', 'kwh', 'power', 'electricity'], required: true },
  { key: 'Waiting Time (minutes)', keywords: ['waiting', 'delay', 'idle', 'wait'], required: false },
  { key: 'Downtime (minutes)', keywords: ['downtime', 'stop', 'breakdown', 'halt'], required: false },
  { key: 'Material Cost (RM)', keywords: ['material', 'raw', 'cost'], required: true },
  { key: 'Misc Cost (RM)', keywords: ['misc', 'miscellaneous', 'other'], required: false },
  { key: 'Unplanned Cost (RM)', keywords: ['unplanned', 'unexpected', 'extra'], required: false }
];

export default function CSVImport({ onComplete }: CSVImportProps) {
  const { user, settings } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Preview
  
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  const [mappedData, setMappedData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validCount, setValidCount] = useState(0);
  
  const [isImporting, setIsImporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clearExisting, setClearExisting] = useState(false);

  const downloadTemplate = () => {
    const csvContent = IMPORT_FIELDS.map(f => f.key).join(',') + '\n' + 
      '2024-03-20,Production,500,40,120,15,30,250.50,50,0\n' +
      '2024-03-20,Packaging,800,24,45,10,5,120.00,20,15.50';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'wastely_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const autoMapColumns = (headers: string[]) => {
    const newMapping: Record<string, string> = {};
    const usedHeaders = new Set<string>();

    IMPORT_FIELDS.forEach(field => {
      // Exact match first
      let match = headers.find(h => h.toLowerCase().trim() === field.key.toLowerCase().trim());
      
      // Keyword match
      if (!match) {
        match = headers.find(h => {
          if (usedHeaders.has(h)) return false;
          const lowerH = h.toLowerCase();
          return field.keywords.some(kw => lowerH.includes(kw));
        });
      }

      if (match) {
        newMapping[field.key] = match;
        usedHeaders.add(match);
      } else {
        newMapping[field.key] = '';
      }
    });

    return newMapping;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCsv = selectedFile.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      setError('Please upload a valid Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON, treating first row as headers
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      
      if (jsonData.length === 0) {
        setError('The file appears to be empty.');
        return;
      }

      const headers = Object.keys(jsonData[0] as object);
      setRawHeaders(headers);
      setRawData(jsonData);
      setMapping(autoMapColumns(headers));
      setStep(2); // Go to mapping step
    } catch (err: any) {
      setError(`Error parsing file: ${err.message}`);
    }
  };

  const parseDate = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) {
      if (isValid(val)) return format(val, 'yyyy-MM-dd');
      return null;
    }
    
    const strVal = String(val).trim();
    const d = new Date(strVal);
    if (isValid(d)) return format(d, 'yyyy-MM-dd');

    // Try common formats if standard parsing fails
    const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy', 'MM-dd-yyyy'];
    for (const fmt of formats) {
      const parsed = parse(strVal, fmt, new Date());
      if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd');
    }
    
    return null;
  };

  const processData = () => {
    const errors: string[] = [];
    const processed: any[] = [];
    let validRows = 0;

    // Check if all required fields are mapped
    const unmapped = IMPORT_FIELDS.filter(f => f.required && !mapping[f.key]);
    if (unmapped.length > 0) {
      setError(`Please map all required fields. Missing: ${unmapped.map(f => f.key).join(', ')}`);
      return;
    }

    rawData.forEach((row, index) => {
      const rowNum = index + 2; // +2 because header is row 1, 0-indexed array
      const newRow: any = {};
      let rowValid = true;

      // Process Date
      const dateVal = row[mapping['Date']];
      const parsedDate = parseDate(dateVal);
      if (!parsedDate) {
        errors.push(`Row ${rowNum}: Invalid or missing Date ("${dateVal}")`);
        rowValid = false;
      } else {
        newRow['Date'] = parsedDate;
      }

      // Process Department
      const deptVal = row[mapping['Department']];
      if (!deptVal || String(deptVal).trim() === '') {
        errors.push(`Row ${rowNum}: Department is required`);
        rowValid = false;
      } else {
        newRow['Department'] = String(deptVal).trim();
      }

      // Process Numeric Fields
      const numericFields = [
        'Output Units', 'Labor Hours', 'Energy (kWh)', 
        'Waiting Time (minutes)', 'Downtime (minutes)', 
        'Material Cost (RM)', 'Misc Cost (RM)', 'Unplanned Cost (RM)'
      ];

      numericFields.forEach(field => {
        const rawVal = row[mapping[field]];
        // Remove commas and currency symbols if any, then parse
        const cleanVal = String(rawVal).replace(/[^0-9.-]+/g, "");
        const val = Number(cleanVal);
        
        if (rawVal === '' || rawVal === undefined || rawVal === null) {
          newRow[field] = 0; // Default to 0 for empty numeric fields
        } else if (isNaN(val)) {
          errors.push(`Row ${rowNum}: "${field}" must be a number (got "${rawVal}")`);
          rowValid = false;
        } else if (val < 0) {
          errors.push(`Row ${rowNum}: "${field}" cannot be negative`);
          rowValid = false;
        } else {
          newRow[field] = val;
        }
      });

      if (rowValid) {
        processed.push(newRow);
        validRows++;
      }
    });

    setMappedData(processed);
    setValidationErrors(errors);
    setValidCount(validRows);
    setError(null);
    setStep(3); // Go to preview
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
    
    return { ...data, timeWaste, energyCost, laborCost, totalOperatingCost, wasteIndex };
  };

  const handleImport = async () => {
    if (!user || !settings || mappedData.length === 0) return;
    setIsImporting(true);
    try {
      const recordsCollection = collection(db, 'records');
      
      if (clearExisting) {
        const q = query(recordsCollection, where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const deleteBatch = writeBatch(db);
        snapshot.docs.forEach((document) => {
          deleteBatch.delete(document.ref);
        });
        await deleteBatch.commit();
      }

      // Firestore batches are limited to 500 operations. We should chunk them.
      const chunks = [];
      for (let i = 0; i < mappedData.length; i += 450) {
        chunks.push(mappedData.slice(i, i + 450));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(row => {
          const record: Partial<OperationalRecord> = {
            userId: user.uid,
            date: row['Date'],
            department: row['Department'],
            outputUnits: Number(row['Output Units']),
            laborHours: Number(row['Labor Hours']),
            energyConsumption: Number(row['Energy (kWh)']),
            waitingTime: Number(row['Waiting Time (minutes)']),
            downtime: Number(row['Downtime (minutes)']),
            materialCost: Number(row['Material Cost (RM)']),
            miscCost: Number(row['Misc Cost (RM)']),
            unplannedCost: Number(row['Unplanned Cost (RM)']),
          };
          const finalRecord = calculateWaste(record);
          const newDocRef = doc(recordsCollection);
          batch.set(newDocRef, { ...finalRecord, createdAt: new Date().toISOString() });
        });
        await batch.commit();
      }

      setImportCount(mappedData.length);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onComplete();
      }, 2500);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'records');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Data Import</h1>
        <p className="text-slate-500">Upload any Excel or CSV file. We'll automatically detect and map your columns.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[
          { num: 1, label: 'Upload' },
          { num: 2, label: 'Map Columns' },
          { num: 3, label: 'Preview & Import' }
        ].map((s, i) => (
          <React.Fragment key={s.num}>
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors",
              step === s.num ? "bg-teal-100 text-teal-700" : 
              step > s.num ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-400"
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                step === s.num ? "bg-teal-500 text-white" : 
                step > s.num ? "bg-white/20" : "bg-slate-200"
              )}>
                {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
              </div>
              {s.label}
            </div>
            {i < 2 && <div className={cn("w-8 h-1 rounded-full", step > s.num ? "bg-slate-800" : "bg-slate-100")} />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="upload"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-12 text-center hover:border-teal-400 transition-all group relative overflow-hidden shadow-sm">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
              />
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center group-hover:bg-teal-50 transition-colors">
                  <FileSpreadsheet className="w-10 h-10 text-slate-400 group-hover:text-teal-500 transition-colors" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800 tracking-tight">Upload Excel or CSV file</h3>
                  <p className="text-sm text-slate-400">Drag and drop your file here, or click to browse</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download Template (Optional)
              </button>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-bold">{error}</span>
              </div>
            )}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="mapping"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Settings2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Map Columns</h3>
                    <p className="text-xs text-slate-500">We've auto-detected most columns. Please review and adjust if needed.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setMapping(autoMapColumns(rawHeaders))}
                  className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset Auto-Map
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {IMPORT_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex-1">
                        <span className="text-sm font-bold text-slate-700">{field.key}</span>
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </div>
                      <div className="flex-1">
                        <select
                          value={mapping[field.key] || ''}
                          onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className={cn(
                            "w-full text-sm rounded-lg border p-2.5 outline-none transition-colors",
                            mapping[field.key] 
                              ? "bg-white border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                              : field.required ? "bg-red-50 border-red-200 text-red-700 focus:border-red-500 focus:ring-1 focus:ring-red-500" : "bg-white border-slate-200"
                          )}
                        >
                          <option value="">-- Select Column --</option>
                          {rawHeaders.map(header => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mx-6 mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-bold">{error}</span>
                </div>
              )}

              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 text-slate-500 font-bold text-sm hover:text-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={processData}
                  className="flex items-center gap-2 bg-slate-800 text-white font-bold py-3 px-8 rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-800/20"
                >
                  Process Data
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3 text-red-700">
                  <AlertCircle className="w-6 h-6" />
                  <div>
                    <h3 className="font-bold">Validation Issues Found</h3>
                    <p className="text-sm text-red-600">We found {validationErrors.length} errors. Invalid rows will be skipped during import.</p>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-red-100 p-4 max-h-40 overflow-y-auto">
                  <ul className="space-y-2">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-1 flex-shrink-0" />
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-400 rounded-xl flex items-center justify-center shadow-sm">
                    <Table className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Data Preview</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      <span className="text-teal-600">{validCount} Valid Records</span> ready to import
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setStep(2)}
                  className="p-2 text-slate-300 hover:text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      {IMPORT_FIELDS.map(f => (
                        <th key={f.key} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 whitespace-nowrap">
                          {f.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {mappedData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                        {IMPORT_FIELDS.map(f => (
                          <td key={f.key} className="px-6 py-4 text-xs font-bold text-slate-600 whitespace-nowrap">
                            {row[f.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mappedData.length > 5 && (
                  <div className="p-4 text-center text-xs font-bold text-slate-400 bg-slate-50/30">
                    ... and {mappedData.length - 5} more rows
                  </div>
                )}
                {mappedData.length === 0 && (
                  <div className="p-8 text-center text-sm font-bold text-slate-500">
                    No valid records found to import. Please check your data and mapping.
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50/30 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-8 py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                  Back to Mapping
                </button>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        checked={clearExisting}
                        onChange={(e) => setClearExisting(e.target.checked)}
                        className="w-5 h-5 border-2 border-slate-300 rounded-md appearance-none checked:bg-red-500 checked:border-red-500 transition-colors cursor-pointer peer"
                      />
                      <X className="w-3 h-3 text-white absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 pointer-events-none" />
                    </div>
                    <span className="text-sm font-bold text-slate-600 group-hover:text-slate-800 transition-colors">Clear existing data</span>
                  </label>
                  <button
                    onClick={handleImport}
                    disabled={isImporting || mappedData.length === 0}
                    className="flex items-center gap-3 bg-teal-400 text-white font-bold py-4 px-10 rounded-2xl hover:bg-teal-500 disabled:opacity-50 transition-all shadow-lg shadow-teal-400/20 uppercase text-xs tracking-widest"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        Import {validCount} Records
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSuccess && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm"
        >
          <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl max-w-sm w-full text-center space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Success!</h3>
              <p className="text-slate-500">Data imported successfully. <br/> <span className="font-bold text-green-500">{importCount} records</span> added to your dashboard.</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
