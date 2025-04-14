/**
 * Summarization UI Module
 * 
 * This module handles the UI interactions for generating summaries from transcripts
 * using LLM services (Ollama, Claude, Gemini) that were configured in Chunk 14.
 */

import { ipcRenderer } from 'electron';
import type { LLMService } from '../llm/api';
import { generateSummary } from '../llm/client';

// Cache the selected LLM service to remember user's last choice
let lastSelectedService: LLMService | null = null;

/**
 * Initialize the summary tab functionality
 * @param summaryTab The summary tab DOM element
 * @param eventId The currently selected event ID
 */
export async function initSummaryTab(summaryTab: HTMLElement, eventId: string): Promise<void> {
  if (!summaryTab) {
    console.error('Summary tab element not found');
    return;
  }

  // Get elements
  const generateBtn = summaryTab.querySelector('#generate-summary-btn') as HTMLButtonElement;
  const summaryContent = summaryTab.querySelector('.summary-content') as HTMLElement;

  if (!generateBtn || !summaryContent) {
    console.error(`Summary tab elements not found: generateBtn=${!!generateBtn}, summaryContent=${!!summaryContent}`);
    return;
  }

  // Check if transcript exists for this event
  const transcriptResult = await ipcRenderer.invoke('load-transcript', eventId);
  const hasTranscript = !!(transcriptResult.success && 
    transcriptResult.data && 
    transcriptResult.data.status === 'completed' && 
    transcriptResult.data.text);

  // Check which LLM services are configured
  const settings = await ipcRenderer.invoke('load-all-settings');
  const configuredServices = getConfiguredLLMServices(settings.settings);

  // Enable/disable the generate button based on requirements
  if (hasTranscript && configuredServices.length > 0) {
    generateBtn.disabled = false;
    generateBtn.title = '';
  } else {
    generateBtn.disabled = true;
    
    if (!hasTranscript) {
      generateBtn.title = 'Transcript required for summarization';
    } else if (configuredServices.length === 0) {
      generateBtn.title = 'Configure LLM API keys in Settings';
    }
  }

  // Load existing summary if available
  try {
    const summaryResult = await ipcRenderer.invoke('load-summary', eventId);
    
    if (summaryResult.success && summaryResult.data) {
      displaySummary(summaryContent, summaryResult.data.text, summaryResult.data.model);
      // Change button text to "Regenerate Summary"
      generateBtn.textContent = 'Regenerate Summary';
    }
  } catch (error) {
    console.error('Error loading existing summary:', error);
  }

  // Add click handler for generate button
  generateBtn.addEventListener('click', async () => {
    // Handle the click to generate a summary
    await handleGenerateSummaryClick(eventId, summaryContent, generateBtn, configuredServices);
  });
}

/**
 * Handle generate summary button click
 */
async function handleGenerateSummaryClick(
  eventId: string, 
  summaryContent: HTMLElement,
  generateBtn: HTMLButtonElement,
  configuredServices: LLMService[]
): Promise<void> {
  if (configuredServices.length === 0) {
    showNotification('Error', 'No LLM services configured. Please configure in Settings.');
    return;
  }

  let selectedService: LLMService;

  // If only one service is configured, use it directly
  if (configuredServices.length === 1) {
    selectedService = configuredServices[0];
  } 
  // If multiple services are configured, show selection UI
  else {
    try {
      selectedService = await showServiceSelectionUI(configuredServices);
      // Update the last selected service for next time
      lastSelectedService = selectedService;
    } catch (error) {
      // User canceled the selection
      return;
    }
  }

  // Show loading state
  generateBtn.disabled = true;
  summaryContent.innerHTML = `
    <div class="loading-indicator">
      <p>Generating summary with ${selectedService}...</p>
      <div class="spinner"></div>
    </div>
  `;

  try {
    // Call the IPC function to generate the summary
    const result = await ipcRenderer.invoke('generate-summary', eventId, selectedService);

    if (result.success && result.summary) {
      // Display the summary
      displaySummary(summaryContent, result.summary, selectedService);
      
      // Update button text
      generateBtn.textContent = 'Regenerate Summary';
    } else {
      // Display error
      summaryContent.innerHTML = `
        <div class="error-message">
          <p>Failed to generate summary: ${result.error}</p>
        </div>
      `;
    }
  } catch (error: any) {
    // Handle error
    summaryContent.innerHTML = `
      <div class="error-message">
        <p>Error generating summary: ${error.message || 'Unknown error'}</p>
      </div>
    `;
  } finally {
    // Re-enable button
    generateBtn.disabled = false;
  }
}

/**
 * Display a summary in the UI
 */
function displaySummary(summaryElement: HTMLElement, summaryText: string, modelUsed: string): void {
  // Format the summary text
  const formattedSummary = formatSummaryText(summaryText);

  // Create HTML with formatted summary and model attribution
  summaryElement.innerHTML = `
    <div class="summary-text">
      ${formattedSummary}
    </div>
    <div class="summary-attribution">
      <p>Summary generated by ${modelUsed}</p>
    </div>
    <div class="summary-actions">
      <button id="copy-summary-btn" class="action-btn">Copy Summary</button>
    </div>
  `;

  // Add event listener for copy button
  const copyBtn = summaryElement.querySelector('#copy-summary-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(summaryText)
        .then(() => {
          showNotification('Copied', 'Summary copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy summary:', err);
          showNotification('Error', 'Failed to copy summary');
        });
    });
  }
}

/**
 * Format the summary text for display
 */
function formatSummaryText(text: string): string {
  // Basic formatting: preserve paragraphs, escape HTML
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Split by lines and wrap paragraphs
  return escaped
    .split('\n')
    .map(line => line.trim() ? `<p>${line}</p>` : '')
    .join('');
}

/**
 * Show a UI for selecting which LLM service to use
 * @returns Promise that resolves to the selected service or rejects if canceled
 */
function showServiceSelectionUI(services: LLMService[]): Promise<LLMService> {
  return new Promise((resolve, reject) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog service-selection-dialog';

    // Format service names for display (capitalize first letter)
    const formatServiceName = (service: string): string => {
      return service.charAt(0).toUpperCase() + service.slice(1);
    };

    // Create service buttons
    const serviceButtons = services.map(service => {
      const isLastSelected = service === lastSelectedService;
      return `
        <button 
          data-service="${service}" 
          class="service-btn ${isLastSelected ? 'last-selected' : ''}"
        >
          ${formatServiceName(service)}
        </button>
      `;
    }).join('');

    // Add content
    dialog.innerHTML = `
      <h3>Generate Summary</h3>
      <p>Select a model to generate the summary:</p>
      <div class="service-buttons">
        ${serviceButtons}
      </div>
      <div class="modal-buttons">
        <button id="service-selection-cancel" class="modal-btn">Cancel</button>
      </div>
    `;

    // Add to DOM
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Add event listeners for service buttons
    const buttons = dialog.querySelectorAll('.service-btn');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const service = button.getAttribute('data-service') as LLMService;
        document.body.removeChild(overlay);
        resolve(service);
      });
    });

    // Add event listener for cancel button
    const cancelBtn = document.getElementById('service-selection-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        reject(new Error('Selection canceled'));
      });
    }
  });
}

/**
 * Get a list of configured LLM services
 */
function getConfiguredLLMServices(settings: any): LLMService[] {
  const configuredServices: LLMService[] = [];

  // Check for Ollama URL
  if (settings?.llmApiKeys?.ollama) {
    configuredServices.push('ollama');
  }

  // Check for Claude API key
  if (settings?.llmApiKeys?.claude) {
    configuredServices.push('claude');
  }

  // Check for Gemini API key
  if (settings?.llmApiKeys?.gemini) {
    configuredServices.push('gemini');
  }

  return configuredServices;
}

/**
 * Show a notification
 */
function showNotification(title: string, message: string): void {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'notification';

  // Add content
  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
  `;

  // Add to DOM
  document.body.appendChild(notification);

  // Show with animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300); // Wait for fade-out animation
  }, 3000);
}