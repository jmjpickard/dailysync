import React, { useState, useEffect } from "react";
import useStore from "../../store";
import { shallow } from "zustand/shallow";
import { LLMSettings } from "../../types";

// Helper for authentication status
const AuthStatus: React.FC = () => {
  const showNotification = useStore(state => state.addNotification);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus();

    // Subscribe to auth state changes
    const unsubscribe = window.electronAPI.onAuthStateChanged((authState) => {
      setIsAuthenticated(authState);
      checkAuthStatus();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const status = await window.electronAPI.getAuthStatus();
      setIsAuthenticated(status.authenticated);
      setAuthEmail(status.email || "");
    } catch (error) {
      console.error("Error checking auth status:", error);
    }
  };

  const handleAuth = async () => {
    if (isAuthenticated) {
      const confirmDisconnect = window.confirm(
        "Are you sure you want to disconnect from Google Calendar?"
      );
      if (!confirmDisconnect) return;
    }

    setIsLoading(true);
    try {
      if (isAuthenticated) {
        await window.electronAPI.signOut();
        showNotification("Disconnected from Google Calendar", "success");
      } else {
        const success = await window.electronAPI.startAuth();
        if (success) {
          showNotification("Connected to Google Calendar", "success");
        } else {
          showNotification("Failed to connect to Google Calendar", "error");
        }
      }
    } catch (error) {
      console.error("Error during auth:", error);
      showNotification("Authentication error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-2">
        Google Calendar
      </h3>

      <div className="bg-gray-50 p-3 rounded-lg border flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div>
            {isAuthenticated && (
              <div className="text-sm text-gray-600">{authEmail}</div>
            )}
          </div>

          <div
            className={`flex items-center px-2 py-1 rounded text-xs font-medium ${
              isAuthenticated
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {isAuthenticated ? "Connected" : "Not Connected"}
          </div>
        </div>

        <button
          onClick={handleAuth}
          disabled={isLoading}
          className={`
            py-1.5 px-2 rounded-md flex items-center justify-center text-sm font-medium
            ${
              isAuthenticated
                ? "bg-red-50 text-red-600 hover:bg-red-100"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isLoading ? (
            <span className="flex items-center">
              <div className="animate-spin h-3 w-3 mr-1.5 border-2 border-current rounded-full border-t-transparent"></div>
              {isAuthenticated ? "Disconnecting..." : "Connecting..."}
            </span>
          ) : isAuthenticated ? (
            "Disconnect"
          ) : (
            "Connect to Google Calendar"
          )}
        </button>
      </div>
    </div>
  );
};

// Permission Status Component
const PermissionStatus: React.FC<{
  status: string;
  onOpenSettings: () => void;
}> = ({ status, onOpenSettings }) => {
  if (status === "not-supported") {
    return (
      <div className="text-center">
        <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
          Not Supported
        </div>
      </div>
    );
  }

  let statusColor = "";
  let statusText = "";
  let showButton = false;

  switch (status) {
    case "granted":
      statusColor = "bg-green-100 text-green-800";
      statusText = "Granted";
      showButton = false;
      break;
    case "denied":
      statusColor = "bg-red-100 text-red-800";
      statusText = "Denied";
      showButton = true;
      break;
    case "restricted":
      statusColor = "bg-red-100 text-red-800";
      statusText = "Restricted";
      showButton = true;
      break;
    default: // not-determined
      statusColor = "bg-yellow-100 text-yellow-800";
      statusText = "Not Set";
      showButton = true;
      break;
  }

  return (
    <div className="text-center">
      <div
        className={`${statusColor} px-2 py-1 rounded text-xs font-medium mb-1`}
      >
        {statusText}
      </div>
      {showButton && (
        <button
          onClick={onOpenSettings}
          className="text-xs text-blue-600 hover:underline"
        >
          Open Settings
        </button>
      )}
    </div>
  );
};

const SettingsPane: React.FC = () => {
  const settings = useStore(state => state.settings);
  const setSidebarView = useStore(state => state.setSidebarView);
  const showNotification = useStore(state => state.addNotification);

  // States for settings form
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("llama3");
  const [claudeKey, setClaudeKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "account" | "audio" | "llm"
  >("account");

  // Permissions state
  const [permissionStatus, setPermissionStatus] = useState<{
    microphone: string;
    screen: string;
  }>({
    microphone: "not-determined",
    screen: "not-determined",
  });

  // Load settings when component mounts
  useEffect(() => {
    if (settings) {
      const llmSettings = settings.llmSettings;
      if (llmSettings) {
        setOllamaUrl(llmSettings.ollamaUrl || "");
        setOllamaModel(llmSettings.ollamaModel || "llama3");
        setClaudeKey(llmSettings.claudeKey || "");
        setGeminiKey(llmSettings.geminiKey || "");
      }
    }

    // Check permissions
    checkPermissions();
  }, [settings]);

  const checkPermissions = async () => {
    try {
      const result = await window.electronAPI.checkScreenCaptureSupport();
      if (!result.supported) {
        setPermissionStatus({
          microphone: "not-supported",
          screen: "not-supported",
        });
        return;
      }

      const permResult = await window.electronAPI.invokeRenderer(
        "check-audio-permissions"
      );
      setPermissionStatus(permResult);
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  };

  const handleOpenPrivacySettings = (section: "microphone" | "screen") => {
    window.electronAPI.openPrivacySettings(section);
  };

  // Get saveSettings function from the store
  const saveSettingsAction = useStore(state => state.saveSettings);

  const handleSaveSettings = async () => {
    setIsSaving(true);

    try {
      // Create updated LLM settings
      const updatedLLMSettings: LLMSettings = {
        ollamaUrl,
        ollamaModel,
        claudeKey,
        geminiKey,
      };

      // Get current settings and update them
      const currentSettings = settings || {};
      const updatedSettings = {
        ...currentSettings,
        llmSettings: updatedLLMSettings,
      };

      // Save settings
      await saveSettingsAction(updatedSettings);
      showNotification("Settings saved successfully", "success");
    } catch (error) {
      console.error("Error saving settings:", error);
      showNotification("Failed to save settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
        <button
          onClick={() => setSidebarView("nav")}
          className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Back"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 mb-4">
        <button
          className={`px-3 py-1.5 text-sm rounded-md flex-1 ${
            activeSection === "account"
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          onClick={() => setActiveSection("account")}
        >
          Account
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded-md flex-1 ${
            activeSection === "audio"
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          onClick={() => setActiveSection("audio")}
        >
          Audio
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded-md flex-1 ${
            activeSection === "llm"
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          onClick={() => setActiveSection("llm")}
        >
          LLM
        </button>
      </div>

      {/* Content Section - Scrollable */}
      <div className="flex-1 overflow-y-auto pr-1">
        {/* Account Settings */}
        {activeSection === "account" && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Connect to your Google Calendar to view and manage your meetings.
            </p>
            <AuthStatus />
          </div>
        )}

        {/* Audio Permissions */}
        {activeSection === "audio" && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Recording requires microphone and screen recording permissions.
            </p>

            <div className="space-y-3">
              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-medium">Microphone Access</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Required for voice capture
                    </p>
                  </div>
                  <PermissionStatus
                    status={permissionStatus.microphone}
                    onOpenSettings={() =>
                      handleOpenPrivacySettings("microphone")
                    }
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-medium">Screen Recording</h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Required for system audio
                    </p>
                  </div>
                  <PermissionStatus
                    status={permissionStatus.screen}
                    onOpenSettings={() => handleOpenPrivacySettings("screen")}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LLM Settings */}
        {activeSection === "llm" && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Configure language models for meeting summaries.
            </p>

            <div className="space-y-4">
              {/* Ollama (Local) */}
              <div className="bg-gray-50 p-3 rounded-lg border">
                <h4 className="text-sm font-medium mb-2">Ollama (Local)</h4>
                <div className="space-y-2">
                  <div>
                    <label
                      htmlFor="ollama-url"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      Ollama URL
                    </label>
                    <input
                      type="text"
                      id="ollama-url"
                      className="w-full p-1.5 text-sm border rounded"
                      placeholder="http://localhost:11434"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ollama-model"
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      Model
                    </label>
                    <select
                      id="ollama-model"
                      className="w-full p-1.5 text-sm border rounded"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                    >
                      <option value="llama3">Llama 3</option>
                      <option value="mistral">Mistral</option>
                      <option value="mixtral">Mixtral</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Anthropic Claude */}
              <div className="bg-gray-50 p-3 rounded-lg border">
                <h4 className="text-sm font-medium mb-2">Anthropic Claude</h4>
                <div>
                  <label
                    htmlFor="claude-key"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    API Key
                  </label>
                  <input
                    type="password"
                    id="claude-key"
                    className="w-full p-1.5 text-sm border rounded"
                    placeholder="sk-ant-api..."
                    value={claudeKey}
                    onChange={(e) => setClaudeKey(e.target.value)}
                  />
                </div>
              </div>

              {/* Google Gemini */}
              <div className="bg-gray-50 p-3 rounded-lg border">
                <h4 className="text-sm font-medium mb-2">Google Gemini</h4>
                <div>
                  <label
                    htmlFor="gemini-key"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    API Key
                  </label>
                  <input
                    type="password"
                    id="gemini-key"
                    className="w-full p-1.5 text-sm border rounded"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer with Save Button */}
      {activeSection === "llm" && (
        <div className="pt-3 mt-3 border-t">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
          >
            {isSaving ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white rounded-full border-t-transparent"></div>
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsPane;
