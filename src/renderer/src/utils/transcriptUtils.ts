/**
 * Utility functions for transcript formatting
 */

/**
 * Format a plain text transcript for display
 * @param text The transcript text
 * @returns Formatted HTML string
 */
export function formatTranscript(text: string): string {
  if (!text) return '';
  
  // Basic formatting: preserve paragraphs, escape HTML
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Check if this transcript has timestamp format like [00:00:00.000 --> 00:00:07.000]
  if (escaped.match(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\]/)) {
    return formatTimestampedTranscript(escaped);
  }

  // Split by lines and wrap paragraphs
  return escaped
    .split("\n")
    .map((line) => (line.trim() ? `<p>${line}</p>` : ""))
    .join("");
}

/**
 * Format a timestamped transcript by grouping into larger chunks
 * @param text The timestamped transcript text
 * @returns Formatted HTML with grouped timestamps
 */
export function formatTimestampedTranscript(text: string): string {
  // Regular expression to match timestamp lines
  const timestampRegex = /\[(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.*)/;
  
  // Split the transcript into lines
  const lines = text.split("\n");
  
  // Group size in seconds (default 30 seconds)
  const groupSize = 30;
  
  // Initialize variables
  let result = '';
  let currentGroup: { start: string, end: string, lines: string[] } | null = null;
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Check if this is a timestamp line
    const match = line.match(timestampRegex);
    if (match) {
      const [_, startTime, endTime, content] = match;
      
      // Convert start time to seconds for comparison
      const startSeconds = timeToSeconds(startTime);
      
      // If no current group or this timestamp is outside the current group's range, create a new group
      if (!currentGroup || startSeconds - timeToSeconds(currentGroup.start) >= groupSize) {
        // If we have a current group, add it to the result
        if (currentGroup) {
          result += formatGroup(currentGroup);
        }
        
        // Start a new group
        currentGroup = {
          start: startTime,
          end: endTime,
          lines: [content]
        };
      } else {
        // Update the end time of the current group
        currentGroup.end = endTime;
        // Add this line's content to the current group
        currentGroup.lines.push(content);
      }
    } else {
      // If this is not a timestamp line but we have a current group, add it as plain text
      if (currentGroup) {
        currentGroup.lines.push(line);
      }
    }
  }
  
  // Add the last group if there is one
  if (currentGroup) {
    result += formatGroup(currentGroup);
  }
  
  return result;
}

/**
 * Format a group of transcript lines
 */
function formatGroup(group: { start: string, end: string, lines: string[] }): string {
  const timestamp = `[${group.start} --> ${group.end}]`;
  const content = group.lines.join(' ').trim();
  
  return `<div class="transcript-group">
    <div class="transcript-timestamp">${timestamp}</div>
    <div class="transcript-content-text">${content}</div>
  </div>`;
}

/**
 * Convert a time string (HH:MM:SS.SSS) to seconds
 */
export function timeToSeconds(timeStr: string): number {
  const [hours, minutes, secondsWithMs] = timeStr.split(':');
  const seconds = parseFloat(secondsWithMs);
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + seconds;
}