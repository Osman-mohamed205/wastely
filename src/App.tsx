import React, { useState, useEffect, createContext, useContext, Component, ErrorInfo, ReactNode } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { UserSettings, OperationalRecord, View, Optimization } from './types';
import Dashboard from './components/Dashboard';
import DataInput from './components/DataInput';
import CSVImport from './components/CSVImport';
import Settings from './components/Settings';
import Profile from './components/Profile';
import DepartmentManagement from './components/DepartmentManagement';
import WasteReports from './components/WasteReports';
import Analytics from './components/Analytics';
import Forecasting from './components/Forecasting';
import { LayoutDashboard, FileInput, Settings as SettingsIcon, BarChart3, Menu, FileText, User as UserIcon, Building2, Crosshair, AlertCircle, RefreshCw, CheckCircle2, X } from './lib/icons';
import { cn } from './lib/utils';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

// Error Boundary for UI resilience
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('View rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-xl mx-auto my-12 text-center border border-red-100 dark:border-red-900/30 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">View Temporary Interruption</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
            A temporary calculation error occurred. Click below to return to the main dashboard.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.dispatchEvent(new CustomEvent('navigate', { detail: 'dashboard' }));
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white font-bold text-xs rounded-xl shadow-md hover:bg-teal-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface AuthContextType {
  user: any | null;
  settings: UserSettings | null;
  loading: boolean;
  activeOptimization: Optimization | null;
  setActiveOptimization: (opt: Optimization | null) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  updateWorkspaceProfile: (name: string, email: string) => Promise<void>;
  loginUser?: (user: any) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  settings: null, 
  loading: true,
  activeOptimization: null,
  setActiveOptimization: () => {},
  updateSettings: async () => {},
  updateWorkspaceProfile: async () => {}
});

export const useAuth = () => useContext(AuthContext);

const AVAILABLE_VIEWS: View[] = ['dashboard', 'input', 'analytics', 'reports', 'settings', 'profile', 'departments', 'forecasting'];
const isAvailableView = (view: string): view is View => AVAILABLE_VIEWS.includes(view as View);

// Default Company Workspace profile for instant direct entry
const DEFAULT_COMPANY_WORKSPACE = {
  uid: 'Zqp4zpgJeLVPkgYJeVAHenJmENk1',
  email: 'owisebrahim8@gmail.com',
  displayName: 'OWIS EBRAHIM',
  metadata: {
    creationTime: '2026-04-01T00:00:00.000Z'
  }
};

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const [user, setUser] = useState<any | null>(DEFAULT_COMPANY_WORKSPACE);
  const [settings, setSettings] = useState<UserSettings | null>({
    email: 'owisebrahim8@gmail.com',
    workspaceName: 'OWIS EBRAHIM',
    energyTariff: 0.55,
    laborRate: 12,
    machineRate: 25,
    targetWasteIndex: 5,
    industry: 'Manufacturing'
  });
  const [loading, setLoading] = useState(false);
  const [activeOptimization, setActiveOptimization] = useState<Optimization | null>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'manual' | 'excel'>('manual');
  const theme = settings?.theme || 'light';

  // Clear legacy mock-user that previously caused permission errors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('wastely_user');
        if (stored && stored.includes('mock-google-user')) {
          localStorage.removeItem('wastely_user');
        }
        const cachedSettings = localStorage.getItem('wastely_settings');
        if (cachedSettings) {
          const parsed = JSON.parse(cachedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      } catch (err) {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-blue', 'theme-burgundy');
    if (theme === 'dark') root.classList.add('dark');
    if (theme === 'blue') root.classList.add('theme-blue');
    if (theme === 'burgundy') root.classList.add('theme-burgundy');
    root.dataset.theme = theme;
  }, [theme]);

  // Auth listener: Direct Instant Entry
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser({
          ...u,
          displayName: u.displayName || settings?.workspaceName || 'OWIS EBRAHIM',
          email: u.email || settings?.email || 'owisebrahim8@gmail.com',
          metadata: u.metadata?.creationTime ? u.metadata : { creationTime: '2026-04-01T00:00:00.000Z' }
        });
      } else {
        // Fallback directly to the company workspace without any login wall
        setUser(DEFAULT_COMPANY_WORKSPACE);
        import('firebase/auth').then(({ signInAnonymously }) => {
          signInAnonymously(auth).catch(() => {
            // Anonymous auth disabled or restricted; direct company workspace continues seamlessly
          });
        });
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const loginUser = (userObj: any) => {
    if (userObj && userObj.uid !== 'mock-google-user') {
      setUser(userObj);
    }
  };

  // Sync settings with Firestore with defensive fallback
  useEffect(() => {
    if (!user) return;

    const defaultSettings: UserSettings = {
      email: user.email || 'owisebrahim8@gmail.com',
      workspaceName: user.displayName || 'OWIS EBRAHIM',
      energyTariff: 0.55,
      laborRate: 12,
      machineRate: 25,
      targetWasteIndex: 5,
      industry: 'Manufacturing'
    };

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeSettings = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserSettings;
        setSettings({
          ...defaultSettings,
          ...data
        });
      } else {
        // Write default initial configuration to Firestore
        setDoc(userDocRef, defaultSettings, { merge: true }).catch((err) => {
          console.warn("Could not save initial user settings to Firestore (using memory):", err);
        });
        setSettings(defaultSettings);
      }
      setLoading(false);
    }, (error) => {
      console.warn("Firestore settings subscription notice (using local default):", error);
      setSettings(defaultSettings);
      setLoading(false);
    });

    return () => unsubscribeSettings();
  }, [user?.uid]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    const merged = { ...settings, ...newSettings } as UserSettings;
    setSettings(merged);
    try {
      localStorage.setItem('wastely_settings', JSON.stringify(merged));
    } catch (e) {
      // ignore
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, merged, { merge: true });
    } catch (error) {
      console.warn("Could not update settings in Firestore:", error);
    }
  };

  const updateWorkspaceProfile = async (name: string, email: string) => {
    await updateSettings({ workspaceName: name, email });
    setUser((prev: any) => prev ? { ...prev, displayName: name, email } : prev);
  };

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const { detail } = e as CustomEvent;
      if (typeof detail === 'string') {
        if (isAvailableView(detail)) setCurrentView(detail);
      } else if (detail && typeof detail === 'object') {
        const destination = detail as { view?: View; inputMode?: 'manual' | 'excel' };
        if (destination.view && isAvailableView(destination.view)) setCurrentView(destination.view);
        if (destination.inputMode) setInputMode(destination.inputMode);
      }
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isSidebarOpen]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'input', label: 'Data Input', icon: FileInput },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'reports', label: 'Waste Reports', icon: FileText },
    { id: 'forecasting', label: 'Forecasting', icon: Crosshair },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'profile', label: 'Workspace Info', icon: UserIcon },
  ];

  return (
    <AuthContext.Provider value={{ 
      user, 
      settings, 
      loading, 
      activeOptimization, 
      setActiveOptimization, 
      updateSettings, 
      updateWorkspaceProfile, 
      loginUser 
    }}>
      {loading ? (
        <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-900 sm:p-8" role="status" aria-label="Loading workspace">
          <div className="mx-auto max-w-screen-2xl animate-pulse space-y-8">
            <div className="h-12 w-56 rounded-xl bg-slate-200 dark:bg-slate-700" />
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-44 rounded-2xl bg-white dark:bg-slate-800" />
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-72 rounded-2xl bg-white dark:bg-slate-800" />
              <div className="h-72 rounded-2xl bg-white dark:bg-slate-800" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-dvh min-w-0 overflow-hidden bg-slate-50 font-sans selection:bg-teal-100 selection:text-teal-900 dark:bg-slate-900">
        <a className="skip-link" href="#app-content">Skip to content</a>

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-700 dark:bg-slate-800 lg:static lg:inset-0 lg:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center gap-3 px-5 py-5 sm:px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white">
              <BarChart3 aria-hidden="true" className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Wastely</span>
          </div>

          <nav id="main-navigation" aria-label="Main navigation" className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-3">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id as View);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                "group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800",
                currentView === item.id
                  ? "bg-teal-50 text-teal-900 dark:bg-teal-900/30 dark:text-teal-100"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                )}
                aria-current={currentView === item.id ? 'page' : undefined}
              >
                <item.icon aria-hidden="true" className={cn("h-5 w-5 shrink-0", currentView === item.id ? "text-teal-700 dark:text-teal-300" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200")} />
                <span className="title-4">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar Footer Card */}
          <div className="p-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Workspace rates</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Cost estimates use the rates saved in settings.</p>
            </div>
          </div>
        </aside>

        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden dark:bg-slate-900">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/90 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:min-h-20 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={isSidebarOpen}
                aria-controls="main-navigation"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              >
                {isSidebarOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <div className="hidden items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 sm:flex">
                <span>Pages</span>
                <span>/</span>
                <span className="truncate text-slate-800 dark:text-slate-200">{navItems.find(i => i.id === currentView)?.label}</span>
                </div>
                <h2 className="heading-6 truncate text-slate-900 dark:text-white">{navItems.find(i => i.id === currentView)?.label}</h2>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <button 
                onClick={() => setCurrentView('profile')}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-700 transition-colors hover:border-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:px-3"
                title="View Company Workspace"
                >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="hidden max-w-36 truncate text-sm font-medium md:inline">{settings?.workspaceName || user?.displayName || 'OWIS EBRAHIM'}</span>
                <span className="text-xs font-medium text-teal-700 dark:text-teal-300">Workspace</span>
                </button>
                <button 
                onClick={() => setCurrentView('settings')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                title="Operational Settings"
                aria-label="Operational settings"
                >
                <SettingsIcon aria-hidden="true" className="h-5 w-5" />
                </button>
            </div>
          </header>

          {/* Page Content */}
          <main id="app-content" tabIndex={-1} className="custom-scrollbar min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            <ViewErrorBoundary>
              <AnimatePresence mode="wait">
                <motion.div
                key={currentView}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={prefersReducedMotion ? { duration: 0.2 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  {currentView === 'dashboard' && <Dashboard />}
                  {currentView === 'input' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                      <div className="flex items-center justify-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit mx-auto border border-slate-200 dark:border-slate-700">
                        <button 
                          type="button"
                          onClick={() => setInputMode('manual')}
                          aria-pressed={inputMode === 'manual'}
                          className={cn(
                            "min-h-11 rounded-xl px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                            inputMode === 'manual' ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          )}
                        >
                          Manual Entry
                        </button>
                        <button 
                          type="button"
                          onClick={() => setInputMode('excel')}
                          aria-pressed={inputMode === 'excel'}
                          className={cn(
                            "min-h-11 rounded-xl px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                            inputMode === 'excel' ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          )}
                        >
                          Excel Import
                        </button>
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={inputMode}
                          initial={{ opacity: 0, x: inputMode === 'manual' ? -20 : 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: inputMode === 'manual' ? 20 : -20 }}
                          transition={{ duration: 0.2 }}
                        >
                          {inputMode === 'manual' ? (
                            <DataInput onComplete={() => setCurrentView('dashboard')} />
                          ) : (
                            <CSVImport onComplete={() => setCurrentView('dashboard')} />
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  )}
                  {currentView === 'analytics' && <Analytics />} 
                  {currentView === 'reports' && <WasteReports />} 
                  {currentView === 'forecasting' && <Forecasting />}
                  {currentView === 'settings' && <Settings />}
                  {currentView === 'profile' && <Profile />}
                  {currentView === 'departments' && <DepartmentManagement />}
                </motion.div>
              </AnimatePresence>
            </ViewErrorBoundary>
          </main>
        </div>
      </div>
      )}
    </AuthContext.Provider>
  );
}
