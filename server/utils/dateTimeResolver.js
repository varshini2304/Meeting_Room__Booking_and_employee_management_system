import { DEFAULT_TIMEZONE } from "../config/timezones.js";
import { isValidHalfHourSlot } from "./generateSlots.js";

const pad = (n) => String(n).padStart(2, "0");

/**
 * Returns formatted local date parts for a given Date in a specific IANA timezone.
 * @param {Date} date
 * @param {string} timeZone
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number }}
 */
export const getZonedDateTimeParts = (date = new Date(), timeZone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") {
      map[p.type] = Number(p.value);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
  };
};

/**
 * Returns today's date string (YYYY-MM-DD) in the specified branch/IANA timezone.
 * @param {string} timeZone
 * @param {Date} [refDate]
 * @returns {string} YYYY-MM-DD
 */
export const getZonedTodayString = (timeZone = DEFAULT_TIMEZONE, refDate = new Date()) => {
  const p = getZonedDateTimeParts(refDate, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

/**
 * Resolves natural language date expression to a YYYY-MM-DD string in the target timezone.
 * Supported: "today", "tomorrow", "day after tomorrow", "next Monday".."next Sunday", "this Friday", YYYY-MM-DD
 *
 * @param {string} dateExpression
 * @param {string} [timeZone]
 * @param {Date} [referenceDate]
 * @returns {{ resolvedDate: string | null, isPast: boolean, error?: string }}
 */
export const resolveDate = (dateExpression, timeZone = DEFAULT_TIMEZONE, referenceDate = new Date()) => {
  if (!timeZone || typeof timeZone !== "string") {
    return {
      resolvedDate: null,
      isPast: false,
      error: "A valid authoritative timezone is required for date resolution. Unrecognized branches must be clarified before resolving dates."
    };
  }

  if (!dateExpression || typeof dateExpression !== "string") {
    return { resolvedDate: null, isPast: false, error: "Date expression is required" };
  }

  const expr = dateExpression.trim().toLowerCase();
  const todayParts = getZonedDateTimeParts(referenceDate, timeZone);
  const baseDate = new Date(Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day));

  // Direct ISO YYYY-MM-DD match
  const isoMatch = expr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [_, y, m, d] = isoMatch.map(Number);
    const targetDate = new Date(Date.UTC(y, m - 1, d));
    const isPast = targetDate < baseDate;
    return {
      resolvedDate: `${y}-${pad(m)}-${pad(d)}`,
      isPast,
      error: isPast ? "That date is in the past. Which upcoming date would you like?" : undefined,
    };
  }

  let offsetDays = null;

  if (expr === "today") {
    offsetDays = 0;
  } else if (expr === "yesterday") {
    offsetDays = -1;
  } else if (expr === "tomorrow") {
    offsetDays = 1;
  } else if (expr === "day after tomorrow") {
    offsetDays = 2;
  } else {
    // Day of week matches ("monday", "next monday", "this friday")
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    for (const [dayName, dayIndex] of Object.entries(dayMap)) {
      if (expr.includes(dayName)) {
        const currentDayIndex = baseDate.getUTCDay();
        let diff = dayIndex - currentDayIndex;
        if (expr.startsWith("next ")) {
          // "next monday" means the upcoming one (at least 1 day away, max 7)
          diff = diff <= 0 ? diff + 7 : diff;
        } else if (diff < 0) {
          // If day already passed this week, advance to next week
          diff += 7;
        }
        offsetDays = diff;
        break;
      }
    }
  }

  if (offsetDays === null) {
    return {
      resolvedDate: null,
      isPast: false,
      error: `Unable to recognize date "${dateExpression}". Please provide a date like "today", "tomorrow", or "YYYY-MM-DD".`,
    };
  }

  const resultDate = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const resolved = `${resultDate.getUTCFullYear()}-${pad(resultDate.getUTCMonth() + 1)}-${pad(resultDate.getUTCDate())}`;
  const isPast = offsetDays < 0;

  return {
    resolvedDate: resolved,
    isPast,
    error: isPast ? "That date is in the past. Which upcoming date would you like?" : undefined,
  };
};

/**
 * Resolves natural language time expression with explicit disambiguation rules (no silent snapping).
 *
 * Disambiguation rules:
 * - Exact boundaries ("3 PM", "15:00", "3:30 PM") -> exact HH:mm
 * - Explicit approximations ("around 3 PM", "approx 3 PM") -> snaps to hour "15:00"
 * - Non-standard boundaries ("3:15 PM", "3:20 PM") -> needsClarification: true, suggests 3:00 / 3:30
 * - Non-standard boundaries ("3:45 PM") -> needsClarification: true, suggests 3:30 / 4:00
 * - Broad periods ("afternoon", "morning", "evening") -> needsClarification: true
 * - Outside operating hours (08:00 - 20:00) -> error
 *
 * @param {string} timeExpression
 * @returns {{
 *   resolvedStartTime: string | null,
 *   needsClarification: boolean,
 *   suggestedSlots?: string[],
 *   clarificationMessage?: string,
 *   error?: string
 * }}
 */
export const resolveTime = (timeExpression) => {
  if (!timeExpression || typeof timeExpression !== "string") {
    return {
      resolvedStartTime: null,
      needsClarification: false,
      error: "Time expression is required",
    };
  }

  const raw = timeExpression.trim().toLowerCase();

  // 1. Check for broad periods requiring clarification
  if (raw === "afternoon" || raw.includes("in the afternoon")) {
    return {
      resolvedStartTime: null,
      needsClarification: true,
      suggestedSlots: ["14:00", "14:30", "15:00", "15:30", "16:00"],
      clarificationMessage: "What time in the afternoon works best for you? (e.g., 2:00 PM, 3:30 PM)",
    };
  }

  if (raw === "morning" || raw.includes("in the morning")) {
    return {
      resolvedStartTime: null,
      needsClarification: true,
      suggestedSlots: ["09:00", "09:30", "10:00", "10:30", "11:00"],
      clarificationMessage: "What time in the morning works best for you? (e.g., 9:00 AM, 10:30 AM)",
    };
  }

  if (raw === "evening" || raw.includes("in the evening")) {
    return {
      resolvedStartTime: null,
      needsClarification: true,
      suggestedSlots: ["17:00", "17:30", "18:00", "18:30", "19:00"],
      clarificationMessage: "What time in the evening works best for you? (e.g., 5:00 PM, 6:30 PM)",
    };
  }

  if (raw === "noon" || raw === "midday") {
    return {
      resolvedStartTime: "12:00",
      needsClarification: false,
    };
  }

  // 2. Approximation prefix check ("around 3 PM", "approx 3:00", "about 4pm")
  const isApproximate = raw.startsWith("around ") || raw.startsWith("approx ") || raw.startsWith("about ");
  const cleanExpr = raw.replace(/^(around|approx|about)\s+/, "").trim();

  // 3. Parse 12-hour or 24-hour time
  // Matches: "3 PM", "3:30 PM", "15:00", "03:15 pm", "3:45", "10 am"
  const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
  const match = cleanExpr.match(timeRegex);

  if (!match) {
    return {
      resolvedStartTime: null,
      needsClarification: false,
      error: `Could not parse time "${timeExpression}". Please provide a time like "3:00 PM", "15:30", or "10 AM".`,
    };
  }

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  } else if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  // Check 24-hour bounds
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return {
      resolvedStartTime: null,
      needsClarification: false,
      error: `Invalid time value "${timeExpression}".`,
    };
  }

  // 4. Operating hours check (08:00 to 20:00; last 30-min slot starts at 19:30)
  if (hour < 8 || hour > 19 || (hour === 19 && minute > 30)) {
    return {
      resolvedStartTime: null,
      needsClarification: false,
      error: "Operating hours are 8:00 AM to 8:00 PM (last slot begins at 7:30 PM). Please select a time within this window.",
    };
  }

  // 5. If approximate ("around 3 PM" or "around 3:00"), snap cleanly to the hour
  if (isApproximate && minute === 0) {
    return {
      resolvedStartTime: `${pad(hour)}:00`,
      needsClarification: false,
    };
  }

  // 6. Check standard boundaries (:00 or :30)
  if (minute === 0 || minute === 30) {
    return {
      resolvedStartTime: `${pad(hour)}:${pad(minute)}`,
      needsClarification: false,
    };
  }

  // 7. Non-standard minutes -> DO NOT SILENTLY SNAP. Explicitly request clarification!
  const lowerSlot = `${pad(hour)}:${minute < 30 ? "00" : "30"}`;
  const upperSlot = minute < 30 ? `${pad(hour)}:30` : `${pad(hour + 1)}:00`;

  const format12 = (h, m) => {
    const hr = h % 12 === 0 ? 12 : h % 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hr}:${pad(m)} ${ampm}`;
  };

  const lowerSlot12 = format12(hour, minute < 30 ? 0 : 30);
  const upperSlot12 = format12(minute < 30 ? hour : hour + 1, minute < 30 ? 30 : 0);

  return {
    resolvedStartTime: null,
    needsClarification: true,
    suggestedSlots: [lowerSlot, upperSlot],
    clarificationMessage: `Meeting rooms are booked in 30-minute slots. Would you prefer ${lowerSlot12} or ${upperSlot12}?`,
  };
};

/**
 * Validates whether a resolved date and start time are within operating hours and not in the past.
 *
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} startTimeStr HH:mm
 * @param {string} [timeZone]
 * @param {Date} [now]
 * @returns {{ isValid: boolean, error?: string }}
 */
export const validateSlotTiming = (dateStr, startTimeStr, timeZone = DEFAULT_TIMEZONE, now = new Date()) => {
  if (!timeZone || typeof timeZone !== "string") {
    return { isValid: false, error: "A valid authoritative timezone is required for slot validation." };
  }

  if (!isValidHalfHourSlot(startTimeStr)) {
    return { isValid: false, error: "startTime must be in 30-minute slots (:00 or :30)" };
  }

  const [h, m] = startTimeStr.split(":").map(Number);
  if (h < 8 || h > 19 || (h === 19 && m > 30)) {
    return { isValid: false, error: "Operating hours are 8:00 AM to 8:00 PM (last slot is 7:30 PM)" };
  }

  // Check past date/time in the target timezone
  const nowParts = getZonedDateTimeParts(now, timeZone);
  const currentDateStr = `${nowParts.year}-${pad(nowParts.month)}-${pad(nowParts.day)}`;

  if (dateStr < currentDateStr) {
    return { isValid: false, error: "That date is in the past. Which upcoming date would you like?" };
  }

  if (dateStr === currentDateStr) {
    const currentMinutes = nowParts.hour * 60 + nowParts.minute;
    const slotMinutes = h * 60 + m;
    if (slotMinutes <= currentMinutes) {
      return { isValid: false, error: "That time slot has already passed for today. Please choose an upcoming slot." };
    }
  }

  return { isValid: true };
};
