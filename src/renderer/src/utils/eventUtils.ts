/**
 * Utilities for working with calendar events
 */
import { CalendarEvent } from '../types';

/**
 * Format a date range for display (Jun 15, 2023 4:30 PM - 5:30 PM)
 */
export function formatDateTimeRange(
  startDateTime?: string,
  endDateTime?: string
): string {
  if (!startDateTime || !endDateTime) return "All day";

  const startDate = new Date(startDateTime);
  const endDate = new Date(endDateTime);

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  // Format the dates
  let startStr = startDate.toLocaleString("en-US", options);
  let endStr: string;

  // If same day, only show the time for end
  if (startDate.toDateString() === endDate.toDateString()) {
    endStr = endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else {
    endStr = endDate.toLocaleString("en-US", options);
  }

  return `${startStr} - ${endStr}`;
}

/**
 * Extract meeting link from event
 */
export function extractMeetingLink(event: CalendarEvent): string | null {
  // First check for hangoutLink
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  // Check in description for common meeting URLs
  if (event.description) {
    const urlRegex = /(https?:\/\/[^\s]+\.(zoom|meet|teams|webex|gotomeeting)\.[^\s]+)/i;
    const match = event.description.match(urlRegex);
    if (match) {
      return match[0];
    }
  }

  // Check in location
  if (event.location) {
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = event.location.match(urlRegex);
    if (match) {
      return match[0];
    }
  }

  return null;
}