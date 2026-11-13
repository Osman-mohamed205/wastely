import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, Mail, Lock, Chrome, LayoutDashboard, User as UserIcon, LogIn, UserPlus, Loader2, AlertCircle, CheckCircle2 } from '../lib/icons';
import { cn } from '../lib/utils';
import { useAuth } from '../App';

export default function Login() {
  const { loginUser } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  const isFormValid = useMemo(() => {
    if (isRegistering) {
      return name.trim() !== '' && isEmailValid && password.length >= 6;
    }
    return isEmailValid && password.length > 0;
  }, [isRegistering, name, email, password, isEmailValid]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setTimeout(() => {
      if (loginUser) {
         loginUser({ uid: 'company-workspace', email: 'workspace@wastely.app', displayName: 'Company Workspace' });
      }
    }, 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (loginUser) {
         loginUser({ uid: 'company-workspace', email: email || 'workspace@wastely.app', displayName: name || 'Company Workspace' });
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg border border-white/30">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Wastely</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <button className="flex items-center gap-2 text-sm font-bold text-white/90 hover:text-white transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            DASHBOARD
          </button>
          <button className="flex items-center gap-2 text-sm font-bold text-white/90 hover:text-white transition-colors">
            <UserIcon className="w-4 h-4" />
            PROFILE
          </button>
          <button 
            onClick={() => setIsRegistering(false)}
            className={cn(
              "flex items-center gap-2 text-sm font-bold transition-colors",
              !isRegistering ? "text-white" : "text-white/70 hover:text-white"
            )}
          >
            <LogIn className="w-4 h-4" />
            SIGN IN
          </button>
          <button 
            onClick={() => setIsRegistering(true)}
            className={cn(
              "flex items-center gap-2 text-sm font-bold transition-colors",
              isRegistering ? "text-white" : "text-white/70 hover:text-white"
            )}
          >
            <UserPlus className="w-4 h-4" />
            SIGN UP
          </button>
        </div>

        <button className="bg-white text-teal-600 px-6 py-2.5 rounded-full text-xs font-black shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wider">
          Free Download
        </button>
      </nav>

      {/* Hero Section with Gradient & Wave */}
      <div className="relative h-[450px] bg-teal-700 overflow-hidden flex flex-col items-center justify-center pt-20">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <path 
              fill="white" 
              fillOpacity="1" 
              d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,197.3C1248,213,1344,203,1392,197.3L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center px-4"
        >
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            {isRegistering ? 'Join Wastely' : 'Welcome Back'}
          </h2>
          <p className="text-white/80 max-w-md mx-auto font-medium leading-relaxed">
            {isRegistering 
              ? 'Create your account to start identifying and reducing operational waste.' 
              : 'Sign in to access your Wastely dashboard and monitor operational efficiency.'}
          </p>
        </motion.div>
      </div>

      {/* Login Card */}
      <div className="relative -mt-32 px-4 pb-20">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="max-w-[450px] mx-auto bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl shadow-teal-900/10 border border-white p-10"
        >
          <div className="mb-6 p-4 bg-teal-50 border border-teal-100 rounded-2xl">
            <p className="text-sm font-bold text-teal-800 leading-snug">
              {isRegistering 
                ? "Fill in your details (name, email, and password) below to create your new account."
                : "If you do not have an account, click 'Sign Up' below and fill in your details to create a new account."}
            </p>
          </div>

          <h3 className="text-2xl font-black text-slate-800 text-center mb-8">
            {isRegistering ? 'Register' : 'Sign in'}
          </h3>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-bold">{error}</p>
              </motion.div>
            )}
            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-600"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-xs font-bold">{success}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegistering && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Name</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(
                      "w-full pl-12 pr-4 py-3.5 bg-white border rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 text-slate-700 font-medium",
                      isRegistering && name.trim() === '' && name.length > 0 ? "border-red-300" : "border-slate-200"
                    )}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Email</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input 
                  type="email" 
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "w-full pl-12 pr-4 py-3.5 bg-white border rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 text-slate-700 font-medium",
                    email.length > 0 && !isEmailValid ? "border-red-300" : "border-slate-200"
                  )}
                  required
                />
              </div>
              {email.length > 0 && !isEmailValid && (
                <p className="text-[10px] font-bold text-red-500 ml-1">Please enter a valid email address</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type="password" 
                  placeholder={isRegistering ? "Min 6 characters" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "w-full pl-12 pr-4 py-3.5 bg-white border rounded-2xl outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 text-slate-700 font-medium",
                    password.length > 0 && isRegistering && password.length < 6 ? "border-red-300" : "border-slate-200"
                  )}
                  required
                />
              </div>
              {password.length > 0 && isRegistering && password.length < 6 && (
                <p className="text-[10px] font-bold text-red-500 ml-1">Password must be at least 6 characters</p>
              )}
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className={cn(
                    "w-11 h-6 rounded-full transition-colors duration-200 ease-in-out",
                    rememberMe ? "bg-teal-500" : "bg-slate-200"
                  )}></div>
                  <div className={cn(
                    "absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm",
                    rememberMe ? "translate-x-5" : "translate-x-0"
                  )}></div>
                </div>
                <span className="text-sm font-bold text-slate-600 group-hover:text-slate-800 transition-colors">Remember me</span>
              </label>
            </div>

            <button 
              type="submit"
              disabled={!isFormValid || loading}
              className={cn(
                "w-full text-white font-black py-4 rounded-2xl shadow-lg transition-all active:translate-y-0 uppercase tracking-widest text-sm flex items-center justify-center gap-2",
                isFormValid && !loading 
                  ? "bg-teal-400 hover:bg-teal-500 shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5" 
                  : "bg-slate-300 cursor-not-allowed shadow-none"
              )}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                isRegistering ? 'Sign Up' : 'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm font-bold text-slate-500">
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button 
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                  setSuccess(null);
                }}
                className="text-teal-500 hover:text-teal-600 transition-colors font-black"
              >
                {isRegistering ? 'Sign in' : 'Sign up'}
              </button>
            </p>
          </div>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex items-center justify-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-bold text-slate-700 text-sm shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-50"
            >
              <Chrome className="w-5 h-5 text-teal-500" />
              Sign in with Google
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer Info */}
      <footer className="text-center pb-10">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">
          © 2026 Wastely SaaS Analytics • Professional SME Solutions
        </p>
      </footer>
    </div>
  );
}
