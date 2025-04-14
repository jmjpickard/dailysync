import React, { useState, useEffect } from 'react'

type TabType = 'account' | 'audio' | 'llm'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, showNotification }) => {
  const [activeTab, setActiveTab] = useState<TabType>('account')
  const [settings, setSettings] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const [permissionStatus, setPermissionStatus] = useState<{
    microphone: string
    screen: string
  }>({
    microphone: 'not-determined',
    screen: 'not-determined'
  })
  
  // LLM settings
  const [ollamaUrl, setOllamaUrl] = useState('')
  const [ollamaModel, setOllamaModel] = useState('llama3')
  const [claudeKey, setClaudeKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      loadSettings()
      checkPermissions()
    }
  }, [isOpen])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const result = await window.electronAPI.loadAllSettings()
      if (result.success) {
        setSettings(result.settings || {})
        
        // Set LLM settings from loaded settings
        setOllamaUrl(result.settings?.llmApiKeys?.ollama || '')
        setOllamaModel(result.settings?.ollamaModel || 'llama3')
        setClaudeKey(result.settings?.llmApiKeys?.claude || '')
        setGeminiKey(result.settings?.llmApiKeys?.gemini || '')
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const checkPermissions = async () => {
    try {
      const result = await window.electronAPI.checkScreenCaptureSupport()
      if (!result.supported) {
        setPermissionStatus({
          microphone: 'not-supported',
          screen: 'not-supported'
        })
        return
      }
      
      const permResult = await window.electronAPI.invokeRenderer('check-audio-permissions')
      setPermissionStatus(permResult)
    } catch (error) {
      console.error('Error checking permissions:', error)
    }
  }
  
  const handleOpenPrivacySettings = (section: 'microphone' | 'screen') => {
    window.electronAPI.openPrivacySettings(section)
  }
  
  const saveLLMSettings = async () => {
    setIsSaving(true)
    try {
      const result = await window.electronAPI.saveLLMSettings({
        ollamaUrl,
        ollamaModel,
        claudeKey,
        geminiKey
      })
      
      if (result.success) {
        showNotification('Settings saved successfully', 'success')
      } else if ('error' in result) {
        showNotification(`Error saving settings: ${result.error}`, 'error')
      }
    } catch (error) {
      console.error('Error saving LLM settings:', error)
      showNotification('Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
  }
  
  // Handle clicking outside to close
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }
  
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Tabs */}
        <div className="border-b">
          <nav className="flex">
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'account' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => handleTabChange('account')}
            >
              Account
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'audio' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => handleTabChange('audio')}
            >
              Audio Permissions
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'llm' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => handleTabChange('llm')}
            >
              LLM Settings
            </button>
          </nav>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <>
              {/* Account Tab */}
              {activeTab === 'account' && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Google Account</h3>
                  <p className="text-gray-600 mb-6">
                    Connect to your Google Calendar to view and manage your meetings.
                  </p>
                  
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <AuthStatus showNotification={showNotification} />
                  </div>
                </div>
              )}
              
              {/* Audio Permissions Tab */}
              {activeTab === 'audio' && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Recording Permissions</h3>
                  <p className="text-gray-600 mb-6">
                    To record meetings, you need to grant microphone and screen recording permissions.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Microphone Access</h4>
                          <p className="text-sm text-gray-500 mt-1">Required for capturing your voice in meetings</p>
                        </div>
                        <PermissionStatus 
                          status={permissionStatus.microphone} 
                          onOpenSettings={() => handleOpenPrivacySettings('microphone')}
                        />
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Screen Recording Access</h4>
                          <p className="text-sm text-gray-500 mt-1">Required for capturing system audio from meetings</p>
                        </div>
                        <PermissionStatus 
                          status={permissionStatus.screen} 
                          onOpenSettings={() => handleOpenPrivacySettings('screen')}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* LLM Settings Tab */}
              {activeTab === 'llm' && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Summarization Settings</h3>
                  <p className="text-gray-600 mb-6">
                    Configure language model settings for meeting summaries.
                  </p>
                  
                  <div className="space-y-6">
                    {/* Ollama (Local) */}
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Ollama (Local)</h4>
                      <div className="space-y-3">
                        <div>
                          <label htmlFor="ollama-url" className="block text-sm font-medium text-gray-700 mb-1">
                            Ollama URL
                          </label>
                          <input
                            type="text"
                            id="ollama-url"
                            className="w-full p-2 border rounded-md"
                            placeholder="http://localhost:11434"
                            value={ollamaUrl}
                            onChange={(e) => setOllamaUrl(e.target.value)}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            The URL where your local Ollama server is running
                          </p>
                        </div>
                        
                        <div>
                          <label htmlFor="ollama-model" className="block text-sm font-medium text-gray-700 mb-1">
                            Model
                          </label>
                          <select
                            id="ollama-model"
                            className="w-full p-2 border rounded-md"
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
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Anthropic Claude</h4>
                      <div>
                        <label htmlFor="claude-key" className="block text-sm font-medium text-gray-700 mb-1">
                          API Key
                        </label>
                        <input
                          type="password"
                          id="claude-key"
                          className="w-full p-2 border rounded-md"
                          placeholder="sk-ant-api..."
                          value={claudeKey}
                          onChange={(e) => setClaudeKey(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    {/* Google Gemini */}
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <h4 className="font-medium mb-2">Google Gemini</h4>
                      <div>
                        <label htmlFor="gemini-key" className="block text-sm font-medium text-gray-700 mb-1">
                          API Key
                        </label>
                        <input
                          type="password"
                          id="gemini-key"
                          className="w-full p-2 border rounded-md"
                          placeholder="AIzaSy..."
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 mr-2"
          >
            Cancel
          </button>
          
          {activeTab === 'llm' && (
            <button
              onClick={saveLLMSettings}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span className="flex items-center">
                  <div className="animate-spin h-4 w-4 mr-2 border-2 border-white rounded-full border-t-transparent"></div>
                  Saving...
                </span>
              ) : (
                'Save Settings'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Auth Status component inside the modal
const AuthStatus: React.FC<{ showNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void }> = ({ showNotification }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  useEffect(() => {
    checkAuthStatus()
    
    // Subscribe to auth state changes
    const unsubscribe = window.electronAPI.onAuthStateChanged((authState) => {
      setIsAuthenticated(authState)
      checkAuthStatus()
    })
    
    return () => {
      unsubscribe()
    }
  }, [])
  
  const checkAuthStatus = async () => {
    try {
      const status = await window.electronAPI.getAuthStatus()
      setIsAuthenticated(status.authenticated)
      setAuthEmail(status.email)
    } catch (error) {
      console.error('Error checking auth status:', error)
    }
  }
  
  const handleAuth = async () => {
    if (isAuthenticated) {
      const confirmDisconnect = window.confirm('Are you sure you want to disconnect from Google Calendar?')
      if (!confirmDisconnect) return
    }
    
    setIsLoading(true)
    try {
      if (isAuthenticated) {
        await window.electronAPI.signOut()
        showNotification('Disconnected from Google Calendar', 'success')
      } else {
        const success = await window.electronAPI.startAuth()
        if (success) {
          showNotification('Connected to Google Calendar', 'success')
        } else {
          showNotification('Failed to connect to Google Calendar', 'error')
        }
      }
    } catch (error) {
      console.error('Error during auth:', error)
      showNotification('Authentication error', 'error')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-medium">Google Calendar</span>
          {isAuthenticated && (
            <div className="text-sm text-gray-600 mt-1">{authEmail}</div>
          )}
        </div>
        
        <div className={`flex items-center px-2 py-1 rounded text-xs font-medium ${isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {isAuthenticated ? 'Connected' : 'Not Connected'}
        </div>
      </div>
      
      <button
        onClick={handleAuth}
        disabled={isLoading}
        className={`
          w-full py-2 rounded-md flex items-center justify-center font-medium
          ${isAuthenticated 
            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isLoading ? (
          <span className="flex items-center">
            <div className="animate-spin h-4 w-4 mr-2 border-2 border-current rounded-full border-t-transparent"></div>
            {isAuthenticated ? 'Disconnecting...' : 'Connecting...'}
          </span>
        ) : (
          isAuthenticated ? 'Disconnect' : 'Connect to Google Calendar'
        )}
      </button>
    </div>
  )
}

// Permission Status Indicator
const PermissionStatus: React.FC<{ 
  status: string 
  onOpenSettings: () => void
}> = ({ status, onOpenSettings }) => {
  if (status === 'not-supported') {
    return (
      <div className="text-center">
        <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium mb-2">
          Not Supported
        </div>
        <p className="text-xs text-gray-500">
          Your system doesn't support this feature
        </p>
      </div>
    )
  }

  let statusColor = ''
  let statusText = ''
  let showButton = false
  
  switch (status) {
    case 'granted':
      statusColor = 'bg-green-100 text-green-800'
      statusText = 'Granted'
      showButton = false
      break
    case 'denied':
      statusColor = 'bg-red-100 text-red-800'
      statusText = 'Denied'
      showButton = true
      break
    case 'restricted':
      statusColor = 'bg-red-100 text-red-800'
      statusText = 'Restricted'
      showButton = true
      break
    default: // not-determined
      statusColor = 'bg-yellow-100 text-yellow-800'
      statusText = 'Not Set'
      showButton = true
      break
  }
  
  return (
    <div className="text-center">
      <div className={`${statusColor} px-2 py-1 rounded text-xs font-medium mb-2`}>
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
  )
}

export default SettingsModal