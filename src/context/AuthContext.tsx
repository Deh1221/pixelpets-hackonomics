import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  hasProfile: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loginAsGuest: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      const newUser = session?.user ?? null;

      // Only set loading if the user has actually changed (login/logout/switch)
      // This prevents "flicker/reload" when Supabase auto-refreshes token on window focus
      if (newUser?.id !== user?.id) {
        setUser(newUser);
        if (newUser) {
          setLoading(true);
          checkProfile(newUser.id);
        } else {
          setHasProfile(false);
          setLoading(false);
        }
      } else {
        // Same user, just session refresh. Update session but don't toggle loading.
        // Maybe refresh profile silently?
        setUser(newUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    // Check if guest mode was active
    const guestActive = localStorage.getItem('pixelpets_guest_active');
    if (guestActive === 'true') {
      setIsGuest(true);
      // Create mock user
      setUser({ id: 'guest_user', email: 'guest@pixelpets.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), aud: 'authenticated', role: 'authenticated' });
      setHasProfile(true); // Guests always have a "profile"
      setLoading(false);
      return;
    }

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);

    if (session?.user) {
      await checkProfile(session.user.id);
    } else {
      setLoading(false);
    }
  };

  const checkProfile = async (userId: string) => {
    try {
      if (!navigator.onLine) {
        const cachedHasProfile = localStorage.getItem(`pixelpets_has_profile_${userId}`);
        // If we don't know, assume true if we have a user session, to unblock them
        setHasProfile(cachedHasProfile === 'true' || cachedHasProfile === null);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      const hasProf = !!data;
      setHasProfile(hasProf);
      localStorage.setItem(`pixelpets_has_profile_${userId}`, hasProf.toString());
    } catch (e) {
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await checkProfile(user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, username?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (!error && data.user && username) {
      // Create profile entry
      try {
        await supabase.from('profiles').insert({
          user_id: data.user.id,
          username,
          show_on_leaderboard: true
        });
        setHasProfile(true);
      } catch (err) {
        console.error("Error creating profile:", err);
      }
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (isGuest) {
      setIsGuest(false);
      setUser(null);
      setHasProfile(false);
      localStorage.removeItem('pixelpets_guest_active');
    } else {
      await supabase.auth.signOut();
      setHasProfile(false);
    }
  };

  const loginAsGuest = () => {
    // Clear all previous guest data so guest mode resets every time
    localStorage.removeItem('pixelpets_guest_pets');
    localStorage.removeItem('pixelpets_guest_balance');
    localStorage.removeItem('pixelpets_guest_achievements');
    localStorage.removeItem('pixelpets_guest_streak');
    localStorage.removeItem('pixelpets_guest_expenses');
    localStorage.removeItem('pixelpets_guest_total_tasks');

    localStorage.setItem('pixelpets_guest_active', 'true');
    setIsGuest(true);
    setUser({ id: 'guest_user', email: 'guest@pixelpets.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(), aud: 'authenticated', role: 'authenticated' });
    setHasProfile(true);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isGuest, hasProfile, signIn, signUp, signOut, loginAsGuest, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
