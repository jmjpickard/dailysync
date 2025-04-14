/**
 * Main Process Settings Manager
 * 
 * This module provides functions to manage application settings from the main process.
 * It serves as a wrapper around the storage module to provide consistent access
 * to settings with default values and type checking.
 */

import { Settings, loadSetting, saveSetting, loadAllSettings, saveAllSettings } from './store';

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
 * Get a specific setting value with type safety
 * @param {K} key The setting key
 * @param {Settings[K]} defaultValue Default value if setting doesn't exist
 * @returns {Settings[K]} The setting value
 */
export function getSetting<K extends keyof Settings>(
  key: K, 
  defaultValue?: Settings[K]
): Settings[K] {
  const finalDefault = defaultValue !== undefined ? 
    defaultValue : 
    DEFAULT_SETTINGS[key];
    
  return loadSetting(key as string, finalDefault);
}

/**
 * Set a specific setting value
 * @param {K} key The setting key
 * @param {Settings[K]} value The value to set
 */
export function setSetting<K extends keyof Settings>(
  key: K, 
  value: Settings[K]
): void {
  saveSetting(key as string, value);
}

/**
 * Get all settings merged with defaults
 * @returns {Settings} The current settings
 */
export function getSettings(): Settings {
  const storedSettings = loadAllSettings();
  return { ...DEFAULT_SETTINGS, ...storedSettings };
}

/**
 * Save all settings
 * @param {Settings} settings The settings to save
 */
export function setSettings(settings: Settings): void {
  saveAllSettings(settings);
}