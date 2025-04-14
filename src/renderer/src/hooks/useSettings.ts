import { useState, useCallback, useEffect } from 'react';
import { useIpcInvoke } from './useIpc';
import { AppSettings, LLMSettings } from '../types';

/**
 * Hook to manage application settings
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadAllSettings = useIpcInvoke('loadAllSettings');
  const saveSetting = useIpcInvoke('saveSetting');
  const saveAllSettings = useIpcInvoke('saveAllSettings');
  const saveLLMSettings = useIpcInvoke('saveLLMSettings');
  
  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const result = await loadAllSettings();
        
        if (result && typeof result === 'object') {
          if ('error' in result) {
            setError(result.error);
          } else if ('success' in result && result.success && 'settings' in result) {
            setSettings(result.settings);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, [loadAllSettings]);
  
  // Function to update a single setting
  const updateSetting = useCallback(async (key: string, value: any) => {
    try {
      setIsLoading(true);
      const result = await saveSetting(key, value);
      
      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error);
        return false;
      }
      
      // Update local state
      setSettings((prev) => {
        if (!prev) return { [key]: value } as AppSettings;
        return { ...prev, [key]: value };
      });
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [saveSetting]);
  
  // Function to update all settings at once
  const updateAllSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      setIsLoading(true);
      const result = await saveAllSettings(newSettings);
      
      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error);
        return false;
      }
      
      // Update local state
      setSettings(newSettings);
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [saveAllSettings]);
  
  // Function to update LLM settings
  const updateLLMSettings = useCallback(async (llmSettings: LLMSettings) => {
    try {
      setIsLoading(true);
      const result = await saveLLMSettings(llmSettings);
      
      if (result && typeof result === 'object' && 'error' in result) {
        setError(result.error);
        return false;
      }
      
      // Update local state
      setSettings((prev) => {
        if (!prev) return { llmSettings } as AppSettings;
        return { ...prev, llmSettings };
      });
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [saveLLMSettings]);
  
  return {
    settings,
    isLoading,
    error,
    updateSetting,
    updateAllSettings,
    updateLLMSettings
  };
}