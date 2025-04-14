import { useState, useEffect } from 'react';
import { useIpcInvoke, useIpcListener } from './useIpc';

/**
 * Hook to manage authentication state and actions
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const checkAuth = useIpcInvoke('checkAuth');
  const startAuth = useIpcInvoke('startAuth');
  const signOut = useIpcInvoke('signOut');
  
  // Listen for auth state changes
  useIpcListener('onAuthStateChanged', (authState) => {
    setIsAuthenticated(authState);
  });
  
  // Check authentication status on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(true);
        const authStatus = await checkAuth();
        setIsAuthenticated(authStatus);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
  }, [checkAuth]);
  
  // Function to initiate sign in
  const login = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const success = await startAuth();
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to sign out
  const logout = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const success = await signOut();
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout
  };
}