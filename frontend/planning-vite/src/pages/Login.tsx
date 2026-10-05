import type { FormEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/moa planinig logo.png';
import homePic from '../assets/agri3.jpg';
import { getErrorMessage } from '../lib/error';
import { Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      // Redirect to root, App.tsx will handle role-based redirect
      window.location.href = '/';
    } catch (err: any) {
      const msg = err?.userMessage || getErrorMessage(err, 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Demo credentials helper for quick testing
  const fillDemoCredentials = (role: 'admin' | 'user' | 'viewer') => {
    const credentials = {
      admin: { username: 'lead_executive', password: 'demo123' },
      user: { username: 'department_head', password: 'demo123' },
      viewer: { username: 'advisor', password: 'demo123' }
    };
    const cred = credentials[role];
    setUsername(cred.username);
    setPassword(cred.password);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-4 lg:p-12 font-sans selection:bg-emerald-500 selection:text-white">

      {/* ── Keyframe Animations ── */}
      <style>{`
        @keyframes slowZoom {
          0% { transform: scale(1); }
          100% { transform: scale(1.06); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-slow-zoom {
          animation: slowZoom 25s ease-in-out infinite alternate;
        }
        .animate-fade-in-1 {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-2 {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
          opacity: 0;
        }
        .animate-fade-in-3 {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
        }
        .animate-pop-in {
          animation: popIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
          opacity: 0;
        }
      `}</style>

      {/* ── Dynamic Background Image Fill with Subtle Slow Motion Zoom ── */}
      <img
        src={homePic}
        alt="Agriculture Background"
        className="absolute inset-0 w-full h-full object-cover object-center animate-slow-zoom"
      />

      {/* ── Dark Vignette & Gradient Overlay ── */}
      
<div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/65 to-black/75 backdrop-brightness-95" /> want to make green


      {/* ── Dynamic Floating Light Glow Orbs ── */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-1/3 w-80 h-80 bg-teal-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      {/* ── Main Content Grid ── */}
      <div className="relative z-10 max-w-7xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

        {/* =============== LEFT PANEL (Branding & Big Title) =============== */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-8 text-white p-4 lg:p-6">

          {/* Top Logo & Ministry Title */}
          <div className="flex items-center gap-4 animate-fade-in-1">
            <div className="w-16 h-16  transform hover:scale-105 transition-transform duration-300">
              <img
                src={logo}
                alt="Ministry of Agriculture Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-white font-serif text-xl tracking-wider uppercase drop-shadow">
                MINISTRY OF AGRICULTURE
              </h2>
              <p className="text-[#416AE8] text-xs font-semibold tracking-widest uppercase">
                Federal Democratic Republic of Ethiopia
              </p>
            </div>
          </div>

          {/* Big Bold Headline matching the template */}
          <div className="space-y-3 pt-4 animate-fade-in-2">
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-medium text-stone-50 leading-[1.1] tracking-tight max-w-2xl">
              Excellence in{" "}
              <em className="">agricultural planning</em>
            </h1>

            <p className="text-gray-200 text-base sm:text-lg max-w-xl font-medium pt-4 leading-relaxed drop-shadow">
              Where Data-Driven Agricultural Visions Become Reality. Embark on a seamless digital experience across all sectors and departments.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-4">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-md text-white rounded-full text-xs font-bold tracking-wide transition-all hover:bg-white/25">
                {/* <CheckCircle2 className="w-4 h-4 text-emerald-400" /> */}
                Beyond Production!
              </span>
              <span className="inline-flex items-center   gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-md border border-white/20 text-[#B5B818] rounded-full text-xs font-bold tracking-wide transition-all hover:bg-white/25">
                ከማምረት በላይ!
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 font-medium pt-6 animate-fade-in-3">
            MOAMPS Version 2.0 • Digital Transformation Initiative
          </p>
        </div>

        {/* =============== RIGHT PANEL (Frosted Glassmorphism Card with Dynamic Interactions) =============== */}
        <div className="lg:col-span-5 flex justify-center w-full animate-pop-in">
          <div className="w-full max-w-md bg-white/20 backdrop-blur-2xl border border-white/30 rounded-3xl p-8 lg:p-10 shadow-2xl text-white transition-all duration-300 hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]">

            {/* Form Title */}
            <div className="mb-6">
              <h2 className="text-2xl font-black text-white tracking-wide uppercase">
                Welcome Back
              </h2>
              <p className="text-xs text-white/80 font-medium mt-1">
                Please enter your credentials to log in.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/30 backdrop-blur-md border border-red-300/40 rounded-2xl flex items-start gap-3 animate-shake">
                <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                <p className="text-xs font-semibold text-red-100">{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={onSubmit} className="space-y-5">

              {/* Email / Username Field */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white/90 uppercase tracking-wider">
                  Email or Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username or email"
                  className="w-full px-4 py-3.5 bg-white rounded-xl text-gray-900 placeholder:text-gray-400 font-medium text-sm border-0 focus:ring-2 focus:ring-emerald-400 focus:outline-none shadow-lg transition-all"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-white/90 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3.5 pr-12 bg-white rounded-xl text-gray-900 placeholder:text-gray-400 font-medium text-sm border-0 focus:ring-2 focus:ring-emerald-400 focus:outline-none shadow-lg transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="text-right pt-1">
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); alert('Please contact system administrator to reset your password.'); }}
                    className="text-xs text-white/90 hover:text-white underline font-medium transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-white/40 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-xs font-medium text-white/90 cursor-pointer">
                  Remember me on this device
                </label>
              </div>

              {/* Dynamic Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#B5B818] px-6 py-3.5 text-sm font-semibold text-emerald-950 transition-colors duration-200 hover:bg-[#c4c723] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B5B818]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <span>SIGN IN</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                  </>
                )}
              </button>
            </form>

            {/* Separator */}
            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <span className="relative px-4 text-xs font-medium text-white/70 bg-transparent uppercase tracking-wider">
                or
              </span>
            </div>

            {/* Quick Demo Test Buttons */}
            {/* <div className="space-y-2">
              <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider text-center">
                Quick Test Accounts:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('admin')}
                  className="py-1.5 px-2 bg-white/20 hover:bg-white/35 active:scale-95 backdrop-blur-md border border-white/30 text-white rounded-lg text-[11px] font-bold transition-all text-center shadow-sm"
                >
                  Executive
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('user')}
                  className="py-1.5 px-2 bg-white/20 hover:bg-white/35 active:scale-95 backdrop-blur-md border border-white/30 text-white rounded-lg text-[11px] font-bold transition-all text-center shadow-sm"
                >
                  Dept Head
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('viewer')}
                  className="py-1.5 px-2 bg-white/20 hover:bg-white/30 active:scale-95 backdrop-blur-md border border-white/30 text-white rounded-lg text-[11px] font-bold transition-all text-center shadow-sm"
                >
                  Advisor
                </button>
              </div>
            </div> */}

            {/* Footer Notice */}
            <div className="text-center pt-6">
              <p className="text-xs text-white/80 font-medium">
                Need support?{' '}
                <a
                  href="mailto:support@moa.gov.et"
                  className="text-emerald-300 font-bold hover:underline"
                >
                  Contact Administrator
                </a>
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}