import React from 'react'
import { formatTime } from '../../utils/dateUtils'
import { CalendarEvent } from '../../types'
import { RECORDING_STATES } from '../../constants'
import useStore from '../../store'

interface EventItemProps {
  event: CalendarEvent;
  isSelected: boolean;
  hasTranscript?: boolean;
  hasNotes?: boolean;
  onClick: () => void;
}

const EventItem: React.FC<EventItemProps> = ({
  event,
  isSelected,
  hasTranscript = false,
  hasNotes = false,
  onClick
}) => {
  const recording = useStore(state => state.recording);
  
  // Check if this event is currently being recorded
  const isBeingRecorded = 
    recording.recordingEventId === event.id && 
    recording.state === RECORDING_STATES.RECORDING;
  
  // Format the start and end time
  const startTime = event.start?.dateTime ? formatTime(event.start.dateTime) : 'All day';
  const endTime = event.start?.dateTime && event.end?.dateTime 
    ? formatTime(event.end.dateTime) 
    : '';
  
  // Check if the event has a video meeting link
  const hasVideoLink = !!event.hangoutLink;
  
  // Determine if the event is happening now
  const now = new Date();
  const isHappeningNow = event.start?.dateTime && event.end?.dateTime 
    ? new Date(event.start.dateTime) <= now && new Date(event.end.dateTime) >= now
    : false;
  
  return (
    <div 
      className={`
        p-3 rounded-lg cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}
      `}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-medium truncate">{event.summary || 'Untitled Event'}</h3>
          <div className="text-sm text-gray-600">
            {startTime}{endTime ? ` - ${endTime}` : ''}
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          {/* Recording Indicator */}
          {isBeingRecorded && (
            <span className="inline-flex items-center justify-center w-5 h-5 bg-red-100 text-red-800 rounded-full animate-pulse" title="Recording in progress">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="8" />
              </svg>
            </span>
          )}
          
          {hasVideoLink && (
            <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-800 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                <path d="M14 6a1 1 0 011 1v6a1 1 0 01-1 1h-1V6h1z" />
              </svg>
            </span>
          )}
          
          {hasTranscript && (
            <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-800 rounded-full" title="Has Transcript">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </span>
          )}
          
          {hasNotes && (
            <span className="inline-flex items-center justify-center w-5 h-5 bg-yellow-100 text-yellow-800 rounded-full" title="Has Notes">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </span>
          )}
          
          {isHappeningNow && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
              Now
            </span>
          )}
        </div>
      </div>
      
      {event.location && (
        <div className="text-xs text-gray-500 mt-1 truncate">
          <svg className="inline-block w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          {event.location}
        </div>
      )}
      
      {event.attendees && event.attendees.length > 0 && (
        <div className="text-xs text-gray-500 mt-1">
          <svg className="inline-block w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
        </div>
      )}
    </div>
  )
}

export default EventItem