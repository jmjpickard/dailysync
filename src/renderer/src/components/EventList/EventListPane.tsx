import React from "react";
import DateNavigation from "../calendar/DateNavigation";
import EventList from "../calendar/EventList";
import { formatDate } from "../../utils/dateUtils";
import useStore from "../../store";
import { shallow } from "zustand/shallow";
import { addDays } from "../../utils/dateUtils";
import { AppState } from "../../store/types";

const EventListPane: React.FC = () => {
  // Use shallow comparison to optimize performance
  const { selectedDate, events, selectedEventId, isLoading } = useStore(
    (state: AppState) => ({
      selectedDate: state.calendar.selectedDate,
      events: state.calendar.events,
      selectedEventId: state.calendar.selectedEventId,
      isLoading: state.calendar.isLoading,
    })
  );

  const isAuthenticated = useStore((state) => state.auth.isAuthenticated);
  const setSelectedDate = useStore((state) => state.setSelectedDate);
  const setSelectedEventId = useStore((state) => state.setSelectedEventId);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const goToNextDay = () => {
    const nextDay = addDays(selectedDate, 1);
    handleDateChange(nextDay);
  };

  const goToPreviousDay = () => {
    const prevDay = addDays(selectedDate, -1);
    handleDateChange(prevDay);
  };

  const goToToday = () => {
    handleDateChange(new Date());
  };

  return (
    <div className="w-full md:w-72 lg:w-96 h-full bg-white p-4 flex flex-col border-r overflow-hidden">
      <DateNavigation
        date={selectedDate}
        onPrevious={goToPreviousDay}
        onNext={goToNextDay}
        onToday={goToToday}
      />

      <h2 className="text-lg font-semibold my-4">{formatDate(selectedDate)}</h2>

      <div className="flex-1 overflow-y-auto">
        {!isAuthenticated ? (
          <div className="text-center text-gray-500 mt-8">
            <p>Please connect your Google Calendar to view events</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p>No events scheduled for this day</p>
          </div>
        ) : (
          <EventList
            events={events}
            selectedEventId={selectedEventId}
            onEventSelect={handleEventSelect}
          />
        )}
      </div>
    </div>
  );
};

export default EventListPane;
