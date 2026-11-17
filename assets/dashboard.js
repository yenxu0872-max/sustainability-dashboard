/*
  Sustainability Dashboard: page logic.

  URL options (combine with &):
    ?mode=tv                 full-screen TV / signage view
    ?mode=embed              for an iframe inside the school portal
    ?mode=embed&view=summary small summary widget for a portal home page
    &theme=light|dark|auto   colour theme (default: light / white)
    &category=food,waste     only show these categories (e.g. the canteen TV)
    &from=web                TV: opened with the web page's "TV mode" button (shows Full screen / Exit buttons)
    &header=0                hide the banner (embed)
    &bg=transparent          transparent background (embed)
    &rotate=20               TV: seconds per page
    &cards=1|2|3|4           TV: projects per page (1 = one big project at a time)
    ?preview=draft           preview unsaved changes from editor.html
    #project=<id>            open one project's page (shareable link, e.g. for a QR code)
*/
(function () {
  "use strict";

  var SD = window.SD, CONFIG = SD.config, esc = SD.esc, icon = SD.icon;
  var root = document.documentElement;
  var app = document.getElementById("app");

  /* ---------- Options from the URL ---------- */

  var params = (function () {
    var out = {};
    location.search.replace(/^\?/, "").split("&").forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf("=");
      var k = decodeURIComponent(i === -1 ? pair : pair.slice(0, i));
      var v = i === -1 ? "" : decodeURIComponent(pair.slice(i + 1).replace(/\+/g, " "));
      out[k.toLowerCase()] = v;
    });
    return out;
  })();

  var mode = { tv: "tv", embed: "embed" }[(params.mode || "").toLowerCase()] || "full";
  var view = mode === "embed" && params.view === "summary" ? "summary" : "full";
  var preview = params.preview === "draft";
  var showHeader = params.header !== "0";
  var onlyCategories = (params.category || "").split(",").map(SD.categoryKey).filter(Boolean);
  var tvPerPage, tvSeconds, newsSeconds, NEW_DAYS, tvSleep;   // set by applyDisplay() once the content has loaded
  var fullPageUrl = location.pathname.replace(/[^\/]*$/, "") + "index.html";
  var fromWeb = mode === "tv" && params.from === "web";

  // Links between the web page and TV mode keep the colour theme and category options.
  function pageUrl(extra) {
    var q = extra ? [extra] : [];
    if (params.theme) q.push("theme=" + encodeURIComponent(params.theme));
    if (params.category) q.push("category=" + encodeURIComponent(params.category));
    return fullPageUrl + (q.length ? "?" + q.join("&") : "");
  }

  root.className += " mode-" + mode + (view === "summary" ? " view-summary" : "") + (params.bg === "transparent" ? " bg-transparent" : "");

  /* ---------- Theme ---------- */

  var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  // Visitors to the web page can pick light or dark colours with the button in the menu bar;
  // their browser remembers it. An address with &theme= (e.g. the portal) still wins.
  var THEME_KEY = "sd:theme";
  function visitorTheme() { var v = SD.storage.get(THEME_KEY); return mode !== "tv" && (v === "light" || v === "dark") ? v : ""; }
  function applyTheme() {
    var d = state.result ? state.result.data.display : {};
    var t = (params.theme || visitorTheme() || (mode === "tv" ? d.tvTheme || CONFIG.tv.theme : d.theme || CONFIG.theme) || "light").toLowerCase();
    if (t === "auto") t = darkQuery && darkQuery.matches ? "dark" : "light";
    root.setAttribute("data-theme", t === "dark" ? "dark" : "light");
    if (state.result) SD.applyBrand(state.result.data.school.color);
  }
  if (darkQuery) {
    if (darkQuery.addEventListener) darkQuery.addEventListener("change", applyTheme);
    else if (darkQuery.addListener) darkQuery.addListener(applyTheme);
  }

  /* ---------- State ---------- */

  var state = {
    result: null, filter: "all", query: "", view: "grid", lastJson: "",
    tvPages: [], tvPage: 0, tvTimer: null, tvLayout: null, ticker: [], tickerIndex: 0, tickerTimer: null,
    detailId: null, detailReturnFocus: null
  };
  applyTheme();

  // Grid or list: each viewer's choice is remembered in their own browser.
  var VIEW_KEY = "sd:view";
  var viewChosen = !!SD.storage.get(VIEW_KEY);
  state.view = SD.storage.get(VIEW_KEY) === "list" ? "list" : "grid";

  // Screen settings: the address wins (e.g. &cards=4 or &rotate=20), then what the editor's
  // Screens tab saved in the content, then config.js.
  function applyDisplay(data) {
    var d = (data && data.display) || {};
    function pick(param, saved, conf) {
      var n = SD.toNumber(param);
      return n !== null ? n : saved !== null && saved !== undefined ? saved : SD.toNumber(conf);
    }
    tvPerPage = Math.min(4, Math.max(1, Math.round(pick(params.cards, d.tvCardsPerPage, CONFIG.tv.cardsPerPage) || 3)));
    tvSeconds = Math.max(5, pick(params.rotate, d.tvSecondsPerPage, CONFIG.tv.secondsPerPage) || 15);
    newsSeconds = Math.max(4, pick(null, d.tvSecondsPerNews, CONFIG.tv.secondsPerUpdate) || 10);
    var days = pick(null, d.highlightNewDays, CONFIG.highlightNewDays);
    NEW_DAYS = Math.max(0, days === null ? 7 : days);
    tvSleep = params.sleep === "off" ? null : {
      from: d.tvSleepFrom || SD.hhmm(CONFIG.tv.sleepFrom),
      to: d.tvSleepTo || SD.hhmm(CONFIG.tv.sleepTo),
      weekends: d.tvSleepWeekends ? d.tvSleepWeekends === "yes" : !!CONFIG.tv.sleepWeekends
    };
    if (!viewChosen) state.view = (d.defaultView || CONFIG.defaultView) === "list" ? "list" : "grid";
  }
  applyDisplay(null);

  function visibleProjects(data) {
    var list = data.projects.filter(function (p) {
      return !onlyCategories.length || onlyCategories.indexOf(p.category) !== -1;
    });
    // Featured projects first, otherwise keep the order set in the editor.
    return list.filter(function (p) { return p.featured; }).concat(list.filter(function (p) { return !p.featured; }));
  }

  function inCategories(item) {
    return !onlyCategories.length || !item.category || onlyCategories.indexOf(item.category) !== -1;
  }

  function statusCounts(projects) {
    var counts = { completed: 0, "in-progress": 0, planning: 0, "on-hold": 0 };
    projects.forEach(function (p) { counts[p.status]++; });
    return counts;
  }

  function shortDate(v) { return SD.formatDate(v, { day: "numeric", month: "short" }); }
  function withUnit(n, unit) { return SD.formatNumber(n) + (unit ? " " + esc(unit) : ""); }

  /* ---------- Small building blocks ---------- */

  // The school's crest (images/school-crest-colour.png, set in the editor under Basics → Logo),
  // otherwise the dashboard's own rain-tree shield.
  function badgeHtml(data) {
    return data.school.logo
      ? '<span class="school-crest"><img src="' + esc(data.school.logo) + '" alt="' + esc((data.school.name ? data.school.name + " " : "") + "crest") + '"></span>'
      : '<span class="logo-mark">' + SD.logoMark() + "</span>";
  }

  // An icon that moves by itself: lightning flickers, recycling arrows turn, a water drop falls,
  // a leaf waves. The movement is all in dashboard.css ("Animated icons").
  function liveIcon(name) { return icon(name, "live i-" + name); }

  // A category's icon on a soft coloured tile, beside headline numbers and on project cards.
  function catIconHtml(key) { return '<span class="cat-icon">' + liveIcon(key) + "</span>"; }

  // School-notes touches: gold highlighter lines and blue-pen marks drawn by hand, like notes
  // in an exercise book. Each is one stroke that draws itself in when it scrolls into view.
  // Shapes are in each viewBox's own units.
  var DOODLES = {
    underline: { box: "0 0 200 20", d: "M4 13C40 8 82 10 122 10S182 7 196 6" },
    double: { box: "0 0 200 24", d: "M4 9C50 5 120 7 196 6M14 18C70 14 130 16 186 15" },
    wave: { box: "0 0 200 20", d: "M4 11q12-9 24 0t24 0 24 0 24 0 24 0 24 0 24 0 24 0" },
    loop: { box: "0 0 200 24", d: "M4 14C50 10 120 12 160 11c22-1 34-8 26-10-10-2-14 16 10 15" },
    circle: { box: "0 0 200 100", d: "M152 14C112 2 44 6 18 30-2 50 22 88 92 93c70 5 106-20 100-50-4-22-42-36-98-33-26 2-46 6-58 13" },
    sparks: { box: "0 0 40 40", d: "M20 3v10M6 10l7 7M34 10l-7 7" },
    arrow: { box: "0 0 120 90", d: "M6 8c40-2 78 12 92 64M84 62l14 12 6-18" },
    back: { box: "0 0 60 30", d: "M56 22C42 8 24 6 8 14M8 14l11-8M8 14l12 5" },
    tick: { box: "0 0 40 40", d: "M5 22l9 10L36 6" },
    crown: { box: "0 0 60 40", d: "M8 34L5 10l13 11 12-17 12 17 13-11-3 24z" }
  };
  function doodle(kind, cls) {
    var s = DOODLES[kind];
    // width/height 0 and fill none keep it invisible (not a big black shape) if the styles haven't loaded yet
    return '<svg class="doodle doodle-' + kind + (cls ? " " + cls : "") + '" viewBox="' + s.box + '" width="0" height="0" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<path pathLength="1" fill="none" stroke="currentColor" d="' + s.d + '"/></svg>';
  }
  // Wraps some words (already escaped) so a doodle can sit on them.
  function inked(html, kind, extra) {
    return '<span class="ink ink-' + kind + '">' + html + doodle(kind) + (extra || "") + "</span>";
  }
  // A short handwritten note in blue pen, with a little arrow pointing back at what it's about.
  // It only repeats what the page already says, so screen readers skip it.
  function penNote(text, cls) {
    return '<span class="note' + (cls ? " " + cls : "") + '" aria-hidden="true">' + doodle("back", "is-pen note-arrow") + "<span>" + esc(text) + "</span></span>";
  }

  /* ---------- What's new: circled and underlined automatically ---------- */

  // Each screen remembers what it showed last time. When a headline number, a project's progress,
  // stage, summary, next step or how to help, or a league score changes (or a new project, news
  // item or event appears), it is circled (numbers) or underlined (words) like a teacher's marks,
  // with a short note in blue pen, for CONFIG.highlightNewDays days. News also counts as new for
  // those days after its date, so a screen that has only just been switched on shows it too.
  var SEEN_KEY = preview ? "sd:seen-draft" : "sd:seen";
  var fresh = {};

  var newsKey = SD.newsKey, eventKey = SD.eventKey;

  function trackChanges(data, source) {
    fresh = {};
    if (!NEW_DAYS) return;
    var now = Date.now(), facts = SD.watchedFacts(data);
    var saved = SD.storage.get(SEEN_KEY) || {}, seen = saved.seen, marks = saved.marks || {};
    if (seen && source !== "saved-copy") {
      var things = Object.keys(facts).filter(function (k) { return k.indexOf("|") === -1; });
      var added = things.filter(function (k) { return !(k in seen); });
      // A whole new set of content (say the sample projects swapped for the real ones) starts
      // afresh, rather than circling everything on the page.
      if (added.length > 3 && added.length > things.length / 2) marks = {};
      else Object.keys(facts).forEach(function (k) {
        if (!(k in seen)) { if (k.indexOf("|") === -1) marks[k] = { at: now, from: null }; }
        else if (seen[k] !== facts[k]) {
          if (marks[k] && marks[k].from === facts[k]) delete marks[k];   // changed back again
          else if (marks[k]) marks[k].at = now;
          else marks[k] = { at: now, from: seen[k] };
        }
      });
    }
    Object.keys(marks).forEach(function (k) {
      if (!(k in facts) || now - marks[k].at > NEW_DAYS * 86400000) delete marks[k];
    });
    if (source !== "saved-copy") SD.storage.set(SEEN_KEY, { seen: facts, marks: marks });
    fresh = marks;
    var today = SD.parseDate(SD.todayISO()).getTime();
    data.updates.forEach(function (u) {
      var d = SD.parseDate(u.date);
      if (d && d.getTime() <= today && today - d.getTime() < NEW_DAYS * 86400000 && !fresh[newsKey(u)]) fresh[newsKey(u)] = { at: d.getTime(), from: null };
    });
  }

  // How many things (projects, numbers, news...) are marked, for the "new this week" key.
  function freshCount() {
    var things = {};
    Object.keys(fresh).forEach(function (k) { things[k.split("|")[0]] = 1; });
    return Object.keys(things).length;
  }
  function newWindowText() { return NEW_DAYS === 7 ? "this week" : NEW_DAYS === 1 ? "today" : "in the last " + NEW_DAYS + " days"; }

  // A blue-pen circle round a number or label that changed.
  function penCircle(html) { return '<span class="ink ink-circle is-new">' + html + doodle("circle", "is-pen") + "</span>"; }
  function circled(html, key) { return fresh[key] ? penCircle(html) : html; }
  // A highlighter underline under words that changed. It follows every line of the text.
  function underlined(html, key) {
    return fresh[key] ? '<span class="new-text">' + html + "</span>" : html;
  }
  // A short note in blue pen on a scrap of paper: "new!", "updated!", "+6%!".
  function newNote(text, cls) {
    return '<span class="new-note' + (cls ? " " + cls : "") + '">' + esc(text) + "</span>";
  }
  // "+200!" or "−1.5!" for a number that went up or down.
  function changeText(now, before) {
    var d = Math.round((now - before) * 100) / 100;
    return !isFinite(d) || d === 0 ? "updated!" : (d > 0 ? "+" : "−") + SD.formatNumber(Math.abs(d)) + "!";
  }

  // How much better a number is than last time, as a fraction (0 if it's the same or worse).
  function statGain(s) {
    if (s.previous === null || !s.previous || typeof s.value !== "number") return 0;
    var diff = s.value - s.previous;
    var good = s.direction === "down" ? diff < 0 : diff > 0;
    return good ? Math.abs(diff) / Math.abs(s.previous) : 0;
  }

  // A headline number card: picture, category icon and change badge, the big number and what it is,
  // then two bars comparing last time with now, and the date it's counted up to.
  // The best-improving number gets a gold "Most improved" label on its photo and a highlighter
  // circle round its change, like a teacher's "well done".
  function statHtml(s, best) {
    var isNum = typeof s.value === "number";
    var value = isNum ? '<span class="count" data-count="' + s.value + '">' + SD.formatNumber(s.value) + "</span>" : esc(s.value);
    var badge = "", bars = "", vs = "";
    if (s.previous !== null && isNum) {
      var diff = s.value - s.previous;
      var pct = s.previous ? Math.round(Math.abs(diff) / Math.abs(s.previous) * 100) : null;
      var good = s.direction === "down" ? diff < 0 : diff > 0;
      var sign = diff > 0 ? "+" : diff < 0 ? "\u2212" : "";
      var then = s.compareLabel ? s.compareLabel.charAt(0).toUpperCase() + s.compareLabel.slice(1) : "Before";
      badge =
        '<span class="stat-change ' + (diff === 0 ? "is-flat" : good ? "is-good" : "is-bad") + '" title="' +
          esc((diff === 0 ? "No change" : sign + SD.formatNumber(Math.abs(diff)) + (s.unit ? " " + s.unit : "")) + (s.compareLabel ? " vs " + s.compareLabel : "")) + '">' +
          '<span aria-hidden="true">' + (diff > 0 ? "\u2191" : diff < 0 ? "\u2193" : "\u2192") + "</span> " +
          (diff === 0 ? "Same" : pct !== null ? sign + pct + "%" : sign + SD.formatNumber(Math.abs(diff))) +
          '<span class="visually-hidden">' + (diff === 0 ? " no change" : good ? " better" : " worse") + "</span>" +
        "</span>";
      var max = Math.max(Math.abs(s.value), Math.abs(s.previous), 1);
      bars =
        '<div class="stat-cmp">' +
          '<div class="cmp"><span class="cmp-label">' + esc(then) + '</span><span class="cmp-bar"><span style="width:' + (Math.abs(s.previous) / max * 100).toFixed(1) + '%"></span></span><span class="cmp-val">' + SD.formatNumber(s.previous) + "</span></div>" +
          '<div class="cmp is-now"><span class="cmp-label">Now</span><span class="cmp-bar"><span style="width:' + (Math.abs(s.value) / max * 100).toFixed(1) + '%"></span></span><span class="cmp-val">' + SD.formatNumber(s.value) + "</span></div>" +
        "</div>";
      if (best) badge = inked(badge, "circle", doodle("sparks", "stat-sparks"));
      vs = s.compareLabel ? '<span class="stat-compare">vs ' + esc(s.compareLabel) + "</span>" : "";
    }
    var key = "stat:" + s.label, changed = fresh[key];
    return (
      '<div class="stat cat-' + s.icon + (best ? " is-best" : "") + '">' +
        slotHtml("stat-media", s.image, "", true) +
        (best ? '<span class="stat-flag">Most improved</span>' : "") +
        (changed ? newNote(changed.from === null ? "new!" : isNum ? changeText(s.value, SD.toNumber(changed.from)) : "updated!", "stat-new") : "") +
        '<div class="stat-head">' + catIconHtml(SD.category(s.icon).key) + badge + "</div>" +
        '<div class="stat-value">' + circled(value + (s.unit ? '<span class="stat-unit">' + esc(s.unit) + "</span>" : ""), key) + "</div>" +
        '<div class="stat-label">' + esc(s.label) + "</div>" +
        (s.note ? '<div class="stat-note">' + esc(s.note) + "</div>" : "") +
        // Numbers worked out from a project or chart say so, with a link to it
        (s.from ? '<div class="stat-from">Worked out from <a href="' + esc((mode === "embed" ? fullPageUrl : "") + s.fromLink) + '"' +
          (mode === "embed" ? ' target="_blank" rel="noopener"' : "") + ">" + esc(s.from) + "</a></div>" : "") +
        bars +
        (s.asOf || vs ? '<div class="stat-foot">' + (s.asOf ? '<span class="stat-asof">Up to ' + esc(SD.formatDate(s.asOf)) + "</span>" : "") + vs + "</div>" : "") +
      "</div>"
    );
  }

  function segbarHtml(counts) {
    return ["completed", "in-progress", "planning", "on-hold"].filter(function (k) { return counts[k]; }).map(function (k) {
      return '<span class="seg-' + k + '" style="flex:' + counts[k] + '" title="' + esc(SD.status(k).label) + ": " + counts[k] + '"></span>';
    }).join("");
  }

  function statsHtml(data, extraTile) {
    var stats = data.stats.slice(0, 4), best = -1, bestGain = 0;
    stats.forEach(function (s, i) { var g = statGain(s); if (g > bestGain) { best = i; bestGain = g; } });
    var tiles = stats.map(function (s, i) { return statHtml(s, i === best); });
    if (extraTile) tiles.push(extraTile);
    if (!tiles.length) return "";
    return '<section class="stats n' + tiles.length + '" aria-label="Headline numbers">' + tiles.join("") + "</section>";
  }

  function statusHtml(key) {
    return '<strong class="tag tag-' + key + '">' + (key === "completed" ? icon("check") : "") + esc(SD.status(key).label) + (key === "completed" ? doodle("tick", "is-pen tag-tick") : "") + "</strong>";
  }

  function chipHtml(catKey) {
    var cat = SD.category(catKey);
    return '<span class="cat-label cat-' + cat.key + '">' + catIconHtml(cat.key) + esc(cat.label) + "</span>";
  }

  // Where a project's own page lives. In the portal embed it opens the full page in a new tab.
  function projectHref(p) {
    return (mode === "embed" ? fullPageUrl : "") + "#project=" + encodeURIComponent(p.id);
  }
  function projectLinkAttrs(p) {
    return 'href="' + esc(projectHref(p)) + '"' + (mode === "embed" ? ' target="_blank" rel="noopener"' : "");
  }

  function metricHtml(p) {
    var m = SD.progress(p);
    if (!m) return stagesHtml(p);
    // The TVs get the short version so it fits on one line in bigger text.
    var foot = m.start === null ? withUnit(m.current, "") + " of " + withUnit(m.target, m.unit)
      : mode === "tv" ? "Now " + withUnit(m.current, m.unit) + " · target " + withUnit(m.target, m.unit)
      : "From " + withUnit(m.start, m.unit) + " to " + withUnit(m.current, m.unit) + " · target " + withUnit(m.target, m.unit);
    var pct = mode === "tv" ? (m.reached ? icon("check") : "") + m.pct + "%"
      : m.pct > 100 ? icon("check") + m.pct + "% of target" : m.reached ? icon("check") + "Target reached" : m.pct + "%";
    var key = "project:" + p.id + "|progress", changed = fresh[key];
    var note = !m.reached && m.pct >= 75 ? penNote("nearly there!", "metric-note") : !m.reached && m.pct >= 50 ? penNote("over halfway!", "metric-note") : "";
    // Progress that has just moved: its percentage is circled and the note says by how much.
    if (changed) {
      var before = SD.toNumber(String(changed.from).split("@")[1]);
      note = penNote(before === null || before === m.pct ? "updated!" : (m.pct > before ? "+" : "−") + Math.abs(m.pct - before) + "%!", "metric-note is-new");
      pct = circled(pct, key);
    }
    // On the TVs the pen note sits on the numbers line, so the label above keeps its full width.
    if (mode === "tv" && note) foot = "<span>" + foot + "</span>" + note;
    return (
      '<div class="metric">' +
        '<div class="metric-head"><span class="metric-label">' + esc(m.label || "Progress") + "</span>" +
          (mode === "tv" ? "" : note) +
          '<span class="metric-pct">' + pct + "</span></div>" +
        '<div class="meter" role="progressbar" aria-label="' + esc(m.label || p.title) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.min(100, m.pct) + '">' +
          '<span class="' + (m.ratio === 0 ? "is-zero" : "") + '" style="width:' + (m.ratio * 100).toFixed(1) + '%"></span>' +
        "</div>" +
        '<div class="metric-foot">' + foot + "</div>" +
      "</div>"
    );
  }

  // Projects without numbers show which stage they are at instead, with the same label row as the
  // numbers so the bars line up with the cards beside them.
  function stagesHtml(p) {
    var stage = { planning: 1, "in-progress": 2, "on-hold": 2, completed: 3 }[p.status] || 1;
    var labels = ["Planning", p.status === "on-hold" ? "On hold" : "In progress", "Completed"];
    var bars = "", names = "";
    for (var i = 1; i <= 3; i++) {
      bars += '<span class="' + (i <= stage ? "is-done" : "") + '"></span>';
      names += '<span class="' + (i === stage ? "is-current" : "") + '">' + labels[i - 1] + "</span>";
    }
    return '<div class="stages" aria-label="Stage: ' + esc(SD.status(p.status).label) + '">' +
      '<div class="metric-head" aria-hidden="true"><span class="metric-label">Stage</span><span class="metric-pct">' + stage + " of 3</span></div>" +
      '<div class="stage-bars">' + bars + '</div><div class="stage-labels">' + names + "</div></div>";
  }

  function milestoneCount(p) {
    if (!p.milestones.length) return "";
    var done = p.milestones.filter(function (m) { return m.done; }).length;
    return done + " of " + p.milestones.length + " milestones done";
  }

  function pictureHtml(src, alt, catKey, lazy) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(alt || "") + '"' + (lazy ? ' loading="lazy"' : "") + ">"
      : '<div class="card-placeholder"><span>No photo yet</span></div>';
  }

  // A space for a picture. Empty spaces show a soft placeholder so it's clear a photo can go there.
  function slotHtml(cls, src, alt, lazy) {
    return '<div class="' + cls + ' slot">' +
      (src ? '<img src="' + esc(src) + '" alt="' + esc(alt || "") + '"' + (lazy && mode !== "tv" ? ' loading="lazy"' : "") + ">" : '<span class="slot-empty" aria-hidden="true">' + icon("image") + "</span>") +
      "</div>";
  }

  /* ---------- Project cards and list rows ---------- */

  // Every card is the same size and shape. Featured projects come first with a gold label.
  // On the TVs "Next step" and "How you can help" run on in one line each, so more of the text fits.
  // Anything new or changed is marked: a new project's name and changed words are underlined,
  // a changed stage is circled, and a note says "new!", "done!" or "updated!" (pinned to the photo
  // on the web page, written after the category and stage on the TVs).
  function cardHtml(p) {
    var cat = SD.category(p.category);
    var linked = mode !== "tv";
    var key = "project:" + p.id;
    var details = [];
    if (p.nextStep) details.push(["Next step", underlined(esc(p.nextStep), key + "|next")]);
    if (p.getInvolved) details.push(["How you can help", underlined(esc(p.getInvolved), key + "|help")]);
    var detailsHtml = !details.length ? ""
      : mode === "tv"
        ? '<div class="card-details">' + details.map(function (d) { return '<p class="card-detail"><strong>' + d[0] + "</strong> " + d[1] + "</p>"; }).join("") + "</div>"
        : '<dl class="card-details">' + details.map(function (d) { return "<div><dt>" + d[0] + "</dt><dd>" + d[1] + "</dd></div>"; }).join("") + "</dl>";
    var footLeft = milestoneCount(p) || p.team;
    var title = underlined(esc(p.title), key);
    var note = fresh[key] ? "new!"
      : fresh[key + "|status"] && p.status === "completed" ? "done!"
      : fresh[key + "|status"] || fresh[key + "|summary"] || fresh[key + "|next"] || fresh[key + "|help"] ? "updated!" : "";
    return (
      '<article class="card cat-' + cat.key + (linked ? " is-linked" : "") + '"' + (linked ? ' data-search="' + esc(searchText(p)) + '"' : "") + ">" +
        '<div class="card-media">' + pictureHtml(p.image, p.imageAlt, cat.key, mode !== "tv") +
          (p.featured && linked ? '<span class="card-flag">Featured</span>' : "") + (note && linked ? newNote(note, "card-new") : "") + "</div>" +
        '<div class="card-body">' +
          '<div class="card-meta">' + chipHtml(cat.key) + circled(statusHtml(p.status), key + "|status") + (note && !linked ? newNote(note, "card-new") : "") + "</div>" +
          '<h3 class="card-title">' + (linked ? '<a class="card-link" ' + projectLinkAttrs(p) + ">" + title + "</a>" : title) + "</h3>" +
          '<p class="card-summary">' + underlined(esc(p.summary || ""), key + "|summary") + "</p>" +
          metricHtml(p) +
          detailsHtml +
          '<div class="card-foot"><span>' + esc(footLeft) + "</span>" +
            (linked ? '<span class="card-more">See details</span>' : "") +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  // Searching projects: every word typed has to appear somewhere in the project's words.
  function searchText(p) {
    return [p.title, p.summary, p.team, SD.category(p.category).label, SD.status(p.status).label, p.nextStep, p.getInvolved, p.metricLabel]
      .join(" ").toLowerCase();
  }
  function applySearch() {
    var words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    var items = app.querySelectorAll("[data-search]"), n = 0;
    for (var i = 0; i < items.length; i++) {
      var text = items[i].getAttribute("data-search");
      var hit = words.every(function (w) { return text.indexOf(w) !== -1; });
      items[i].hidden = !hit;
      if (hit) n++;
    }
    var count = app.querySelector("#projects-heading .section-count"), none = app.querySelector("#search-none"), status = app.querySelector("#search-status");
    if (count) count.textContent = n;
    if (none) {
      none.hidden = n > 0 || !words.length;
      none.querySelector(".search-words").textContent = state.query.trim();
      none.querySelector(".search-cat").textContent = state.filter !== "all" ? SD.category(state.filter).label.toLowerCase() + " " : "";
    }
    if (status) status.textContent = words.length ? (n === 1 ? "1 project matches" : n + " projects match") : "";
    evenCards(app.querySelector(".projects"));
  }

  // Cards side by side line up: each card's title, summary, progress and next steps take the
  // height of the tallest one, so the bars and labels sit level all the way along. Skipped when
  // the cards are in a single column (phones), where there's nothing beside them to line up with.
  var EVEN_PARTS = [".card-meta", ".card-title", ".card-summary", ".metric-head", ".metric, .stages", ".card-details"];
  function evenCards(scope) {
    var cards = scope ? [].filter.call(scope.querySelectorAll(".card"), function (c) { return !c.hidden; }) : [];
    if (!cards.length) return;
    var sideBySide = cards.length > 1 && cards[0].offsetTop === cards[1].offsetTop;
    EVEN_PARTS.forEach(function (sel) {
      var parts = [], max = 0, i;
      for (i = 0; i < cards.length; i++) {
        var el = cards[i].querySelector(sel);
        if (el) { el.style.minHeight = ""; parts.push(el); }
      }
      if (!sideBySide) return;
      for (i = 0; i < parts.length; i++) max = Math.max(max, parts[i].offsetHeight);
      for (i = 0; i < parts.length; i++) parts[i].style.minHeight = max + "px";
    });
  }

  function listRowHtml(p) {
    var cat = SD.category(p.category);
    return (
      '<li class="lrow is-linked cat-' + cat.key + '" data-search="' + esc(searchText(p)) + '">' +
        '<div class="lrow-thumb">' + pictureHtml(p.image, p.imageAlt, cat.key, true) + "</div>" +
        '<div class="lrow-main">' +
          '<div class="lrow-tags">' + chipHtml(cat.key) + statusHtml(p.status) + "</div>" +
          '<h3 class="lrow-title"><a class="card-link" ' + projectLinkAttrs(p) + ">" + esc(p.title) + "</a></h3>" +
          (p.summary ? '<p class="lrow-summary">' + esc(p.summary) + "</p>" : "") +
        "</div>" +
        '<div class="lrow-progress">' + metricHtml(p) + "</div>" +
      "</li>"
    );
  }

  /* ---------- Panels: progress, news, events, get involved, league ---------- */

  function panel(cls, iconName, title, body) {
    return '<section class="panel' + (cls ? " " + cls : "") + '" aria-label="' + esc(title) + '"><h2><span class="panel-icon">' + liveIcon(iconName) + "</span>" + esc(title) + "</h2>" + body + "</section>";
  }

  function progressPanelHtml(projects, extraClass) {
    var counts = statusCounts(projects);
    var total = projects.length;
    var legend = ["completed", "in-progress", "planning", "on-hold"].map(function (k) {
      return '<li><span class="swatch seg-' + k + '"></span><span class="legend-label">' + esc(SD.status(k).label) + '</span><span class="legend-value">' + counts[k] + "</span></li>";
    }).join("");
    return panel(extraClass || "", "in-progress", "Project progress",
      '<div class="hero-figure"><strong>' + counts.completed + "</strong><span>of " + total + " project" + (total === 1 ? "" : "s") + " completed</span></div>" +
      (total ? '<div class="segbar" aria-hidden="true">' + segbarHtml(counts) + "</div>" : "") +
      '<ul class="legend">' + legend + "</ul>");
  }

  function newsItemsHtml(list, data, insideProject) {
    return '<ul class="updates">' + list.map(function (u) {
      var p = u.project ? SD.findProject(data, u.project) : null;
      return (
        '<li class="update cat-' + (u.category || "other") + (u.category ? "" : " no-cat") + '">' +
          slotHtml("update-thumb", u.image, "", true) +
          '<div class="update-body">' + (u.date ? '<div class="update-date">' + esc(SD.formatDate(u.date)) + "</div>" : "") +
            (fresh[newsKey(u)] ? newNote("new!", "item-new") : "") +
          '<p class="update-text">' + underlined(esc(u.text), newsKey(u)) + "</p>" +
          (p && mode !== "tv" && !insideProject ? '<a class="update-link" ' + projectLinkAttrs(p) + ">" + esc(p.title) + "</a>" : "") +
          "</div>" +
        "</li>"
      );
    }).join("") + "</ul>";
  }

  function updatesHtml(data, limit) {
    var list = data.updates.filter(inCategories).slice(0, limit);
    return list.length ? panel("", "news", "Latest news", newsItemsHtml(list, data)) : "";
  }

  function eventItemsHtml(list, data, insideProject) {
    return '<ul class="events">' + list.map(function (e) {
      var d = SD.parseDate(e.date);
      var p = e.project ? SD.findProject(data, e.project) : null;
      var when = [SD.formatDate(e.date, { weekday: "short", day: "numeric", month: "short" }), e.time].filter(Boolean).join(", ");
      var soon = SD.daysAway(e.date);
      return (
        '<li class="event' + (e.category ? " cat-" + e.category : "") + '">' +
          '<div class="event-thumb">' + slotHtml("event-pic", e.image, "", true) +
            '<div class="event-date"><span>' + esc(SD.formatDate(d, { month: "short" })) + "</span><strong>" + d.getDate() + "</strong></div></div>" +
          '<div class="event-body">' +
            '<div class="event-title">' + underlined(esc(e.title), eventKey(e)) + "</div>" +
            '<div class="event-meta">' + esc(when) + (e.place ? " · " + esc(e.place) : "") +
              (mode !== "tv" ? ' <button type="button" class="event-cal" data-ics="' + esc(eventKey(e)) + '" aria-label="Add ' + esc(e.title) + ' to your calendar">' + icon("calendar") + "Add to calendar</button>" : "") + "</div>" +
            (soon ? '<span class="event-soon' + (soon === "Today" || soon === "Tomorrow" ? " is-close" : "") + '">' + esc(soon) + "</span>" : "") +
            (fresh[eventKey(e)] ? newNote("new!", "item-new") : "") +
            (p && mode !== "tv" && !insideProject ? '<a class="update-link" ' + projectLinkAttrs(p) + ">" + esc(p.title) + "</a>" : "") +
          "</div>" +
        "</li>"
      );
    }).join("") + "</ul>";
  }

  // "Add to calendar" on an event: downloads a calendar file the phone or computer opens.
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest("[data-ics]");
    if (!btn || !state.result) return;
    var key = btn.getAttribute("data-ics");
    var e = state.result.data.events.filter(function (x) { return eventKey(x) === key; })[0];
    if (!e) return;
    var p = e.project ? SD.findProject(state.result.data, e.project) : null;
    var ics = SD.eventIcs(e, SD.qrLink(fullPageUrl + (p ? "#project=" + encodeURIComponent(p.id) : "")));
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = String(e.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + ".ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 1000);
  });

  function eventsHtml(data, limit) {
    var list = SD.upcomingEvents(data).filter(inCategories).slice(0, limit);
    return list.length ? panel("", "calendar", "Coming up", eventItemsHtml(list, data)) : "";
  }

  // The Get involved QR code: the picture students added, or one made from the link.
  function involveQr(g) {
    if (g.qrImage) return '<img class="involve-qr" src="' + esc(SD.safeImage(g.qrImage)) + '" alt="QR code: ' + esc(g.linkLabel) + '">';
    var link = SD.qrLink(g.link);
    return link ? '<span class="involve-qr">' + SD.qrSvg(link, g.linkLabel) + "</span>" : "";
  }

  function involveHtml(data) {
    var g = data.getInvolved;
    if (!g.text && !g.link && !g.qrImage) return "";
    var link = SD.safeUrl(g.link);
    return (
      '<section class="panel involve' + (g.image ? " has-image" : "") + '" aria-label="' + esc(g.heading) + '">' +
        (g.image ? '<img class="involve-bg" src="' + esc(g.image) + '" alt="" loading="lazy"><div class="involve-shade"></div>' : "") +
        '<div class="involve-content"><h2>' + liveIcon("hand") + inked(esc(g.heading), "underline") + "</h2>" +
          '<div class="involve-body">' +
            "<div>" + (g.text ? '<p class="involve-text">' + esc(g.text) + "</p>" : "") +
              (link ? '<a class="button" href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(g.linkLabel) + icon("external") + "</a>" : "") +
            "</div>" +
            involveQr(g) +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function leaderboardHtml(data, extraClass) {
    var lb = data.leaderboard;
    if (!lb.entries.length) return "";
    var max = Math.max.apply(null, lb.entries.map(function (e) { return e.score; }).concat([1]));
    return panel("league" + (extraClass ? " " + extraClass : ""), "trophy", lb.title || "Leaderboard",
      '<ol class="league-list">' + lb.entries.map(function (e, i) {
        // A changed score is circled; "new!" or "up 2!" when a team joins or climbs the table.
        var key = "league:" + e.name, changed = fresh[key];
        var before = changed && changed.from !== null ? +String(changed.from).split("@")[1] : 0;
        var note = !changed ? "" : changed.from === null ? "new!" : before > i + 1 ? "up " + (before - i - 1) + "!" : "";
        return (
          '<li class="league-row' + (i === 0 ? " is-first" : "") + '">' +
            '<span class="league-rank">' + (i + 1) + "</span>" +
            '<span class="league-avatar">' + (e.image ? '<img src="' + esc(e.image) + '" alt="">' : esc(e.name.charAt(0).toUpperCase())) + "</span>" +
            '<div class="league-main"><div class="league-head"><span class="league-name">' + esc(e.name) + (i === 0 ? doodle("crown", "league-crown") : "") + (note ? newNote(note, "item-new") : "") + '</span><span class="league-score">' + circled(withUnit(e.score, lb.unit), key) + "</span></div>" +
            '<div class="league-bar"><span style="width:' + Math.max(2, e.score / max * 100).toFixed(1) + '%"></span></div></div>' +
          "</li>"
        );
      }).join("") + "</ol>" +
      (lb.note ? '<p class="panel-note">' + esc(lb.note) + "</p>" : ""));
  }

  function tipHtml(data) {
    var tip = SD.tipOfTheDay(data);
    return tip ? '<div class="inset"><strong>' + liveIcon("bulb") + 'Eco tip of the day</strong> <p class="inset-note">' + esc(tip) + "</p></div>" : "";
  }

  /* ---------- Charts: a number over time ---------- */

  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  // "16% lower than in Apr · improving", coloured and worded so colour isn't needed.
  function trendDelta(t) {
    var pts = t.points;
    if (pts.length < 2 || pts[0].value === 0) return "";
    var first = pts[0].value, last = pts[pts.length - 1].value;
    var change = (last - first) / Math.abs(first);
    var pct = Math.round(Math.abs(change) * 100);
    if (pct === 0) return '<span class="delta">No change since ' + esc(pts[0].label) + "</span>";
    var good = t.direction === "down" ? change < 0 : change > 0;
    return (
      '<span class="delta ' + (good ? "is-good" : "is-bad") + '"><span aria-hidden="true">' + (change < 0 ? "\u2193" : "\u2191") + "</span> " +
        pct + "% " + (change < 0 ? "lower" : "higher") + " than " + esc(pts[0].label) + " · " + (good ? "improving" : "getting worse") +
      "</span>"
    );
  }

  function trendTargetText(t) {
    if (t.target === null) return "";
    var last = t.points[t.points.length - 1].value;
    var reached = t.direction === "down" ? last <= t.target : last >= t.target;
    return '<span class="target-note"><span class="target-key" aria-hidden="true"></span>' + (reached ? "Target reached: " : "Target: ") + withUnit(t.target, t.unit) + "</span>";
  }

  function trendCardHtml(t, i, extraClass) {
    var table = '<table><thead><tr><th scope="col">When</th><th scope="col">' + esc(t.unit || "Value") + "</th></tr></thead><tbody>" +
      t.points.map(function (pt) { return "<tr><td>" + esc(pt.label) + "</td><td>" + SD.formatNumber(pt.value) + "</td></tr>"; }).join("") + "</tbody></table>";
    return (
      '<section class="panel trend cat-' + t.icon + (extraClass ? " " + extraClass : "") + '" aria-label="' + esc(t.title) + '">' +
        '<div class="trend-head"><h3>' + esc(t.title) + "</h3>" + (t.note ? '<p class="trend-sub">' + esc(t.note) + "</p>" : "") + trendDelta(t) + "</div>" +
        '<div class="chart" data-trend="' + i + '" role="img" aria-label="' + esc(t.title + ": " + t.points.map(function (pt) { return pt.label + " " + SD.formatNumber(pt.value); }).join(", ")) + '"></div>' +
        (t.target !== null ? '<div class="trend-foot">' + trendTargetText(t) + "</div>" : "") +
        (mode !== "tv" ? '<details class="trend-table"><summary>See the numbers</summary>' + table + "</details>" +
          '<div class="trend-table print-only" aria-hidden="true">' + table + "</div>" : "") +   // on paper, the numbers instead of the chart
      "</section>"
    );
  }

  // Draw every chart placeholder at its real size, so text stays crisp and readable.
  function drawCharts() {
    if (!state.result) return;
    var trends = state.result.data.trends;
    var boxes = app.querySelectorAll(".chart[data-trend]");
    for (var i = 0; i < boxes.length; i++) {
      var t = trends[+boxes[i].getAttribute("data-trend")];
      if (t) drawChart(boxes[i], t);
    }
  }

  function drawChart(box, t) {
    var W = Math.max(200, box.clientWidth), H = Math.max(120, box.clientHeight);
    var rem = parseFloat(getComputedStyle(root).fontSize) || 16;
    var padL = rem * 3, padR = rem * 1.25, padT = rem * 1.6, padB = rem * 1.6;
    var pts = t.points, n = pts.length;
    var values = pts.map(function (p) { return p.value; });
    var top = Math.max.apply(null, values.concat(t.target !== null ? [t.target] : []).concat([0]));
    var step = niceStep((top || 1) * 1.08 / 4);
    var yMax = Math.ceil(((top || 1) * 1.08) / step) * step;
    function x(i) { return n === 1 ? (padL + W - padR) / 2 : padL + i * (W - padL - padR) / (n - 1); }
    function y(v) { return padT + (H - padT - padB) * (1 - v / yMax); }

    var svg = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">' +
      (t.unit ? '<text class="ch-axis ch-unit" x="' + (padL - rem * 0.5) + '" y="' + (padT - rem * 0.75) + '" text-anchor="end">' + esc(t.unit) + "</text>" : "");
    for (var v = 0; v <= yMax + step / 2; v += step) {
      svg += '<line class="' + (v === 0 ? "ch-base" : "ch-grid") + '" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
        '<text class="ch-axis" x="' + (padL - rem * 0.5) + '" y="' + (y(v) + rem * 0.3) + '" text-anchor="end">' + SD.formatNumber(v) + "</text>";
    }
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.value).toFixed(1); }).join(" ");
    if (t.target !== null) {
      svg += '<line class="ch-target" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(t.target) + '" y2="' + y(t.target) + '"/>' +
        '<text class="ch-target-label" x="' + (padL + rem * 0.4) + '" y="' + (y(t.target) - rem * 0.4) + '">Target</text>';
    }
    if (n > 1) svg += '<path class="ch-line" d="' + line + '"/>';
    var every = n > 8 ? Math.ceil(n / 8) : 1;
    pts.forEach(function (p, i) {
      svg += '<circle class="ch-dot" cx="' + x(i) + '" cy="' + y(p.value) + '" r="' + (rem * 0.22).toFixed(1) + '"/>';
      if (i % every === 0 || i === n - 1) svg += '<text class="ch-axis" x="' + x(i) + '" y="' + (H - padB + rem * 1.15) + '" text-anchor="middle">' + esc(p.label) + "</text>";
    });
    var last = pts[n - 1];
    svg += '<text class="ch-label" x="' + x(n - 1) + '" y="' + (y(last.value) - rem * 0.65) + '" text-anchor="' + (n > 1 ? "end" : "middle") + '">' +
      SD.formatNumber(last.value) + (t.unit ? " " + esc(t.unit) : "") + "</text>";
    svg += '<line class="ch-cross" x1="0" x2="0" y1="' + padT + '" y2="' + y(0) + '" visibility="hidden"/>';
    svg += "</svg>";
    box.innerHTML = svg + '<div class="ch-tip" hidden></div>';
    var path = box.querySelector(".ch-line");
    if (path && path.getTotalLength) path.style.setProperty("--len", Math.ceil(path.getTotalLength()));

    if (mode === "tv" || n < 2) return;
    // Hover: a line and a label for the nearest point.
    var cross = box.querySelector(".ch-cross"), tip = box.querySelector(".ch-tip");
    var dots = box.querySelectorAll(".ch-dot");
    box.onmousemove = function (ev) {
      var r = box.getBoundingClientRect();
      var i = Math.max(0, Math.min(n - 1, Math.round((ev.clientX - r.left - padL) / ((W - padL - padR) / (n - 1)))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      for (var k = 0; k < dots.length; k++) dots[k].setAttribute("class", "ch-dot" + (k === i ? " is-active" : ""));
      tip.hidden = false;
      tip.innerHTML = "<strong>" + esc(pts[i].label) + "</strong> " + withUnit(pts[i].value, t.unit);
      var left = Math.min(W - tip.offsetWidth - 4, Math.max(4, x(i) - tip.offsetWidth / 2));
      tip.style.left = left + "px";
      tip.style.top = Math.max(0, y(pts[i].value) - tip.offsetHeight - rem * 0.9) + "px";
    };
    box.onmouseleave = function () {
      cross.setAttribute("visibility", "hidden");
      tip.hidden = true;
      for (var k = 0; k < dots.length; k++) dots[k].setAttribute("class", "ch-dot");
    };
  }

  function trendsSectionHtml(data) {
    if (!data.trends.length) return "";
    return (
      '<section class="section" id="trends" aria-labelledby="trends-heading"><div class="wrap">' +
        sectionHeadHtml("trends", "Is it getting <em>better</em>?", "Our numbers week by week and month by month.") +
        '<div class="trends">' + data.trends.map(function (t, i) { return trendCardHtml(t, i); }).join("") + "</div>" +
      "</div></section>"
    );
  }

  /* ---------- Notices and banner ---------- */

  function noticesHtml(result, data) {
    function bar(kind, html) {
      return '<div class="notice-bar' + (kind === "info" ? " is-preview" : "") + '"><div class="notice-bar-inner">' +
        icon(kind === "info" ? "check" : "warning") + "<div>" + html + "</div></div></div>";
    }
    var out = "";
    if (result.source === "draft") {
      out += bar("info", "<strong>Preview.</strong> You're looking at unsaved changes from the editor. Only this browser can see them.");
    } else if (data.isSampleData) {
      out += bar("warn", "<strong>Sample content.</strong> These projects, numbers and pictures are examples. Replace them in the editor and untick \"sample content\" before going live.");
    }
    if (result.warning) {
      out += bar("warn", "<strong>Showing a saved copy.</strong> The latest content couldn't be loaded: " + esc(result.warning));
    }
    return out;
  }

  function lastUpdatedText(data) {
    return data.dashboard.lastUpdated ? "Last updated " + esc(SD.formatDate(data.dashboard.lastUpdated)) : "";
  }

  // A site header bar in the school colour, like a school or council website.
  // A slim see-through bar that stays at the top while you scroll.
  function themeButtonHtml() {
    var dark = root.getAttribute("data-theme") === "dark", label = dark ? "Use light colours" : "Use dark colours";
    return '<button type="button" class="theme-toggle" data-theme-toggle aria-label="' + label + '" title="' + label + '">' + icon(dark ? "sun" : "moon") + "</button>";
  }

  function siteHeaderHtml(data, sections) {
    var hasInvolve = data.getInvolved.text || data.getInvolved.link;
    return (
      '<header class="site-header"><div class="site-header-inner">' +
        '<a class="site-brand" href="#top">' + badgeHtml(data) +
          '<span class="site-name">' + (data.school.name ? '<span class="site-school">' + esc(data.school.name) + "</span>" : "") +
          '<span class="site-title">' + esc(data.dashboard.title) + "</span></span></a>" +
        '<nav class="site-nav" aria-label="Sections">' + sections.map(function (sct) { return '<a href="#' + sct[0] + '">' + esc(sct[1]) + "</a>"; }).join("") + "</nav>" +
        (params.theme ? "" : themeButtonHtml()) +
        '<a class="pill pill-sm pill-sky site-tv" href="' + esc(pageUrl("mode=tv&from=web")) + '" title="Show the dashboard as it looks on the school TVs">' + icon("tv") + "TV mode</a>" +
        (hasInvolve ? '<a class="pill pill-sm" href="#news">Get involved</a>' : "") +
      "</div></header>"
    );
  }

  // The opening, laid out like the school website: a small label, a big serif title with its
  // last word in italics, a short intro and two buttons, beside the banner photo.
  // Only on paper: a QR code to the live dashboard, so a printed copy on a noticeboard leads to it.
  function printQrHtml() {
    var link = SD.qrLink(fullPageUrl);
    return link ? '<div class="print-only print-qr">' + SD.qrSvg(link, "the live dashboard") + "<p><strong>Scan for the live dashboard</strong>" + esc(link.replace(/^https?:\/\//, "")) + "</p></div>" : "";
  }

  function introHtml(data) {
    var d = data.dashboard;
    var updated = d.lastUpdated ? SD.formatDate(d.lastUpdated, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
    var words = String(d.title || "").split(" ");
    var last = words.pop();
    var titleHtml = (words.length ? esc(words.join(" ")) + " " : "") + "<em>" + inked(esc(last), "underline", doodle("sparks", "hero-sparks")) + "</em>";
    return (
      '<section class="hero' + (d.banner ? " has-media" : "") + '" id="top">' +
        '<div class="hero-text">' +
          (data.school.name ? '<p class="eyebrow">' + esc(data.school.name) + "</p>" : "") +
          "<h1>" + titleHtml + "</h1>" +
          (d.tagline ? '<p class="hero-lead">' + esc(d.tagline) + "</p>" : "") +
          '<div class="hero-actions"><span class="hero-main"><a class="pill" href="#projects">Explore the projects</a>' +
            '<span class="hero-start" aria-hidden="true">' + doodle("arrow", "is-pen") + '<span class="note">start here!</span></span></span>' +
            (d.about ? '<a class="pill pill-sky" href="#about">How we measure</a>' : "") + "</div>" +
          (updated ? '<p class="hero-updated">Last updated ' + esc(updated) + "</p>" : "") +
          newLegendHtml() +
        "</div>" +
        printQrHtml() +
        (d.banner
          ? '<figure class="hero-media offset-bar is-right"><div class="hero-frame"><img class="hero-img" src="' + esc(d.banner) + '" alt=""></div>' +
            (d.bannerAlt ? "<figcaption>" + esc(d.bannerAlt) + "</figcaption>" : "") + "</figure>"
          : "") +
      "</section>"
    );
  }

  // The key to the marks: "(5) new or changed this week: look for the circles and underlines".
  function newLegendHtml() {
    var n = freshCount();
    if (!n) return "";
    return '<p class="new-legend">' + penCircle('<span class="new-count">' + n + "</span>") +
      '<span><strong>new or changed ' + newWindowText() + "</strong> · look for the " + '<span class="new-text">circles and underlines</span></span></p>';
  }

  // A swipeable row of big photos, with arrow buttons.
  // Photos from around school, laid out like a photo album: one big photo and up to four smaller
  // ones. Any of them opens the full-screen viewer, which steps through every photo.
  function galleryHtml(data) {
    var photos = data.gallery;
    if (!photos.length) return "";
    var shown = photos.slice(0, 5), more = photos.length - shown.length;
    var all = photos.length > 1 ? '<button type="button" class="pill pill-sky" data-photo="0">' + icon("grid") + "See all " + photos.length + " photos</button>" : "";
    return sectionHtml("gallery", "gallery",
      sectionHeadHtml("gallery", "Around <em>school</em>", "Photos from our projects. Tap one to see it bigger.", all) +
      '<div class="mosaic n' + shown.length + '">' +
        shown.map(function (p, i) {
          return '<button type="button" class="mosaic-item" data-photo="' + i + '" aria-label="' + esc("Photo " + (i + 1) + " of " + photos.length + (p.caption ? ": " + p.caption : "")) + '">' +
            slotHtml("mosaic-pic", p.image, "", i > 0) +
            (p.caption ? '<span class="mosaic-cap">' + esc(p.caption) + "</span>" : "") +
            (i === shown.length - 1 && more > 0 ? '<span class="mosaic-more">+' + more + " more</span>" : "") +
          "</button>";
        }).join("") +
      "</div>");
  }

  function setupGallery() {
    var items = app.querySelectorAll("[data-photo]");
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener("click", function (e) { openPhoto(Number(e.currentTarget.getAttribute("data-photo"))); });
    }
  }

  // Full-screen photo viewer: arrows, swipe or the arrow keys step through every photo.
  function openPhoto(index) {
    var photos = state.result && state.result.data.gallery;
    if (!photos || !photos.length) return;
    var lb = document.getElementById("lightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "lightbox";
      lb.className = "lightbox";
      lb.hidden = true;
      lb.setAttribute("role", "dialog");
      lb.setAttribute("aria-modal", "true");
      lb.setAttribute("aria-label", "Photos from around school");
      lb.innerHTML =
        '<button type="button" class="lb-btn lb-close" data-lb="close" aria-label="Close">' + icon("close") + "</button>" +
        '<button type="button" class="lb-btn lb-prev" data-lb="-1" aria-label="Previous photo">' + icon("chevron") + "</button>" +
        '<figure class="lb-figure"><div class="lb-frame"><img class="lb-img" alt=""></div>' +
          '<figcaption><span class="lb-count"></span><span class="lb-cap"></span></figcaption></figure>' +
        '<button type="button" class="lb-btn lb-next" data-lb="1" aria-label="Next photo">' + icon("chevron") + "</button>";
      document.body.appendChild(lb);
      lb.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("[data-lb]") : null;
        if (b) {
          var a = b.getAttribute("data-lb");
          if (a === "close") closePhoto();
          else showPhoto(state.photo + Number(a), Number(a));
        } else if (e.target === lb) closePhoto();
      });
      lb.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.stopPropagation(); closePhoto(); }
        else if (e.key === "ArrowRight") showPhoto(state.photo + 1, 1);
        else if (e.key === "ArrowLeft") showPhoto(state.photo - 1, -1);
      });
      var startX = null;
      lb.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener("touchend", function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) showPhoto(state.photo + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      });
    }
    state.photoReturn = document.activeElement;
    lb.classList.remove("is-closing");
    lb.classList.toggle("is-single", photos.length < 2);
    lb.hidden = false;
    document.documentElement.classList.add("has-lightbox");
    showPhoto(index, 0);
    lb.querySelector(".lb-close").focus();
  }

  function showPhoto(i, dir) {
    var photos = state.result.data.gallery, lb = document.getElementById("lightbox");
    var count = photos.length;
    i = (i + count) % count;
    state.photo = i;
    var img = lb.querySelector(".lb-img");
    img.classList.remove("is-in");
    img.style.setProperty("--from", (dir * 48) + "px");
    img.src = photos[i].image;
    img.alt = photos[i].caption || "";
    void img.offsetWidth; // restarts the slide-in animation
    img.classList.add("is-in");
    lb.querySelector(".lb-count").textContent = (i + 1) + " / " + count;
    lb.querySelector(".lb-cap").textContent = photos[i].caption || "";
  }

  function closePhoto() {
    var lb = document.getElementById("lightbox");
    if (!lb || lb.hidden) return;
    function hide() { lb.hidden = true; lb.classList.remove("is-closing"); }
    document.documentElement.classList.remove("has-lightbox");
    if (reduceMotion) hide();
    else { lb.classList.add("is-closing"); setTimeout(hide, 260); }
    if (state.photoReturn && state.photoReturn.focus) state.photoReturn.focus();
  }

  // The highlight behind the chosen category slides over from the one picked before.
  function placeGlider() {
    var box = app.querySelector(".filters"), glider = box && box.querySelector(".filter-glider");
    var on = glider && box.querySelector('.filter[aria-pressed="true"]');
    if (!on) return;
    function put(g) {
      glider.style.width = g.w + "px";
      glider.style.height = g.h + "px";
      glider.style.transform = "translate(" + g.l + "px," + g.t + "px)";
    }
    var to = { l: on.offsetLeft, t: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
    var from = state.gliderFrom;
    state.gliderFrom = null;
    if (from) box.scrollLeft = from.scroll || 0;
    if (from && !reduceMotion) {
      glider.style.transition = "none";
      put(from);
      void glider.offsetWidth; // applies the starting point before sliding
      glider.style.transition = "";
    }
    put(to);
    box.classList.add("has-glider");
    // On phones the chips scroll sideways; keep the chosen one in view.
    if (box.scrollWidth > box.clientWidth + 4 && (to.l < box.scrollLeft || to.l + to.w > box.scrollLeft + box.clientWidth)) {
      var left = Math.max(0, to.l - 24);
      if (box.scrollTo && !reduceMotion) box.scrollTo({ left: left, behavior: "smooth" });
      else box.scrollLeft = left;
    }
    if (!state.gliderResize) {
      state.gliderResize = true;
      window.addEventListener("resize", placeGlider);
    }
  }

  function sectionHtml(id, cls, inner) {
    return '<section class="section' + (cls ? " " + cls : "") + '" id="' + id + '" aria-labelledby="' + id + '-heading"><div class="wrap">' + inner + "</div></section>";
  }

  // Section titles follow the school website: a small capitals label, then a big serif
  // title with one word in italics (titles are written in the code, so they can hold <em>).
  // Each section's italic word gets its own highlighter stroke.
  var SECTION_INK = { headlines: "underline", projects: "wave", gallery: "loop", news: "double", trends: "underline", standings: "wave", about: "loop" };
  var SECTION_LABEL = {
    headlines: "Headlines", projects: "Projects", gallery: "Photos", news: "Events and news",
    trends: "Progress over time", standings: "League and status", about: "About this data"
  };

  function sectionHeadHtml(id, titleHtml, sub, right, scribble) {
    titleHtml = titleHtml.replace(/<em>([\s\S]*?)<\/em>/, function (m, word) { return "<em>" + inked(word, SECTION_INK[id] || "underline") + "</em>"; });
    return (
      '<div class="section-head">' + (SECTION_LABEL[id] ? '<p class="eyebrow">' + SECTION_LABEL[id] + "</p>" : "") + '<div class="section-title">' +
        '<h2 id="' + id + '-heading">' + titleHtml + (scribble ? penNote(scribble, "section-note") : "") + "</h2>" +
        (sub ? '<p class="section-sub">' + esc(sub) + "</p>" : "") + "</div>" + (right || "") +
      "</div>"
    );
  }

  // "3 of 4 getting better!" beside the Headlines title.
  function headlinesNote(data) {
    var stats = data.stats.slice(0, 4).filter(function (s) { return s.previous !== null && typeof s.value === "number"; });
    var better = stats.filter(function (s) { return statGain(s) > 0; }).length;
    if (!better) return "";
    return better === stats.length ? (better === 1 ? "getting better!" : "all getting better!") : better + " of " + stats.length + " getting better!";
  }

  // "2 done already!" beside the Projects title.
  function projectsNote(projects) {
    var done = statusCounts(projects).completed;
    return done ? done + " done already!" : projects.length ? "just getting started!" : "";
  }

  function contactHtml(d) {
    if (!d.contact) return "";
    return /@/.test(d.contact) && !/\s/.test(d.contact) ? '<a href="mailto:' + esc(d.contact) + '">' + esc(d.contact) + "</a>" : esc(d.contact);
  }

  function aboutHtml(data) {
    var d = data.dashboard;
    var contact = contactHtml(d);
    if (!d.about && !contact && !d.madeBy) return "";
    return (
      '<section class="section about" id="about" aria-labelledby="about-heading"><div class="wrap">' +
        sectionHeadHtml("about", "About <em>this data</em>", "Where the numbers come from.") +
        '<div class="about-grid">' + '<div class="about-pic offset-bar">' + slotHtml("about-media", d.aboutImage, "", true) + "</div>" +
        '<div class="about-body">' +
          (d.about ? "<p>" + esc(d.about) + "</p>" : "") +
          '<dl class="about-facts">' +
            (d.madeBy ? "<div><dt>Run by</dt><dd>" + esc(d.madeBy) + "</dd></div>" : "") +
            (d.lastUpdated ? "<div><dt>Last updated</dt><dd>" + esc(SD.formatDate(d.lastUpdated)) + "</dd></div>" : "") +
            (contact ? "<div><dt>Questions or ideas</dt><dd>" + contact + "</dd></div>" : "") +
          "</dl>" +
          '<button type="button" class="pill pill-sm pill-sky about-download" data-download-numbers>' + icon("download") + "Download the numbers</button>" +
          '<p class="about-download-note">A spreadsheet of every number on this page, for lessons and projects.</p>' +
        "</div></div>" +
      "</div></section>"
    );
  }

  /* ---------- Full page (and embed) ---------- */

  function renderFull(result) {
    var data = result.data;
    var typing = document.activeElement && document.activeElement.id === "project-search";   // kept if new content arrives mid-search
    var projects = visibleProjects(data);
    var present = SD.CATEGORIES.filter(function (c) {
      return projects.some(function (p) { return p.category === c.key; });
    });
    if (state.filter !== "all" && !present.some(function (c) { return c.key === state.filter; })) state.filter = "all";
    var shown = projects.filter(function (p) { return state.filter === "all" || p.category === state.filter; });

    var filters = present.length > 1
      ? '<div class="filters" role="group" aria-label="Filter projects by category"><span class="filter-glider" aria-hidden="true"></span>' +
          '<button type="button" class="filter" data-filter="all" aria-pressed="' + (state.filter === "all") + '"><span class="filter-icon">' + icon("grid") + "</span>All" +
            '<span class="filter-count">' + projects.length + "</span></button>" +
          present.map(function (c) {
            var n = projects.filter(function (p) { return p.category === c.key; }).length;
            return '<button type="button" class="filter cat-' + c.key + '" data-filter="' + c.key + '" aria-pressed="' + (state.filter === c.key) + '"><span class="filter-icon">' + liveIcon(c.key) + "</span>" + esc(c.label) +
              '<span class="filter-count">' + n + "</span></button>";
          }).join("") +
        "</div>"
      : "";

    var viewToggle =
      '<div class="project-tools">' +
        (projects.length > 3
          ? '<label class="project-search">' + icon("search") + '<span class="visually-hidden">Search projects</span>' +
              '<input type="search" id="project-search" placeholder="Search projects" autocomplete="off" value="' + esc(state.query) + '"></label>'
          : "") +
        '<div class="view-toggle" role="group" aria-label="Show projects as">' +
          '<button type="button" data-view="grid" aria-pressed="' + (state.view === "grid") + '">' + icon("grid") + "Grid</button>" +
          '<button type="button" data-view="list" aria-pressed="' + (state.view === "list") + '">' + icon("list") + "List</button>" +
        "</div>" +
      "</div>";

    var projectsHtml = !shown.length
      ? '<div class="empty">No projects to show yet.</div>'
      : state.view === "list"
        ? '<ul class="project-list">' + shown.map(listRowHtml).join("") + "</ul>"
        : '<div class="projects">' + shown.map(function (p) { return cardHtml(p); }).join("") + "</div>";

    var happening = eventsHtml(data, 4) + updatesHtml(data, 5) + involveHtml(data);
    var standing = leaderboardHtml(data) + progressPanelHtml(projects);
    var stats = statsHtml(data);
    var about = aboutHtml(data);
    // [section id, short name for the menu bar]
    var sections = [["projects", "Projects"]];
    if (stats) sections.unshift(["headlines", "Headlines"]);
    if (data.gallery.length) sections.push(["gallery", "Photos"]);
    if (happening) sections.push(["news", "News"]);
    if (data.trends.length) sections.push(["trends", "Progress"]);
    sections.push(["standings", data.leaderboard.entries.length ? "League" : "Status"]);
    if (about) sections.push(["about", "About"]);
    // A deep navy footer like the school website's: logo, quick links to each section, contact.
    var d = data.dashboard, contact = contactHtml(d);
    var footer = '<footer class="footer"><div class="wrap">' +
      '<div class="footer-grid">' +
        // The school's white crest-and-name logo when there is one, like the school website's footer
        (data.school.logoWhite
          ? '<div><a class="footer-brand has-logo" href="#top"><img class="footer-logo" src="' + esc(data.school.logoWhite) + '" alt="' + esc(data.school.name || "School logo") + '">' +
            '<span class="site-title">' + esc(d.title) + "</span></a>"
          : '<div><a class="footer-brand" href="#top">' + badgeHtml(data) + '<span class="site-name">' +
            (data.school.name ? '<span class="site-school">' + esc(data.school.name) + "</span>" : "") + '<span class="site-title">' + esc(d.title) + "</span></span></a>") +
          (d.madeBy ? '<p class="footer-text">' + esc(d.madeBy) + "</p>" : "") + "</div>" +
        '<div><p class="footer-label">On this page</p><nav class="footer-links" aria-label="Sections">' +
          sections.map(function (sct) { return '<a href="#' + sct[0] + '">' + esc(sct[1]) + "</a>"; }).join("") + "</nav></div>" +
        (contact ? '<div><p class="footer-label">Questions or ideas</p><p class="footer-text">' + contact + "</p></div>" : "") +
      "</div>" +
      '<div class="footer-bottom"><span>' + esc(data.school.name || d.title) + "</span><span>" + lastUpdatedText(data) +
        ' · <a href="' + esc(pageUrl("mode=tv&from=web")) + '">TV mode</a>' +
        (CONFIG.showEditorLink ? ' · <a href="editor.html">Edit</a>' : "") + "</span></div>" +
    "</div></footer>";

    app.innerHTML =
      (showHeader ? '<a class="skip-link" href="#content">Skip to the dashboard</a>' + siteHeaderHtml(data, sections) : "") +
      noticesHtml(result, data) +
      '<main class="main" id="content" tabindex="-1">' +
        (showHeader ? '<div class="stage"><div class="wrap">' + introHtml(data) + "</div></div>" : "") +
        (stats
          ? sectionHtml("headlines", "", sectionHeadHtml("headlines", "How we're <em>doing</em>", "The numbers we track, compared with last time.", "", headlinesNote(data)) + stats + tipHtml(data))
          : (tipHtml(data) ? '<div class="wrap">' + tipHtml(data) + "</div>" : "")) +
        sectionHtml("projects", "",
          sectionHeadHtml("projects", "Our <em>projects</em>" + '<span class="section-count">' + shown.length + "</span>", "What we're working on, and how far each project has got.", viewToggle, projectsNote(projects)) +
          filters + projectsHtml +
          '<p class="empty search-none" id="search-none" hidden>No <span class="search-cat"></span>projects match \u201c<span class="search-words"></span>\u201d. <button type="button" class="link-button" data-clear-search>Show all projects</button></p>' +
          '<p class="visually-hidden" id="search-status" role="status" aria-live="polite"></p>') +
        galleryHtml(data) +
        (happening ? sectionHtml("news", "", sectionHeadHtml("news", "What's <em>happening</em>?", "What's coming up, and what's happened recently.") + '<div class="extras">' + happening + "</div>") : "") +
        trendsSectionHtml(data) +
        sectionHtml("standings", "",
          sectionHeadHtml("standings", data.leaderboard.entries.length ? "Who's <em>leading</em>?" : "Where projects <em>stand</em>", data.leaderboard.entries.length ? "Who's leading the challenge, and where every project stands." : "Where every project stands.") +
          '<div class="extras">' + standing + "</div>") +
        about +
        footer +
      "</main>";

    // Sections alternate between light grey and white, whichever ones are showing, so each stands apart.
    var secs = app.querySelectorAll(".main > .section");
    for (var k = 0; k < secs.length; k += 2) secs[k].classList.add("band");

    // Clicking re-draws the page. Keyboard users get their focus back; a mouse click
    // (e.detail > 0) doesn't need it, and refocusing would show a focus ring.
    var buttons = app.querySelectorAll("[data-filter]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (e) {
        var box = app.querySelector(".filters"), was = box && box.querySelector('.filter[aria-pressed="true"]');
        state.gliderFrom = was ? { l: was.offsetLeft, t: was.offsetTop, w: was.offsetWidth, h: was.offsetHeight, scroll: box.scrollLeft } : null;
        state.filter = e.currentTarget.getAttribute("data-filter");
        var byKeyboard = e.detail === 0;
        renderFull(state.result);
        var b = app.querySelector('[data-filter="' + state.filter + '"]');
        if (b && byKeyboard) b.focus();
      });
    }
    var themeBtn = app.querySelector("[data-theme-toggle]");
    if (themeBtn) themeBtn.addEventListener("click", function () {
      SD.storage.set(THEME_KEY, root.getAttribute("data-theme") === "dark" ? "light" : "dark");
      applyTheme();
      var dark = root.getAttribute("data-theme") === "dark", label = dark ? "Use light colours" : "Use dark colours";
      themeBtn.innerHTML = icon(dark ? "sun" : "moon");
      themeBtn.setAttribute("aria-label", label);
      themeBtn.title = label;
      drawCharts();   // the charts take their colours from the theme
    });
    var numbers = app.querySelector("[data-download-numbers]");
    if (numbers) numbers.addEventListener("click", function () {
      var blob = new Blob([SD.numbersCsv(state.result.data)], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "sustainability-numbers-" + SD.todayISO() + ".csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 1000);
    });
    var search = app.querySelector("#project-search");
    if (search) {
      search.addEventListener("input", function () { state.query = search.value; applySearch(); });
      search.addEventListener("keydown", function (e) {
        if ((e.key === "Escape" || e.key === "Esc") && search.value) { e.stopPropagation(); search.value = ""; state.query = ""; applySearch(); }
      });
    } else state.query = "";
    if (search && typing) { search.focus(); search.setSelectionRange(search.value.length, search.value.length); }
    var clear = app.querySelector("[data-clear-search]");
    if (clear) clear.addEventListener("click", function () {
      state.query = "";
      if (search) { search.value = ""; search.focus(); }
      applySearch();
    });
    var views = app.querySelectorAll("[data-view]");
    for (var j = 0; j < views.length; j++) {
      views[j].addEventListener("click", function (e) {
        state.view = e.currentTarget.getAttribute("data-view");
        SD.storage.set(VIEW_KEY, state.view);
        viewChosen = true;
        var byKeyboard = e.detail === 0;
        renderFull(state.result);
        var b = app.querySelector('[data-view="' + state.view + '"]');
        if (b && byKeyboard) b.focus();
      });
    }
    placeGlider();
    var heroImg = app.querySelector(".hero-img");
    if (heroImg) heroImg.addEventListener("error", function () {
      var fig = heroImg.parentNode.parentNode, hero = app.querySelector(".hero");
      if (fig && fig.parentNode) fig.parentNode.removeChild(fig);
      if (hero) hero.classList.remove("has-media");
    });
    watchImages(app);
    applySearch();   // also lines the cards up (evenCards)
    drawCharts();
    setupGallery();
    revealOnScroll();
    setupScrollEffects();
    postHeight();
  }

  /* ---------- Motion (no plugins: plain JavaScript and CSS) ---------- */

  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var EASE_OUT = function (k) { return k >= 1 ? 1 : 1 - Math.pow(2, -10 * k); };

  // Numbers count up from zero, slowing down at the end.
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (!isFinite(target) || el.getAttribute("data-counted")) return;
    el.setAttribute("data-counted", "1");
    var started = null, duration = 1700;
    function step(t) {
      if (started === null) started = t;
      var k = Math.min(1, (t - started) / duration), v = target * EASE_OUT(k);
      el.textContent = SD.formatNumber(k >= 1 ? target : Math.abs(target) < 10 ? Math.round(v * 10) / 10 : Math.round(v));
      if (k < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  // Things fade up the first time they scroll into view; bars fill, charts draw and numbers count.
  function revealOnScroll() {
    if (state.revealed || !window.IntersectionObserver || reduceMotion) return;
    state.revealed = true;
    var hero = app.querySelector(".hero"), brand = app.querySelector(".site-brand");
    if (brand) brand.classList.add("logo-intro");
    if (hero) {
      hero.classList.add("intro");
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { hero.classList.add("intro-play"); });
      });
    }
    var items = app.querySelectorAll(".section-head, .stat, .inset, .card, .lrow, .panel, .mosaic-item, .about-grid");
    var counts = app.querySelectorAll(".stat .count");
    for (var c = 0; c < counts.length; c++) counts[c].textContent = SD.formatNumber(0);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-visible");
        var nums = en.target.querySelectorAll(".count");
        for (var n = 0; n < nums.length; n++) countUp(nums[n]);
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    for (var i = 0; i < items.length; i++) {
      items[i].classList.add("reveal");
      items[i].style.setProperty("--delay", (i % 3) * 90 + "ms");
      io.observe(items[i]);
    }
    setupScrollEffects();
  }

  // Scroll-linked effects: the opening drifts up and fades, the banner photo
  // moves a little slower than the page, the background rings move slowly,
  // and the top bar gets its line once you start scrolling.
  function setupScrollEffects() {
    if (state.scrollFx) return;
    state.scrollFx = true;
    var ticking = false;
    function clamp(v) { return Math.max(0, Math.min(1, v)); }
    function update() {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop, vh = window.innerHeight;
      var header = document.querySelector(".site-header");
      if (header) header.classList.toggle("is-scrolled", y > 8);
      if (reduceMotion) return;
      var hero = app.querySelector(".hero");
      if (hero) {
        var p = clamp(y / Math.max(1, hero.offsetHeight + 80));
        hero.style.opacity = (1 - p * 0.85).toFixed(3);
        hero.style.transform = "translate3d(0," + (-p * 70).toFixed(1) + "px,0) scale(" + (1 - p * 0.05).toFixed(4) + ")";
      }
      var img = app.querySelector(".hero.intro-done .hero-img");
      if (img) img.style.transform = "translate3d(0," + (clamp(y / vh) * 40).toFixed(1) + "px,0) scale(1.1)";
      var rings = app.querySelectorAll(".stage");
      for (var i = 0; i < rings.length; i++) {
        var rr = rings[i].getBoundingClientRect();
        if (rr.bottom < 0 || rr.top > vh) continue;
        rings[i].style.setProperty("--parallax", Math.max(-160, Math.min(160, rr.top * -0.18)).toFixed(1) + "px");
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // After the opening animation, hand the banner photo over to the scroll effect.
    setTimeout(function () {
      var hero = app.querySelector(".hero");
      if (hero) hero.classList.add("intro-done");
      update();
    }, 2400);
    update();
  }

  /* ---------- One project's page ---------- */

  function detailHtml(p, data) {
    var cat = SD.category(p.category);
    var pictures = (p.image ? [{ image: p.image, imageAlt: p.imageAlt }] : []).concat(p.gallery);
    var thumbs = pictures.length > 1
      ? '<div class="detail-thumbs">' + pictures.map(function (g, i) {
          return '<button type="button" class="detail-thumb' + (i === 0 ? " is-active" : "") + '" data-picture="' + i + '" aria-label="Show picture ' + (i + 1) + '">' +
            '<img src="' + esc(g.image) + '" alt=""></button>';
        }).join("") + "</div>"
      : "";
    // "About this project" is always one paragraph.
    var story = p.story ? "<p>" + esc(p.story.replace(/\s*\n\s*/g, " ")) + "</p>" : "";
    var nextIndex = -1;
    p.milestones.some(function (m, i) { if (!m.done) { nextIndex = i; return true; } return false; });
    var timeline = p.milestones.length
      ? '<ol class="timeline">' + p.milestones.map(function (m, i) {
          var cls = m.done ? "is-done" : i === nextIndex ? "is-next" : "is-todo";
          return (
            '<li class="tl-item ' + cls + '"><span class="tl-dot">' + (m.done ? icon("check") : i + 1) + "</span>" +
              '<div class="tl-text"><div class="tl-title">' + esc(m.title) + (i === nextIndex ? ' <span class="tl-tag">Next</span>' : "") + "</div>" +
              (m.date ? '<div class="tl-date">' + esc(SD.formatDate(m.date)) + (m.done ? "" : " (planned)") + "</div>" : "") + "</div>" +
            "</li>"
          );
        }).join("") + "</ol>"
      : "";
    var news = data.updates.filter(function (u) { return u.project === p.id; }).slice(0, 5);
    var events = SD.upcomingEvents(data).filter(function (e) { return e.project === p.id; });
    var facts = [
      p.team ? ["Who's running it", esc(p.team)] : null,
      p.startDate ? ["Started", esc(SD.formatDate(p.startDate))] : null,
      p.endDate ? ["Aiming to finish", esc(SD.formatDate(p.endDate))] : null,
      p.updated ? ["Last updated", esc(SD.formatDate(p.updated))] : null
    ].filter(Boolean);
    var help = p.getInvolved || p.helpLink;
    var qr = SD.qrLink(fullPageUrl + "#project=" + encodeURIComponent(p.id));   // "" when opened from a file

    return (
      '<div class="detail" role="dialog" aria-modal="true" aria-labelledby="detail-title" tabindex="-1">' +
        '<div class="detail-bar"><button type="button" class="detail-close" data-close aria-label="Close">' + icon("close") + "</button></div>" +
        '<div class="detail-media cat-' + cat.key + '"><div class="detail-picture" id="detail-picture">' + pictureHtml(pictures.length ? pictures[0].image : "", pictures.length ? pictures[0].imageAlt : "", cat.key) + "</div></div>" +
        thumbs +
        '<div class="detail-body">' +
          '<div class="detail-head"><div class="card-meta">' + chipHtml(cat.key) + statusHtml(p.status) + "</div>" +
            '<h2 id="detail-title">' + esc(p.title) + "</h2>" +
            (p.summary ? '<p class="detail-lead">' + esc(p.summary) + "</p>" : "") +
          "</div>" +
          '<div class="detail-cols">' +
            '<div class="detail-main">' +
              (story ? '<section class="detail-section"><h3>About this project</h3><div class="detail-story">' + story + "</div></section>" : "") +
              (timeline ? '<section class="detail-section is-milestones"><h3>Milestones<span>' + esc(milestoneCount(p)) + "</span></h3>" +
                '<div class="tl-bar" aria-hidden="true"><span style="width:' + (p.milestones.filter(function (m) { return m.done; }).length / p.milestones.length * 100).toFixed(1) + '%"></span></div>' +
                timeline + "</section>" : "") +
              (events.length ? '<section class="detail-section"><h3>Coming up</h3>' + eventItemsHtml(events, data, true) + "</section>" : "") +
              (news.length ? '<section class="detail-section"><h3>Project news</h3>' + newsItemsHtml(news, data, true) + "</section>" : "") +
            "</div>" +
            '<aside class="detail-side cat-' + cat.key + '">' +
              '<div class="detail-box">' + metricHtml(p) + "</div>" +
              (p.nextStep ? '<div class="detail-box"><div class="detail-label">Next step</div><p>' + esc(p.nextStep) + "</p></div>" : "") +
              (help ? '<div class="detail-box is-help"><div class="detail-label">How you can help</div>' +
                (p.getInvolved ? "<p>" + esc(p.getInvolved) + "</p>" : "") +
                (p.helpLink ? '<a class="button" href="' + esc(p.helpLink) + '" target="_blank" rel="noopener">Sign up' + icon("external") + "</a>" : "") + "</div>" : "") +
              (facts.length ? '<dl class="detail-facts">' + facts.map(function (f) { return "<div><dt>" + f[0] + "</dt><dd>" + f[1] + "</dd></div>"; }).join("") + "</dl>" : "") +
              (qr ? '<div class="detail-qr">' + SD.qrSvg(qr, "open " + p.title + " on a phone") + "<p>Scan to open this page on a phone. Print it for a poster.</p></div>" : "") +
              '<button type="button" class="detail-copy" data-copy><span>' + (navigator.share ? "Share this project" : "Copy link to this project") + "</span></button>" +
            "</aside>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function openDetail(p) {
    var data = state.result.data;
    var layer = document.getElementById("detail-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "detail-layer";
      layer.className = "detail-layer";
      document.body.appendChild(layer);
      layer.addEventListener("click", function (e) {
        if (e.target === layer || (e.target.closest && e.target.closest("[data-close]"))) closeDetailFromUser();
        var thumb = e.target.closest && e.target.closest("[data-picture]");
        if (thumb) showPicture(+thumb.getAttribute("data-picture"));
        var copy = e.target.closest && e.target.closest("[data-copy]");
        if (copy) copyLink(copy);
      });
    }
    if (state.detailId === null) state.detailReturnFocus = document.activeElement;
    state.detailId = p.id;
    layer.classList.remove("is-closing");
    layer.innerHTML = detailHtml(p, data);
    layer.hidden = false;
    document.body.classList.add("has-detail");
    document.title = p.title + " · " + data.dashboard.title;
    watchImages(layer);
    var dialog = layer.querySelector(".detail");
    dialog.scrollTop = 0;
    dialog.focus();
  }

  function showPicture(i) {
    var p = SD.findProject(state.result.data, state.detailId);
    if (!p) return;
    var pictures = (p.image ? [{ image: p.image, imageAlt: p.imageAlt }] : []).concat(p.gallery);
    var box = document.getElementById("detail-picture");
    if (!pictures[i] || !box) return;
    box.innerHTML = pictureHtml(pictures[i].image, pictures[i].imageAlt, p.category);
    var thumbs = document.querySelectorAll(".detail-thumb");
    for (var k = 0; k < thumbs.length; k++) thumbs[k].classList.toggle("is-active", k === i);
  }

  // Phones get their own share sheet (WhatsApp, Teams, email...); computers copy the link.
  function copyLink(btn) {
    var hash = "#project=" + encodeURIComponent(state.detailId);
    var url = SD.qrLink(fullPageUrl + hash) || location.href.split("#")[0] + hash;   // the plain page, not a TV or portal address
    var label = btn.querySelector("span");
    function done(ok) { label.textContent = ok ? "Link copied" : url; }
    function copy() {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      else done(false);
    }
    if (navigator.share) {
      var p = state.result && SD.findProject(state.result.data, state.detailId);
      navigator.share({ title: p ? p.title : document.title, text: p && p.summary ? p.summary : "", url: url }).then(null, function (err) {
        if (!err || err.name !== "AbortError") copy();      // closing the share sheet isn't a failure
      });
    } else copy();
  }

  function closeDetail() {
    var layer = document.getElementById("detail-layer");
    if (!layer || state.detailId === null) return;
    state.detailId = null;
    function hide() {
      if (state.detailId !== null) return; // reopened meanwhile
      layer.classList.remove("is-closing");
      layer.hidden = true;
      layer.innerHTML = "";
    }
    if (reduceMotion) hide();
    else { layer.classList.add("is-closing"); setTimeout(hide, 280); }
    document.body.classList.remove("has-detail");
    if (state.result) document.title = state.result.data.dashboard.title + (state.result.data.school.name ? " · " + state.result.data.school.name : "");
    if (state.detailReturnFocus && state.detailReturnFocus.focus) state.detailReturnFocus.focus();
  }

  function closeDetailFromUser() {
    if (/^#project=/.test(location.hash)) location.hash = "";
    closeDetail();
  }

  // The address bar decides which project page is open, so Back closes it and links can be shared.
  function syncDetailWithHash() {
    if (mode === "tv" || view === "summary" || !state.result) return;
    var m = /^#project=(.+)$/.exec(location.hash);
    var p = m ? SD.findProject(state.result.data, decodeURIComponent(m[1])) : null;
    if (p) openDetail(p);
    else closeDetail();
  }

  window.addEventListener("hashchange", syncDetailWithHash);
  document.addEventListener("keydown", function (e) {
    if (state.detailId === null) return;
    if (e.key === "Escape" || e.key === "Esc") { closeDetailFromUser(); return; }
    if (e.key === "Tab") {
      // Keep keyboard focus inside the project page while it's open.
      var focusable = document.querySelectorAll("#detail-layer button, #detail-layer a[href], #detail-layer summary");
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement.classList.contains("detail"))) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });

  /* ---------- Summary widget for the portal home page ---------- */

  function renderSummary(result) {
    var data = result.data;
    var projects = visibleProjects(data);
    var rows = projects.map(function (p) {
      var m = SD.progress(p), cat = SD.category(p.category);
      var stage = { planning: 0.15, "in-progress": 0.5, "on-hold": 0.5, completed: 1 }[p.status];
      var ratio = m ? m.ratio : stage;
      return (
        '<li class="row cat-' + cat.key + '">' +
          '<span class="row-thumb">' + (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : icon(cat.key)) + "</span>" +
          '<div><a class="row-title" ' + projectLinkAttrs(p) + ">" + esc(p.title) + '</a><div class="row-status">' + esc(cat.label) + " · " + esc(SD.status(p.status).label) + "</div></div>" +
          '<div class="meter" aria-hidden="true"><span style="width:' + (ratio * 100).toFixed(1) + '%"></span></div>' +
          '<span class="row-pct">' + (m ? Math.min(m.pct, 100) + "%" : "") + "</span>" +
        "</li>"
      );
    }).join("");
    var next = SD.upcomingEvents(data).filter(inCategories)[0];

    app.innerHTML =
      noticesHtml(result, data) +
      '<main class="page">' +
        (showHeader
          ? '<div class="summary-head"><div class="summary-title" role="heading" aria-level="1">' + badgeHtml(data) + esc(data.dashboard.title) + "</div>" +
            '<a class="summary-link" href="' + esc(fullPageUrl) + '" target="_blank" rel="noopener">Open full dashboard' + icon("external") + "</a></div>"
          : "") +
        statsHtml(data) +
        (next ? '<div class="summary-next">' + icon("calendar") + "<div><strong>Next up: " + esc(next.title) + "</strong><span>" +
          esc([SD.formatDate(next.date, { weekday: "short", day: "numeric", month: "short" }), next.time, SD.daysAway(next.date)].filter(Boolean).join(" · ")) + "</span></div></div>" : "") +
        progressPanelHtml(projects, "summary-progress") +
        (rows ? '<ul class="rows">' + rows + "</ul>" : "") +
      "</main>";
    watchImages(app);
    postHeight();
  }

  /* ---------- TV ---------- */

  // Size everything from the screen so 1080p and 4K look identical.
  function fitTv() {
    var w = window.innerWidth, h = window.innerHeight;
    var portrait = h > w * 1.1;
    var size = portrait ? Math.min(w / 47.25, h / 84) : Math.min(w / 84, h / 47.25);
    root.style.fontSize = Math.max(10, size).toFixed(2) + "px";
    var tv = app.querySelector(".tv");
    if (tv) tv.className = "tv" + (portrait ? " is-portrait" : "");
    applyTvLayout();
    drawCharts();
  }

  function isPortrait() { return window.innerHeight > window.innerWidth * 1.1; }

  // Every page uses the same columns as the bottom strip, so the edges line up from page to page:
  // the cards per page, or fewer when there are only a couple of projects.
  function tvColumns(projects) {
    return tvPerPage === 1 || projects.length < 2 ? 3 : Math.min(tvPerPage, projects.length);
  }

  function applyTvLayout() {
    var grid = document.getElementById("tv-main"), l = state.tvLayout;
    if (!grid || !l) return;
    var portrait = isPortrait();
    var cols = portrait ? 1 : state.tvCols, rows = portrait ? l.cols : 1;
    grid.className = "tv-main " + l.cls + " cols-" + (portrait ? "p" : l.cols) + (grid.classList.contains("is-fading") ? " is-fading" : "");
    grid.style.setProperty("--cols", cols);
    grid.style.setProperty("--rows", rows);
    // Tiles share out the columns: 3 cards in 3 columns get one each, 2 panels get one and two.
    var n = grid.children.length, base = Math.floor(cols / Math.max(n, 1)), extra = cols - base * n;
    for (var i = 0; i < n; i++) {
      var span = portrait ? 1 : base + (i >= n - extra ? 1 : 0), tile = grid.children[i];
      tile.style.gridColumn = portrait ? "" : "span " + span;
      if (span > 1) tile.classList.add("tv-wide"); else tile.classList.remove("tv-wide");
    }
    evenCards(grid);
  }

  // Pages of projects, then photos, then charts, then the league and what's coming up.
  function buildTvPages(data, projects) {
    var pages = [], cols = tvColumns(projects);
    for (var i = 0; i < projects.length; i += tvPerPage) {
      var items = projects.slice(i, i + tvPerPage);
      // A short last page is topped up from the start, so every page has the same number of
      // same-sized cards (the featured projects, which come first, get a little more time).
      if (i > 0) items = items.concat(projects.slice(0, tvPerPage - items.length));
      pages.push({ type: "projects", items: items });
    }
    if (data.gallery.length) pages.push({ type: "photos", items: data.gallery.slice(0, cols) });
    if (data.trends.length) pages.push({ type: "trends", items: data.trends.slice(0, cols) });
    var highlights = [leaderboardHtml(data, "tv-panel"), eventsHtml(data, 4)].filter(Boolean);
    if (highlights.length) pages.push({ type: "highlights", items: highlights });
    return pages;
  }

  function tvProgressTile(projects) {
    var counts = statusCounts(projects);
    return (
      '<div class="stat cat-other">' +
        '<div class="stat-head"><span class="cat-icon">' + liveIcon("in-progress") + "</span></div>" +
        '<div class="stat-value">' + counts.completed + '<span class="stat-unit">of ' + projects.length + "</span></div>" +
        '<div class="stat-label">Projects completed</div>' +
        (projects.length ? '<div class="segbar" aria-hidden="true">' + segbarHtml(counts) + "</div>" : "") +
      "</div>"
    );
  }

  function tvInvolveHtml(data) {
    var g = data.getInvolved;
    if (!g.text && !g.link && !g.qrImage) return "";
    var link = SD.safeUrl(g.link);
    return (
      '<div class="tv-involve">' + liveIcon("hand") +
        '<div class="tv-involve-text"><strong>' + esc(g.heading) + "</strong><span>" + esc(g.text) +
          (link ? " <em>" + esc(link.replace(/^https?:\/\//, "")) + "</em>" : "") + "</span></div>" +
        involveQr(g) +
      "</div>"
    );
  }

  // The bottom strip takes turns showing what's coming up, the latest news and a tip.
  function buildTicker(data) {
    var items = [];
    SD.upcomingEvents(data).filter(inCategories).slice(0, 2).forEach(function (e) {
      var soon = SD.daysAway(e.date);
      items.push({ kind: "Coming up", when: SD.formatDate(e.date, { weekday: "short", day: "numeric", month: "short" }), text: e.title + (e.place ? " · " + e.place : "") + (soon ? " (" + soon.toLowerCase() + ")" : ""), image: e.image, isNew: !!fresh[eventKey(e)] });
    });
    data.updates.filter(inCategories).slice(0, 4).forEach(function (u) {
      items.push({ kind: "Latest news", when: shortDate(u.date), text: u.text, image: u.image, isNew: !!fresh[newsKey(u)] });
    });
    var tip = SD.tipOfTheDay(data);
    if (tip) items.push({ kind: "Eco tip", when: "Today", text: tip });
    return items;
  }

  function renderTv(result) {
    var data = result.data;
    var projects = visibleProjects(data);
    state.tvCols = tvColumns(projects);
    state.tvPages = buildTvPages(data, projects);
    if (state.tvPage >= state.tvPages.length) state.tvPage = 0;
    state.ticker = buildTicker(data);
    if (state.tickerIndex >= state.ticker.length) state.tickerIndex = 0;

    var tags = "";
    if (result.source === "draft") tags += '<span class="tv-tag">' + icon("check") + "Preview</span>";
    else if (data.isSampleData) tags += '<span class="tv-tag">' + icon("warning") + "Sample content</span>";
    if (result.warning) tags += '<span class="tv-tag" title="' + esc(result.warning) + '">' + icon("warning") + "Saved copy</span>";
    var filterNote = onlyCategories.length
      ? "<span>" + onlyCategories.map(function (k) { return esc(SD.category(k).label); }).join(" · ") + " projects</span>"
      : "";

    // The bottom strip uses the same columns as the project cards, so "Get involved" sits exactly
    // under the last card (under the last two when there are 4 per page).
    var stripCols = state.tvCols, newsSpan = stripCols === 4 ? 2 : stripCols - 1;
    var strip = (state.ticker.length ? '<div class="tv-news"><div class="tv-news-thumb" id="tv-news-thumb"></div><div class="tv-news-label"><strong id="tv-news-kind"></strong><span id="tv-news-date"></span></div><p class="tv-news-text" id="tv-news-text"></p></div>' : "") +
      tvInvolveHtml(data);

    app.innerHTML =
      '<main class="tv">' +
        '<header class="tv-head">' +
          '<div class="brand">' + badgeHtml(data) +
            "<div>" + (data.school.name ? '<p class="eyebrow">' + esc(data.school.name) + "</p>" : "") + "<h1>" + esc(data.dashboard.title) + "</h1></div>" +
          "</div>" +
          '<div class="tv-clock"><div class="tv-time" id="tv-time"></div><div class="tv-date" id="tv-date"></div></div>' +
        "</header>" +
        statsHtml(data, tvProgressTile(projects)) +
        (state.tvPages.length
          ? '<h2 class="visually-hidden">Projects</h2><section class="tv-main" id="tv-main" aria-label="Projects"></section>'
          : '<div class="tv-empty empty">No projects to show yet.</div>') +
        (strip ? '<div class="tv-strip" style="--strip-cols:' + stripCols + ";--news-span:" + newsSpan + ";--involve-start:" + (newsSpan + 1) + '">' + strip + "</div>" : "") +
        (fromWeb
          ? '<div class="tv-controls"><button type="button" class="pill pill-sm pill-sky" data-tv-fullscreen>' + icon("expand") + "<span>Full screen</span></button>" +
            '<a class="pill pill-sm" href="' + esc(pageUrl("")) + '">' + icon("close") + "Exit TV mode</a></div>"
          : "") +
        '<div class="tv-sleep" id="tv-sleep" hidden aria-hidden="true"><div class="tv-sleep-inner"><span class="tv-sleep-time"></span><span class="tv-sleep-note"></span></div></div>' +
        '<footer class="tv-foot">' +
          '<div class="tv-pager" id="tv-pager"></div>' +
          '<div class="tv-foot-right">' + tags + filterNote +
            (freshCount() ? '<span class="tv-new-legend">' + penCircle('<span class="new-count">' + freshCount() + "</span>") + " new or changed " + newWindowText() + "</span>" : "") + '<span class="tv-made-by">' + esc(data.dashboard.madeBy) + "</span><span>" + lastUpdatedText(data) + "</span></div>" +
        "</footer>" +
      "</main>";

    fitTv();
    tick();
    setupTvControls();
    showTvPage(false);
    showTicker(false);

    clearInterval(state.tvTimer);
    if (state.tvPages.length > 1) {
      state.tvTimer = setInterval(function () {
        state.tvPage = (state.tvPage + 1) % state.tvPages.length;
        showTvPage(true);
      }, tvSeconds * 1000);
    }
    clearInterval(state.tickerTimer);
    if (state.ticker.length > 1) {
      state.tickerTimer = setInterval(function () {
        state.tickerIndex = (state.tickerIndex + 1) % state.ticker.length;
        showTicker(true);
      }, newsSeconds * 1000);
    }
  }

  // Opened from the web page's "TV mode" button: Full screen and Exit buttons appear when the
  // mouse moves and fade away again, and Esc goes back to the web page. Real school TVs open
  // plain ?mode=tv, so they never show these.
  function setupTvControls() {
    if (!fromWeb) return;
    var fsButton = app.querySelector("[data-tv-fullscreen]");
    var docEl = document.documentElement;
    var canFull = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
    function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
    function label() { if (fsButton) fsButton.querySelector("span").textContent = isFull() ? "Exit full screen" : "Full screen"; }
    if (fsButton) {
      if (!canFull) fsButton.parentNode.removeChild(fsButton);
      else {
        label();
        fsButton.addEventListener("click", function () {
          if (isFull()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          else (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl);
        });
      }
    }
    if (state.tvControls) return;
    state.tvControls = true;
    var hideTimer = null;
    function wake() {
      root.classList.add("tv-awake");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { root.classList.remove("tv-awake"); }, 3000);
    }
    document.addEventListener("mousemove", wake);
    document.addEventListener("touchstart", wake, { passive: true });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Escape" || e.key === "Esc") && !isFull()) location.href = pageUrl("");
    });
    document.addEventListener("fullscreenchange", label);
    document.addEventListener("webkitfullscreenchange", label);
    wake();
  }

  function showTvPage(animate) {
    var grid = document.getElementById("tv-main");
    var pager = document.getElementById("tv-pager");
    var page = state.tvPages[state.tvPage];
    if (!grid || !page) return;
    function fill() {
      if (page.type === "projects") {
        state.tvLayout = { cols: page.items.length, cls: "is-projects" };
        grid.innerHTML = page.items.map(function (p) { return cardHtml(p); }).join("");
      } else if (page.type === "photos") {
        state.tvLayout = { cols: page.items.length, cls: "is-photos" };
        grid.innerHTML = page.items.map(function (g) {
          return '<figure class="tv-photo"><img src="' + esc(g.image) + '" alt="">' + (g.caption ? "<figcaption>" + esc(g.caption) + "</figcaption>" : "") + "</figure>";
        }).join("");
      } else if (page.type === "trends") {
        state.tvLayout = { cols: page.items.length, cls: "is-trends" };
        grid.innerHTML = page.items.map(function (t, i) { return trendCardHtml(t, i, "tv-panel"); }).join("");
      } else {
        state.tvLayout = { cols: page.items.length, cls: "is-highlights" };
        grid.innerHTML = page.items.join("");
      }
      applyTvLayout();
      grid.classList.remove("is-fading");
      watchImages(grid);
      drawCharts();
      state.tvBeat = Date.now();   // the TV watchdog checks this
    }
    if (animate) {
      grid.classList.add("is-fading");
      setTimeout(fill, 450);
    } else fill();
    if (pager) {
      var n = state.tvPages.length;
      pager.innerHTML = n > 1
        ? "<span>Page " + (state.tvPage + 1) + " of " + n + "</span>" +
          '<span class="tv-dots">' + state.tvPages.map(function (_, i) { return '<span class="' + (i === state.tvPage ? "is-active" : "") + '"></span>'; }).join("") + "</span>" +
          '<span class="tv-timer"><span style="animation-duration:' + tvSeconds + 's"></span></span>'
        : "";
    }
  }

  function showTicker(animate) {
    var text = document.getElementById("tv-news-text");
    var kind = document.getElementById("tv-news-kind"), when = document.getElementById("tv-news-date");
    var item = state.ticker[state.tickerIndex];
    if (!text || !item) return;
    var thumb = document.getElementById("tv-news-thumb");
    function fill() {
      if (thumb) {
        thumb.innerHTML = item.image ? '<img src="' + esc(item.image) + '" alt="">' : "";
        thumb.style.display = item.image ? "" : "none";
      }
      // New news and events are underlined, with "new!" beside the label
      kind.innerHTML = esc(item.kind) + (item.isNew ? newNote("new!", "item-new") : "");
      when.textContent = item.when;
      text.innerHTML = item.isNew ? '<span class="new-text">' + esc(item.text) + "</span>" : esc(item.text);
      text.classList.remove("is-fading");
    }
    if (animate) {
      text.classList.add("is-fading");
      setTimeout(fill, 450);
    } else fill();
  }

  // TV sleep: outside school hours (Screens tab, or tv.sleepFrom/sleepTo in config.js) the TV
  // shows a black screen with a small dim clock that moves now and then, so nothing burns in, and
  // wakes up by itself. Returns when it wakes ("07:00", "Monday 07:00"), or "" when it's awake.
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function minutesOf(hhmm) { var m = /^(\d\d):(\d\d)$/.exec(hhmm || ""); return m ? +m[1] * 60 + +m[2] : null; }
  function sleepUntil(now) {
    if (!tvSleep) return "";
    var from = minutesOf(tvSleep.from), to = minutesOf(tvSleep.to), t = now.getHours() * 60 + now.getMinutes(), day = now.getDay();
    var night = from !== null && to !== null && from !== to && (from < to ? t >= from && t < to : t >= from || t < to);
    var weekend = tvSleep.weekends && (day === 6 || day === 0 || (day === 5 && from !== null && t >= from));
    if (weekend) return "Monday" + (tvSleep.to ? " " + tvSleep.to : "");
    return night ? tvSleep.to : "";
  }
  function updateSleep(now, clock) {
    var box = document.getElementById("tv-sleep");
    if (!box) return;
    var until = sleepUntil(now);
    root.classList.toggle("tv-asleep", !!until);
    box.hidden = !until;
    if (!until) return;
    box.querySelector(".tv-sleep-time").textContent = clock;
    box.querySelector(".tv-sleep-note").textContent = "Sleeping to save energy. Back on at " + until + ".";
    var m = now.getHours() * 60 + now.getMinutes();
    var inner = box.querySelector(".tv-sleep-inner");
    inner.style.left = (25 + (m * 37) % 50) + "%";
    inner.style.top = (25 + (m * 53) % 50) + "%";
  }

  function tick() {
    var t = document.getElementById("tv-time"), d = document.getElementById("tv-date");
    if (!t) return;
    var now = new Date();
    try {
      t.textContent = now.toLocaleTimeString(CONFIG.locale, { hour: "2-digit", minute: "2-digit" });
      d.textContent = now.toLocaleDateString(CONFIG.locale, { weekday: "long", day: "numeric", month: "long" });
    } catch (e) {
      t.textContent = now.getHours() + ":" + pad2(now.getMinutes());
      d.textContent = now.toDateString();
    }
    updateSleep(now, t.textContent);
  }

  /* ---------- Errors and broken pictures ---------- */

  function renderError(err) {
    app.innerHTML =
      '<div class="error-screen">' + icon("warning") +
        "<h1>The dashboard couldn't load its content</h1>" +
        "<p>" + (mode === "tv" ? "This screen will try again every minute." : "Please try again in a moment.") + "</p>" +
        "<p>For the person who looks after it:</p><code>" + esc(err && err.message ? err.message : String(err)) + "</code>" +
      "</div>";
    postHeight();
  }

  // A picture that can't be found shows the category placeholder instead of a broken image.
  function watchImages(scope) {
    var imgs = scope.querySelectorAll(".card-media img, .lrow-thumb img, .row-thumb img, .detail-picture img, .slot img");
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].getAttribute("data-watched")) continue;
      imgs[i].setAttribute("data-watched", "1");
      imgs[i].addEventListener("error", function (e) {
        var img = e.target, box = img.parentNode;
        if (!box) return;
        if (box.classList.contains("slot")) { box.innerHTML = '<span class="slot-empty" aria-hidden="true">' + icon("image") + "</span>"; return; }
        var cat = ((box.closest && box.closest(".card, .lrow, .row, .detail-media")) || box).className.match(/cat-(\w+)/);
        var placeholder = document.createElement("div");
        placeholder.className = box.classList.contains("row-thumb") ? "" : "card-placeholder";
        placeholder.innerHTML = box.classList.contains("row-thumb") ? icon(cat ? cat[1] : "other") : "<span>No photo yet</span>";
        box.replaceChild(box.classList.contains("row-thumb") ? placeholder.firstChild : placeholder, img);
      });
      imgs[i].addEventListener("load", postHeight);
    }
  }

  /* ---------- Portal iframe height ---------- */

  // If the portal page listens for this message it can size the iframe to
  // fit (see IT-SETUP.md). If it doesn't, the iframe simply scrolls.
  function postHeight() {
    if (window.parent === window) return;
    try {
      // Measure the content, not the window, so the iframe can shrink as well as grow.
      var height = Math.ceil(app.getBoundingClientRect().height);
      window.parent.postMessage({ type: "sustainability-dashboard:height", height: height }, "*");
    } catch (e) { /* ignore */ }
  }

  /* ---------- Load, render, refresh ---------- */

  function render(result) {
    state.result = result;
    try {
      applyTheme();
      if (mode === "tv") renderTv(result);
      else if (view === "summary") renderSummary(result);
      else renderFull(result);
      syncDetailWithHash();
    } catch (err) {
      // Something in the content tripped the page up. Say so, and try again with the next check
      // (TVs reload themselves, see recoverTv) instead of leaving a half-drawn screen.
      state.lastJson = "";
      if (window.console) console.error(err);
      renderError(err);
      if (mode === "tv") setTimeout(recoverTv, 60000);
    }
  }

  // Unattended TVs fix themselves: a reload clears most browser hiccups. At most once every
  // 10 minutes, so a problem a reload can't fix doesn't make the screen flash.
  function recoverTv() {
    var last = 0;
    try { last = +window.sessionStorage.getItem("sd:recovered") || 0; } catch (e) { /* private mode */ }
    if (Date.now() - last < 600000) return;
    try { window.sessionStorage.setItem("sd:recovered", String(Date.now())); } catch (e) { /* ignore */ }
    safeReload();
  }

  // Reload only once the dashboard's web server answers. Reloading during a network cut would
  // leave the TV on the browser's own "no internet" page, where nothing could bring it back;
  // until then the TV keeps showing what it has and asks again every minute.
  function safeReload() {
    if (location.protocol === "file:") { location.reload(); return; }
    var x = new XMLHttpRequest(), done = false;
    function retry() { if (!done) { done = true; setTimeout(safeReload, 60000); } }
    x.open("GET", location.pathname + "?alive=" + Date.now(), true);
    x.timeout = 15000;
    x.onload = function () { if (done) return; done = true; if (x.status >= 200 && x.status < 400) location.reload(); else setTimeout(safeReload, 60000); };
    x.onerror = retry;
    x.ontimeout = retry;
    x.send();
  }

  function load(isRefresh) {
    return SD.load({ preview: preview }).then(
      function (result) {
        var json = JSON.stringify(result.data) + "|" + result.warning;
        if (isRefresh && json === state.lastJson) return;
        state.lastJson = json;
        applyDisplay(result.data);
        trackChanges(result.data, result.source);
        if (result.data.dashboard.title && state.detailId === null) document.title = result.data.dashboard.title + (result.data.school.name ? " · " + result.data.school.name : "");
        render(result);
      },
      function (err) {
        if (isRefresh && state.result) return; // keep showing what we have
        renderError(err);
        if (mode === "tv") setTimeout(function () { load(false); }, 60000);
      }
    );
  }

  load(false);

  var refreshMs = Math.max(1, SD.toNumber(CONFIG.refreshMinutes) || 10) * 60000;
  setInterval(function () { quickOff = false; load(true); }, refreshMs);

  // Fast updates. The editor's "Execute changes" also writes data/updated.js, a tiny file with
  // the time it was published. Every screen looks at it every CONFIG.quickCheckSeconds and loads
  // the content straight away when it changes, rather than waiting for the full check every
  // refreshMinutes. Without that file (e.g. IT copied the content file in by hand) the full check
  // still picks the change up.
  var lastStamp = null, quickOff = false;
  function quickCheck() {
    if (quickOff || preview || CONFIG.dataSource === "google-sheet") return;
    var s = document.createElement("script");
    function done() { if (s.parentNode) s.parentNode.removeChild(s); }
    window.DASHBOARD_UPDATED = undefined;
    s.src = CONFIG.dataFile.replace(/[^\/]*$/, "") + "updated.js?v=" + Date.now();
    s.onload = function () {
      done();
      var stamp = window.DASHBOARD_UPDATED;
      if (!stamp) return;
      if (lastStamp !== null && stamp !== lastStamp) load(true);
      lastStamp = stamp;
    };
    s.onerror = function () { done(); quickOff = true; };   // no updated.js: rely on the full check
    document.head.appendChild(s);
  }
  quickCheck();
  setInterval(quickCheck, Math.max(10, SD.toNumber(CONFIG.quickCheckSeconds) || 30) * 1000);

  window.addEventListener("storage", function (e) {
    // A draft preview refreshes as soon as the editor saves.
    if (preview && e.key === SD.DRAFT_KEY) load(true);
    // Published from the editor in this same browser: update at once.
    if (!preview && e.key === "sd:published") load(true);
  });

  var resizeTimer;
  if (mode === "tv") {
    window.addEventListener("resize", fitTv);
    setInterval(tick, 10000);
    // Watchdog: if the screen goes blank or stops turning its pages for a minute, reload.
    var strikes = 0;
    setInterval(function () {
      if (document.hidden || !state.result) return;    // hidden tabs slow their timers right down
      var grid = document.getElementById("tv-main");
      var drawn = grid ? grid.children.length > 0 : !!document.querySelector(".tv-empty");
      var stuck = state.tvPages.length > 1 && Date.now() - (state.tvBeat || 0) > Math.max(120000, tvSeconds * 4000);
      strikes = drawn && !stuck ? 0 : strikes + 1;
      if (strikes >= 2) recoverTv();
    }, 30000);
    var hours = SD.toNumber(CONFIG.tv.reloadPageEveryHours);
    if (hours && hours > 0) setTimeout(safeReload, hours * 3600000);
  } else {
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { evenCards(app.querySelector(".projects")); drawCharts(); postHeight(); }, 150);
    });
    if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
  }
})();
