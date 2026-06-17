import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  getSystemConfig,
  getSystemStatus,
  getUsage,
  getSettings,
  getNotifications,
  listDocuments,
  updateSettings
} from '../api';
import type {
  SystemConfig,
  SystemStatus,
  UsageResponse,
  Settings,
  NotificationsResponse,
  DocumentMetadata
} from '../types';
import { useAuth } from './useAuth';
import { useUsageStore } from '../services/usage';

export interface AppDataContextType {
  systemConfig: SystemConfig | null;
  status: SystemStatus | null;
  usage: UsageResponse | null;
  settings: Settings | null;
  notifications: NotificationsResponse | null;
  documents: DocumentMetadata[];
  loading: boolean;
  error: string | null;
  refreshConfig: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  refreshAll: () => Promise<void>;
  updateSettingsInContext: (newSettings: Settings) => Promise<Settings>;
  decrementUsage: () => void;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notifications, setNotifications] = useState<NotificationsResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFetchPromise = useRef<Promise<void> | null>(null);
  const tier2Timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshConfig = useCallback(async () => {
    try {
      const data = await getSystemConfig();
      setSystemConfig(data);
    } catch (err: any) {
      console.error('Failed to refresh system config:', err);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getSystemStatus();
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to refresh status:', err);
    }
  }, []);

  const refreshUsage = useCallback(async () => {
    try {
      const data = await getUsage();
      setUsage(data);
      // Hydrate Zustand store
      useUsageStore.setState({ data, lastFetchedAt: Date.now() });
    } catch (err: any) {
      console.error('Failed to refresh usage:', err);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (err: any) {
      console.error('Failed to refresh settings:', err);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err: any) {
      console.error('Failed to refresh notifications:', err);
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    try {
      const data = await listDocuments();
      setDocuments(data);
    } catch (err: any) {
      console.error('Failed to refresh documents:', err);
    }
  }, []);

  // Fetch Tier 1 immediately and Tier 2 after 200ms delay to prevent saturating connections
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Tier 1: config, status, usage
      await Promise.all([
        getSystemConfig().then(setSystemConfig).catch(e => console.error(e)),
        getSystemStatus().then(setStatus).catch(e => console.error(e)),
        getUsage().then(u => {
          setUsage(u);
          useUsageStore.setState({ data: u, lastFetchedAt: Date.now() });
        }).catch(e => console.error(e))
      ]);

      // Tier 2: settings, notifications, documents
      if (tier2Timer.current) clearTimeout(tier2Timer.current);
      tier2Timer.current = setTimeout(() => {
        void Promise.all([
          getSettings().then(setSettings).catch(e => console.error(e)),
          getNotifications().then(setNotifications).catch(e => console.error(e)),
          listDocuments().then(setDocuments).catch(e => console.error(e))
        ]);
      }, 200);

    } catch (err: any) {
      setError(err.message || 'Failed to load app data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced/deduplicated refreshAll
  const refreshAll = useCallback(() => {
    if (activeFetchPromise.current) {
      return activeFetchPromise.current;
    }
    const promise = fetchAll().finally(() => {
      activeFetchPromise.current = null;
    });
    activeFetchPromise.current = promise;
    return promise;
  }, [fetchAll]);

  const updateSettingsInContext = useCallback(async (newSettings: Settings) => {
    const updated = await updateSettings(newSettings);
    setSettings(updated);
    // Force immediate config update (bypassing the 5-minute TTL cache)
    await refreshConfig();
    return updated;
  }, [refreshConfig]);

  const decrementUsage = useCallback(() => {
    setUsage(prev => {
      if (prev && prev.remaining > 0) {
        const used = prev.used + 1;
        const remaining = Math.max(0, prev.remaining - 1);
        const percentage = Math.min(100, Math.floor((used / prev.limit) * 100));
        const updated = {
          ...prev,
          used,
          remaining,
          percentage,
          status: (remaining > 0 ? 'active' : 'exhausted') as 'active' | 'exhausted'
        };
        // Keep Zustand usage store in sync
        useUsageStore.setState({ data: updated, lastFetchedAt: Date.now() });
        return updated;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (user) {
      void refreshAll();
    } else {
      setSystemConfig(null);
      setStatus(null);
      setUsage(null);
      setSettings(null);
      setNotifications(null);
      setDocuments([]);
    }
    return () => {
      if (tier2Timer.current) clearTimeout(tier2Timer.current);
    };
  }, [user, refreshAll]);

  const value: AppDataContextType = {
    systemConfig,
    status,
    usage,
    settings,
    notifications,
    documents,
    loading,
    error,
    refreshConfig,
    refreshStatus,
    refreshUsage,
    refreshSettings,
    refreshNotifications,
    refreshDocuments,
    refreshAll,
    updateSettingsInContext,
    decrementUsage
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used inside AppDataProvider');
  }
  return context;
}
