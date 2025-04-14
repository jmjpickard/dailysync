/**
 * LLM Settings Component
 * 
 * This component provides UI elements for configuring LLM API keys and settings
 * for Ollama, Claude (Anthropic), and Gemini (Google).
 */

import { ipcRenderer } from 'electron';
import { getSetting } from '../storage/settings';

// Create and render the LLM settings UI
export function createLLMSettingsUI(container: HTMLElement): void {
  // Create section container
  const sectionContainer = document.createElement('div');
  sectionContainer.className = 'settings-section';
  sectionContainer.innerHTML = `
    <h3>LLM Integration</h3>
    <p>Configure API keys and settings for summarizing meeting transcripts.</p>
    
    <div class="settings-form">
      <div class="settings-group">
        <h4>Ollama</h4>
        <div class="form-group">
          <label for="ollamaUrl">Base URL:</label>
          <input type="text" id="ollamaUrl" placeholder="http://localhost:11434">
          <small>Example: http://localhost:11434</small>
        </div>
        <div class="form-group">
          <label for="ollamaModel">Model Name:</label>
          <input type="text" id="ollamaModel" placeholder="llama3">
          <small>Example: llama3</small>
        </div>
      </div>
      
      <div class="settings-group">
        <h4>Claude (Anthropic)</h4>
        <div class="form-group">
          <label for="claudeKey">API Key:</label>
          <input type="password" id="claudeKey" placeholder="sk-ant-...">
        </div>
      </div>
      
      <div class="settings-group">
        <h4>Gemini (Google)</h4>
        <div class="form-group">
          <label for="geminiKey">API Key:</label>
          <input type="password" id="geminiKey" placeholder="AIzaSyC...">
        </div>
      </div>
      
      <div class="button-group">
        <button id="saveLLMSettings" class="primary-button">Save LLM Settings</button>
      </div>
    </div>
  `;
  
  // Append to container
  container.appendChild(sectionContainer);
  
  // Get references to form elements
  const ollamaUrlInput = document.getElementById('ollamaUrl') as HTMLInputElement;
  const ollamaModelInput = document.getElementById('ollamaModel') as HTMLInputElement;
  const claudeKeyInput = document.getElementById('claudeKey') as HTMLInputElement;
  const geminiKeyInput = document.getElementById('geminiKey') as HTMLInputElement;
  const saveButton = document.getElementById('saveLLMSettings') as HTMLButtonElement;
  
  // Load existing settings
  loadSettings();
  
  // Add event listener for save button
  saveButton.addEventListener('click', async () => {
    await saveSettings();
  });
  
  // Load settings from storage
  async function loadSettings(): Promise<void> {
    try {
      // Get settings
      const ollamaUrl = await getSetting('llmApiKeys.ollama', '');
      const ollamaModel = await getSetting('ollamaModel', 'llama3');
      const claudeKey = await getSetting('llmApiKeys.claude', '');
      const geminiKey = await getSetting('llmApiKeys.gemini', '');
      
      // Populate form fields
      ollamaUrlInput.value = ollamaUrl;
      ollamaModelInput.value = ollamaModel;
      claudeKeyInput.value = claudeKey;
      geminiKeyInput.value = geminiKey;
    } catch (error) {
      console.error('Error loading LLM settings:', error);
      showNotification('Error loading settings', 'error');
    }
  }
  
  // Save settings to storage
  async function saveSettings(): Promise<void> {
    try {
      const settings = {
        ollamaUrl: ollamaUrlInput.value.trim(),
        ollamaModel: ollamaModelInput.value.trim() || 'llama3', // Default if empty
        claudeKey: claudeKeyInput.value.trim(),
        geminiKey: geminiKeyInput.value.trim()
      };
      
      // Send to main process
      const result = await ipcRenderer.invoke('save-llm-settings', settings);
      
      if (result.success) {
        showNotification('LLM settings saved successfully', 'success');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error saving LLM settings:', error);
      showNotification(`Error saving settings: ${error.message}`, 'error');
    }
  }
  
  // Helper to show notifications
  function showNotification(message: string, type: 'success' | 'error'): void {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Auto-remove after timeout
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
}