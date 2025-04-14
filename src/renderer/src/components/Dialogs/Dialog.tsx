import React, { useEffect, useState } from 'react';

export interface ButtonConfig {
  text: string;
  onClick: () => void;
  type: 'primary' | 'secondary' | 'danger';
}

interface DialogProps {
  title: string;
  children: React.ReactNode;
  buttons: ButtonConfig[];
  onClose: () => void;
}

const Dialog: React.FC<DialogProps> = ({ title, children, buttons, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10);
    
    // Add escape key listener
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);
  
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };
  
  const getButtonClasses = (type: ButtonConfig['type']) => {
    switch (type) {
      case 'primary':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'secondary':
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      case 'danger':
        return 'bg-red-500 hover:bg-red-600 text-white';
    }
  };
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 ease-in-out z-40 ${
          isVisible ? 'opacity-50' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      
      {/* Dialog */}
      <div 
        className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                    bg-white rounded-lg shadow-xl z-50 w-full max-w-md mx-auto
                    transition-all duration-300 ease-in-out ${
                      isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                    }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">{title}</h2>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              onClick={handleClose}
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          {children}
        </div>
        
        {/* Footer */}
        {buttons.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
            {buttons.map((button, index) => (
              <button
                key={index}
                className={`px-4 py-2 rounded-md transition-colors font-medium ${getButtonClasses(button.type)}`}
                onClick={() => {
                  button.onClick();
                }}
              >
                {button.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Dialog;