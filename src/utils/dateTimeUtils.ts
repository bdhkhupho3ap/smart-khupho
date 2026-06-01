/**
 * Utility functions for synchronized date and time formatting.
 * Date format is always dd/MM/yyyy
 * Time format is always HH:mm:ss or HH:mm for meetings
 * Timezone is Asia/Ho_Chi_Minh (GMT+7)
 */

export const TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Format date to dd/MM/yyyy
 */
export function formatDate(dateInput: Date | string | number | undefined | null): string {
  if (!dateInput) return "";
  
  // If already in dd/MM/yyyy or similar, clean it up and return
  if (typeof dateInput === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
    return dateInput;
  }

  // If in yyyy-MM-dd format, split and re-join to avoid timezone shift on local parsing
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const parts = dateInput.split("-");
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    return formatter.format(d); // en-GB outputs dd/MM/yyyy
  } catch (e) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

/**
 * Format time to HH:mm:ss
 */
export function formatTime(dateInput: Date | string | number | undefined | null): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    return formatter.format(d); // HH:mm:ss
  } catch (e) {
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }
}

/**
 * Format time to HH:mm (especially for meeting schedule times)
 */
export function formatTimeHM(dateInput: Date | string | number | undefined | null): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    return formatter.format(d); // HH:mm
  } catch (e) {
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}

/**
 * Format date and time to dd/MM/yyyy HH:mm:ss
 */
export function formatDateTime(dateInput: Date | string | number | undefined | null): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }
  return `${formatDate(d)} ${formatTime(d)}`;
}

/**
 * Format date and time to dd/MM/yyyy HH:mm (especially for meeting schedule displays)
 */
export function formatDateTimeHM(dateInput: Date | string | number | undefined | null): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }
  return `${formatDate(d)} ${formatTimeHM(d)}`;
}

