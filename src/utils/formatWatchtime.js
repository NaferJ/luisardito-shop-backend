/**
 * Utility to format watchtime minutes into a readable format
 * Converts minutes to the most relevant units: years, months, weeks, days, hours, minutes
 * Always shows the 2 most significant units
 */

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 60 * 24;
const MINUTES_PER_WEEK = 60 * 24 * 7;
const MINUTES_PER_MONTH = 60 * 24 * 30;
const MINUTES_PER_YEAR = 60 * 24 * 365;

// Appends the days/hours/mins sub-branch shared by the months, weeks and days
// selections (and by the years+months sub-branch). When `days > 0` it emits the
// day unit followed by the most significant of hours/mins; otherwise it emits the
// most significant of hours/mins directly.
function appendDaySubBranch(parts, days, hours, mins) {
  if (days > 0) {
    parts.push(`${days}d`);
    if (hours > 0) {
      parts.push(`${hours}h`);
    } else if (mins > 0) {
      parts.push(`${mins}min`);
    }
  } else if (hours > 0) {
    parts.push(`${hours}h`);
  } else if (mins > 0) {
    parts.push(`${mins}min`);
  }
}

function formatWatchtime(minutes) {
  if (!minutes || minutes === 0) return "0 min";

  const totalMinutes = Math.round(minutes);

  // Calculate all units
  const years = Math.floor(totalMinutes / MINUTES_PER_YEAR);
  let remaining = totalMinutes % MINUTES_PER_YEAR;

  const months = Math.floor(remaining / MINUTES_PER_MONTH);
  remaining = remaining % MINUTES_PER_MONTH;

  const weeks = Math.floor(remaining / MINUTES_PER_WEEK);
  remaining = remaining % MINUTES_PER_WEEK;

  const days = Math.floor(remaining / MINUTES_PER_DAY);
  remaining = remaining % MINUTES_PER_DAY;

  const hours = Math.floor(remaining / MINUTES_PER_HOUR);
  const mins = remaining % MINUTES_PER_HOUR;

  // Build the response. The selection is intentionally branch-specific: under
  // years, weeks is only shown when months is zero (and is terminal); lower
  // units are dropped entirely when years>0 has no months and no weeks.
  const parts = [];

  if (years > 0) {
    parts.push(`${years}a`);
    if (months > 0) {
      parts.push(`${months}m`);
      appendDaySubBranch(parts, days, hours, mins);
    } else if (weeks > 0) {
      parts.push(`${weeks}s`);
    }
  } else if (months > 0) {
    parts.push(`${months}m`);
    appendDaySubBranch(parts, days, hours, mins);
  } else if (weeks > 0) {
    parts.push(`${weeks}s`);
    appendDaySubBranch(parts, days, hours, mins);
  } else if (days > 0) {
    appendDaySubBranch(parts, days, hours, mins);
  } else if (hours > 0) {
    parts.push(`${hours}h`);
  } else {
    parts.push(`${mins}min`);
  }

  return parts.join(" ");
}

module.exports = formatWatchtime;
