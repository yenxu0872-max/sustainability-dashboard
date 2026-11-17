/*
  Shared code for the dashboard (index.html) and the editor (editor.html).
  Plain JavaScript, no libraries, no build step. Written to run on older
  TV and signage browsers too, so it avoids the newest syntax (no ?. or ??).
*/
(function () {
  "use strict";

  var SD = (window.SD = {});
  var CONFIG = (SD.config = Object.assign(
    {
      dataSource: "file",
      dataFile: "data/dashboard-data.js",
      googleSheet: {},
      theme: "light",
      defaultView: "grid",
      refreshMinutes: 10,
      quickCheckSeconds: 30,
      highlightNewDays: 7,
      tv: {},
      locale: "en-GB",
      showEditorLink: false
    },
    window.DASHBOARD_CONFIG || {}
  ));
  CONFIG.tv = Object.assign(
    { theme: "light", cardsPerPage: 3, secondsPerPage: 15, secondsPerUpdate: 10, reloadPageEveryHours: 12, sleepFrom: "", sleepTo: "", sleepWeekends: false },
    CONFIG.tv || {}
  );

  /* ---------- Categories and statuses ---------- */

  // Colours live in dashboard.css (--cat-<key>). Order here is display order.
  SD.CATEGORIES = [
    { key: "energy", label: "Energy" },
    { key: "waste", label: "Waste & recycling" },
    { key: "water", label: "Water" },
    { key: "food", label: "Food" },
    { key: "nature", label: "Nature" },
    { key: "transport", label: "Travel" },
    { key: "community", label: "Community" },
    { key: "other", label: "Other" }
  ];

  SD.STATUSES = [
    { key: "planning", label: "Planning" },
    { key: "in-progress", label: "In progress" },
    { key: "completed", label: "Completed" },
    { key: "on-hold", label: "On hold" }
  ];

  var CATEGORY_ALIASES = {
    energy: "energy", electricity: "energy", power: "energy",
    waste: "waste", recycling: "waste", wasterecycling: "waste", plastic: "waste",
    water: "water",
    food: "food",
    nature: "nature", biodiversity: "nature", trees: "nature", wildlife: "nature",
    transport: "transport", travel: "transport",
    community: "community", learning: "community", communitylearning: "community", education: "community",
    other: "other"
  };

  var STATUS_ALIASES = {
    planning: "planning", planned: "planning", idea: "planning", notstarted: "planning",
    inprogress: "in-progress", ongoing: "in-progress", active: "in-progress", started: "in-progress",
    completed: "completed", complete: "completed", done: "completed", finished: "completed",
    onhold: "on-hold", paused: "on-hold", hold: "on-hold", stopped: "on-hold"
  };

  function keyify(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  SD.keyify = keyify;

  // "Solar panels on the Sports Hall" -> "solar-panels-on-the-sports-hall", for project links.
  function slugify(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  }

  // "Waste & recycling", "waste", "Recycling" -> "waste". Unknown -> null.
  SD.categoryKey = function (v) {
    return CATEGORY_ALIASES[keyify(v)] || null;
  };

  SD.category = function (key) {
    for (var i = 0; i < SD.CATEGORIES.length; i++) if (SD.CATEGORIES[i].key === key) return SD.CATEGORIES[i];
    return SD.CATEGORIES[SD.CATEGORIES.length - 1];
  };
  SD.status = function (key) {
    for (var i = 0; i < SD.STATUSES.length; i++) if (SD.STATUSES[i].key === key) return SD.STATUSES[i];
    return SD.STATUSES[0];
  };

  /* ---------- Icons (inline SVG, 24x24, stroke) ---------- */

  var ICONS = {
    energy: '<path d="M13 2.5 4.5 13.5h6.5l-1 8 8.5-11h-6.5l1-8z"/>',
    waste: '<path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L20.5 8.5"/><path d="M20.5 3.5v5h-5"/><path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5"/><path d="M3.5 20.5v-5h5"/>',
    water: '<path d="M12 3s-6.5 7-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10 12 3 12 3z"/>',
    food: '<path d="M12 7.5c-1.8-1.3-5.6-1.6-7.1 1.3-1.6 3-.6 7.4 1.3 10 1.7 2.3 3.7 2.3 5.8 1.3 2.1 1 4.1 1 5.8-1.3 1.9-2.6 2.9-7 1.3-10-1.5-2.9-5.3-2.6-7.1-1.3z"/><path d="M12 7.5c0-2 .8-3.6 2.8-4.5"/>',
    nature: '<path d="M11 20a7 7 0 0 1-7-7c0-6 5-9 16-9 0 11-3 16-9 16z"/><path d="M4 20.5c3.5-4 7-7 11-10"/>',
    transport: '<circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16 9 9h6.5l3 7"/><path d="M9 9l3.5 7h-7"/><path d="M7.5 6h3"/><path d="M14 6h2l-.5 3"/>',
    community: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 13.5a5 5 0 0 1 5 6.5"/>',
    other: '<path d="M12 3.5l2.3 6.2 6.2 2.3-6.2 2.3L12 20.5l-2.3-6.2L3.5 12l6.2-2.3z"/>',
    planning: '<circle cx="12" cy="12" r="8" stroke-dasharray="3.2 3"/>',
    "in-progress": '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>',
    completed: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7L16.2 9.5"/>',
    "on-hold": '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>',
    leaf: '<path d="M11 20a7 7 0 0 1-7-7c0-6 5-9 16-9 0 11-3 16-9 16z"/><path d="M4 20.5c3.5-4 7-7 11-10"/>',
    news: '<path d="M4 5h12v14H6a2 2 0 0 1-2-2z"/><path d="M16 9h4v8a2 2 0 0 1-2 2h-2"/><path d="M7.5 9h5M7.5 12.5h5M7.5 16h3"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5"/><path d="M8 13l-1.6-1.8a1.6 1.6 0 0 0-2.4 2.1L8 19c1.2 1.4 2.6 2 4.5 2h.5a5 5 0 0 0 5-5v-3"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    warning: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    // Editor buttons
    chevron: '<path d="m9 5 7 7-7 7"/>',
    tv: '<rect x="3" y="4.5" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 17v3.5"/>',
    expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M4.5 19.5h15"/>',
    upload: '<path d="M12 15.5v-11M7 9l5-5 5 5"/><path d="M4.5 19.5h15"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6"/><path d="M6.5 7l1 12.5h9l1-12.5"/><path d="M9.5 7V4.5h5V7"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11"/><path d="M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
    chart: '<path d="M4 4v16h16"/><path d="m7.5 14.5 3.5-4 3 2.5 5-6"/>',
    "trend-down": '<path d="m3.5 7 6.5 6.5 3.5-3.5 7 7"/><path d="M20.5 11.5V17H15"/>',
    "trend-up": '<path d="m3.5 17 6.5-6.5 3.5 3.5 7-7"/><path d="M20.5 12.5V7H15"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    flag: '<path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>',
    team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 13.5a5 5 0 0 1 5 6.5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    list: '<rect x="3.5" y="5" width="5" height="5" rx="1.2"/><rect x="3.5" y="14" width="5" height="5" rx="1.2"/><path d="M11.5 6.5h9M11.5 9h6M11.5 15.5h9M11.5 18h6"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4 17.5 5-4.5 4 3.5 2.5-2 4.5 3.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.9-4.9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    qr: '<rect x="3.5" y="3.5" width="6" height="6" rx="1"/><rect x="14.5" y="3.5" width="6" height="6" rx="1"/><rect x="3.5" y="14.5" width="6" height="6" rx="1"/><path d="M14.5 14.5h2v2h-2zM18.5 18.5h2v2h-2zM14.5 20.5v-1M20.5 14.5h-1"/>'
  };

  SD.icon = function (name, cls) {
    var body = ICONS[name] || ICONS.other;
    return (
      '<svg class="icon' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + "</svg>"
    );
  };

  /*
    The dashboard's own logo: a shield in the school's navy with a sand border,
    and one of the campus rain trees by the lake under a gold sun. The same
    drawing is in assets/logo-mark.svg and assets/logo.svg for posters.
    It isn't the official school crest; a crest added in the editor replaces it.
  */
  SD.logoMark = function () {
    return (
      '<svg class="logo-svg" viewBox="0 0 64 72" width="64" height="72" aria-hidden="true" focusable="false">' +
        '<path class="lm-shield" d="M5 4h54v32c0 17-12.5 27.5-27 32C17.5 63.5 5 53 5 36z" fill="#153573"/>' +
        '<path class="lm-rule" d="M9.5 8.5h45V36c0 14.3-10.4 23.4-22.5 27.4C19.9 59.4 9.5 50.3 9.5 36z" fill="none" stroke="#deb88a" stroke-width="1.5"/>' +
        '<circle class="lm-sun" cx="46.5" cy="15" r="3.6" fill="#f4bf23"/>' +
        '<g class="lm-tree">' +
          '<path d="M30.3 51v-8.6c-2.2-2.9-4.9-5-8.3-6.6l1-1.9c3.2 1.3 5.7 3.2 7.6 5.5-.2-1.9-.8-3.6-1.9-5.1l1.7-1.1c1.4 1.9 2.1 4 2.2 6.4 1.6-2.4 3.9-4.4 7-5.8l.9 2c-3.6 1.6-6.1 4-7.6 6.6V51z" fill="#deb88a"/>' +
          '<g class="lm-canopy">' +
            '<path d="M11.5 34.6c-1.6-5.2 2.6-9 7.3-8.9 1.4-5 7-7.2 11.5-5.6 3.1-3 9.6-2.6 12.1 1.1 5-.6 9.5 3.4 9.1 7.9 2.6 1.5 2.1 5.3-.9 5.8z" fill="#b9d478"/>' +
            '<path d="M11.6 34.6c12.8-2.4 26-2.4 38.9.3-12.9 2.6-26.1 2.5-38.9-.3z" fill="#8fae4a"/>' +
          "</g>" +
        "</g>" +
        '<path class="lm-ground" d="M14.5 51h35" stroke="#deb88a" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path class="lm-water" pathLength="1" d="M18 56c2.3-1.5 4.7-1.5 7 0s4.7 1.5 7 0 4.7-1.5 7 0 4.7 1.5 7 0M23.5 60.5c2.1-1.3 4.2-1.3 6.3 0s4.2 1.3 6.3 0 3.4-1.1 4.6-.4" fill="none" stroke="#b0d0ef" stroke-width="1.5" stroke-linecap="round"/>' +
      "</svg>"
    );
  };

  /* ---------- Small helpers ---------- */

  SD.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  // Only allow http(s), mailto and relative links (no javascript: URLs).
  SD.safeUrl = function (u) {
    u = String(u == null ? "" : u).trim();
    if (!u) return "";
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  };

  // Images can also be photos stored inside the data file (data:image/...),
  // which is how the editor saves photos.
  SD.safeImage = function (u) {
    u = String(u == null ? "" : u).trim();
    if (!u) return "";
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+\/=\s]+$/i.test(u)) return u;
    if (/^mailto:/i.test(u)) return "";
    return SD.safeUrl(u);
  };

  function toNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    var s = String(v).replace(/[,\s]/g, "").replace(/%$/, "");
    if (s === "") return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }
  SD.toNumber = toNumber;

  // A time of day as "HH:MM" ("7:30", "07.30" and "7:30pm" all work), or "" if it isn't one.
  SD.hhmm = function (v) {
    var m = /^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*$/i.exec(v === null || v === undefined ? "" : String(v));
    if (!m || (!m[2] && !m[3])) return "";
    var h = +m[1], min = m[2] ? +m[2] : 0, ap = (m[3] || "").toLowerCase();
    if (ap) { if (h < 1 || h > 12) return ""; h = h % 12 + (ap === "pm" ? 12 : 0); }
    return h < 24 && min < 60 ? (h < 10 ? "0" : "") + h + ":" + (min < 10 ? "0" : "") + min : "";
  };

  function toBool(v) {
    if (typeof v === "boolean") return v;
    return /^(true|yes|y|1|x)$/i.test(String(v == null ? "" : v).trim());
  }

  SD.formatNumber = function (n) {
    if (n === null || n === undefined || !isFinite(n)) return "";
    var abs = Math.abs(n);
    var loc = CONFIG.locale || "en-GB";
    function fmt(x, digits) {
      try {
        return x.toLocaleString(loc, { maximumFractionDigits: digits });
      } catch (e) {
        return String(Math.round(x * Math.pow(10, digits)) / Math.pow(10, digits));
      }
    }
    if (abs >= 1e9) return fmt(n / 1e9, 1) + "B";
    if (abs >= 1e6) return fmt(n / 1e6, 1) + "M";
    if (abs >= 1e5) return fmt(n / 1e3, 0) + "K";
    return fmt(n, abs < 10 ? 2 : abs < 100 ? 1 : 0);
  };

  // Accepts 2026-11-04, 04/11/2026 (UK day first) or anything Date can read.
  SD.parseDate = function (v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    var s = String(v).trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/.exec(s))) return new Date(+m[3], +m[2] - 1, +m[1]);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  };

  SD.formatDate = function (v, opts) {
    var d = SD.parseDate(v);
    if (!d) return "";
    try {
      return d.toLocaleDateString(CONFIG.locale || "en-GB", opts || { day: "numeric", month: "short", year: "numeric" });
    } catch (e) {
      return d.toDateString();
    }
  };

  SD.todayISO = function () {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  };

  /*
    Progress of a project's measure.
    - With no start value: progress = current / target (e.g. 24 of 60 panels).
    - With a start value: progress = how far you've moved from start towards
      target. Works for "reduce" goals too (start 52,000 kWh -> target 45,000).
  */
  SD.progress = function (p) {
    var cur = toNumber(p.metricCurrent), tgt = toNumber(p.metricTarget), start = toNumber(p.metricStart);
    if (cur === null || tgt === null) return null;
    var hasStart = start !== null;
    if (!hasStart) start = 0;
    var span = tgt - start;
    if (span === 0) return null;
    var raw = (cur - start) / span;
    return {
      raw: raw,
      ratio: Math.max(0, Math.min(1, raw)),
      pct: Math.max(0, Math.round(raw * 100)),
      reached: raw >= 1,
      current: cur,
      target: tgt,
      start: hasStart ? start : null,
      reduce: tgt < start,
      unit: p.metricUnit || "",
      label: p.metricLabel || ""
    };
  };

  /* ---------- School colour ---------- */

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(c) {
    return "#" + c.map(function (v) { return ("0" + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join("");
  }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return a[i] * (1 - t) + b[i] * t; }); }
  function luminance(c) {
    var v = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  SD.contrast = function (hexA, hexB) { return contrast(hexToRgb(hexA), hexToRgb(hexB)); };

  /*
    Turn one school colour into the colours the page needs, keeping text
    readable whatever colour is chosen: white or dark text on the colour,
    a darker (or lighter, in dark mode) shade for links, and a soft tint.
    An empty colour keeps the built-in school navy.
  */
  SD.applyBrand = function (hex) {
    var style = document.documentElement.style;
    var names = ["--accent", "--accent-ink", "--accent-soft", "--on-accent"];
    var c = hexToRgb(hex);
    if (!c) { names.forEach(function (n) { style.removeProperty(n); }); return; }
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    var white = [255, 255, 255], ink = [6, 32, 71];
    var surface = dark ? [10, 26, 53] : white;
    var onAccent = contrast(c, white) >= 4.5 || contrast(c, white) >= contrast(c, ink) ? white : ink;
    var accentInk = c;
    for (var i = 1; i <= 20 && contrast(accentInk, surface) < 4.5; i++) accentInk = mix(c, dark ? white : ink, i * 0.05);
    style.setProperty("--accent", rgbToHex(c));
    style.setProperty("--on-accent", rgbToHex(onAccent));
    style.setProperty("--accent-ink", rgbToHex(accentInk));
    style.setProperty("--accent-soft", rgbToHex(mix(c, surface, dark ? 0.78 : 0.9)));
  };

  /* ---------- Cleaning up content so the page never breaks ---------- */

  function str(v) {
    return v === null || v === undefined ? "" : String(v).trim();
  }

  SD.normalise = function (raw) {
    raw = raw || {};
    var school = raw.school || {}, dash = raw.dashboard || {}, gi = raw.getInvolved || {};
    var out = {
      isSampleData: raw.isSampleData === undefined ? false : toBool(raw.isSampleData),
      school: {
        name: str(school.name),
        logo: SD.safeImage(school.logo),
        logoWhite: SD.safeImage(school.logoWhite),   // the white version, for the navy footer
        color: /^#[0-9a-f]{6}$/i.test(str(school.color)) ? str(school.color).toLowerCase() : ""
      },
      dashboard: {
        title: str(dash.title) || "Sustainability Dashboard",
        tagline: str(dash.tagline),
        banner: SD.safeImage(dash.banner),
        bannerAlt: str(dash.bannerAlt),
        about: str(dash.about),
        aboutImage: SD.safeImage(dash.aboutImage),
        contact: str(dash.contact),
        lastUpdated: str(dash.lastUpdated),
        madeBy: str(dash.madeBy)
      },
      stats: [],
      projects: [],
      updates: [],
      getInvolved: {
        heading: str(gi.heading) || "Get involved",
        text: str(gi.text),
        link: str(gi.link),
        linkLabel: str(gi.linkLabel) || "Find out more",
        qrImage: str(gi.qrImage),
        image: SD.safeImage(gi.image)
      }
    };

    (raw.stats || []).forEach(function (s) {
      if (!s || !str(s.label)) return;
      out.stats.push({
        label: str(s.label),
        value: toNumber(s.value) === null ? str(s.value) : toNumber(s.value),
        unit: str(s.unit),
        note: str(s.note),
        icon: CATEGORY_ALIASES[keyify(s.icon)] || "other",
        asOf: str(s.asOf),
        previous: toNumber(s.previous),
        compareLabel: str(s.compareLabel),
        direction: /^(down|lower|less)/i.test(str(s.direction)) ? "down" : "up",
        image: SD.safeImage(s.image),
        source: str(s.source),                     // "project:<id>" or "chart:<title>" to work it out (see SD.workOut)
        calc: str(s.calc).toLowerCase(),
        factor: toNumber(s.factor)
      });
    });

    (raw.projects || []).forEach(function (p, i) {
      if (!p || !str(p.title)) return;
      out.projects.push({
        id: str(p.id) || "project-" + (i + 1),
        title: str(p.title),
        category: CATEGORY_ALIASES[keyify(p.category)] || "other",
        status: STATUS_ALIASES[keyify(p.status)] || "planning",
        summary: str(p.summary),
        team: str(p.team),
        metricLabel: str(p.metricLabel),
        metricStart: str(p.metricStart),
        metricCurrent: str(p.metricCurrent),
        metricTarget: str(p.metricTarget),
        metricUnit: str(p.metricUnit),
        nextStep: str(p.nextStep),
        getInvolved: str(p.getInvolved),
        helpLink: SD.safeUrl(p.helpLink),
        image: SD.safeImage(p.image),
        imageAlt: str(p.imageAlt),
        story: str(p.story),
        startDate: str(p.startDate),
        endDate: str(p.endDate),
        gallery: listOf(p.gallery).map(function (g) {
          return typeof g === "string" ? { image: SD.safeImage(g), imageAlt: "" } : { image: SD.safeImage(g && g.image), imageAlt: str(g && g.imageAlt) };
        }).filter(function (g) { return g.image; }).slice(0, 6),
        milestones: listOf(p.milestones).filter(function (m) { return m && str(m.title); }).map(function (m) {
          return { title: str(m.title), date: str(m.date), done: toBool(m.done) };
        }),
        featured: toBool(p.featured),
        updated: str(p.updated)
      });
    });

    (raw.updates || []).forEach(function (u) {
      if (!u || !str(u.text)) return;
      out.updates.push({
        date: str(u.date),
        text: str(u.text),
        category: CATEGORY_ALIASES[keyify(u.category)] || "",
        project: str(u.project),
        image: SD.safeImage(u.image)
      });
    });
    out.updates.sort(function (a, b) {
      var da = SD.parseDate(a.date), db = SD.parseDate(b.date);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });

    // Events, soonest first. Pages only show the ones that haven't happened yet.
    out.events = listOf(raw.events).filter(function (e) { return e && str(e.title) && SD.parseDate(e.date); }).map(function (e) {
      return {
        date: str(e.date), time: str(e.time), title: str(e.title), place: str(e.place),
        project: str(e.project), category: CATEGORY_ALIASES[keyify(e.category)] || "",
        image: SD.safeImage(e.image)
      };
    }).sort(function (a, b) { return SD.parseDate(a.date) - SD.parseDate(b.date); });

    // Charts of a number over time.
    out.trends = listOf(raw.trends).filter(function (t) { return t && str(t.title); }).map(function (t) {
      return {
        title: str(t.title), unit: str(t.unit), note: str(t.note),
        icon: CATEGORY_ALIASES[keyify(t.icon)] || "other",
        direction: /^(up|higher|more)/i.test(str(t.direction)) ? "up" : "down",
        target: toNumber(t.target),
        points: listOf(t.points).filter(function (pt) { return pt && str(pt.label) && toNumber(pt.value) !== null; })
          .map(function (pt) { return { label: str(pt.label), value: toNumber(pt.value) }; })
      };
    }).filter(function (t) { return t.points.length; });

    // A competition table, highest score first.
    var lb = raw.leaderboard || {};
    out.leaderboard = {
      title: str(lb.title), unit: str(lb.unit), note: str(lb.note),
      entries: listOf(lb.entries).filter(function (e) { return e && str(e.name) && toNumber(e.score) !== null; })
        .map(function (e) { return { name: str(e.name), score: toNumber(e.score), image: SD.safeImage(e.image) }; })
        .sort(function (a, b) { return b.score - a.score; })
    };

    // Screen settings chosen in the editor's Screens tab. Empty (null) means "use config.js".
    var disp = raw.display || {};
    function whole(v, min, max) { var n = toNumber(v); return n === null ? null : Math.min(max, Math.max(min, Math.round(n))); }
    function oneOf(v, list) { v = str(v).toLowerCase(); return list.indexOf(v) === -1 ? "" : v; }
    out.display = {
      tvCardsPerPage: whole(disp.tvCardsPerPage, 1, 4),
      tvSecondsPerPage: whole(disp.tvSecondsPerPage, 5, 120),
      tvSecondsPerNews: whole(disp.tvSecondsPerNews, 4, 60),
      tvTheme: oneOf(disp.tvTheme, ["light", "dark"]),
      theme: oneOf(disp.theme, ["light", "dark", "auto"]),
      defaultView: oneOf(disp.defaultView, ["grid", "list"]),
      highlightNewDays: whole(disp.highlightNewDays, 0, 60),
      tvSleepFrom: SD.hhmm(disp.tvSleepFrom),
      tvSleepTo: SD.hhmm(disp.tvSleepTo),
      tvSleepWeekends: oneOf(disp.tvSleepWeekends, ["yes", "no"])
    };

    out.tips = listOf(raw.tips).map(function (t) { return str(t && t.text !== undefined ? t.text : t); }).filter(Boolean);

    // Photos from around school, shown as a swipeable gallery.
    out.gallery = listOf(raw.gallery).map(function (g) {
      return typeof g === "string" ? { image: SD.safeImage(g), caption: "" } : { image: SD.safeImage(g && g.image), caption: str(g && g.caption) };
    }).filter(function (g) { return g.image; }).slice(0, 24);

    // Headline numbers linked to a project or chart are worked out now, so every screen agrees.
    out.stats.forEach(function (s) {
      var r = SD.workOut(out, s);
      if (!r) return;
      s.value = r.value;
      s.from = r.from;
      s.fromLink = r.link;
      if (r.asOf) s.asOf = r.asOf;
      if (s.previous === null && r.previous !== null) {
        s.previous = r.previous;
        s.previousAuto = true;           // worked out again every time, so the editor doesn't save it
        if (!s.compareLabel) { s.compareLabel = r.compareLabel; s.compareAuto = true; }
      }
    });

    return out;
  };

  /*
    The things screens keep an eye on, as short strings, so anything new or changed can be circled
    on the screens (dashboard.js) and listed in the editor before it's published. A key with "|"
    in it is one detail of a thing (a project's progress); a key without is the thing itself.
  */
  SD.newsKey = function (u) { return "news:" + u.date + ":" + u.text; };
  SD.eventKey = function (e) { return "event:" + e.date + ":" + e.title; };
  SD.watchedFacts = function (data) {
    var f = {};
    data.stats.forEach(function (s) { f["stat:" + s.label] = String(s.value); });
    data.projects.forEach(function (p) {
      var k = "project:" + p.id, m = SD.progress(p);
      f[k] = "1";
      f[k + "|progress"] = m ? m.current + "@" + m.pct : "";
      f[k + "|status"] = p.status;
      f[k + "|summary"] = p.summary || "";
      f[k + "|next"] = p.nextStep || "";
      f[k + "|help"] = p.getInvolved || "";
    });
    data.updates.forEach(function (u) { f[SD.newsKey(u)] = "1"; });
    data.events.forEach(function (e) { f[SD.eventKey(e)] = "1"; });
    data.leaderboard.entries.forEach(function (e, i) { f["league:" + e.name] = e.score + "@" + (i + 1); });
    return f;
  };

  /*
    Working out a headline number from what students already keep up to date, so nobody types
    the same number twice. A number's source is "project:<id>" or "chart:<chart title>", and
    calc says how:
      now     the project's "Now" number, or the chart's latest value
      change  how far it has moved: from the project's "Start" to "Now" (e.g. electricity saved,
              52,000 down to 48,600 = 3,400 kWh), or from the chart's first value to its latest
      total   all the chart's values added up (e.g. bottles refilled each month)
    factor multiplies the answer, e.g. 0.001 to turn kg into tonnes.
    The date is the project's "last updated" (or the dashboard's, for a chart). A chart also gives
    the number before its latest value to compare with, unless "Number last time" is filled in.
    Returns null if the source can't be found, and the typed-in number is shown instead.
  */
  SD.CALCS = {
    project: [{ value: "now", label: "Its \"Now\" number" }, { value: "change", label: "How far it has moved, from Start to Now" }],
    chart: [{ value: "now", label: "The latest value" }, { value: "total", label: "All the values added up" }, { value: "change", label: "How far it has moved, from the first value to the latest" }]
  };
  SD.workOut = function (data, s) {
    var m = /^(project|chart):\s*(.+)$/i.exec(s.source || "");
    if (!m) return null;
    var kind = m[1].toLowerCase(), key = m[2].trim().toLowerCase();
    var calc = s.calc || "now", factor = s.factor === null || s.factor === undefined ? 1 : s.factor;
    function tidy(n) { return Math.round(n * factor * 1000) / 1000; }
    if (kind === "project") {
      var p = data.projects.filter(function (x) { return x.id.toLowerCase() === key; })[0];
      var cur = p ? toNumber(p.metricCurrent) : null;
      if (cur === null) return null;
      var start = toNumber(p.metricStart) || 0;
      return { value: tidy(calc === "change" ? Math.abs(cur - start) : cur), from: p.title, link: "#project=" + encodeURIComponent(p.id), asOf: p.updated, previous: null, compareLabel: "" };
    }
    var t = data.trends.filter(function (x) { return x.title.toLowerCase() === key; })[0];
    if (!t) return null;
    function of(pts) {
      var vals = pts.map(function (pt) { return pt.value; });
      return calc === "total" ? vals.reduce(function (a, b) { return a + b; }, 0)
        : calc === "change" ? Math.abs(vals[vals.length - 1] - vals[0])
        : vals[vals.length - 1];
    }
    var n = t.points.length, before = t.points[n - 2];
    return {
      value: tidy(of(t.points)), from: t.title, link: "#trends", asOf: data.dashboard.lastUpdated,
      previous: n > 1 ? tidy(of(t.points.slice(0, -1))) : null,
      compareLabel: n > 1 ? (calc === "now" ? before.label : "end of " + before.label) : ""
    };
  };

  function listOf(v) { return Array.isArray(v) ? v : []; }

  // Upcoming events only (today counts as upcoming).
  SD.upcomingEvents = function (data) {
    var today = SD.parseDate(SD.todayISO());
    return data.events.filter(function (e) { return SD.parseDate(e.date) >= today; });
  };

  // "Today", "Tomorrow", "In 5 days"
  SD.daysAway = function (date) {
    var d = SD.parseDate(date), today = SD.parseDate(SD.todayISO());
    if (!d) return "";
    var n = Math.round((d - today) / 86400000);
    return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n > 1 ? "In " + n + " days" : "";
  };

  // Tip of the day: the same tip all day, a different one tomorrow.
  SD.tipOfTheDay = function (data) {
    if (!data.tips.length) return "";
    var now = new Date(), start = new Date(now.getFullYear(), 0, 0);
    var day = Math.floor((now - start) / 86400000);
    return data.tips[day % data.tips.length];
  };

  SD.findProject = function (data, id) {
    for (var i = 0; i < data.projects.length; i++) if (data.projects[i].id === id) return data.projects[i];
    return null;
  };

  /* ---------- CSV (for the Google Sheets option) ---------- */

  SD.parseCSV = function (text) {
    var rows = [], row = [], field = "", inQuotes = false, i, c;
    text = String(text || "").replace(/^﻿/, "");
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) {
      return r.some(function (f) { return String(f).trim() !== ""; });
    });
  };

  // Friendly spreadsheet headings -> field names. Headings are matched
  // ignoring case, spaces and punctuation, so "Next step" = "nextStep".
  var FIELDS = {
    projects: {
      id: "id", linkname: "id", projectlink: "id", title: "title", project: "title", projectname: "title", name: "title",
      category: "category", theme: "category", status: "status", stage: "status",
      summary: "summary", description: "summary", team: "team", whosrunningit: "team", lead: "team", ledby: "team",
      metriclabel: "metricLabel", whatwemeasure: "metricLabel", measure: "metricLabel", measuring: "metricLabel",
      metricstart: "metricStart", startvalue: "metricStart", start: "metricStart", baseline: "metricStart",
      metriccurrent: "metricCurrent", currentvalue: "metricCurrent", current: "metricCurrent", now: "metricCurrent",
      metrictarget: "metricTarget", targetvalue: "metricTarget", target: "metricTarget", goal: "metricTarget",
      metricunit: "metricUnit", unit: "metricUnit", units: "metricUnit",
      nextstep: "nextStep", next: "nextStep", getinvolved: "getInvolved", howtohelp: "getInvolved", howyoucanhelp: "getInvolved",
      featured: "featured", lastupdated: "updated", updated: "updated",
      image: "image", photo: "image", picture: "image", imageurl: "image", photourl: "image", imageaddress: "image",
      imagedescription: "imageAlt", photodescription: "imageAlt", alttext: "imageAlt", imagealt: "imageAlt",
      story: "story", about: "story", aboutthisproject: "story", fulldescription: "story", moredetail: "story",
      started: "startDate", startdate: "startDate", finish: "endDate", aimingtofinish: "endDate", enddate: "endDate", targetdate: "endDate",
      helplink: "helpLink", signuplink: "helpLink", signup: "helpLink",
      morephotos: "gallery", gallery: "gallery", extraphotos: "gallery"
    },
    events: { date: "date", time: "time", event: "title", title: "title", what: "title", place: "place", where: "place", location: "place", project: "project", category: "category", image: "image", photo: "image", picture: "image" },
    trends: { chart: "chart", title: "chart", unit: "unit", lowerisbetter: "lowerIsBetter", target: "target", icon: "icon", category: "icon", note: "note", label: "label", month: "label", when: "label", value: "value", number: "value" },
    leaderboard: { name: "name", team: "name", house: "name", score: "score", points: "score", value: "score", image: "image", crest: "image", badge: "image", logo: "image" },
    tips: { tip: "text", text: "text" },
    milestones: { project: "project", milestone: "title", title: "title", step: "title", date: "date", done: "done", finished: "done" },
    stats: { label: "label", name: "label", value: "value", number: "value", unit: "unit", units: "unit", note: "note", icon: "icon", category: "icon",
      upto: "asOf", asof: "asOf", date: "asOf", previous: "previous", previousvalue: "previous", comparedwith: "compareLabel", compareto: "compareLabel",
      lowerisbetter: "lowerIsBetter", image: "image", photo: "image", picture: "image",
      workoutfrom: "source", workedoutfrom: "source", source: "source", from: "source", how: "calc", calculation: "calc", calc: "calc", multiplyby: "factor", factor: "factor" },
    updates: { date: "date", text: "text", update: "text", news: "text", message: "text", category: "category", project: "project", image: "image", photo: "image", picture: "image" },
    gallery: { image: "image", photo: "image", picture: "image", caption: "caption", description: "caption" },
    settings: {
      schoolname: "school.name", school: "school.name", logo: "school.logo", whitelogo: "school.logoWhite", logowhite: "school.logoWhite",
      tvprojectsperpage: "display.tvCardsPerPage", tvsecondsperpage: "display.tvSecondsPerPage", tvsecondspernewsitem: "display.tvSecondsPerNews",
      tvcolours: "display.tvTheme", tvcolors: "display.tvTheme", pagecolours: "display.theme", pagecolors: "display.theme",
      projectsshownas: "display.defaultView", daystocirclenewthings: "display.highlightNewDays",
      tvsleepfrom: "display.tvSleepFrom", tvwakeat: "display.tvSleepTo", tvsleepatweekends: "display.tvSleepWeekends",
      schoolcolour: "school.color", schoolcolor: "school.color", colour: "school.color", color: "school.color", maincolour: "school.color",
      banner: "dashboard.banner", bannerimage: "dashboard.banner", bannerphoto: "dashboard.banner", banneraddress: "dashboard.banner",
      bannerdescription: "dashboard.bannerAlt", banneralt: "dashboard.bannerAlt",
      dashboardtitle: "dashboard.title", title: "dashboard.title", tagline: "dashboard.tagline",
      aboutthisdata: "dashboard.about", about: "dashboard.about", contact: "dashboard.contact", contactemail: "dashboard.contact",
      lastupdated: "dashboard.lastUpdated", madeby: "dashboard.madeBy",
      getinvolvedheading: "getInvolved.heading", getinvolvedtext: "getInvolved.text",
      getinvolvedlink: "getInvolved.link", getinvolvedlinklabel: "getInvolved.linkLabel",
      qrimage: "getInvolved.qrImage", qrcode: "getInvolved.qrImage", sampledata: "isSampleData", issampledata: "isSampleData",
      leaderboardtitle: "leaderboard.title", leaderboardunit: "leaderboard.unit", leaderboardnote: "leaderboard.note",
      getinvolvedimage: "getInvolved.image", getinvolvedphoto: "getInvolved.image", aboutimage: "dashboard.aboutImage", aboutphoto: "dashboard.aboutImage"
    }
  };

  function rowsToObjects(rows, map) {
    if (!rows.length) return [];
    var heads = rows[0].map(function (h) { return map[keyify(h)] || null; });
    return rows.slice(1).map(function (r) {
      var o = {};
      heads.forEach(function (f, i) { if (f) o[f] = r[i] === undefined ? "" : r[i]; });
      return o;
    });
  }

  function setPath(obj, path, value) {
    var parts = path.split("."), o = obj;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]] = o[parts[i]] || {};
    o[parts[parts.length - 1]] = value;
  }

  function fetchText(url) {
    var u = url + (url.indexOf("?") === -1 ? "?" : "&") + "_=" + Date.now();
    return fetch(u, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Google Sheet returned " + r.status + " for " + url);
      return r.text();
    });
  }

  SD.fromSheets = function (texts) {
    var raw = { school: {}, dashboard: {}, getInvolved: {} };
    if (texts.settings) {
      SD.parseCSV(texts.settings).forEach(function (r) {
        var f = FIELDS.settings[keyify(r[0])];
        if (f) setPath(raw, f, r[1] === undefined ? "" : r[1]);
      });
    }
    raw.stats = texts.stats ? rowsToObjects(SD.parseCSV(texts.stats), FIELDS.stats) : [];
    raw.stats.forEach(function (st) { if (st.lowerIsBetter) st.direction = toBool(st.lowerIsBetter) ? "down" : "up"; });
    raw.projects = texts.projects ? rowsToObjects(SD.parseCSV(texts.projects), FIELDS.projects) : [];
    raw.updates = texts.updates ? rowsToObjects(SD.parseCSV(texts.updates), FIELDS.updates) : [];
    raw.events = texts.events ? rowsToObjects(SD.parseCSV(texts.events), FIELDS.events) : [];
    raw.tips = texts.tips ? rowsToObjects(SD.parseCSV(texts.tips), FIELDS.tips).map(function (t) { return t.text; }) : [];
    raw.gallery = texts.gallery ? rowsToObjects(SD.parseCSV(texts.gallery), FIELDS.gallery) : [];
    raw.leaderboard = raw.leaderboard || {};
    raw.leaderboard.entries = texts.leaderboard ? rowsToObjects(SD.parseCSV(texts.leaderboard), FIELDS.leaderboard) : [];

    // Projects tab: "Link name" is the end of each project's own link. When it's empty it's
    // made from the title, so links on posters don't change if rows are moved around.
    // "More photos" holds picture addresses separated by spaces or commas.
    var usedIds = {};
    raw.projects.forEach(function (p, i) {
      var base = slugify(p.id) || slugify(p.title) || "project-" + (i + 1), id = base, n = 2;
      while (usedIds[id]) id = base + "-" + n++;
      usedIds[id] = true;
      p.id = id;
      p.gallery = String(p.gallery || "").split(/[\s,]+/).filter(Boolean);
      p.milestones = [];
    });
    // Milestones tab: one row per milestone, matched to a project by its title.
    if (texts.milestones) {
      rowsToObjects(SD.parseCSV(texts.milestones), FIELDS.milestones).forEach(function (m) {
        var key = keyify(m.project);
        raw.projects.forEach(function (p) { if (keyify(p.title) === key || keyify(p.id) === key) p.milestones.push(m); });
      });
    }
    // News and events can name a project by its title.
    function linkProject(item) {
      var key = keyify(item.project);
      if (!key) return;
      raw.projects.forEach(function (p) { if (keyify(p.title) === key || keyify(p.id) === key) item.project = p.id; });
    }
    raw.updates.forEach(linkProject);
    raw.events.forEach(linkProject);

    // Trends tab: one row per point; rows with the same Chart name make one chart.
    raw.trends = [];
    if (texts.trends) {
      var byName = {};
      rowsToObjects(SD.parseCSV(texts.trends), FIELDS.trends).forEach(function (r) {
        var name = String(r.chart || "").trim();
        if (!name) return;
        var t = byName[name];
        if (!t) { t = byName[name] = { title: name, points: [] }; raw.trends.push(t); }
        if (!t.unit && r.unit) t.unit = r.unit;
        if (!t.direction && r.lowerIsBetter) t.direction = toBool(r.lowerIsBetter) ? "down" : "up";
        if (t.target === undefined && r.target) t.target = r.target;
        if (!t.icon && r.icon) t.icon = r.icon;
        if (!t.note && r.note) t.note = r.note;
        t.points.push({ label: r.label, value: r.value });
      });
    }
    return raw;
  };

  function loadFromSheets() {
    var g = CONFIG.googleSheet || {};
    if (!g.projectsCsvUrl) return Promise.reject(new Error("dataSource is \"google-sheet\" but googleSheet.projectsCsvUrl is empty in config.js"));
    var keys = ["settings", "stats", "projects", "updates", "events", "trends", "leaderboard", "tips", "milestones", "gallery"];
    return Promise.all(keys.map(function (k) {
      var url = g[k + "CsvUrl"];
      return url ? fetchText(url) : Promise.resolve("");
    })).then(function (res) {
      var texts = {};
      keys.forEach(function (k, i) { texts[k] = res[i]; });
      return SD.fromSheets(texts);
    });
  }

  /* ---------- Loading the data file ---------- */

  // The data file is a script (not JSON) so the dashboard also works when
  // opened straight from a folder (file://), where browsers block fetch().
  SD.loadDataFile = function (src) {
    return new Promise(function (resolve, reject) {
      var lastError = null;
      function onError(e) {
        if (e && e.filename && e.filename.indexOf(src.split("/").pop()) !== -1) lastError = e;
      }
      window.addEventListener("error", onError);
      window.DASHBOARD_DATA = undefined;
      var s = document.createElement("script");
      s.src = src + (src.indexOf("?") === -1 ? "?" : "&") + "v=" + Date.now();
      function done() {
        window.removeEventListener("error", onError);
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      s.onload = function () {
        done();
        if (window.DASHBOARD_DATA && typeof window.DASHBOARD_DATA === "object") resolve(window.DASHBOARD_DATA);
        else if (lastError) reject(new Error("There is a typing mistake in " + src + " (line " + lastError.lineno + "): " + lastError.message));
        else reject(new Error(src + " loaded, but it doesn't contain window.DASHBOARD_DATA"));
      };
      s.onerror = function () {
        done();
        reject(new Error("Couldn't find " + src));
      };
      document.head.appendChild(s);
    });
  };

  var LAST_GOOD_KEY = "sd:lastGood";
  var DRAFT_KEY = (SD.DRAFT_KEY = "sd:draft");

  function storageGet(k) {
    try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function storageSet(k, v) {
    try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function storageRemove(k) {
    try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ }
  }
  SD.storage = { get: storageGet, set: storageSet, remove: storageRemove };

  /*
    Load content. Resolves with { data, source, warning }.
    If the live content fails (typo in the file, sheet offline) but this
    screen has loaded good content before, that saved copy is shown with a
    warning, so TVs never go blank.
  */
  SD.load = function (opts) {
    opts = opts || {};
    if (opts.preview) {
      var draft = storageGet(DRAFT_KEY);
      if (draft && draft.data) return Promise.resolve({ data: SD.normalise(draft.data), source: "draft", warning: null });
    }
    var p = CONFIG.dataSource === "google-sheet" ? loadFromSheets() : SD.loadDataFile(CONFIG.dataFile);
    return p.then(
      function (raw) {
        var data = SD.normalise(raw);
        if (!storageSet(LAST_GOOD_KEY, { savedAt: Date.now(), data: data })) {
          // Browser storage is full (photos are big): keep a copy without the built-in photos.
          var slim = JSON.parse(JSON.stringify(data));
          slim.projects.forEach(function (p) { if (/^data:/.test(p.image)) p.image = ""; });
          storageSet(LAST_GOOD_KEY, { savedAt: Date.now(), data: slim });
        }
        return { data: data, source: CONFIG.dataSource, warning: null, raw: raw };
      },
      function (err) {
        var saved = storageGet(LAST_GOOD_KEY);
        if (saved && saved.data) {
          return { data: SD.normalise(saved.data), source: "saved-copy", warning: err.message, savedAt: saved.savedAt };
        }
        throw err;
      }
    );
  };

  /*
    QR codes, made right here so posters and TVs can link to a sign-up form or a project page
    without any other website. Standard QR (byte mode, medium error correction, versions 1 to 10:
    up to about 210 characters, plenty for a web address).
    SD.qrMatrix(text) gives rows of true (dark) / false, or null if the text is too long.
    SD.qrSvg(text, label) gives an SVG picture, dark navy on white with the usual white border.
  */
  var QR_ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // error-correction codewords per block (level M)
  var QR_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];          // number of blocks (level M)
  function qrRawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function qrMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function qrDivisor(degree) {
    var r = [], root = 1, i, j;
    for (i = 0; i < degree - 1; i++) r.push(0);
    r.push(1);
    for (i = 0; i < degree; i++) {
      for (j = 0; j < r.length; j++) { r[j] = qrMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = qrMul(root, 2);
    }
    return r;
  }
  function qrRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift();
      r.push(0);
      div.forEach(function (c, i) { r[i] ^= qrMul(c, f); });
    });
    return r;
  }
  SD.qrMatrix = function (text) {
    var bytes = unescape(encodeURIComponent(String(text))).split("").map(function (c) { return c.charCodeAt(0); });
    var ver, dataLen, ccBits;
    for (ver = 1; ver <= 10; ver++) {
      dataLen = Math.floor(qrRawModules(ver) / 8) - QR_ECC[ver] * QR_BLOCKS[ver];
      ccBits = ver < 10 ? 8 : 16;
      if (4 + ccBits + bytes.length * 8 <= dataLen * 8) break;
    }
    if (ver > 10) return null;

    // The data: mode, length, bytes, end marker and padding
    var bits = [];
    function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ccBits);
    bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, dataLen * 8 - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xec; bits.length < dataLen * 8; pad ^= 0xec ^ 0x11) put(pad, 8);
    var data = [];
    for (var b = 0; b < bits.length; b += 8) data.push(parseInt(bits.slice(b, b + 8).join(""), 2));

    // Split into blocks, add error correction, interleave
    var nBlocks = QR_BLOCKS[ver], eccLen = QR_ECC[ver], raw = Math.floor(qrRawModules(ver) / 8);
    var nShort = nBlocks - raw % nBlocks, shortLen = Math.floor(raw / nBlocks), div = qrDivisor(eccLen), blocks = [], k = 0, i, j;
    for (i = 0; i < nBlocks; i++) {
      var dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += dat.length;
      var ecc = qrRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var words = [];
    for (i = 0; i < blocks[0].length; i++) for (j = 0; j < blocks.length; j++) if (i !== shortLen - eccLen || j >= nShort) words.push(blocks[j][i]);

    // The fixed patterns
    var size = ver * 4 + 17, mod = [], fn = [];
    for (i = 0; i < size; i++) { mod.push([]); fn.push([]); for (j = 0; j < size; j++) { mod[i].push(false); fn[i].push(false); } }
    function set(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), x = c[0] + dx, y = c[1] + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    });
    var align = [];
    if (ver > 1) {
      var n = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      align = [6];
      for (var pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos);
    }
    align.forEach(function (ay, ai) {
      align.forEach(function (ax, aj) {
        var last = align.length - 1;
        if ((ai === 0 && aj === 0) || (ai === 0 && aj === last) || (ai === last && aj === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    function format(mask) {
      var d = mask, r = d, f, q;                       // level M is 00
      for (q = 0; q < 10; q++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      f = ((d << 10) | r) ^ 0x5412;
      function bit(q) { return ((f >>> q) & 1) !== 0; }
      for (q = 0; q <= 5; q++) set(8, q, bit(q));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (q = 9; q < 15; q++) set(14 - q, 8, bit(q));
      for (q = 0; q < 8; q++) set(size - 1 - q, 8, bit(q));
      for (q = 8; q < 15; q++) set(8, size - 15 + q, bit(q));
      set(8, size - 8, true);
    }
    format(0);
    if (ver >= 7) {
      var vr = ver, q;
      for (q = 0; q < 12; q++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1f25);
      var vb = (ver << 12) | vr;
      for (q = 0; q < 18; q++) { var on = ((vb >>> q) & 1) !== 0, a = size - 11 + q % 3, c = Math.floor(q / 3); set(a, c, on); set(c, a, on); }
    }

    // The codewords, in the zig-zag
    var at = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && at < words.length * 8) { mod[y][x] = ((words[at >>> 3] >>> (7 - (at & 7))) & 1) !== 0; at++; }
      }
    }

    // Try the 8 masks and keep the one scanners find easiest
    function flip(m) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        if (fn[y][x]) continue;
        var t = [(x + y) % 2, y % 2, x % 3, (x + y) % 3, (Math.floor(x / 3) + Math.floor(y / 2)) % 2, x * y % 2 + x * y % 3, (x * y % 2 + x * y % 3) % 2, ((x + y) % 2 + x * y % 3) % 2][m];
        if (t === 0) mod[y][x] = !mod[y][x];
      }
    }
    function penalty() {
      var p = 0, dark = 0, x, y;
      function lines(get) {
        for (var a = 0; a < size; a++) {
          var run = 1, s = "";
          for (var c = 0; c < size; c++) {
            var v = get(a, c);
            s += v ? "1" : "0";
            if (c > 0) { if (v === get(a, c - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
          }
          var hits = s.match(/(?=(10111010000|00001011101))/g);
          p += (hits ? hits.length : 0) * 40;
        }
      }
      lines(function (a, c) { return mod[a][c]; });
      lines(function (a, c) { return mod[c][a]; });
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        if (mod[y][x]) dark++;
        if (x < size - 1 && y < size - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
      }
      return p + Math.max(0, Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
    }
    var best = 0, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      flip(m); format(m);
      var score = penalty();
      if (score < bestScore) { bestScore = score; best = m; }
      flip(m);
    }
    flip(best); format(best);
    return mod;
  };

  SD.qrSvg = function (text, label) {
    var m = SD.qrMatrix(text);
    if (!m) return "";
    var n = m.length, d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (m[y][x]) d += "M" + (x + 4) + " " + (y + 4) + "h1v1h-1z";
    return '<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 8) + " " + (n + 8) + '" shape-rendering="crispEdges" role="img" aria-label="' +
      SD.esc("QR code" + (label ? ": " + label : "")) + '"><rect width="100%" height="100%" fill="#ffffff"/><path fill="#062047" d="' + d + '"/></svg>';
  };

  /*
    All the numbers as a spreadsheet (CSV), one row per number, for teachers and classes:
    Section, Name, What, Value, Unit, Date. Opens in Excel, Numbers and Google Sheets.
  */
  SD.numbersCsv = function (data) {
    var rows = [["Section", "Name", "What", "Value", "Unit", "Date"]];
    data.stats.forEach(function (s) {
      rows.push(["Headline number", s.label, "Now", s.value, s.unit, s.asOf]);
      if (s.previous !== null) rows.push(["Headline number", s.label, s.compareLabel || "Last time", s.previous, s.unit, ""]);
    });
    data.projects.forEach(function (p) {
      rows.push(["Project", p.title, "Status", SD.status(p.status).label, "", p.updated]);
      if (p.metricCurrent !== "") {
        if (p.metricStart !== "") rows.push(["Project", p.title, (p.metricLabel || "Progress") + ": start", p.metricStart, p.metricUnit, p.startDate]);
        rows.push(["Project", p.title, (p.metricLabel || "Progress") + ": now", p.metricCurrent, p.metricUnit, p.updated]);
        if (p.metricTarget !== "") rows.push(["Project", p.title, (p.metricLabel || "Progress") + ": target", p.metricTarget, p.metricUnit, p.endDate]);
      }
    });
    data.trends.forEach(function (t) {
      t.points.forEach(function (pt) { rows.push(["Chart", t.title, pt.label, pt.value, t.unit, ""]); });
      if (t.target !== null) rows.push(["Chart", t.title, "Target", t.target, t.unit, ""]);
    });
    data.leaderboard.entries.forEach(function (e) { rows.push(["League", data.leaderboard.title || "League", e.name, e.score, data.leaderboard.unit, ""]); });
    return "\ufeff" + rows.map(function (r) {
      return r.map(function (v) {
        v = v === null || v === undefined ? "" : String(v);
        if (/^[=+\-@]/.test(v) && isNaN(Number(v))) v = "'" + v;   // so a spreadsheet never treats text as a formula
        return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(",");
    }).join("\r\n") + "\r\n";
  };

  /*
    An event as a calendar file (.ics) for "Add to calendar": opens in Outlook, Google Calendar
    and phone calendars. A time like "08:30" or "1:15pm" (or "08:30-09:30") makes it a timed
    event, an hour long unless an end time is given; with no time it's an all-day event.
  */
  SD.eventIcs = function (e, link) {
    var d = SD.parseDate(e.date);
    if (!d) return "";
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    function day(x) { return x.getFullYear() + p2(x.getMonth() + 1) + p2(x.getDate()); }
    function local(x) { return day(x) + "T" + p2(x.getHours()) + p2(x.getMinutes()) + "00"; }
    function text(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, "\\$&").replace(/\r?\n/g, "\\n"); }
    function fold(line) {                                  // calendar lines are at most 75 characters
      var out = "";
      while (line.length > 74) { out += line.slice(0, 74) + "\r\n "; line = line.slice(74); }
      return out + line;
    }
    var times = /(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)(?:\s*(?:-|\u2013|to)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?))?/i.exec(e.time || "");
    var start = times && SD.hhmm(times[1]), end = times && times[2] && SD.hhmm(times[2]);
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sustainability Dashboard//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT"];
    var stamp = new Date();
    lines.push("UID:" + day(d) + "-" + String(e.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) + "@sustainability-dashboard");
    lines.push("DTSTAMP:" + stamp.getUTCFullYear() + p2(stamp.getUTCMonth() + 1) + p2(stamp.getUTCDate()) + "T" + p2(stamp.getUTCHours()) + p2(stamp.getUTCMinutes()) + "00Z");
    if (start) {
      var s = start.split(":"), from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +s[0], +s[1]);
      var to = end ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), +end.split(":")[0], +end.split(":")[1]) : new Date(from.getTime() + 3600000);
      if (to <= from) to = new Date(from.getTime() + 3600000);
      lines.push("DTSTART:" + local(from), "DTEND:" + local(to));
    } else {
      lines.push("DTSTART;VALUE=DATE:" + day(d), "DTEND;VALUE=DATE:" + day(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)));
    }
    lines.push("SUMMARY:" + text(e.title));
    if (e.place) lines.push("LOCATION:" + text(e.place));
    if (link) lines.push("DESCRIPTION:" + text("More on the sustainability dashboard: " + link), "URL:" + link);
    lines.push("END:VEVENT", "END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  };

  // A link a phone can open from a QR code: a full web address (or email), worked out from a
  // relative one where the dashboard is online. "" when there isn't one (e.g. opened from a file).
  SD.qrLink = function (link) {
    link = SD.safeUrl(link);
    if (!link) return "";
    try { link = new URL(link, window.location.href).href; } catch (e) { return ""; }
    return /^(https?:|mailto:)/i.test(link) ? link : "";
  };
})();
