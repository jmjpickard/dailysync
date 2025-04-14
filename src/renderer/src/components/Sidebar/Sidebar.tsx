import React from 'react'
import MiniCalendar from '../calendar/MiniCalendar'
import AuthButton from '../buttons/AuthButton'
import SettingsButton from '../buttons/SettingsButton'
import SettingsPane from '../Settings/SettingsPane'
import useStore from '../../store'

interface SidebarProps {
  isAuthenticated: boolean
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

const Sidebar: React.FC<SidebarProps> = ({
  isAuthenticated,
  selectedDate,
  onDateSelect
}) => {
  const sidebarView = useStore(state => state.ui.sidebarView);
  const setSidebarView = useStore(state => state.setSidebarView);
  
  const handleSettingsClick = () => {
    setSidebarView('settings');
  };
  
  // Display either Navigation elements or SettingsPane
  return (
    <div className="w-64 h-full bg-white shadow-md p-4 flex flex-col border-r">
      {sidebarView === 'settings' ? (
        <SettingsPane />
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Daily Sync</h2>
            <SettingsButton onClick={handleSettingsClick} />
          </div>
          
          <div className="mb-8">
            <MiniCalendar 
              selectedDate={selectedDate} 
              onDateSelect={onDateSelect} 
            />
          </div>
          
          <div className="mt-auto">
            <AuthButton isAuthenticated={isAuthenticated} />
          </div>
        </>
      )}
    </div>
  )
}

export default Sidebar