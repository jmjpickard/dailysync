import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true,
      error 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("App error:", error, errorInfo);
    // Optional: Report to error tracking service
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary flex flex-col items-center justify-center h-screen bg-gray-100">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p className="mb-6">The application encountered an unexpected error. Please restart.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;