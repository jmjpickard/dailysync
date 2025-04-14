import React, { useState } from 'react'
import MiniCalendar from './calendar/MiniCalendar'
import AuthButton from './buttons/AuthButton'
import SettingsButton from './buttons/SettingsButton'

interface NavigationPaneProps {
  isAuthenticated: boolean
  selectedDate: Date
  onDateSelect: (date: Date) => void
  onSettingsClick: () => void
}

const NavigationPane: React.FC<NavigationPaneProps> = ({
  isAuthenticated,
  selectedDate,
  onDateSelect,
  onSettingsClick
}) => {
  return (
    <div className="w-1/5 h-full bg-white shadow-md p-4 flex flex-col border-r">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Daily Sync</h2>
        <SettingsButton onClick={onSettingsClick} />
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
    </div>
  )
}

export default NavigationPane