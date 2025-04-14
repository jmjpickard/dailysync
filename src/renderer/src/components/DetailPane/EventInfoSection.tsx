import React, { useMemo } from 'react'
import { CalendarEvent } from '../../types'
import { extractMeetingLink } from '../../utils/eventUtils'
import useStore from '../../store'

interface EventInfoSectionProps {
  event: CalendarEvent
}

function getResponseColor(responseStatus?: string): string {
  switch (responseStatus) {
    case 'accepted':
      return 'bg-green-500'
    case 'declined':
      return 'bg-red-500'
    case 'tentative':
      return 'bg-yellow-500'
    default:
      return 'bg-gray-400'
  }
}

const EventInfoSection: React.FC<EventInfoSectionProps> = ({ event }) => {
  // Get notification action from store
  const showNotification = useStore(state => state.addNotification)

  const attendees = event.attendees || []
  const location = event.location || ''
  const description = event.description || ''
  
  // Extract meeting link from event
  const meetingLink = extractMeetingLink(event)
  
  // Memoize the attendee list to prevent unnecessary re-renders
  const attendeeList = useMemo(() => {
    if (attendees.length === 0) return null
    
    return (
      <div className="space-y-1">
        {attendees.slice(0, 5).map((attendee, index) => (
          <div key={index} className="flex items-center">
            <div 
              className={`w-2 h-2 rounded-full mr-2 ${getResponseColor(attendee.responseStatus)}`}
            />
            <span>{attendee.email}</span>
          </div>
        ))}
        {attendees.length > 5 && (
          <div className="text-gray-500 italic">+{attendees.length - 5} more</div>
        )}
      </div>
    )
  }, [attendees])
  
  const handleMeetingLink = (e: React.MouseEvent) => {
    e.preventDefault()
    if (meetingLink) {
      window.electronAPI.openMeetingUrl(meetingLink)
        .then((result) => {
          if (result && typeof result === 'object' && 'error' in result) {
            showNotification(`Error opening meeting link: ${result.error}`, 'error')
          }
        })
        .catch((error) => {
          console.error('Error opening meeting link:', error)
          showNotification('Failed to open meeting link', 'error')
        })
    }
  }
  
  return (
    <div className="mt-4 text-sm text-gray-600">
      {/* Location */}
      {location && (
        <div className="flex items-start mb-3">
          <svg className="w-5 h-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="flex-1 break-words">{location}</div>
        </div>
      )}
      
      {/* Meeting link */}
      {meetingLink && (
        <div className="flex items-start mb-3">
          <svg className="w-5 h-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <a 
            href="#" 
            onClick={handleMeetingLink}
            className="text-blue-600 hover:underline"
          >
            Join video meeting
          </a>
        </div>
      )}
      
      {/* Attendees */}
      {attendees.length > 0 && (
        <div className="flex items-start mb-3">
          <svg className="w-5 h-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <div className="flex-1">
            <div className="font-medium mb-1">Attendees ({attendees.length})</div>
            {attendeeList}
          </div>
        </div>
      )}
      
      {/* Description */}
      {description && (
        <div className="flex items-start mt-4">
          <svg className="w-5 h-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="flex-1">
            <div className="font-medium mb-1">Description</div>
            <div className="whitespace-pre-wrap break-words">{description}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(EventInfoSection)