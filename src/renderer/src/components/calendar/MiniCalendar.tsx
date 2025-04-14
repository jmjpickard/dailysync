import React, { useState, useEffect } from 'react'
import { 
  getCalendarDays, 
  isSameDay, 
  isToday,
  getMonthName
} from '../../utils/dateUtils'

interface MiniCalendarProps {
  selectedDate: Date
  onDateSelect: (date: Date) => void
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({ selectedDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(selectedDate))
  const [calendarDays, setCalendarDays] = useState<Date[]>([])
  
  useEffect(() => {
    setCalendarDays(getCalendarDays(currentMonth))
  }, [currentMonth])
  
  const goToPreviousMonth = () => {
    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    setCurrentMonth(prevMonth)
  }
  
  const goToNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    setCurrentMonth(nextMonth)
  }
  
  return (
    <div className="mini-calendar">
      <div className="flex justify-between items-center mb-2">
        <button 
          onClick={goToPreviousMonth}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        
        <h3 className="text-sm font-medium">
          {getMonthName(currentMonth)} {currentMonth.getFullYear()}
        </h3>
        
        <button 
          onClick={goToNextMonth}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-xs text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <div key={index} className="text-gray-500 font-medium py-1">
            {day}
          </div>
        ))}
        
        {calendarDays.map((date, index) => {
          const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
          const isSelected = isSameDay(date, selectedDate)
          const isTodayDate = isToday(date)
          
          return (
            <button
              key={index}
              onClick={() => onDateSelect(date)}
              className={`
                rounded-full h-7 w-7 flex items-center justify-center text-xs
                ${!isCurrentMonth ? 'text-gray-300' : ''}
                ${isSelected ? 'bg-blue-500 text-white' : ''}
                ${isTodayDate && !isSelected ? 'border border-blue-500 text-blue-500' : ''}
                ${isCurrentMonth && !isSelected && !isTodayDate ? 'hover:bg-gray-100' : ''}
              `}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MiniCalendar