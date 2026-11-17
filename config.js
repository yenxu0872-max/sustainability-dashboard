/*
  Sustainability Dashboard: settings (for IT)
  ------------------------------------------------------------------
  This file controls HOW the dashboard works. The CONTENT (projects,
  numbers, news) lives in data/dashboard-data.js, or in a Google Sheet
  if you switch dataSource below. See IT-SETUP.md for full details.
*/
window.DASHBOARD_CONFIG = {
  // Where the content comes from:
  //   "file"         -> data/dashboard-data.js (default, works offline)
  //   "google-sheet" -> live from a published Google Sheet (see IT-SETUP.md, section 6)
  dataSource: "file",
  dataFile: "data/dashboard-data.js",

  // Only used when dataSource is "google-sheet". Paste each tab's
  // "Publish to web -> CSV" link here.
  googleSheet: {
    settingsCsvUrl: "",
    statsCsvUrl: "",
    projectsCsvUrl: "",
    updatesCsvUrl: "",
    eventsCsvUrl: "",
    trendsCsvUrl: "",
    leaderboardCsvUrl: "",
    tipsCsvUrl: "",
    milestonesCsvUrl: "",
    galleryCsvUrl: "",
    // Optional: the normal edit link, shown to students in the editor page.
    editUrl: ""
  },

  // How often open screens check for new content (minutes).
  refreshMinutes: 10,

  // When students click "Execute changes" in the editor it also writes data/updated.js (a
  // tiny file with the time). Screens look at that file this often (seconds) and show the new
  // content as soon as it changes, so updates appear within about half a minute.
  quickCheckSeconds: 30,

  // The next few settings are the standard ones. Students can change the colours, the TV pages
  // and how long new things stay marked for every screen in the editor's Screens tab; what they
  // choose is saved in the content and used instead. An address like ?mode=tv&cards=4 wins over both.

  // New or changed things are marked automatically, like a teacher's corrections: numbers that
  // change are circled in blue pen, changed words are underlined in highlighter, and a short note
  // says "new!", "+6%!" or "done!". This is how many days the marks stay. 0 turns them off.
  highlightNewDays: 7,

  // Colours for the normal page and portal: "light" (white), "dark",
  // or "auto" (follows each device's light/dark setting).
  theme: "light",

  // How projects are shown at first: "grid" (cards, 3 per row) or "list".
  // Viewers can switch, and their browser remembers their choice.
  defaultView: "grid",

  // Settings for TV / digital signage screens (index.html?mode=tv).
  tv: {
    theme: "light",             // "light" (white) or "dark"
    cardsPerPage: 3,            // 3 side by side, 4 for more at once, 2 bigger, or 1 = one big project at a time
    secondsPerPage: 15,         // how long each page of projects stays up
    secondsPerUpdate: 10,       // how long each news item stays up
    reloadPageEveryHours: 12,   // full reload to pick up new code and keep the browser fresh
    // Sleep outside school hours to save energy: a black screen with a small dim clock.
    // e.g. sleepFrom: "18:00", sleepTo: "07:00". Leave both empty to keep the TVs on.
    sleepFrom: "",
    sleepTo: "",
    sleepWeekends: false        // true = sleep all Saturday and Sunday too
  },

  // Dates and times are shown in this format (en-GB = 4 Nov 2026, 14:05).
  locale: "en-GB",

  // Show a small "Edit" link in the dashboard footer. Leave false for public screens.
  showEditorLink: false
};
