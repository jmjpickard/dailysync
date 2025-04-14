import React from 'react';
import { formatDate } from '../../utils/dateUtils';
import useStore from '../../store';
import { addDays } from '../../utils/dateUtils';

const DateNavigator: React.FC = () => {
  const selectedDate = useStore(state => state.calendar.selectedDate);
  const setSelectedDate = useStore(state => state.setSelectedDate);

  const goToPreviousDay = () => {
    const newDate = addDays(selectedDate, -1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="flex items-center space-x-4">
      <button
        onClick={goToPreviousDay}
        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
        aria-label="Previous Day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </button>
      
      <button
        onClick={goToToday}
        className="px-3 py-1 text-sm font-medium bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
      >
        Today
      </button>
      
      <div className="text-lg font-medium">{formatDate(selectedDate)}</div>
      
      <button
        onClick={goToNextDay}
        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
        aria-label="Next Day"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

export default DateNavigator;