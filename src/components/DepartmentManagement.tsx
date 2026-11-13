import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Department } from '../types';
import { Plus, Trash2, Edit2, Save, X, Building2, Loader2, AlertCircle } from '../lib/icons';
import { motion, AnimatePresence } from 'motion/react';

export default function DepartmentManagement() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'departments'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const depts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Department[];
      setDepartments(depts.sort((a, b) => a.name.localeCompare(b.name)));
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'departments');
    });

    return () => unsubscribe();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newDeptName.trim()) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'departments'), {
        userId: user.uid,
        name: newDeptName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewDeptName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'departments');
    } finally {
      setIsSaving(false);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'departments', id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'departments');
    }
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditName(dept.name);
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    
    try {
      await updateDoc(doc(db, 'departments', id), {
        name: editName.trim()
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'departments');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-navy-900">Department Management</h1>
        <p className="text-slate-500">Add or manage business departments for operational tracking.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Department Form */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-6">
            <h2 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-green-500" />
              Add New Department
            </h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Department Name</label>
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Logistics, Quality Control"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-navy-900 outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSaving || !newDeptName.trim()}
                className="w-full bg-navy-900 text-white font-bold py-3 rounded-xl hover:bg-navy-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Add Department
              </button>
            </form>
          </div>
        </div>

        {/* Department List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-navy-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-navy-900" />
                Active Departments
              </h2>
              <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full">
                {departments.length} Total
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="font-medium">Loading departments...</p>
                </div>
              ) : departments.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-600">No departments found</p>
                    <p className="text-sm">Add your first department to start tracking data.</p>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {departments.map((dept) => (
                    <motion.div
                      key={dept.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                    >
                      {editingId === dept.id ? (
                        <div className="flex-1 flex items-center gap-3 pr-4">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-navy-900 outline-none text-sm font-medium"
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdate(dept.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Save"
                          >
                            <Save className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-navy-50 flex items-center justify-center text-navy-900 font-bold">
                              {dept.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-navy-900">{dept.name}</p>
                              <p className="text-xs text-slate-400">Created {new Date(dept.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 transition-opacity">
                            {deleteConfirmId === dept.id ? (
                              <div className="flex items-center gap-2 bg-red-50 p-1.5 rounded-xl border border-red-100">
                                <span className="text-[10px] font-bold text-red-600">Delete?</span>
                                <button
                                  onClick={() => handleDelete(dept.id)}
                                  className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded hover:bg-red-700"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-300"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(dept)}
                                  className="p-2 text-slate-400 hover:bg-slate-100 hover:text-navy-900 rounded-lg transition-all"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(dept.id)}
                                  className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> Departments help you categorize your operational data. You can see specific waste metrics for each department in the dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
