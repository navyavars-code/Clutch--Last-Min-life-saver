/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Safely parses any date input and returns a formatted string: "h:mm AM/PM" (example: "2:15 PM").
 * If parsing fails, returns "Today".
 */
export function formatLocalTime(dateInput: any): string {
  if (!dateInput) return "Today";
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      return "Today";
    }
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 hour should be 12
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
  } catch {
    return "Today";
  }
}

/**
 * Safely parses any date input and returns a formatted string: "MMM D" (example: "Jun 24").
 * If parsing fails, returns "Today".
 */
export function formatLocalDate(dateInput: any): string {
  if (!dateInput) return "Today";
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (!(d instanceof Date) || isNaN(d.getTime())) {
      return "Today";
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return "Today";
  }
}

/**
 * Formats task duration in a human-readable layout.
 * Under 60 minutes: "[N]m" — example: "45m"
 * Exactly 60 minutes: "1h"
 * Over 60 minutes: "[N]h [M]m" — example: "2h 30m"
 */
export function formatDuration(mins: number): string {
  if (!mins || isNaN(mins) || mins <= 0) return "0m";
  if (mins < 60) {
    return `${mins}m`;
  } else if (mins === 60) {
    return "1h";
  } else {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) {
      return `${h}h`;
    }
    return `${h}h ${m}m`;
  }
}

interface MinimalTask {
  status: string;
  due_date: string;
}

export interface SprintSchedule {
  start: Date;
  end: Date;
  displayString: string;
}

/**
 * Calculates sprint session schedule times based on local time and pending task deadlines.
 */
export function calculateSprintSchedule(
  currentTimeInput: Date | string | number | undefined | null,
  durationMins: number,
  tasks: MinimalTask[] = []
): SprintSchedule {
  const d = currentTimeInput ? new Date(currentTimeInput) : new Date();
  const duration = durationMins && durationMins > 0 ? durationMins : 45;
  
  // 1. Check if there is a pending deadline within 90 minutes
  const hasUrgentDeadline = tasks && Array.isArray(tasks) && tasks.some(t => {
    if (t.status === 'completed') return false;
    const dueTime = new Date(t.due_date).getTime();
    const diffMs = dueTime - d.getTime();
    return diffMs > 0 && diffMs <= 90 * 60 * 1000;
  });

  if (hasUrgentDeadline) {
    const start = new Date(d);
    const end = new Date(start.getTime() + duration * 60000);
    const endStr = formatLocalTime(end);
    return {
      start,
      end,
      displayString: `Starting immediately → ${endStr}`
    };
  }

  const hour = d.getHours();
  
  // 2. Night hours rule: between 23:00 (11:00 PM) and 07:00 (7:00 AM)
  const isNightHour = hour >= 23 || hour < 7;
  
  if (isNightHour) {
    const start = new Date(d);
    if (hour >= 23) {
      start.setDate(start.getDate() + 1);
    }
    start.setHours(7, 30, 0, 0);
    const end = new Date(start.getTime() + duration * 60000);
    const endStr = formatLocalTime(end);
    return {
      start,
      end,
      displayString: `Tomorrow 7:30 AM → ${endStr}`
    };
  }

  // 3. Waking hours rule: between 07:00 and 23:00
  // Schedule starting at current time + 10 minutes, rounded up to nearest 5-minute mark
  const baseDate = new Date(d.getTime() + 10 * 60 * 1000);
  const ms = 1000 * 60 * 5; // 5 minutes
  const roundedStart = new Date(Math.ceil(baseDate.getTime() / ms) * ms);
  
  // Check if the rounded start time falls into the night hours (>= 23:00)
  if (roundedStart.getHours() >= 23 || roundedStart.getHours() < 7) {
    const start = new Date(d);
    if (hour >= 23) {
      start.setDate(start.getDate() + 1);
    }
    start.setHours(7, 30, 0, 0);
    const end = new Date(start.getTime() + duration * 60000);
    const endStr = formatLocalTime(end);
    return {
      start,
      end,
      displayString: `Tomorrow 7:30 AM → ${endStr}`
    };
  }

  const roundedEnd = new Date(roundedStart.getTime() + duration * 60000);
  const startStr = formatLocalTime(roundedStart);
  const endStr = formatLocalTime(roundedEnd);

  return {
    start: roundedStart,
    end: roundedEnd,
    displayString: `${startStr} → ${endStr}`
  };
}
