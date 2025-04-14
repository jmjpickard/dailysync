import React from 'react'
import EventItem from './EventItem'
import { CalendarEvent } from '../../types'
import useStore from '../../store'

interface EventListProps {
  events: CalendarEvent[];
  selectedEventId: string | null;
  onEventSelect: (eventId: string) => void;
}

const EventList: React.FC<EventListProps> = ({
  events,
  selectedEventId,
  onEventSelect
}) => {
  const meetings = useStore(state => state.meetings);
  
  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => {
    const aStart = a.start?.dateTime ? new Date(a.start.dateTime).getTime() : 0
    const bStart = b.start?.dateTime ? new Date(b.start.dateTime).getTime() : 0
    return aStart - bStart
  });

  return (
    <div className="space-y-2">
      {sortedEvents.map(event => {
        const eventId = event.id;
        const meetingData = meetings.data[eventId];
        const hasTranscript = meetingData?.hasTranscript || false;
        const hasNotes = meetingData?.hasNotes || false;
        
        return (
          <EventItem
            key={eventId}
            event={event}
            isSelected={eventId === selectedEventId}
            hasTranscript={hasTranscript}
            hasNotes={hasNotes}
            onClick={() => onEventSelect(eventId)}
          />
        );
      })}
    </div>
  )
}

export default EventList