import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authEnabled, supabase } from '../lib/supabase';
import { FRONTEND_URL } from '../config/api';
import { clearApiCache } from '../api';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  signInWithEmail: (email: string, password: string) => Promise<unknown>;
  signUpWithEmail: (
    email: string,
    password: string,
    profile?: { full_name?: string; phone?: string; timezone?: string }
  ) => Promise<unknown>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: authEnabled,
  });

  useEffect(() => {
    if (!authEnabled) {
      setState({
        user: null,
        session: null,
        loading: false,
      });
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!active) return;
        if (error) {
          console.error('Session error (e.g. Invalid Refresh Token):', error);
          clearApiCache();
          const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('qk_'));
          keysToRemove.forEach(k => localStorage.removeItem(k));
          sessionStorage.clear();
        }
        setState({
          user: session?.user ?? null,
          session: error ? null : session,
          loading: false,
        });
      })
      .catch(() => {
        if (!active) return;
        setState({
          user: null,
          session: null,
          loading: false,
        });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearApiCache();
        const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('qk_'));
        keysToRemove.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
      }
      setState({
        user: session?.user ?? null,
        session,
        loading: false,
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!authEnabled) {
      throw new Error('Authentication is disabled for this environment.');
    }
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signUpWithEmail = useCallback(async (
    email: string,
    password: string,
    profile?: { full_name?: string; phone?: string; timezone?: string }
  ) => {
    if (!authEnabled) {
      throw new Error('Authentication is disabled for this environment.');
    }
    const dataPayload = profile
      ? Object.fromEntries(
          Object.entries(profile).filter(([, value]) => value && value.toString().trim().length > 0)
        )
      : undefined;
    const redirectBase = FRONTEND_URL || window.location.origin;
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectBase}/auth/callback`,
        data: dataPayload,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    if (!authEnabled) {
      return;
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    }
    // ── Secure session cleanup ──
    clearApiCache();
    const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('qk_'));
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    // Reset auth state immediately
    setState({ user: null, session: null, loading: false });
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    if (!authEnabled) {
      throw new Error('Authentication is disabled for this environment.');
    }
    const redirectBase = FRONTEND_URL || window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const updateUserPassword = useCallback(async (password: string) => {
    if (!authEnabled) {
      throw new Error('Authentication is disabled for this environment.');
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      resetPasswordForEmail,
      updateUserPassword,
    }),
    [
      state,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      resetPasswordForEmail,
      updateUserPassword,
    ],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
