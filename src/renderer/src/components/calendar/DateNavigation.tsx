import React from 'react'
import { formatDate } from '../../utils/dateUtils'

interface DateNavigationProps {
  date: Date
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}

const DateNavigation: React.FC<DateNavigationProps> = ({
  date,
  onPrevious,
  onNext,
  onToday
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <button
          onClick={onPrevious}
          className="p-1 rounded hover:bg-gray-100"
          aria-label="Previous day"
        >
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        
        <button
          onClick={onNext}
          className="p-1 rounded hover:bg-gray-100"
          aria-label="Next day"
        >
          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <button
        onClick={onToday}
        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100"
      >
        Today
      </button>
    </div>
  )
}

export default DateNavigation