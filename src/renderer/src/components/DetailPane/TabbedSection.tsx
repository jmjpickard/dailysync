import React from 'react'

type TabType = 'notes' | 'transcript' | 'summary'

interface TabbedSectionProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  children: React.ReactNode
}

const TabbedSection: React.FC<TabbedSectionProps> = ({
  activeTab,
  onTabChange,
  children
}) => {
  const tabs: { id: TabType; label: string }[] = [
    { id: 'notes', label: 'Notes' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'summary', label: 'Summary' }
  ]
  
  return (
    <div className="mt-4 flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map(tab => (
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
          ))}
        </nav>
      </div>
      
      <div className="mt-4 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

export default TabbedSection