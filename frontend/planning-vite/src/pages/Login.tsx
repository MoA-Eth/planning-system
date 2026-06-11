import type { FormEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/moa planinig logo.png'; // Update if needed
import { getErrorMessage } from '../lib/error';

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

  // Demo credentials for testing
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        
        {/* =============== LEFT SIDE - Hero Section =============== */}
        <div className="flex flex-col items-start space-y-6 lg:space-y-8">
          {/* Logo with Enhanced Design */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={logo}
                alt="MoA Logo"
                className="w-20 h-20 lg:w-24 lg:h-24 object-cover rounded-2xl border-4 border-white shadow-2xl ring-4 ring-emerald-100"
              />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-800">Ministry of Agriculture</h1>
              <p className="text-sm text-gray-600">Digital Transformation Initiative</p>
            </div>
          </div>

          {/* Main Heading */}
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Planning & Performance
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                Management System
              </span>
            </h2>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Beyond Production!
              <span className="font-semibold text-emerald-900">ከማምረት በላይ!</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 max-w-xl">
            <p className="text-gray-700 text-lg leading-relaxed">
              A comprehensive digital platform designed to transform agricultural planning, 
              enhance coordination, and drive performance excellence across all levels of 
              the Ministry of Agriculture.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Real-time Monitoring</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Data-driven Decisions</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Secure & Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-sm text-gray-600">Multi-level Coordination</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">24/7</div>
              <div className="text-xs text-gray-500">Accessibility</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">100%</div>
              <div className="text-xs text-gray-500">Transparency</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">Gov</div>
              <div className="text-xs text-gray-500">Approved</div>
            </div>
          </div>
        </div>

        {/* =============== RIGHT SIDE — Login Form =============== */}
        <div className="w-full">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
            {/* Form Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6">
              <h2 className="text-2xl font-bold text-white text-center">
                Welcome Back
              </h2>
              <p className="text-emerald-100 text-center text-sm mt-1">
                Sign in to continue to your dashboard
              </p>
            </div>

            {/* Demo Credentials Section
            <div className="px-8 pt-6">
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Quick test (demo credentials):</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials('admin')}
                    className="px-3 py-1.5 text-xs bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                  >
                    Lead Executive
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials('user')}
                    className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    Department Head
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoCredentials('viewer')}
                    className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                  >
                    Advisor
                  </button>
                </div>
              </div>
            </div> */}

            {/* Form Content */}
            <div className="px-8 py-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-5">
                {/* Username Field */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl shadow-sm 
                                focus:outline-none focus:ring-2 focus:ring-emerald-500 
                                focus:border-transparent transition-all"
                      placeholder="Enter your username"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-emerald-600 hover:text-emerald-800"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl shadow-sm 
                                focus:outline-none focus:ring-2 focus:ring-emerald-500 
                                focus:border-transparent transition-all"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-600">Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="text-sm text-emerald-600 hover:text-emerald-800"
                    onClick={() => {/* Add forgot password logic */}}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white 
                           font-semibold rounded-xl py-3.5 hover:from-emerald-700 hover:to-teal-700 
                           transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      Sign in to Dashboard
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  )}
                </button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Need help?</span>
                  </div>
                </div>

                {/* Support Info */}
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Contact system administrator at{' '}
                    <a href="mailto:support@moa.gov.et" className="text-emerald-600 hover:text-emerald-800">
                      support@moa.gov.et
                    </a>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Version 2.0.1 • Last updated: December 2024
                  </p>
                </div>
              </form>
            </div>

            {/* Form Footer */}
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
              <div className="text-center">
                <p className="text-xs text-gray-600">
                  By signing in, you agree to our{' '}
                  <a href="#" className="text-emerald-600 hover:text-emerald-800">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-emerald-600 hover:text-emerald-800">
                    Privacy Policy
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <a href="#" className="text-xs text-gray-500 hover:text-emerald-600">
              User Guide
            </a>
            <span className="text-gray-300">•</span>
            <a href="#" className="text-xs text-gray-500 hover:text-emerald-600">
              System Requirements
            </a>
            <span className="text-gray-300">•</span>
            <a href="#" className="text-xs text-gray-500 hover:text-emerald-600">
              Training Materials
            </a>
            <span className="text-gray-300">•</span>
            <a href="#" className="text-xs text-gray-500 hover:text-emerald-600">
              Report Issue
            </a>
          </div>
        </div>
      </div>

      {/* Background Decorations */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute top-1/3 right-1/3 w-48 h-48 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-500"></div>
      </div>
    </div>
  );
}