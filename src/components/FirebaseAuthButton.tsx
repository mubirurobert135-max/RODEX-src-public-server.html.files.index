import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon, Cloud, ShieldCheck } from 'lucide-react';
import { auth, signInWithGoogle, signOutUser, subscribeToAuthChanges } from '../services/firebase';
import { triggerHaptic } from '../utils/haptics';

export const FirebaseAuthButton: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    triggerHaptic('tap');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.warn('Google Sign-in aborted or failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    triggerHaptic('tap');
    setDropdownOpen(false);
    await signOutUser();
  };

  if (!user) {
    return (
      <button
        id="firebase-google-signin-btn"
        onClick={handleSignIn}
        disabled={loading}
        title="Sign in with Google to sync Firestore & creations"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-300 text-[11px] font-medium transition-all active:scale-95 shadow-sm shadow-cyan-950/40"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{loading ? 'Signing in...' : 'Sign in'}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        id="firebase-user-avatar-btn"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-1.5 p-1 pr-2 rounded-full bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 transition-all active:scale-95"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-5 h-5 rounded-full object-cover border border-cyan-400/60"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-300 flex items-center justify-center text-[10px] font-bold">
            {user.displayName?.[0] || 'U'}
          </div>
        )}
        <span className="text-[11px] font-medium text-neutral-200 truncate max-w-[80px]">
          {user.displayName?.split(' ')[0] || 'Account'}
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 p-3 rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl z-50 space-y-2">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-900">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full object-cover border border-cyan-400"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-cyan-950 text-cyan-300 flex items-center justify-center text-xs font-bold">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.displayName || 'Robert'}</p>
              <p className="text-[10px] text-neutral-400 truncate">{user.email}</p>
            </div>
          </div>

          <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 py-1">
            <Cloud className="w-3.5 h-3.5" />
            <span>Firestore Database Connected</span>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-1.5 px-2.5 rounded-xl bg-neutral-900 hover:bg-red-950/80 text-neutral-300 hover:text-red-300 text-xs flex items-center justify-center gap-1.5 transition-colors border border-neutral-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
};
