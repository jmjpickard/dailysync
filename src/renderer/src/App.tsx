import React, { useEffect } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import EventListPane from './components/EventList/EventListPane'
import DetailPane from './components/DetailPane/DetailPane'
import Header from './components/Header'
import { Notifications } from './components/Notifications'
import { Dialogs } from './components/Dialogs'
import './styles/global.css'
import ErrorBoundary from './components/ErrorBoundary'
import useStore from './store'

function App() {
  // Initialize the store and set up listeners
  useEffect(() => {
    const { 
      loadInitialData, 
      initListeners, 
      clearDebouncedFunctions,
      updateConfiguredLLMServices 
    } = useStore.getState();
    
    // Initial data loading
    loadInitialData().then(() => {
      // Once settings are loaded, initialize LLM services
      updateConfiguredLLMServices();
    });
    
    // Set up IPC listeners
    const cleanupListeners = initListeners();

    // Return a combined cleanup function
    return () => {
      // Clean up IPC listeners
      cleanupListeners();
      
      // Cancel any pending debounced operations
      clearDebouncedFunctions();
    };
  }, []);

  // Get necessary state from the store
  const isAuthenticated = useStore(state => state.auth.isAuthenticated);
  const selectedDate = useStore(state => state.calendar.selectedDate);
  const setSelectedDate = useStore(state => state.setSelectedDate);

  return (
    <ErrorBoundary>
      <div className="h-screen overflow-hidden bg-gray-100 flex flex-col">
        {/* Header */}
        <Header />
        
        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left pane - Sidebar (fixed width) */}
          <Sidebar 
            isAuthenticated={isAuthenticated}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
          
          {/* Main content area - Adaptive layout for different screen sizes */}
          <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
            {/* Event List Pane (adjusts width based on screen size) */}
            <EventListPane />
            
            {/* Detail Pane (takes remaining space) */}
            <DetailPane />
          </div>
        </div>
        
        {/* Notifications and Dialogs are managed by their respective components */}
        <Notifications />
        <Dialogs />
      </div>
    </ErrorBoundary>
  );
}

export default App