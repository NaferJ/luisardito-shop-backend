/**
 * Utility to format watchtime minutes into a readable format
 * Converts minutes to the most relevant units: years, months, weeks, days, hours, minutes
 * Always shows the 2 most significant units
 */

function formatWatchtime(minutes) {
  if (!minutes || minutes === 0) return "0 min";

  const totalMinutes = Math.round(minutes);

  // Calculate all units
  const years = Math.floor(totalMinutes / (60 * 24 * 365));
  let remaining = totalMinutes % (60 * 24 * 365);

  const months = Math.floor(remaining / (60 * 24 * 30));
  remaining = remaining % (60 * 24 * 30);

  const weeks = Math.floor(remaining / (60 * 24 * 7));
  remaining = remaining % (60 * 24 * 7);

  const days = Math.floor(remaining / (60 * 24));
  remaining = remaining % (60 * 24);

  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;

  // Build the response showing the 2 most significant units
  const parts = [];

  if (years > 0) {
    parts.push(`${years}a`);
    if (months > 0) {
      parts.push(`${months}m`);
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
    } else if (weeks > 0) {
      parts.push(`${weeks}s`);
    }
  } else if (months > 0) {
    parts.push(`${months}m`);
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
  } else if (weeks > 0) {
    parts.push(`${weeks}s`);
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
  } else if (days > 0) {
    parts.push(`${days}d`);
    if (hours > 0) {
      parts.push(`${hours}h`);
    } else if (mins > 0) {
      parts.push(`${mins}min`);
    }
  } else if (hours > 0) {
    parts.push(`${hours}h`);
  } else {
    parts.push(`${mins}min`);
  }

  return parts.join(" ");
}

module.exports = formatWatchtime;
