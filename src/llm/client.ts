/**
 * LLM Client Module
 * 
 * This module provides client-side functions for the renderer process to
 * interact with LLM APIs via IPC channels to the main process.
 */

import { ipcRenderer } from 'electron';
import type { LLMService } from './api';

/**
 * Generate a summary for a meeting transcript
 * @param {string} eventId - The meeting event ID
 * @param {LLMService} serviceType - The LLM service to use
 * @returns {Promise<string>} - The generated summary or error message
 */
export async function generateSummary(
  eventId: string,
  serviceType: LLMService
): Promise<string> {
  try {
    // Call the main process to generate the summary
    const result = await ipcRenderer.invoke('generate-summary', eventId, serviceType);
    
    if (result.success) {
      return result.summary;
    } else {
      throw new Error(result.error || 'Failed to generate summary');
    }
  } catch (error: any) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

/**
 * Save LLM API settings
 * @param {Object} settings - The LLM API settings
 * @returns {Promise<boolean>} - Success indicator
 */
export async function saveLLMSettings(settings: {
  ollamaUrl: string;
  ollamaModel: string;
  claudeKey: string;
  geminiKey: string;
}): Promise<boolean> {
  try {
    const result = await ipcRenderer.invoke('save-llm-settings', settings);
    return result.success;
  } catch (error: any) {
    console.error('Error saving LLM settings:', error);
    return false;
  }
}