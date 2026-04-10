/**
 * logic.js — Tetraism shared date & time logic
 * Used by: index.html (main calendar), conventor.html, and any future consumer.
 *
 * ⚠️  PUBLIC API — קובץ זה הוא ממשק ציבורי משותף.
 *     דפים ורכיבים רבים תלויים בו ישירות.
 *     כל שינוי בחתימות הפונקציות, בשמות, או בהתנהגות —
 *     עלול לשבור צרכנים קיימים ללא התראה.
 *     לפני כל שינוי: עדכן את כל הצרכנים הידועים ובדוק תאימות לאחור.
 *
 * ★ Zero hardcoded data. Every constant lives in logic.json.
 *   Change logic.json → every page that includes this file updates automatically.
 *
 * Usage (any page):
 *   <script src="logic.js"></script>
 *   <script>
 *     loadTetraConfig().then(cfg => {
 *       // cfg.epoch, cfg.tetraMonths, cfg.gregMonths, cfg.historicalHolidays …
 *       // pure helpers (getAbsoluteDays, isLeapYear …) are available globally
 *     });
 *   </script>
 *
 * Usage when logic.js and logic.json are in a parent/sibling folder:
 *   <script src="../logic.js"></script>
 *   <script>
 *     loadTetraConfig('../logic.json').then(cfg => { … });
 *   </script>
 */

/* ─── Config loader ──────────────────────────────────────────────── */

/**
 * Fetches logic.json and caches the result in window.TETRA_CONFIG.
 * Safe to call multiple times — subsequent calls return the cache immediately.
 *
 * @param {string} [configPath]  Optional explicit URL/path to logic.json.
 *   Pass this when logic.js and logic.json live in a different directory
 *   from the HTML page (e.g. loadTetraConfig('../logic.json')).
 *   If omitted, the path is inferred from the <script src> attribute.
 *
 * @returns {Promise<Object>}
 */
function loadTetraConfig(configPath) {
    if (window.TETRA_CONFIG) return Promise.resolve(window.TETRA_CONFIG);

    /* Resolve the URL for logic.json:
       1. Use explicit configPath if provided by caller.
       2. Auto-detect from the <script src> that loaded this file.
       3. Fall back to same directory as the page. */
    let url = configPath || null;
    if (!url) {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const me = scripts.find(s => s.src.includes('logic.js'));
        url = me ? me.src.replace(/\/[^/]*$/, '/') + 'logic.json' : 'logic.json';
    }

    return fetch(url)
        .then(r => {
            if (!r.ok) throw new Error(`logic.json not found at ${url} (${r.status})`);
            return r.json();
        })
        .then(data => {
            /* Derived conveniences so callers never recompute them */
            data.historicalExtraHolidaysSet = new Set(data.historicalExtraHolidays);
            data.tetraYearOffset = data.epoch.tY - data.epoch.gY;   /* typically 10000 */
            window.TETRA_CONFIG = data;
            return data;
        });
}

/* ─── Pure math helpers (no data, no DOM) ───────────────────────── */

/**
 * Julian Day Number for a Gregorian (or proleptic-Gregorian) date.
 * Uses the Fliegel–Van Flandern formula.
 *
 * @param {number} d  day of month
 * @param {number} m  month (1–12)
 * @param {number} y  full year (can be 0 or negative / BCE)
 * @returns {number}  Julian Day Number (may be fractional; treat as integer for day-counting)
 */
function getAbsoluteDays(d, m, y) {
    let year = y, month = m;
    if (month <= 2) { year--; month += 12; }
    return Math.floor(365.25 * (year + 4716))
         + Math.floor(30.6001 * (month + 1))
         + d - 1524.5;
}

/**
 * Converts a Julian Day Number back to a Gregorian {d, m, y} object.
 * Standard algorithm — handles both Julian and Gregorian calendars.
 *
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
 * Returns whether a Tetra year is a leap year.
 *
 * @param {number} tetraYear  e.g. 12026
 * @returns {boolean}
 */
function isLeapYear(tetraYear) {
    const offset = (window.TETRA_CONFIG)
        ? window.TETRA_CONFIG.tetraYearOffset
        : 10000;
    const gY = tetraYear - offset;
    return (gY % 4 === 0 && gY % 100 !== 0) || (gY % 400 === 0);
}

/**
 * Converts regular (Gregorian) seconds-since-midnight to Tetra time components.
 *
 * @param {number} totalGregSec  seconds since midnight (0 – 86 399)
 * @returns {{ h: number, m: number, s: number }}
 */
function gregSecsToTetra(totalGregSec) {
    const t = (window.TETRA_CONFIG) ? window.TETRA_CONFIG.time : null;
    const gregPerDay  = t ? t.gregSecondsPerDay  : 86400;
    const tetraPerDay = t ? t.tetraUnitsPerDay   : 248832;
    const mPerH       = t ? t.tetraMinutesPerHour : 144;
    const sPerM       = t ? t.tetraSecondsPerMinute : 144;
    const offsetTetra = t ? (t.tetraTimeOffset || 0) : 0;

    let totalTetra = Math.round(totalGregSec * tetraPerDay / gregPerDay);
    
    // הסטה: כאשר totalTetra היה 3:18:86 (64886 יחידות), עכשיו יהיה 0:000:000
    totalTetra = totalTetra - offsetTetra;
    
    // אם התוצאה שלילית, הוסף יום עשרוני שלם
    if (totalTetra < 0) {
        totalTetra += tetraPerDay;
    }
    
    return {
        h: Math.floor(totalTetra / (mPerH * sPerM)),
        m: Math.floor((totalTetra % (mPerH * sPerM)) / sPerM),
        s: totalTetra % sPerM
    };
}

/**
 * Converts Tetra time units back to regular (Gregorian) time.
 *
 * @param {number} totalTetra  Tetra units since midnight (0 – tetraUnitsPerDay-1)
 * @returns {{ h: number, m: number, s: number }}
 */
function tetraUnitsToGreg(totalTetra) {
    const t = (window.TETRA_CONFIG) ? window.TETRA_CONFIG.time : null;
    const gregPerDay  = t ? t.gregSecondsPerDay  : 86400;
    const tetraPerDay = t ? t.tetraUnitsPerDay   : 248832;
    const offsetTetra = t ? (t.tetraTimeOffset || 0) : 0;

    // הוסף את ההסטה בחזרה לפני ההמרה לגרגוריאני
    let adjustedTetra = totalTetra + offsetTetra;
    
    // אם חרגנו מעבר ליום, החזר ליום הבא
    if (adjustedTetra >= tetraPerDay) {
        adjustedTetra -= tetraPerDay;
    }

    const totalGregSec = Math.round(adjustedTetra * gregPerDay / tetraPerDay);
    return {
        h: Math.floor(totalGregSec / 3600),
        m: Math.floor((totalGregSec % 3600) / 60),
        s: totalGregSec % 60
    };
}

/**
 * Zero-pads a number to the given length.
 *
 * @param {number} n
 * @param {number} [len=2]
 * @returns {string}
 */
function pad(n, len = 2) {
    return String(n).padStart(len, '0');
}