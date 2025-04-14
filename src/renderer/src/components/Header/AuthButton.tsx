import React from 'react';
import useStore from '../../store';
import { shallow } from 'zustand/shallow';
import { useIpcInvoke } from '../../hooks/useIpc';

const AuthButton: React.FC = () => {
  const { isAuthenticated, isLoading } = useStore(
    state => ({
      isAuthenticated: state.auth.isAuthenticated,
      isLoading: state.auth.isLoading
    }),
    shallow
  );
  const showNotification = useStore(state => state.addNotification);
  
  const startAuth = useIpcInvoke('startAuth');
  const signOut = useIpcInvoke('signOut');

  // Get Zustand actions
  const startAuthAction = useStore(state => state.startAuth);
  const signOutAction = useStore(state => state.signOut);
  
  const handleAuth = async () => {
    try {
      if (isAuthenticated) {
        // Sign out
        await signOutAction();
      } else {
        // Sign in
        await startAuthAction();
      }
    } catch (error) {
      console.error('Authentication error:', error);
      showNotification('Authentication error occurred', 'error');
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className={`flex items-center ${isAuthenticated ? 'text-green-600' : 'text-gray-400'}`}>
        <div className={`h-2 w-2 rounded-full mr-2 ${isAuthenticated ? 'bg-green-600' : 'bg-gray-400'}`}></div>
        <span className="text-xs font-medium">
          {isAuthenticated ? 'Connected' : 'Not connected'}
        </span>
      </div>
      
      <button
        onClick={handleAuth}
        disabled={isLoading}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          isAuthenticated
            ? 'bg-red-50 text-red-700 hover:bg-red-100'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {isAuthenticated ? 'Disconnecting...' : 'Connecting...'}
          </span>
        ) : (
          <span>
            {isAuthenticated ? 'Disconnect Google Calendar' : 'Connect Google Calendar'}
          </span>
        )}
      </button>
    </div>
  );
};

export default AuthButton;