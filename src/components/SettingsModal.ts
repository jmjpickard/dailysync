/**
 * Settings Modal Component
 *
 * This component creates a modal dialog for application settings,
 * with sections for Account, Audio Permissions, and LLM settings.
 */

import { ipcRenderer, shell } from "electron";
import { loadSettings } from "../storage/settings";
import { createLLMSettingsUI } from "./LLMSettings";

export class SettingsModal {
  private modalElement: HTMLElement | null = null;
  private isAuthenticated = false;
  private userEmail = "";
  private micPermission = "not_determined";
  private screenRecordingPermission = "not_determined";

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the settings modal
   */
  private async initialize() {
    // Create modal container if it doesn't exist
    if (!document.getElementById("settings-modal")) {
      this.createModalElement();
    } else {
      this.modalElement = document.getElementById("settings-modal");
    }

    // Load initial data
    await this.loadInitialData();
  }

  /**
   * Create the modal element and append it to the DOM
   */
  private createModalElement() {
    this.modalElement = document.createElement("div");
    this.modalElement.id = "settings-modal";
    this.modalElement.className = "modal";
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Settings</h2>
          <span class="close">&times;</span>
        </div>
        <div class="modal-body">
          <div class="tabs">
            <button class="tab-button active" data-tab="account">Account</button>
            <button class="tab-button" data-tab="audio">Audio Permissions</button>
            <button class="tab-button" data-tab="llm">LLM / Summarization</button>
          </div>
          
          <div id="account" class="tab-content-modal active">
            <h3>Google Account</h3>
            <div id="account-status">
              <p id="account-email">Not connected</p>
              <button id="connect-google-btn" class="primary-button">Connect Google Account</button>
              <button id="disconnect-google-btn" class="secondary-button" style="display: none;">Disconnect</button>
            </div>
          </div>
          
          <div id="audio" class="tab-content-modal">
            <h3>Audio Recording Permissions</h3>
            <div class="permission-item">
              <div class="permission-header">
                <span>Microphone Access</span>
                <span id="mic-permission-status" class="permission-status not_determined">Not Determined</span>
              </div>
              <p class="permission-description">Required for capturing microphone input during recordings.</p>
            </div>
            
            <div class="permission-item">
              <div class="permission-header">
                <span>Screen Recording</span>
                <span id="screen-permission-status" class="permission-status not_determined">Not Determined</span>
              </div>
              <p class="permission-description">Required for capturing system audio during recordings.</p>
            </div>
            
            <div id="permission-message" class="warning-message" style="display: none;">
              <p>Permissions required for recording.</p>
              <button id="open-privacy-settings" class="secondary-button">Open Privacy & Security Settings</button>
            </div>
          </div>
          
          <div id="llm" class="tab-content-modal">
            <!-- LLM Settings will be rendered here by the LLMSettings component -->
            <div id="llm-settings-container"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="close-settings" class="primary-button">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalElement);
    this.setupEventListeners();
  }

  /**
   * Load initial data for the settings modal
   */
  private async loadInitialData() {
    // Load Google auth status
    const authResult = await ipcRenderer.invoke("get-google-auth-status");
    this.isAuthenticated = authResult.authenticated || false;
    this.userEmail = authResult.email || "";

    // Load audio permissions
    const permissionsResult = await ipcRenderer.invoke(
      "check-audio-permissions"
    );
    this.micPermission = permissionsResult.microphone || "not_determined";
    this.screenRecordingPermission =
      permissionsResult.screenRecording || "not_determined";

    // Update UI
    this.updateUI();
  }

  /**
   * Update the UI with current data
   */
  private updateUI() {
    if (!this.modalElement) return;

    // Update Google Account status
    const accountEmailElement =
      this.modalElement.querySelector("#account-email");
    const connectButton = this.modalElement.querySelector(
      "#connect-google-btn"
    ) as HTMLElement;
    const disconnectButton = this.modalElement.querySelector(
      "#disconnect-google-btn"
    ) as HTMLElement;

    if (accountEmailElement && connectButton && disconnectButton) {
      if (this.isAuthenticated) {
        accountEmailElement.textContent = this.userEmail || "Connected";
        connectButton.style.display = "none";
        disconnectButton.style.display = "block";
      } else {
        accountEmailElement.textContent = "Not connected";
        connectButton.style.display = "block";
        disconnectButton.style.display = "none";
      }
    }

    // Update audio permissions
    const micStatus = this.modalElement.querySelector("#mic-permission-status");
    const screenStatus = this.modalElement.querySelector(
      "#screen-permission-status"
    );
    const permissionMessage = this.modalElement.querySelector(
      "#permission-message"
    ) as HTMLElement;

    if (micStatus && screenStatus && permissionMessage) {
      // Update microphone status
      micStatus.textContent = this.getReadablePermissionStatus(
        this.micPermission
      );
      micStatus.className = `permission-status ${this.micPermission}`;

      // Update screen recording status
      screenStatus.textContent = this.getReadablePermissionStatus(
        this.screenRecordingPermission
      );
      screenStatus.className = `permission-status ${this.screenRecordingPermission}`;

      // Show message if permissions are not granted
      if (
        this.micPermission !== "allowed" ||
        this.screenRecordingPermission !== "allowed"
      ) {
        permissionMessage.style.display = "block";
      } else {
        permissionMessage.style.display = "none";
      }
    }

    // Initialize LLM settings UI
    const llmSettingsContainer = this.modalElement.querySelector(
      "#llm-settings-container"
    ) as HTMLElement;
    if (llmSettingsContainer) {
      // Clear existing content
      llmSettingsContainer.innerHTML = "";
      // Create LLM settings UI
      createLLMSettingsUI(llmSettingsContainer);
    }
  }

  /**
   * Set up event listeners for the modal
   */
  private setupEventListeners() {
    if (!this.modalElement) return;

    // Close button
    const closeBtn = this.modalElement.querySelector(".close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.close());
    }

    // Close settings button
    const closeSettingsBtn = this.modalElement.querySelector("#close-settings");
    if (closeSettingsBtn) {
      closeSettingsBtn.addEventListener("click", () => this.close());
    }

    // Tab switching
    const tabButtons = this.modalElement.querySelectorAll(".tab-button");
    tabButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const tabId = target.getAttribute("data-tab");

        // Update active tab button
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        target.classList.add("active");

        // Update active tab content
        const tabContents =
          this.modalElement?.querySelectorAll(".tab-content-modal");
        tabContents?.forEach((content) => content.classList.remove("active"));

        const activeContent = this.modalElement?.querySelector(`#${tabId}`);
        activeContent?.classList.add("active");
      });
    });

    // Connect Google Account
    const connectBtn = this.modalElement.querySelector("#connect-google-btn");
    if (connectBtn) {
      connectBtn.addEventListener("click", async () => {
        await ipcRenderer.invoke("google-auth-start");
        await this.loadInitialData(); // Refresh data after auth attempt
      });
    }

    // Disconnect Google Account
    const disconnectBtn = this.modalElement.querySelector(
      "#disconnect-google-btn"
    );
    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", async () => {
        await ipcRenderer.invoke("google-auth-disconnect");
        await this.loadInitialData(); // Refresh data after disconnect
      });
    }

    // Open Privacy Settings
    const openPrivacyBtn = this.modalElement.querySelector(
      "#open-privacy-settings"
    );
    if (openPrivacyBtn) {
      openPrivacyBtn.addEventListener("click", () => {
        shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        );
      });
    }
  }

  /**
   * Convert permission status to readable format
   * @param status Permission status
   * @returns Human-readable status
   */
  private getReadablePermissionStatus(status: string): string {
    switch (status) {
      case "allowed":
        return "Allowed";
      case "denied":
        return "Denied";
      case "not_determined":
      default:
        return "Not Determined";
    }
  }

  /**
   * Open the settings modal
   */
  public open() {
    if (this.modalElement) {
      this.loadInitialData(); // Refresh data when opening
      this.modalElement.style.display = "block";
    }
  }

  /**
   * Close the settings modal
   */
  public close() {
    if (this.modalElement) {
      this.modalElement.style.display = "none";
    }
  }
}
