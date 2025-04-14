/**
 * Formats a date in the format: "Monday, January 1, 2023"
 */
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Formats a date in the format: "Mon, Jan 1"
 */
export const formatShortDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Formats a time in the format: "10:00 AM"
 */
export const formatTime = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Returns the day of the month
 */
export const getDayOfMonth = (date: Date): number => {
  return date.getDate()
}

/**
 * Gets the first day of the month for the given date
 */
export const getFirstDayOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Gets the last day of the month for the given date
 */
export const getLastDayOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * Gets the day of the week (0-6, where 0 is Sunday)
 */
export const getDayOfWeek = (date: Date): number => {
  return date.getDay()
}

/**
 * Gets the name of the month
 */
export const getMonthName = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long' })
}

/**
 * Creates a date array for a calendar month view
 * Includes days from previous/next months to fill out the weeks
 */
export const getCalendarDays = (date: Date): Date[] => {
  const firstDay = getFirstDayOfMonth(date)
  const lastDay = getLastDayOfMonth(date)
  const daysInMonth = lastDay.getDate()
  
  const startingDayOfWeek = getDayOfWeek(firstDay)
  const calendarDays: Date[] = []
  
  // Add days from the previous month
  const prevMonthLastDay = new Date(date.getFullYear(), date.getMonth(), 0).getDate()
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push(new Date(date.getFullYear(), date.getMonth() - 1, prevMonthLastDay - i))
  }
  
  // Add days from the current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(date.getFullYear(), date.getMonth(), i))
  }
  
  // Add days from the next month to complete 6 rows (42 days)
  const remainingDays = 42 - calendarDays.length
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push(new Date(date.getFullYear(), date.getMonth() + 1, i))
  }
  
  return calendarDays
}

/**
 * Adds days to a date
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Checks if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Checks if a date is today
 */
export const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date())
}

/**
 * Checks if a date is in the past
 */
export const isPast = (date: Date): boolean => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

/**
 * Formats a duration between two dates as hours and minutes
 */
export const formatDuration = (startDate: string, endDate: string): string => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const durationMs = end.getTime() - start.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours === 0) {
    return `${minutes} min`
  } else if (minutes === 0) {
    return `${hours} hr`
  } else {
    return `${hours} hr ${minutes} min`
  }
}