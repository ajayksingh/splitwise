import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
// NetInfo crashes on web at import time (calls addListener on null native module)
// Lazy-require only on native
const NetInfo = Platform.OS !== 'web' ? require('@react-native-community/netinfo').default : null;
import {
  getCurrentUser, loginUser, registerUser, logoutUser,
  getGroups, getFriends, calculateBalances,
  getActivity, seedDemoData, syncFromSupabase,
} from '../services/storage';
import { loadSelectedCurrency, saveSelectedCurrency, detectDefaultCurrency } from '../services/currency';
import { flushQueue, getQueueLength } from '../services/syncService';
import { Analytics, setAnalyticsUser } from '../services/analytics';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const AppContext = createContext({});

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [balances, setBalances] = useState([]);
  const [activity, setActivity] = useState([]);
  const [currency, setCurrencyState] = useState('INR');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Network & sync state
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null); // null | 'offline' | 'syncing' | 'synced' | 'error'
  const [pendingCount, setPendingCount] = useState(0);
  const syncTimeoutRef = useRef(null);

  useEffect(() => {
    seedDemoData();
    loadSelectedCurrency().then(c => setCurrencyState(c));
  }, []);

  useEffect(() => {
    const restore = async () => {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setAnalyticsUser(currentUser.id);
      }
      setLoading(false);
    };
    restore();
  }, []);

  // Supabase auth state listener — handles session expiry and sign-out across devices
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSyncStatus(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Network listener — auto-sync when coming back online
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = async () => {
        setIsOnline(true);
        if (isSupabaseConfigured()) {
          const count = await getQueueLength();
          if (count > 0) triggerSync();
        }
      };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);

      if (online && isSupabaseConfigured()) {
        const count = await getQueueLength();
        if (count > 0) {
          triggerSync();
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    setSyncStatus('syncing');
    try {
      const { synced, failed } = await flushQueue();
      const remaining = await getQueueLength();
      setPendingCount(remaining);

      if (failed > 0) {
        setSyncStatus('error');
        Analytics.syncError(`${failed} items failed`);
        clearSyncStatusAfter(4000);
      } else if (synced > 0) {
        setSyncStatus('synced');
        Analytics.syncCompleted(synced);
        clearSyncStatusAfter(2500);
      } else {
        setSyncStatus(null);
      }
    } catch (e) {
      setSyncStatus('error');
      clearSyncStatusAfter(4000);
    }
  }, []);

  const clearSyncStatusAfter = (ms) => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => setSyncStatus(null), ms);
  };

  // Called after any write operation to show the right banner
  const notifyWrite = useCallback(async (action) => {
    const count = await getQueueLength();
    setPendingCount(count);

    if (!isOnline) {
      setSyncStatus('offline');
      Analytics.offlineSave(action);
    } else if (isSupabaseConfigured()) {
      // Small delay to batch rapid writes
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => triggerSync(), 800);
    }
  }, [isOnline, triggerSync]);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setGroups([]); setFriends([]); setBalances([]); setActivity([]);
    }
  }, [user, refreshTrigger]);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [g, f, b, a] = await Promise.all([
        getGroups(user.id),
        getFriends(user.id),
        calculateBalances(user.id),
        getActivity(user.id),
      ]);
      console.log('[loadData] groups:', g.length, 'user:', user.id);
      setGroups(g); setFriends(f); setBalances(b); setActivity(a);
    } catch (e) {
      console.error('Load data error:', e);
    }
  }, [user]);

  const refresh = useCallback(() => {
    setRefreshTrigger(t => t + 1);
  }, []);

  const syncData = useCallback(async () => {
    if (!user || !isSupabaseConfigured()) return;
    await syncFromSupabase(user.id);
    await loadData();
  }, [user, loadData]);

  const setCurrency = async (code) => {
    setCurrencyState(code);
    await saveSelectedCurrency(code);
    Analytics.changeCurrency(code);
  };

  const login = async (email, password) => {
    const loggedIn = await loginUser({ email, password });
    setUser(loggedIn);
    setAnalyticsUser(loggedIn.id);
    Analytics.login('email');
    return loggedIn;
  };

  const register = async (name, email, password) => {
    const registered = await registerUser({ name, email, password });
    setUser(registered);
    setAnalyticsUser(registered.id);
    Analytics.register('email');
    return registered;
  };

  const logout = async () => {
    Analytics.logout();
    await logoutUser();
    setUser(null);
    setSyncStatus(null);
  };

  const totalBalance = balances.reduce((sum, b) => sum + b.amount, 0);

  return (
    <AppContext.Provider value={{
      user, setUser, loading,
      groups, friends, balances, activity,
      totalBalance, currency, setCurrency,
      login, register, logout,
      refresh, loadData, syncData,
      // Sync & network
      isOnline, syncStatus, pendingCount,
      notifyWrite, triggerSync,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
