import React, { useMemo, useEffect } from 'react'
import useStore from '../../store'

type TabType = 'notes' | 'transcript' | 'summary'

interface TabContainerProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  children: React.ReactNode
}

const tabs: { id: TabType; label: string }[] = [
  { id: 'notes', label: 'Notes' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'summary', label: 'Summary' }
]

const TabContainer: React.FC<TabContainerProps> = ({
  activeTab,
  onTabChange,
  children
}) => {
  // Get the current event ID from the store
  const selectedEventId = useStore((state) => state.meetingDetail.selectedEventId);

  // Memoize the tab buttons to prevent unnecessary re-renders
  const tabButtons = useMemo(() => {
    return tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={`
          whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
          ${activeTab === tab.id
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
        `}
        aria-current={activeTab === tab.id ? 'page' : undefined}
      >
        {tab.label}
      </button>
    ));
  }, [activeTab, onTabChange]);
  
  // Save the current tab in the store when it changes
  useEffect(() => {
    if (selectedEventId) {
      // Store the active tab in the store to persist it across tab switches
      useStore.getState().setActiveTab(activeTab);
    }
  }, [activeTab, selectedEventId]);
  
  return (
    <div className="mt-4 flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabButtons}
        </nav>
      </div>
      
      <div className="mt-4 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

export default React.memo(TabContainer)