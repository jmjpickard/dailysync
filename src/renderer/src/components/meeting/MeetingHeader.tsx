import React from 'react'
import { formatTime } from '../../utils/dateUtils'

interface MeetingHeaderProps {
  meeting: any
}

const MeetingHeader: React.FC<MeetingHeaderProps> = ({ meeting }) => {
  // Format time for display
  const startTime = meeting.start?.dateTime ? formatTime(meeting.start.dateTime) : 'All day'
  const endTime = meeting.start?.dateTime && meeting.end?.dateTime
    ? formatTime(meeting.end.dateTime)
    : ''
  
  return (
    <div className="border-b pb-4">
      <h2 className="text-xl font-semibold text-gray-800 mb-1">
        {meeting.summary || 'Untitled Event'}
      </h2>
      <div className="text-sm text-gray-600">
        {startTime}{endTime ? ` - ${endTime}` : ''}
      </div>
    </div>
  )
}

export default MeetingHeader