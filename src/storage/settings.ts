/**
 * Settings Manager
 * 
 * This module provides functions to manage application settings.
 * It serves as a wrapper around the storage module to provide
 * consistent access to settings with default values and type checking.
 */

import { ipcRenderer } from 'electron';
import { Settings } from './store';

// Default settings
const DEFAULT_SETTINGS: Settings = {
  whisperModel: 'base.en',
  defaultMicDevice: '',
  llmApiKeys: {
    ollama: '',
    claude: '',
    gemini: ''
  }
};

/**
 * Load all application settings
 * @returns {Promise<Settings>} The current settings
 */
export async function loadSettings(): Promise<Settings> {
  try {
    // Fetch settings from main process
    const result = await ipcRenderer.invoke('load-all-settings');
    
    if (result.success) {
      // Merge with default settings to ensure all expected properties exist
      return { ...DEFAULT_SETTINGS, ...result.settings };
    } else {
      console.error('Error loading settings:', result.error);
      return { ...DEFAULT_SETTINGS };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save all application settings
 * @param {Settings} settings The settings to save
 * @returns {Promise<boolean>} Success indicator
 */
export async function saveSettings(settings: Settings): Promise<boolean> {
  try {
    const result = await ipcRenderer.invoke('save-all-settings', settings);
    return result.success;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

/**
 * Get a specific setting value with type safety
 * @param {K} key The setting key
 * @param {Settings[K]} defaultValue Default value if setting doesn't exist
 * @returns {Promise<Settings[K]>} The setting value
 */
export async function getSetting<K extends keyof Settings>(
  key: K, 
  defaultValue?: Settings[K]
): Promise<Settings[K]> {
  try {
    const finalDefault = defaultValue !== undefined ? 
      defaultValue : 
      DEFAULT_SETTINGS[key];
      
    const result = await ipcRenderer.invoke('load-setting', key, finalDefault);
    
    if (result.success) {
      return result.value as Settings[K];
    } else {
      console.error(`Error loading setting ${key}:`, result.error);
      return finalDefault;
    }
  } catch (error) {
    console.error(`Error loading setting ${key}:`, error);
    return defaultValue !== undefined ? 
      defaultValue : 
      DEFAULT_SETTINGS[key];
  }
}

/**
 * Set a specific setting value
 * @param {K} key The setting key
 * @param {Settings[K]} value The value to set
 * @returns {Promise<boolean>} Success indicator
 */
export async function setSetting<K extends keyof Settings>(
  key: K, 
  value: Settings[K]
): Promise<boolean> {
  try {
    const result = await ipcRenderer.invoke('save-setting', key, value);
    return result.success;
  } catch (error) {
    console.error(`Error saving setting ${key}:`, error);
    return false;
  }
}