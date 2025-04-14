import React, { useState } from 'react'

interface AuthButtonProps {
  isAuthenticated: boolean
}

const AuthButton: React.FC<AuthButtonProps> = ({ isAuthenticated }) => {
  const [isLoading, setIsLoading] = useState(false)
  
  const handleAuth = async () => {
    if (isAuthenticated) {
      const confirm = window.confirm('Are you sure you want to disconnect from Google Calendar?')
      if (!confirm) return
    }
    
    setIsLoading(true)
    try {
      if (isAuthenticated) {
        await window.electronAPI.signOut()
      } else {
        await window.electronAPI.startAuth()
      }
    } catch (error) {
      console.error('Auth error:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <button
      className={`
        w-full py-2 px-4 rounded-lg flex items-center justify-center space-x-2
        ${isAuthenticated 
          ? 'bg-red-50 text-red-600 hover:bg-red-100' 
          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
      `}
      onClick={handleAuth}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <div className="animate-spin h-4 w-4 border-2 border-current rounded-full border-t-transparent"></div>
          <span>Loading...</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032 s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2 C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
          </svg>
          <span>{isAuthenticated ? 'Disconnect Calendar' : 'Connect Google Calendar'}</span>
        </>
      )}
    </button>
  )
}

export default AuthButton