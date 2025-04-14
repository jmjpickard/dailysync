import React from 'react'
import DateNavigation from './calendar/DateNavigation'
import EventList from './calendar/EventList'
import { formatDate } from '../utils/dateUtils'

interface DailySchedulePaneProps {
  selectedDate: Date
  events: any[]
  isLoading: boolean
  selectedEventId: string | null
  onEventSelect: (eventId: string) => void
  onDateChange: (date: Date) => void
}

const DailySchedulePane: React.FC<DailySchedulePaneProps> = ({
  selectedDate,
  events,
  isLoading,
  selectedEventId,
  onEventSelect,
  onDateChange
}) => {
  const goToNextDay = () => {
    const nextDay = new Date(selectedDate)
    nextDay.setDate(nextDay.getDate() + 1)
    onDateChange(nextDay)
  }
  
  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDate)
    prevDay.setDate(prevDay.getDate() - 1)
    onDateChange(prevDay)
  }
  
  const goToToday = () => {
    onDateChange(new Date())
  }
  
  return (
    <div className="w-2/5 h-full bg-white p-4 flex flex-col border-r">
      <DateNavigation
        date={selectedDate}
        onPrevious={goToPreviousDay}
        onNext={goToNextDay}
        onToday={goToToday}
      />
      
      <h2 className="text-lg font-semibold my-4">{formatDate(selectedDate)}</h2>
      
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>No events scheduled for today</p>
          </div>
        ) : (
          <EventList 
            events={events} 
            selectedEventId={selectedEventId} 
            onEventSelect={onEventSelect} 
          />
        )}
      </div>
    </div>
  )
}

export default DailySchedulePane