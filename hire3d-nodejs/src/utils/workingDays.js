'use strict';

const Holidays = require('date-holidays');

// England public holidays — the jurisdiction covering all three products
// (THE CHECK, HIRE 3D Core, HIRE 3D Enhanced).
const hd = new Holidays('GB', 'ENG');

function isWorkingDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // weekend
  return hd.isHoliday(date) === false;      // not a bank holiday
}

/**
 * Returns the date that is `days` working days after `startDate`.
 * Weekends and England public holidays are skipped.
 */
function addWorkingDays(startDate, days) {
  const current = new Date(startDate);
  let added = 0;
  while (added < days) {
    current.setDate(current.getDate() + 1);
    if (isWorkingDay(current)) added++;
  }
  // Return as YYYY-MM-DD string to match DATEONLY columns.
  return current.toISOString().slice(0, 10);
}

module.exports = { addWorkingDays, isWorkingDay };
