/**
 * logic.js — Tetraism shared date & time logic
 * Used by both: index.html (main calendar) and converter/index.html
 *
 * All functions are pure: no DOM access, no config assumptions.
 * Callers are responsible for passing the right epoch/config values.
 */

/**
 * Returns the Julian Day Number for a Gregorian date.
 * Uses the Fliegel–Van Flandern formula.
 * @param {number} d  day of month
 * @param {number} m  month (1–12)
 * @param {number} y  year (can be negative / BCE)
 */
function getAbsoluteDays(d, m, y) {
    let year = y, month = m;
    if (month <= 2) { year--; month += 12; }
    return Math.floor(365.25 * (year + 4716))
         + Math.floor(30.6001 * (month + 1))
         + d - 1524.5;
}

/**
 * Returns whether a Tetra year is a leap year.
 * A Tetra year maps to Gregorian by: gregYear = tetraYear - 10000
 * @param {number} tetraYear  e.g. 12026
 */
function isLeapYear(tetraYear) {
    const gY = tetraYear - 10000;
    return (gY % 4 === 0 && gY % 100 !== 0) || (gY % 400 === 0);
}

/**
 * Converts a Julian Day Number back to a Gregorian {d, m, y} object.
 * Standard algorithm (handles both Julian and Gregorian calendars).
 * @param {number} jd  Julian Day Number
 * @returns {{ d: number, m: number, y: number }}
 */
function julianToGregorian(jd) {
    const z = Math.floor(jd + 0.5);
    let a;
    if (z < 2299161) {
        a = z;
    } else {
        const alpha = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);

    const day   = b - d - Math.floor(30.6001 * e);
    const month = e < 14 ? e - 1 : e - 13;
    const year  = month > 2 ? c - 4716 : c - 4715;
    return { d: day, m: month, y: year };
}

/**
 * Converts regular (Gregorian) seconds-in-day to Tetra time components.
 * Tetra day = 10 hours × 100 minutes × 100 seconds = 100,000 units
 * @param {number} totalGregSec  seconds since midnight (0–86399)
 * @returns {{ h: number, m: number, s: number }}
 */
function gregSecsToTetra(totalGregSec) {
    const totalTetra = Math.round(totalGregSec * 100000 / 86400);
    return {
        h: Math.floor(totalTetra / 10000),
        m: Math.floor((totalTetra % 10000) / 100),
        s: totalTetra % 100
    };
}

/**
 * Converts Tetra time units back to regular (Gregorian) time.
 * @param {number} totalTetra  Tetra units since midnight (0–99999)
 * @returns {{ h: number, m: number, s: number }}
 */
function tetraUnitsToGreg(totalTetra) {
    const totalGregSec = Math.round(totalTetra * 86400 / 100000);
    return {
        h: Math.floor(totalGregSec / 3600),
        m: Math.floor((totalGregSec % 3600) / 60),
        s: totalGregSec % 60
    };
}

/**
 * Zero-pads a number to the given length.
 * @param {number} n
 * @param {number} [len=2]
 */
function pad(n, len = 2) {
    return String(n).padStart(len, '0');
}
