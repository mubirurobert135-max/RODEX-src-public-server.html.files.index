import React, { useState } from 'react';
import {
  X,
  User,
  Lock,
  Mail,
  Shield,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { globalAuthClient, AuthenticatedUser } from '../services/authClient';
import { signInWithGoogle } from '../services/firebase';
import { triggerHaptic } from '../utils/haptics';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: AuthenticatedUser) => void;
  initialTab?: 'signin' | 'register' | 'recover';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'signin',
}) => {
  const [tab, setTab] = useState<'signin' | 'register' | 'recover'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  
  // Register fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('What is your primary AI project?');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Recover fields
  const [recoverIdentifier, setRecoverIdentifier] = useState('');
  const [recoverAnswer, setRecoverAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setLoading(true);
    triggerHaptic('tap');

    try {
      const user = await globalAuthClient.login(identifier, password);
      triggerHaptic('success');
      setSuccessNotice(`Welcome back, ${user.displayName}!`);
      setTimeout(() => {
        onSuccess?.(user);
        onClose();
      }, 500);
    } catch (err: any) {
      triggerHaptic('error');
      setError(err?.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setLoading(true);
    triggerHaptic('tap');

    try {
      const user = await globalAuthClient.register({
        username,
        email,
        displayName,
        password,
        securityQuestion,
        securityAnswer,
        preferredName: preferredName || displayName,
      });
      triggerHaptic('success');
      setSuccessNotice(`Account created successfully! Welcome, ${user.displayName}!`);
      setTimeout(() => {
        onSuccess?.(user);
        onClose();
      }, 600);
    } catch (err: any) {
      triggerHaptic('error');
      setError(err?.message || 'Failed to register account.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setLoading(true);
    triggerHaptic('tap');

    try {
      const result = await globalAuthClient.recoverPassword({
        identifier: recoverIdentifier,
        securityAnswer: recoverAnswer,
        newPassword,
      });
      triggerHaptic('success');
      setSuccessNotice(result.message || 'Password successfully reset! You can now sign in.');
      setTab('signin');
      setIdentifier(recoverIdentifier);
      setPassword('');
    } catch (err: any) {
      triggerHaptic('error');
      setError(err?.message || 'Password recovery failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span>RODEX Account & Security</span>
              </h2>
              <p className="text-xs text-neutral-400">Multi-user isolated sessions & identity</p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('tap');
              onClose();
            }}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex p-1.5 bg-neutral-900/80 border-b border-neutral-800 text-xs font-medium">
          <button
            onClick={() => {
              setTab('signin');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-center transition-all ${
              tab === 'signin'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-center transition-all ${
              tab === 'register'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Create Account
          </button>
          <button
            onClick={() => {
              setTab('recover');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg text-center transition-all ${
              tab === 'recover'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Recover Access
          </button>
        </div>

        {/* Form Container */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Feedback Notices */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* 1. Sign In Tab */}
          {tab === 'signin' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const fbUser = await signInWithGoogle();
                    if (fbUser) {
                      triggerHaptic('success');
                      setSuccessNotice(`Welcome back, ${fbUser.displayName || 'User'}!`);
                      const syncUser = globalAuthClient.setFirebaseUser(fbUser);
                      setTimeout(() => {
                        onSuccess?.(syncUser);
                        onClose();
                      }, 500);
                    }
                  } catch (err: any) {
                    setError(err?.message || 'Google sign-in cancelled or failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-cyan-500/50 text-white font-medium text-xs rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-95 shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google / Firebase</span>
              </button>

              <div className="flex items-center gap-2 my-2 text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                <div className="flex-1 h-px bg-neutral-800" />
                <span>or email & password</span>
                <div className="flex-1 h-px bg-neutral-800" />
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="robert or robert@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Default account: robert / robert123</span>
                <button
                  type="button"
                  onClick={() => setTab('recover')}
                  className="text-cyan-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to RODEX</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
          )}

          {/* 2. Create Account Tab */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alice Walker"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="alice"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    Preferred Name
                  </label>
                  <input
                    type="text"
                    value={preferredName}
                    onChange={(e) => setPreferredName(e.target.value)}
                    placeholder="Alice"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alice@example.com"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Password (min 6 chars)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Security Question (for recovery)
                </label>
                <input
                  type="text"
                  required
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  placeholder="e.g. What is your favorite city?"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60 mb-1.5"
                />
                <input
                  type="text"
                  required
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="Security Answer"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 mt-2"
              >
                {loading ? (
                  <span>Registering...</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Create My RODEX Account</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 3. Account Recovery Tab */}
          {tab === 'recover' && (
            <form onSubmit={handleRecover} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Account Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={recoverIdentifier}
                    onChange={(e) => setRecoverIdentifier(e.target.value)}
                    placeholder="Username or email"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Security Answer
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={recoverAnswer}
                    onChange={(e) => setRecoverAnswer(e.target.value)}
                    placeholder="Enter the answer to your security question"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
              >
                {loading ? (
                  <span>Resetting Password...</span>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Reset Password & Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
