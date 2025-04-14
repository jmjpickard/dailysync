import React from 'react'
import { CalendarEvent } from '../../types'
import { formatDateTimeRange } from '../../utils/eventUtils'

interface EventHeaderProps {
  event: CalendarEvent
}

const EventHeader: React.FC<EventHeaderProps> = ({ event }) => {
  const dateTimeString = formatDateTimeRange(
    event.start?.dateTime,
    event.end?.dateTime
  )
  
  return (
    <div className="border-b pb-4">
      <h2 className="text-xl font-semibold text-gray-800 mb-1">
        {event.summary || 'Untitled Event'}
      </h2>
      <div className="text-sm text-gray-600">
        {dateTimeString}
      </div>
    </div>
  )
}

// Use React.memo to prevent unnecessary re-renders
export default React.memo(EventHeader)