/*
  Dashboard editor.

  This page never changes the live dashboard by itself. It keeps a draft
  in this browser (localStorage), lets you preview it, and downloads a new
  data/dashboard-data.js for IT to upload. That keeps the live site safe:
  nobody can break the TVs from the editor.
*/
(function () {
  "use strict";

  var SD = window.SD, CONFIG = SD.config, esc = SD.esc, icon = SD.icon;
  var root = document.documentElement;
  var el = document.getElementById("editor");

  var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function applyTheme() {
    var t = (CONFIG.theme || "light").toLowerCase();
    if (t === "auto") t = darkQuery && darkQuery.matches ? "dark" : "light";
    root.setAttribute("data-theme", t === "dark" ? "dark" : "light");
  }
  applyTheme();
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener("change", applyTheme);

  // Lengths that fit the TV cards in big, easy-to-read text (the counter turns red past them).
  var SUMMARY_LIMIT = 85, TITLE_LIMIT = 40, UPDATE_LIMIT = 140, DETAIL_LIMIT = 60, LABEL_LIMIT = 28;

  var state = {
    data: null,          // what's being edited (raw, not cleaned, so half-finished items survive)
    liveJson: "",        // the live content, to tell whether there are unsaved changes
    tab: "projects",
    open: {},            // which project panels are expanded
    savedAt: null,
    storageFull: false,  // the browser had no room left for the draft (photos are big)
    photoTarget: null,   // which picture the file picker is choosing (e.g. "projects.2.image")
    undo: [],            // copies of the content from before each delete, put back, discard or open
    others: {},          // other editor tabs open in this browser, and when each was last heard from
    otherSaved: false,   // one of them has saved changes since
    notices: []
  };

  var uid = 0;
  function newKey() { return "k" + Date.now().toString(36) + (++uid); }
  var DISPLAY_KEYS = ["tvCardsPerPage", "tvSecondsPerPage", "tvSecondsPerNews", "tvTheme", "theme", "defaultView", "highlightNewDays",
    "tvSleepFrom", "tvSleepTo", "tvSleepWeekends"];

  /* ---------- Data helpers ---------- */

  function editable(source) {
    var base = SD.normalise({});
    var d = JSON.parse(JSON.stringify(source || {}));
    ["school", "dashboard", "getInvolved"].forEach(function (k) { d[k] = Object.assign(base[k], d[k] || {}); });
    ["projects", "stats", "updates"].forEach(function (k) {
      d[k] = (Array.isArray(d[k]) ? d[k] : []).map(function (x) { x._key = newKey(); return x; });
    });
    ["events", "trends", "tips", "gallery"].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    d.leaderboard = Object.assign({ title: "", unit: "", note: "", entries: [] }, d.leaderboard || {});
    // Screen settings (Screens tab): "" means IT's standard setting in config.js
    d.display = Object.assign({}, d.display || {});
    DISPLAY_KEYS.forEach(function (k) { var v = d.display[k]; d.display[k] = v === null || v === undefined ? "" : String(v); });
    if (!Array.isArray(d.leaderboard.entries)) d.leaderboard.entries = [];
    d.projects.forEach(function (p) {
      ["milestones", "gallery"].forEach(function (k) { if (!Array.isArray(p[k])) p[k] = []; });
      ["story", "startDate", "endDate", "helpLink"].forEach(function (k) { if (p[k] === undefined || p[k] === null) p[k] = ""; });
    });
    d.stats.forEach(function (st) {
      // Parts worked out from a project or chart are worked out again, not edited
      if (st.previousAuto) st.previous = "";
      if (st.compareAuto) st.compareLabel = "";
      ["previousAuto", "compareAuto", "from", "fromLink"].forEach(function (k) { delete st[k]; });
      if (st.previous === null || st.previous === undefined) st.previous = "";
      if (st.factor === null || st.factor === undefined) st.factor = "";
      if (!st.source) st.source = "";
      if (!st.calc) st.calc = "now";
    });
    d.trends.forEach(function (t) {
      if (!Array.isArray(t.points)) t.points = [];
      if (t.target === null || t.target === undefined) t.target = "";
    });
    d.isSampleData = d.isSampleData === true;
    return d;
  }

  // Each project gets a short id from its first title, used in links like #project=tree-planting.
  // It never changes afterwards, so links on posters keep working even if the title is edited.
  function assignId(p) {
    if (p.id || !String(p.title || "").trim()) return;
    var id = slug(p.title), n = 2, taken = {};
    state.data.projects.forEach(function (q) { if (q !== p && q.id) taken[q.id] = true; });
    while (taken[id]) id = slug(p.title) + "-" + n++;
    p.id = id;
  }

  // New items for each kind of list.
  var TEMPLATES = {
    events: function () { return { date: SD.todayISO(), time: "", title: "", place: "", project: "", category: "" }; },
    milestones: function () { return { title: "", date: "", done: false }; },
    gallery: function () { return { image: "", imageAlt: "", caption: "" }; },
    points: function () { return { label: "", value: "" }; },
    entries: function () { return { name: "", score: "" }; },
    tips: function () { return ""; },
    trends: function () { return { title: "", unit: "", icon: "other", direction: "down", target: "", note: "", points: [{ label: "", value: "" }, { label: "", value: "" }] }; }
  };

  function slug(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "project";
  }

  function numOrBlank(v) {
    var n = SD.toNumber(v);
    return n === null ? "" : n;
  }

  // The tidy version that goes into the downloaded file.
  function exportData(d) {
    var clean = SD.normalise(d);
    var used = {};
    clean.projects.forEach(function (p) {
      var id = p.id && !/^project-\d+$/.test(p.id) ? p.id : slug(p.title);
      while (used[id]) id += "-2";
      used[id] = true;
      p.id = id;
      p.metricStart = numOrBlank(p.metricStart);
      p.metricCurrent = numOrBlank(p.metricCurrent);
      p.metricTarget = numOrBlank(p.metricTarget);
    });
    // Numbers worked out from a project or chart keep their latest answer as a fallback, but
    // not the parts that are worked out afresh each time (a chart's "before" value, the link).
    clean.stats.forEach(function (s) {
      if (s.previousAuto) s.previous = null;
      if (s.compareAuto) s.compareLabel = "";
      ["previousAuto", "compareAuto", "from", "fromLink"].forEach(function (k) { delete s[k]; });
    });
    // Only the screen settings that were actually chosen
    Object.keys(clean.display).forEach(function (k) { if (clean.display[k] === null || clean.display[k] === "") delete clean.display[k]; });
    if (!Object.keys(clean.display).length) delete clean.display;
    return clean;
  }

  function stripKeys(d) {
    return JSON.parse(JSON.stringify(d, function (k, v) { return k === "_key" ? undefined : v; }));
  }

  function isDirty() {
    return JSON.stringify(SD.normalise(stripKeys(state.data))) !== state.liveJson;
  }

  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, value) {
    var parts = path.split("."), o = obj;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }

  function saveDraft() {
    state.savedAt = Date.now();
    if (isDirty()) state.storageFull = !SD.storage.set(SD.DRAFT_KEY, { savedAt: state.savedAt, data: stripKeys(state.data) });
    else { SD.storage.remove(SD.DRAFT_KEY); state.storageFull = false; }
    renderStatus();
  }

  /* ---------- Form fields ---------- */

  function field(o) {
    var path = o.path, value = getPath(state.data, path);
    value = value === undefined || value === null ? "" : value;
    var id = "f-" + path.replace(/\./g, "-");
    var label = '<span class="ed-label' + (o.compact ? " is-hidden" : "") + '">' + esc(o.label) + (o.optional ? ' <span class="ed-optional">(optional)</span>' : "") + "</span>";
    var input;
    if (o.type === "checkbox") {
      return (
        '<label class="ed-check' + (o.wide ? " is-wide" : "") + '"><input type="checkbox" data-path="' + path + '"' + (value === true ? " checked" : "") + ">" +
        '<span class="' + (o.compact ? "ed-label is-hidden" : "") + '">' + esc(o.label) + (o.hint ? "<small>" + esc(o.hint) + "</small>" : "") + "</span></label>"
      );
    }
    if (o.type === "select") {
      input = '<select id="' + id + '" data-path="' + path + '">' + o.options.map(function (opt) {
        return '<option value="' + esc(opt.value) + '"' + (String(value) === opt.value ? " selected" : "") + ">" + esc(opt.label) + "</option>";
      }).join("") + "</select>";
    } else if (o.type === "textarea") {
      input = '<textarea id="' + id + '" data-path="' + path + '" rows="' + (o.rows || 3) + '"' + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "") + ">" + esc(value) + "</textarea>";
    } else {
      input = '<input id="' + id + '" type="' + (o.type || "text") + '" data-path="' + path + '" value="' + esc(value) + '"' +
        (o.number ? ' inputmode="decimal"' : "") + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "") + ">";
    }
    var hint = "";
    if (o.limit) hint = '<span class="ed-hint' + (String(value).length > o.limit ? " is-over" : "") + '" data-count-for="' + path + '" data-limit="' + o.limit + '">' + counterText(value, o.limit, o.hint) + "</span>";
    else if (o.hint) hint = '<span class="ed-hint">' + esc(o.hint) + "</span>";
    return '<label class="ed-field' + (o.wide ? " is-wide" : "") + '" for="' + id + '">' + label + input + hint + "</label>";
  }

  function counterText(value, limit, hint) {
    var n = String(value || "").length;
    var base = n + " / " + limit + " characters";
    if (n > limit) return base + ". Shorter is better: TVs may cut this off.";
    return hint ? base + ". " + esc(hint) : base;
  }

  var CATEGORY_OPTIONS = SD.CATEGORIES.map(function (c) { return { value: c.key, label: c.label }; });
  var STATUS_OPTIONS = SD.STATUSES.map(function (s) { return { value: s.key, label: s.label }; });

  /* ---------- Sections ---------- */

  function projectSummary(p) {
    var cat = SD.category(SD.categoryKey(p.category) || "other");
    return (
      '<span class="ed-item-icon">' + icon(cat.key) + "</span>" +
      '<span class="ed-item-text">' +
        '<span class="ed-item-title' + (p.title ? "" : " is-empty") + '">' + esc(p.title || "Untitled project (add a title or it won't show)") + "</span><br>" +
        '<span class="ed-item-meta">' + esc(cat.label) + " · " + esc(SD.status(p.status).label) + (p.featured ? " · Featured" : "") + "</span>" +
      "</span>" + icon("chevron", "ed-chevron")
    );
  }

  function metricPreview(p) {
    var m = SD.progress(p);
    if (!m) {
      var cur = String(p.metricCurrent || "").trim(), tgt = String(p.metricTarget || "").trim();
      if (!cur && !tgt) return '<p class="ed-hint">No numbers yet, so the dashboard will show which stage the project is at instead.</p>';
      return '<p class="ed-hint is-over">Fill in both "Now" and "Target" with numbers to show a progress bar.</p>';
    }
    return (
      '<div class="metric"><div class="metric-head"><span class="metric-label">Preview: ' + esc(m.label || "Progress") + '</span><span class="metric-pct">' + m.pct + "%</span></div>" +
      '<div class="meter"><span style="width:' + (m.ratio * 100).toFixed(1) + '%"></span></div></div>'
    );
  }

  /* ---------- Photos, logo and banner ---------- */

  // Pictures are shrunk in the browser and stored inside the data file, so
  // there is only ever one file to send to IT. Each kind of picture has its
  // own size: project photos, the wide banner, and the logo (kept as PNG so
  // a transparent background stays transparent).
  var PICTURES = {
    photo: { maxW: 1280, maxH: 960, format: "jpeg", empty: "No photo yet" },
    banner: { maxW: 2000, maxH: 1000, format: "jpeg", empty: "No banner photo: the school colour is used" },
    logo: { maxW: 600, maxH: 240, format: "png", empty: "No logo added, so the dashboard's own tree shield is shown" }
  };

  function pictureKind(path) {
    return path === "school.logo" || path === "school.logoWhite" ? "logo" : path === "dashboard.banner" ? "banner" : "photo";
  }

  function processPicture(file, kind, done) {
    var o = PICTURES[kind];
    if (!/^image\//.test(file.type)) return done(new Error("That file isn't a picture."));
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, o.maxW / img.naturalWidth, o.maxH / img.naturalHeight);
        var w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext("2d");
        if (o.format === "jpeg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        var url = o.format === "png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.8);
        if (o.format === "jpeg" && url.length > 450000) url = canvas.toDataURL("image/jpeg", 0.65);
        done(null, url);
      };
      img.onerror = function () { done(new Error("Couldn't read that picture. Try a JPG or PNG. (iPhone photos: share them as JPG first.)")); };
      img.src = reader.result;
    };
    reader.onerror = function () { done(new Error("Couldn't read that file.")); };
    reader.readAsDataURL(file);
  }

  function picturePreview(path) {
    var src = SD.safeImage(getPath(state.data, path));
    var kind = pictureKind(path);
    var iconName = kind === "photo" ? SD.categoryKey(getPath(state.data, path.replace(/image$/, "category"))) || "other" : "image";
    return src
      ? '<img src="' + esc(src) + '" alt="">'
      : path === "school.logoWhite" ? '<span class="ed-photo-empty">' + icon("image") + "No white logo, so the footer shows the crest instead</span>"
      : '<span class="ed-photo-empty">' + (kind === "logo" ? '<span class="ed-logo-mark">' + SD.logoMark() + "</span>" : icon(iconName)) + esc(PICTURES[kind].empty) + "</span>";
  }

  // A picture box with Choose / Remove buttons and an optional address field.
  function pictureField(o) {
    var value = getPath(state.data, o.path) || "";
    var address = /^data:/.test(value) ? "" : value;
    var kind = pictureKind(o.path);
    return (
      '<div class="ed-photo is-' + kind + '">' +
        '<div class="ed-photo-preview' + (o.cat ? " cat-" + o.cat : "") + '" data-picture-preview="' + o.path + '">' + picturePreview(o.path) + "</div>" +
        '<div class="ed-photo-side">' +
          '<div class="ed-photo-buttons">' +
            '<button type="button" class="btn btn-sm" data-action="pick-picture" data-target="' + o.path + '">' + icon("image") + (value ? "Change " : "Choose ") + esc(o.noun) + "</button>" +
            (value ? '<button type="button" class="btn btn-sm btn-quiet btn-danger" data-action="remove-picture" data-target="' + o.path + '">' + icon("trash") + "Remove</button>" : "") +
          "</div>" +
          (o.hint ? '<p class="ed-hint">' + o.hint + "</p>" : "") +
          '<p class="ed-hint">Or drag a photo onto the picture, or click the picture and paste one (Ctrl+V, or Cmd+V on a Mac).</p>' +
          (o.altPath ? field({ label: "Describe the " + o.noun, path: o.altPath, optional: true, placeholder: o.altPlaceholder, hint: "Read aloud by screen readers for students who can't see the picture." }) : "") +
          '<details class="ed-more"><summary>Use a picture IT has uploaded instead</summary>' +
            '<label class="ed-field"><span class="ed-label">Picture address</span>' +
            '<input type="text" data-picture-address="' + o.path + '" value="' + esc(address) + '" placeholder="images/' + (kind === "logo" ? "logo.png" : "photo.jpg") + ' or https://…">' +
            '<span class="ed-hint">For pictures in the dashboard\'s images folder, or a web address.</span></label>' +
          "</details>" +
        "</div>" +
      "</div>"
    );
  }

  // A small picture control for rows (news, events, numbers, league).
  function pictureMini(path, label) {
    var value = getPath(state.data, path) || "";
    return (
      '<div class="ed-mini">' +
        '<div class="ed-mini-thumb" data-picture-preview="' + path + '" title="Drag a photo here, or click and paste one">' + picturePreview(path) + "</div>" +
        '<div class="ed-mini-side"><span class="ed-label">' + esc(label || "Picture") + ' <span class="ed-optional">(optional)</span></span>' +
          '<div class="ed-mini-buttons"><button type="button" class="btn btn-sm" data-action="pick-picture" data-target="' + path + '">' + icon("image") + (value ? "Change" : "Choose") + "</button>" +
          (value ? '<button type="button" class="btn btn-sm btn-quiet btn-danger" data-action="remove-picture" data-target="' + path + '">' + icon("trash") + "Remove</button>" : "") +
        "</div></div>" +
      "</div>"
    );
  }

  function photoFieldset(p, i) {
    return (
      '<fieldset class="ed-fieldset"><legend>Photo (optional)</legend>' +
        pictureField({
          path: "projects." + i + ".image", altPath: "projects." + i + ".imageAlt", noun: "photo",
          cat: SD.categoryKey(p.category) || "other", altPlaceholder: "e.g. Solar panels on the Sports Hall roof",
          hint: "Wide (landscape) photos look best. They're shrunk automatically so the dashboard stays fast. " +
            "Only use photos where everyone shown has agreed, following the school's photo rules. Photos of the project itself (panels, gardens, bins) are ideal."
        }) +
      "</fieldset>"
    );
  }

  function refreshPicture(path) {
    var box = el.querySelector('[data-picture-preview="' + path + '"]');
    if (box) box.innerHTML = picturePreview(path);
    // A new crest shows at the top of the editor straight away
    var mark = path === "school.logo" && document.getElementById("ed-brand-mark");
    if (mark) mark.outerHTML = brandMarkHtml();
  }

  // A project's "last updated" date moves on whenever its picture changes.
  function touchProject(path) {
    var m = /^projects\.(\d+)(\.|$)/.exec(path);
    if (m && state.data.projects[+m[1]]) state.data.projects[+m[1]].updated = SD.todayISO();
  }

  function onPicture(e) {
    var file = e.target.files && e.target.files[0];
    var path = state.photoTarget;
    e.target.value = "";
    if (!file || !path) return;
    addPicture(path, file);
  }

  function addPicture(path, file) {
    processPicture(file, pictureKind(path), function (err, url) {
      if (err) return window.alert(err.message);
      setPath(state.data, path, url);
      touchProject(path);
      changed();
      toast("Picture added (" + Math.round(url.length * 0.75 / 1024) + " KB).");
    });
  }

  // Drag a photo onto a picture box, or click a picture box and paste a copied photo.
  function pictureTarget(node) {
    var box = node && node.closest ? node.closest(".ed-photo, .ed-mini") : null;
    var btn = box && box.querySelector('[data-action="pick-picture"]');
    return btn ? { box: box, path: btn.getAttribute("data-target") } : null;
  }
  function draggingFiles(e) { return e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], "Files") !== -1; }
  function clearDrop() { [].forEach.call(el.querySelectorAll(".is-drop"), function (b) { b.classList.remove("is-drop"); }); }
  document.addEventListener("dragover", function (e) {
    if (!draggingFiles(e)) return;
    e.preventDefault();                                     // a photo dropped anywhere else mustn't open in place of the editor
    var t = pictureTarget(e.target);
    clearDrop();
    if (t) t.box.classList.add("is-drop");
    e.dataTransfer.dropEffect = t ? "copy" : "none";
  });
  document.addEventListener("dragleave", function (e) { if (!e.relatedTarget) clearDrop(); });
  document.addEventListener("drop", function (e) {
    if (!draggingFiles(e)) return;
    e.preventDefault();
    clearDrop();
    var t = pictureTarget(e.target), file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    if (t) addPicture(t.path, file);
    else toast("Drop the photo onto a picture box.");
  });
  el.addEventListener("click", function (e) { var t = pictureTarget(e.target); if (t) state.pasteTarget = t.path; }, true);
  document.addEventListener("paste", function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [], file = null;
    for (var i = 0; i < items.length; i++) if (items[i].kind === "file" && /^image\//.test(items[i].type)) { file = items[i].getAsFile(); break; }
    if (!file) return;                                      // ordinary text: paste as usual
    var t = pictureTarget(document.activeElement);
    var path = t ? t.path : state.pasteTarget;
    e.preventDefault();
    if (path && el.querySelector('[data-action="pick-picture"][data-target="' + path + '"]')) addPicture(path, file);
    else toast("Click the picture box you want first, then paste.");
  });

  // Move up / down / delete buttons for a row in any list (the list is a path like "projects.2.milestones").
  function rowButtons(list, i, count, what) {
    return (
      '<span class="ed-row-buttons">' +
        '<button type="button" class="btn btn-sm btn-quiet btn-icon" data-action="move" data-list="' + list + '" data-index="' + i + '" data-dir="-1" aria-label="Move ' + what + ' up"' + (i === 0 ? " disabled" : "") + ">" + icon("up") + "</button>" +
        '<button type="button" class="btn btn-sm btn-quiet btn-icon" data-action="move" data-list="' + list + '" data-index="' + i + '" data-dir="1" aria-label="Move ' + what + ' down"' + (i === count - 1 ? " disabled" : "") + ">" + icon("down") + "</button>" +
        '<button type="button" class="btn btn-sm btn-quiet btn-danger btn-icon" data-action="delete" data-list="' + list + '" data-index="' + i + '" aria-label="Delete this ' + what + '">' + icon("trash") + "</button>" +
      "</span>"
    );
  }

  function addButton(list, label, extraClass) {
    return '<button type="button" class="btn ed-add' + (extraClass ? " " + extraClass : "") + '" data-action="add" data-list="' + list + '">' + icon("plus") + esc(label) + "</button>";
  }

  function projectOptions() {
    return [{ value: "", label: "None" }].concat(state.data.projects.filter(function (p) { return p.id; }).map(function (p) {
      return { value: p.id, label: p.title };
    }));
  }

  function milestonesFieldset(p, i) {
    var list = "projects." + i + ".milestones";
    var rows = p.milestones.map(function (m, j) {
      var base = list + "." + j + ".";
      return (
        '<div class="ed-row milestone-row">' +
          field({ label: "Done", path: base + "done", type: "checkbox", compact: true }) +
          field({ label: "Milestone", path: base + "title", compact: true, placeholder: "e.g. First 24 panels installed" }) +
          field({ label: "Date", path: base + "date", type: "date", compact: true }) +
          rowButtons(list, j, p.milestones.length, "milestone") +
        "</div>"
      );
    }).join("");
    return (
      '<fieldset class="ed-fieldset"><legend>Milestones (optional)</legend>' +
        "<p>The big steps of the project. Tick the ones that are done. They're shown as a timeline on the project's page, with the next one highlighted.</p>" +
        (rows ? '<div class="ed-row-head milestone-row"><span>Done</span><span>Milestone</span><span>Date (or planned date)</span><span></span></div>' + rows : "") +
        addButton(list, "Add a milestone", "is-small") +
      "</fieldset>"
    );
  }

  function galleryFieldset(p, i) {
    var list = "projects." + i + ".gallery";
    var items = p.gallery.map(function (g, j) {
      return (
        '<div class="ed-gallery-item">' +
          pictureField({ path: list + "." + j + ".image", altPath: list + "." + j + ".imageAlt", noun: "photo", cat: SD.categoryKey(p.category) || "other", altPlaceholder: "What's in this photo?" }) +
          rowButtons(list, j, p.gallery.length, "photo") +
        "</div>"
      );
    }).join("");
    return (
      '<fieldset class="ed-fieldset"><legend>More photos (optional)</legend>' +
        "<p>Extra photos shown on the project's page, e.g. before and after. Up to 6.</p>" +
        items +
        (p.gallery.length < 6 ? addButton(list, "Add another photo", "is-small") : "") +
      "</fieldset>"
    );
  }

  function projectItem(p, i, count) {
    var base = "projects." + i + ".";
    var cat = SD.categoryKey(p.category) || "other";
    return (
      '<details class="ed-item cat-' + cat + '" data-key="' + p._key + '"' + (state.open[p._key] ? " open" : "") + ">" +
        '<summary data-summary-for="' + i + '">' + projectSummary(p) + "</summary>" +
        '<div class="ed-item-body">' +
          '<div class="ed-grid">' +
            field({ label: "Project name", path: base + "title", wide: true, limit: TITLE_LIMIT, placeholder: "e.g. Solar panels on the Sports Hall" }) +
            field({ label: "Category", path: base + "category", type: "select", options: CATEGORY_OPTIONS }) +
            field({ label: "Status", path: base + "status", type: "select", options: STATUS_OPTIONS }) +
            (p.id ? '<p class="ed-link-note is-wide">' + icon("link") + "Project page link: <code>index.html#project=" + esc(p.id) + "</code> (add it after the dashboard's address, e.g. for a QR code on a poster)</p>" : "") +
            field({ label: "What is it?", path: base + "summary", type: "textarea", wide: true, limit: SUMMARY_LIMIT, hint: "One or two short sentences a Year 7 would understand. Shown on the card." }) +
            field({ label: "About this project", path: base + "story", type: "textarea", rows: 4, wide: true, optional: true, limit: 600,
              placeholder: "Why does this project matter? What are you doing, and what difference will it make?",
              hint: "One paragraph, shown on the project's own page." }) +
            field({ label: "Who's running it", path: base + "team", hint: "Use group names (e.g. Eco Committee), not students' full names.", wide: true }) +
            field({ label: "Started", path: base + "startDate", type: "date", optional: true }) +
            field({ label: "Aiming to finish", path: base + "endDate", type: "date", optional: true }) +
            field({ label: "Next step", path: base + "nextStep", optional: true, limit: DETAIL_LIMIT, placeholder: "e.g. Panels arrive after half-term" }) +
            field({ label: "How students can help", path: base + "getInvolved", optional: true, limit: DETAIL_LIMIT, placeholder: "e.g. Join the energy monitors" }) +
            field({ label: "Sign-up link", path: base + "helpLink", optional: true, placeholder: "https://…", hint: "e.g. a Google or Microsoft Form. Shows a Sign up button on the project's page." }) +
          "</div>" +
          photoFieldset(p, i) +
          galleryFieldset(p, i) +
          milestonesFieldset(p, i) +
          '<fieldset class="ed-fieldset"><legend>Progress numbers (optional)</legend>' +
            "<p>Only fill in \"Start\" if you're reducing something (e.g. electricity from 52,000 kWh down to 45,000 kWh).</p>" +
            '<div class="ed-grid cols-4">' +
              field({ label: "What you measure", path: base + "metricLabel", placeholder: "Trees planted", wide: true, limit: LABEL_LIMIT }) +
              field({ label: "Start", path: base + "metricStart", number: true, optional: true }) +
              field({ label: "Now", path: base + "metricCurrent", number: true }) +
              field({ label: "Target", path: base + "metricTarget", number: true }) +
              field({ label: "Unit", path: base + "metricUnit", placeholder: "trees, kg, kWh" }) +
            "</div>" +
            '<div class="ed-metric-preview cat-' + cat + '" data-preview-for="' + i + '">' + metricPreview(p) + "</div>" +
          "</fieldset>" +
          '<div class="ed-grid">' +
            field({ label: "Show first (featured)", path: base + "featured", type: "checkbox", hint: "Featured projects appear first on the dashboard and TVs." }) +
            field({ label: "Last updated", path: base + "updated", type: "date", hint: "Changes automatically when you edit this project." }) +
          "</div>" +
          '<div class="ed-actions">' +
            '<button type="button" class="btn btn-sm" data-action="move" data-list="projects" data-index="' + i + '" data-dir="-1"' + (i === 0 ? " disabled" : "") + ">" + icon("up") + "Move up</button>" +
            '<button type="button" class="btn btn-sm" data-action="move" data-list="projects" data-index="' + i + '" data-dir="1"' + (i === count - 1 ? " disabled" : "") + ">" + icon("down") + "Move down</button>" +
            '<button type="button" class="btn btn-sm" data-action="duplicate" data-index="' + i + '">' + icon("copy") + "Duplicate</button>" +
            (p.id ? qrButton(dashboardUrl() + "#project=" + encodeURIComponent(p.id), p.title) : "") +
            '<span class="spacer"></span>' +
            '<button type="button" class="btn btn-sm btn-quiet btn-danger" data-action="delete" data-list="projects" data-index="' + i + '">' + icon("trash") + "Delete</button>" +
          "</div>" +
        "</div>" +
      "</details>"
    );
  }

  function sectionProjects() {
    var d = state.data;
    return (
      sectionHead("Projects", "Each project gets its own card on the dashboard. Click a project to open it. Use Move up and Move down to change the order.") +
      (d.projects.length > 6
        ? '<label class="ed-filter">' + icon("search") + '<span class="visually-hidden">Find a project</span>' +
            '<input type="search" id="ed-project-filter" placeholder="Find a project" autocomplete="off" value="' + esc(state.projectFilter || "") + '"></label>' +
          '<p class="ed-hint ed-filter-none" id="ed-filter-none" hidden>No projects match. <button type="button" class="link-button" data-action="clear-filter">Show them all</button></p>'
        : "") +
      '<div class="ed-list">' + d.projects.map(function (p, i) { return projectItem(p, i, d.projects.length); }).join("") + "</div>" +
      '<button type="button" class="btn ed-add" data-action="add-project">' + icon("plus") + "Add a project</button>"
    );
  }

  // "Find a project": hides the projects whose words don't match what's typed.
  function filterProjects() {
    var box = document.getElementById("ed-project-filter");
    if (!box) return;
    var words = (state.projectFilter || "").toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
    var byKey = {};
    state.data.projects.forEach(function (p) { byKey[p._key] = p; });
    [].forEach.call(el.querySelectorAll("#ed-section .ed-item[data-key]"), function (item) {
      var p = byKey[item.getAttribute("data-key")];
      var text = p ? [p.title, p.summary, p.team, SD.category(SD.categoryKey(p.category) || "other").label, SD.status(p.status).label].join(" ").toLowerCase() : "";
      var hit = words.every(function (w) { return text.indexOf(w) !== -1; });
      item.hidden = !hit;
      if (hit) shown++;
    });
    document.getElementById("ed-filter-none").hidden = shown > 0;
  }

  // What a headline number can be worked out from: projects with a "Now" number, and charts.
  function statSources(current) {
    var opts = [{ value: "", label: "Nothing: I'll type the number in" }];
    state.data.projects.forEach(function (p) {
      if (p.id && SD.toNumber(p.metricCurrent) !== null) opts.push({ value: "project:" + p.id, label: "Project: " + p.title });
    });
    state.data.trends.forEach(function (t) { if (t.title) opts.push({ value: "chart:" + t.title, label: "Chart: " + t.title }); });
    if (current && !opts.some(function (o) { return o.value === current; })) opts.push({ value: current, label: "Not found: " + current });
    return opts;
  }

  // "3,400 kWh, from Switch Off Challenge" (or why it couldn't be worked out).
  function statCalcHtml(st, data) {
    var r = SD.workOut(data, { source: st.source, calc: st.calc, factor: SD.toNumber(st.factor) });
    if (!r) return '<p class="ed-calc is-missing">' + icon("warning") + "That project or chart has no number to use, so the number typed below is shown.</p>";
    return '<p class="ed-calc">' + icon("check") + "<span><strong>" + esc(SD.formatNumber(r.value) + (st.unit ? " " + st.unit : "")) + "</strong>, worked out from " + esc(r.from) +
      (r.previous !== null && (st.previous === "" || st.previous === null) ? " (compared with " + esc(SD.formatNumber(r.previous)) + " " + esc(r.compareLabel) + ")" : "") +
      ". It changes by itself whenever that " + (/^chart:/.test(st.source) ? "chart" : "project") + " is updated.</span></p>";
  }

  function sectionStats() {
    var d = state.data, data = SD.normalise(stripKeys(d));
    var directions = [{ value: "up", label: "Higher is better" }, { value: "down", label: "Lower is better" }];
    var cards = d.stats.map(function (st, i) {
      var base = "stats." + i + ".";
      var kind = (/^(project|chart):/.exec(st.source || "") || [])[1];
      var worked = kind && SD.workOut(data, { source: st.source, calc: st.calc, factor: SD.toNumber(st.factor) });
      return (
        '<div class="ed-card ed-stat">' +
          '<div class="ed-grid" style="margin-top:0">' +
            field({ label: "What it counts", path: base + "label", placeholder: "Trees planted", limit: LABEL_LIMIT }) +
            field({ label: "Colour", path: base + "icon", type: "select", options: CATEGORY_OPTIONS }) +
          "</div>" +
          // Work it out from a project or chart, so the number keeps itself up to date
          '<div class="ed-workout">' +
            '<div class="ed-grid" style="margin-top:0">' +
              field({ label: "Work this number out from", path: base + "source", type: "select", options: statSources(st.source), wide: true }) +
              (kind
                ? field({ label: "How", path: base + "calc", type: "select", options: SD.CALCS[kind] }) +
                  field({ label: "Multiply by", path: base + "factor", number: true, optional: true, placeholder: "1", hint: "e.g. 0.001 turns kg into tonnes." })
                : "") +
            "</div>" +
            (kind ? statCalcHtml(st, data) : "") +
          "</div>" +
          '<div class="ed-grid">' +
            (worked ? "" : field({ label: "Number", path: base + "value", number: true })) +
            field({ label: "Unit", path: base + "unit", optional: true, placeholder: "kWh" }) +
            (worked ? "" : field({ label: "Up to (date)", path: base + "asOf", type: "date", optional: true, hint: "The date the number was last counted." })) +
            field({ label: "Small note", path: base + "note", optional: true, placeholder: "since September" }) +
            field({ label: "Number last time", path: base + "previous", number: true, optional: true,
              hint: kind === "chart" ? "Leave empty to compare with the chart's value before the latest one." : "Shows the change, e.g. \u2191 1,500 (+79%)." }) +
            field({ label: "Compared with", path: base + "compareLabel", optional: true, placeholder: "last term" }) +
            field({ label: "Which way is good?", path: base + "direction", type: "select", options: directions, hint: "Makes the change green when it's good news." }) +
          "</div>" +
          '<div class="ed-row-picture">' + pictureMini(base + "image", "Picture on this tile") + "</div>" +
          '<div class="ed-actions"><span class="spacer"></span><button type="button" class="btn btn-sm btn-quiet btn-danger" data-action="delete" data-list="stats" data-index="' + i + '">' + icon("trash") + "Delete this number</button></div>" +
        "</div>"
      );
    }).join("");
    return (
      sectionHead("Headline numbers", "The big numbers at the top. The first 4 are shown. Link each one to a project or chart and it works itself out, with its date, whenever that project or chart is updated. Or type it in, say when it was counted, and compare it with last time so people can see the change.") +
      '<div class="ed-list">' + (cards || '<div class="ed-card"><p class="ed-hint">No headline numbers yet.</p></div>') + "</div>" +
      (d.stats.length < 4 ? '<button type="button" class="btn ed-add" data-action="add-stat">' + icon("plus") + "Add a number</button>" : "")
    );
  }

  function sectionUpdates() {
    var d = state.data;
    var opts = [{ value: "", label: "None" }].concat(CATEGORY_OPTIONS);
    var rows = d.updates.map(function (u, i) {
      var base = "updates." + i + ".";
      return (
        '<div class="ed-row update-row">' +
          field({ label: "Date", path: base + "date", type: "date" }) +
          field({ label: "Category", path: base + "category", type: "select", options: opts }) +
          field({ label: "Project", path: base + "project", type: "select", options: projectOptions() }) +
          field({ label: "News", path: base + "text", limit: UPDATE_LIMIT, placeholder: "e.g. 320 trees planted!" }) +
          '<button type="button" class="btn btn-sm btn-quiet btn-danger" data-action="delete" data-list="updates" data-index="' + i + '" aria-label="Delete this news item">' + icon("trash") + "</button>" +
          '<div class="ed-row-picture">' + pictureMini(base + "image", "Picture") + "</div>" +
        "</div>"
      );
    }).join("");
    return (
      sectionHead("Latest news", "Short updates, newest first. The dashboard shows the latest 5. Link news to a project and it also appears on that project's page.") +
      '<button type="button" class="btn ed-add" style="margin:0 0 0.75rem" data-action="add-update">' + icon("plus") + "Add news</button>" +
      '<div class="ed-card">' + (rows || '<p class="ed-hint">No news yet.</p>') + "</div>"
    );
  }

  function sectionEvents() {
    var d = state.data;
    var cats = [{ value: "", label: "None" }].concat(CATEGORY_OPTIONS);
    var rows = d.events.map(function (ev, i) {
      var base = "events." + i + ".";
      return (
        '<div class="ed-row event-row">' +
          field({ label: "Date", path: base + "date", type: "date" }) +
          field({ label: "Time", path: base + "time", optional: true, placeholder: "13:15" }) +
          field({ label: "What's happening", path: base + "title", placeholder: "e.g. Tree planting day" }) +
          field({ label: "Where", path: base + "place", optional: true, placeholder: "e.g. Playing fields" }) +
          field({ label: "Project", path: base + "project", type: "select", options: projectOptions() }) +
          field({ label: "Category", path: base + "category", type: "select", options: cats }) +
          '<button type="button" class="btn btn-sm btn-quiet btn-danger" data-action="delete" data-list="events" data-index="' + i + '" aria-label="Delete this event">' + icon("trash") + "</button>" +
          '<div class="ed-row-picture">' + pictureMini(base + "image", "Picture (the date is shown on top of it)") + "</div>" +
        "</div>"
      );
    }).join("");
    return (
      sectionHead("Coming up", "Events students can join. They're shown soonest first with a countdown (\"In 3 days\"), and disappear by themselves once the date has passed.") +
      addButton("events", "Add an event", "is-top") +
      '<div class="ed-card">' + (rows || '<p class="ed-hint">No events yet.</p>') + "</div>"
    );
  }

  function sectionTrends() {
    var d = state.data;
    var directions = [{ value: "down", label: "Lower is better (e.g. electricity, waste)" }, { value: "up", label: "Higher is better (e.g. recycling, trees)" }];
    var cards = d.trends.map(function (t, i) {
      var base = "trends." + i + ".";
      var list = base + "points";
      var points = t.points.map(function (pt, j) {
        return (
          '<div class="ed-row point-row">' +
            field({ label: "When", path: list + "." + j + ".label", compact: true, placeholder: "e.g. Sep or Week 1" }) +
            field({ label: "Number", path: list + "." + j + ".value", compact: true, number: true }) +
            rowButtons(list, j, t.points.length, "point") +
          "</div>"
        );
      }).join("");
      return (
        '<div class="ed-card ed-trend">' +
          '<div class="ed-grid" style="margin-top:0">' +
            field({ label: "Chart title", path: base + "title", wide: true, placeholder: "e.g. Electricity used each month" }) +
            field({ label: "Unit", path: base + "unit", placeholder: "kWh, kg, bottles" }) +
            field({ label: "Icon", path: base + "icon", type: "select", options: CATEGORY_OPTIONS }) +
            field({ label: "Which way is good?", path: base + "direction", type: "select", options: directions }) +
            field({ label: "Target", path: base + "target", number: true, optional: true, hint: "Shown as a dashed line." }) +
            field({ label: "Small note", path: base + "note", wide: true, optional: true, placeholder: "e.g. The Switch Off Challenge started in September." }) +
          "</div>" +
          '<div class="ed-sub-label" style="margin-top:1.25rem">The numbers, oldest first</div>' +
          '<div class="ed-row-head point-row"><span>When</span><span>Number</span><span></span></div>' +
          points +
          addButton(list, "Add a number", "is-small") +
          '<div class="ed-actions">' +
            '<button type="button" class="btn btn-sm" data-action="move" data-list="trends" data-index="' + i + '" data-dir="-1"' + (i === 0 ? " disabled" : "") + ">" + icon("up") + "Move up</button>" +
            '<button type="button" class="btn btn-sm" data-action="move" data-list="trends" data-index="' + i + '" data-dir="1"' + (i === d.trends.length - 1 ? " disabled" : "") + ">" + icon("down") + "Move down</button>" +
            '<span class="spacer"></span>' +
            '<button type="button" class="btn btn-sm btn-quiet btn-danger" data-action="delete" data-list="trends" data-index="' + i + '">' + icon("trash") + "Delete chart</button>" +
          "</div>" +
        "</div>"
      );
    }).join("");
    return (
      sectionHead("Numbers over time", "Charts that show whether things are getting better, e.g. electricity used each month. Add a new number each week or month. The dashboard works out whether it's improving.") +
      '<div class="ed-list">' + (cards || '<div class="ed-card"><p class="ed-hint">No charts yet.</p></div>') + "</div>" +
      addButton("trends", "Add a chart")
    );
  }

  function sectionLeaderboard() {
    var lb = state.data.leaderboard;
    var list = "leaderboard.entries";
    var rows = lb.entries.map(function (e, i) {
      return (
        '<div class="ed-row entry-row">' +
          field({ label: "Name", path: list + "." + i + ".name", compact: true, placeholder: "e.g. Kingfisher House" }) +
          field({ label: "Score", path: list + "." + i + ".score", compact: true, number: true }) +
          rowButtons(list, i, lb.entries.length, "entry") +
          '<div class="ed-row-picture">' + pictureMini(list + "." + i + ".image", "Badge or crest") + "</div>" +
        "</div>"
      );
    }).join("");
    return (
      sectionHead("Leaderboard", "A friendly competition between houses, tutor groups or year groups. It's sorted by score automatically. Leave it empty to hide it.") +
      '<div class="ed-card"><div class="ed-grid" style="margin-top:0">' +
        field({ label: "Title", path: "leaderboard.title", wide: true, placeholder: "e.g. Switch Off Challenge: house league" }) +
        field({ label: "Unit", path: "leaderboard.unit", placeholder: "points" }) +
        field({ label: "Small note", path: "leaderboard.note", optional: true, placeholder: "e.g. Updated every Friday." }) +
      "</div>" +
      '<div class="ed-sub-label" style="margin-top:1.25rem">Scores</div>' +
      (rows ? '<div class="ed-row-head entry-row"><span>Name</span><span>Score</span><span></span></div>' + rows : "") +
      addButton(list, "Add a team", "is-small") +
      "</div>"
    );
  }

  function sectionTips() {
    var tips = state.data.tips;
    var rows = tips.map(function (t, i) {
      return '<div class="ed-row tip-row">' + field({ label: "Tip", path: "tips." + i, compact: true, limit: 120, placeholder: "e.g. Switch off the lights when you leave a room." }) + rowButtons("tips", i, tips.length, "tip") + "</div>";
    }).join("");
    return (
      sectionHead("Eco tips", "Short, practical tips. One is shown each day as \"Tip of the day\", and they take turns on the TVs.") +
      '<div class="ed-card">' + (rows || '<p class="ed-hint">No tips yet.</p>') + addButton("tips", "Add a tip", "is-small") + "</div>"
    );
  }

  function sectionGallery() {
    var g = state.data.gallery;
    var items = g.map(function (ph, i) {
      return (
        '<div class="ed-card ed-gallery-card">' +
          pictureField({ path: "gallery." + i + ".image", noun: "photo" }) +
          '<div class="ed-grid">' + field({ label: "Caption", path: "gallery." + i + ".caption", wide: true, optional: true, placeholder: "e.g. Planting day on the playing fields" }) + "</div>" +
          '<div class="ed-actions"><span class="spacer"></span>' + rowButtons("gallery", i, g.length, "photo") + "</div>" +
        "</div>"
      );
    }).join("");
    return (
      sectionHead("Photos", "A swipeable row of big photos from around school, also shown on the TVs. Wide (landscape) photos look best. Only use photos where everyone shown has agreed.") +
      '<div class="ed-list">' + (items || '<div class="ed-card"><p class="ed-hint">No photos yet. The Photos section is hidden until you add one.</p></div>') + "</div>" +
      (g.length < 24 ? addButton("gallery", "Add a photo") : "")
    );
  }

  function sectionBasics() {
    return (
      sectionHead("Basics", "The title, opening line and \"About this data\" section.") +
      '<div class="ed-card"><div class="ed-grid" style="margin-top:0">' +
        field({ label: "School name", path: "school.name" }) +
        field({ label: "Dashboard title", path: "dashboard.title" }) +
        field({ label: "Tagline", path: "dashboard.tagline", type: "textarea", rows: 2, wide: true, limit: 120 }) +
        field({ label: "Run by", path: "dashboard.madeBy", wide: true, placeholder: "The Sustainability Group, with the IT Department" }) +
        field({ label: "About this data", path: "dashboard.about", type: "textarea", rows: 3, wide: true, optional: true,
          placeholder: "Where do the numbers come from, who collects them, and how often is this updated?",
          hint: "Shown at the bottom of the dashboard. It helps people trust the numbers." }) +
        field({ label: "Contact for questions", path: "dashboard.contact", optional: true, placeholder: "e.g. sustainability@yourschool.edu", hint: "An email address or where to find you. Use a group or staff email, not a student's." }) +
        field({ label: "Last updated", path: "dashboard.lastUpdated", type: "date", hint: "Set to today automatically when you download." }) +
        field({ label: "This is sample content", path: "isSampleData", type: "checkbox", wide: true, hint: "Shows a \"Sample content\" warning on every screen. Untick it once the real projects are in." }) +
      "</div></div>" +
      sectionHead("About this data: picture", "Shown beside the \"About this data\" text, e.g. the team that collects the numbers, or a meter reading.") +
      '<div class="ed-card">' + pictureField({ path: "dashboard.aboutImage", noun: "picture" }) + "</div>" +
      sectionHead("School colour and logo", "Used for the banner, buttons and the TV header. Text colours adjust automatically so everything stays readable.") +
      '<div class="ed-card">' +
        '<div class="ed-colour">' +
          '<label class="ed-field" for="f-school-color"><span class="ed-label">Main colour</span>' +
            '<input type="color" id="f-school-color" data-path="school.color" value="' + esc(state.data.school.color || "#153573") + '"></label>' +
          '<div class="ed-colour-side"><p class="ed-hint">' + (state.data.school.color ? "Using your school colour " + esc(state.data.school.color) + "." : "Using the default school navy.") + "</p>" +
            (state.data.school.color ? '<button type="button" class="btn btn-sm btn-quiet" data-action="reset-colour">' + icon("undo") + "Back to school navy</button>" : "") +
          "</div>" +
        "</div>" +
        '<div class="ed-sub-label">Logo</div>' +
        pictureField({ path: "school.logo", noun: "logo", hint: "The school crest, beside the dashboard's name at the top of every screen. It's the colour crest from the school website (images/school-crest-colour.png); a navy one-colour version is in images/school-crest.svg. Remove it to use the dashboard's own tree shield instead." }) +
        '<div class="ed-sub-label">White logo (for the navy footer)</div>' +
        pictureField({ path: "school.logoWhite", noun: "logo", hint: "The school's white crest and name from its website (images/school-logo-white.svg), shown in the navy footer. Leave empty to show the crest above instead." }) +
      "</div>" +
      sectionHead("Banner photo", "The big picture across the top of the dashboard. Not shown on TVs.") +
      '<div class="ed-card">' +
        pictureField({
          path: "dashboard.banner", altPath: "dashboard.bannerAlt", noun: "banner", altPlaceholder: "e.g. Students planting trees on the school field",
          hint: "Use a wide photo. The title sits on the left, so a photo whose interesting part is on the right works best. A dark shade is added automatically so the title is easy to read."
        }) +
      "</div>"
    );
  }

  function sectionInvolved() {
    return (
      sectionHead("Get involved", "The photo panel that tells students how to join in.") +
      '<div class="ed-card"><div class="ed-grid" style="margin-top:0">' +
        field({ label: "Heading", path: "getInvolved.heading" }) +
        field({ label: "Button text", path: "getInvolved.linkLabel", hint: "Only shown if there's a link." }) +
        field({ label: "Message", path: "getInvolved.text", type: "textarea", rows: 2, wide: true, limit: 100 }) +
        field({ label: "Link", path: "getInvolved.link", optional: true, placeholder: "https://…", hint: "e.g. a sign-up form. On TVs the address is shown as text." }) +
        field({ label: "QR code image", path: "getInvolved.qrImage", optional: true, placeholder: "Leave empty", hint: "Leave this empty: a QR code for the link above is made for you, so people can scan it from the TVs." }) +
      "</div></div>" +
      sectionHead("Photo behind it", "Turns the panel into a big photo tile with the text on top. Without a photo it uses the school colour.") +
      '<div class="ed-card">' + pictureField({ path: "getInvolved.image", noun: "photo", hint: "A photo of students taking part works well. A dark shade is added so the text stays readable." }) + "</div>"
    );
  }

  function sectionHead(title, text) {
    return '<div class="ed-section-head"><h2>' + esc(title) + "</h2><p>" + esc(text) + "</p></div>";
  }

  // How many days screens keep new things circled: the Screens tab, then config.js, then 7.
  function markDays() {
    var n = SD.toNumber(state.data && state.data.display && state.data.display.highlightNewDays);
    if (n === null) n = SD.toNumber(CONFIG.highlightNewDays);
    return n === null ? 7 : n;
  }

  // Screen settings, saved with the content so every screen picks them up, and the address for
  // each kind of screen.
  function sectionScreens() {
    var tv = CONFIG.tv;
    function std(v) { return "Standard (" + v + ")"; }
    var perPage = [{ value: "", label: std(tv.cardsPerPage) }, { value: "1", label: "1: one big project at a time" },
      { value: "2", label: "2 side by side" }, { value: "3", label: "3 side by side" }, { value: "4", label: "4 at once" }];
    var tvThemes = [{ value: "", label: std(tv.theme === "dark" ? "dark navy" : "white") }, { value: "light", label: "White" }, { value: "dark", label: "Dark navy" }];
    var themes = [{ value: "", label: std({ dark: "dark navy", auto: "follows each device" }[CONFIG.theme] || "white") }, { value: "light", label: "White" },
      { value: "dark", label: "Dark navy" }, { value: "auto", label: "Follow each device's light or dark setting" }];
    var views = [{ value: "", label: std(CONFIG.defaultView === "list" ? "list" : "cards") }, { value: "grid", label: "Cards" }, { value: "list", label: "List" }];
    var configDays = SD.toNumber(CONFIG.highlightNewDays);
    var weekends = [{ value: "", label: std(tv.sleepWeekends ? "yes" : "no") }, { value: "yes", label: "Yes, sleep all weekend" }, { value: "no", label: "No, same times every day" }];
    var stdFrom = SD.hhmm(tv.sleepFrom), stdTo = SD.hhmm(tv.sleepTo);
    return (
      publishingHtml() +
      sectionHead("TV screens", "How the corridor and canteen TVs show the dashboard. These are saved with your content, so every TV picks them up when the file is published. Leave a box on Standard (or empty) to use IT's setting.") +
      '<div class="ed-card"><div class="ed-grid" style="margin-top:0">' +
        field({ label: "Projects on each page", path: "display.tvCardsPerPage", type: "select", options: perPage, hint: "4 shows more at once; 1 is best for big or far-away TVs." }) +
        field({ label: "TV colours", path: "display.tvTheme", type: "select", options: tvThemes }) +
        field({ label: "Seconds on each page", path: "display.tvSecondsPerPage", number: true, optional: true, placeholder: String(tv.secondsPerPage), hint: "Between 5 and 120." }) +
        field({ label: "Seconds on each news item", path: "display.tvSecondsPerNews", number: true, optional: true, placeholder: String(tv.secondsPerUpdate), hint: "The news strip along the bottom. Between 4 and 60." }) +
      "</div>" +
      '<div class="ed-actions"><button type="button" class="btn btn-sm" data-action="preview-tv">' + icon("tv") + "Preview on a TV</button></div></div>" +
      sectionHead("TV sleep", "Outside school hours the TVs can show a black screen with a small dim clock, to save energy and stop the picture burning in. They wake up by themselves. Leave both times empty to keep the TVs on" + (stdFrom && stdTo ? " (IT's standard is " + stdFrom + " to " + stdTo + ")" : "") + ".") +
      '<div class="ed-card"><div class="ed-grid" style="margin-top:0">' +
        field({ label: "TVs sleep from", path: "display.tvSleepFrom", type: "time", optional: true, hint: "For example 18:00." }) +
        field({ label: "Wake at", path: "display.tvSleepTo", type: "time", optional: true, hint: "For example 07:00. Can be the next morning." }) +
        field({ label: "At weekends", path: "display.tvSleepWeekends", type: "select", options: weekends, hint: "Yes sleeps from Friday evening to Monday morning." }) +
      "</div>" + sleepNote() + "</div>" +
      sectionHead("Web page and portal", "How the dashboard looks on computers, phones and in the school portal.") +
      '<div class="ed-card"><div class="ed-grid" style="margin-top:0">' +
        field({ label: "Page colours", path: "display.theme", type: "select", options: themes }) +
        field({ label: "Projects shown as", path: "display.defaultView", type: "select", options: views, hint: "Visitors can still switch, and their choice is remembered." }) +
      "</div></div>" +
      sectionHead("New and changed things", "When a new version is published, every screen circles numbers that changed and underlines new or changed words, with a short note in pen. The list at the top of this page shows what will be marked.") +
      '<div class="ed-card"><div class="ed-grid" style="margin-top:0">' +
        field({ label: "Days to keep them marked", path: "display.highlightNewDays", number: true, optional: true, placeholder: String(configDays === null ? 7 : configDays), hint: "0 turns the circles and underlines off." }) +
      "</div></div>" +
      sectionHead("Addresses for each screen", "Give these to IT for the TVs and the portal, or turn one into a QR code. They work once IT has put the dashboard online.") +
      '<div class="ed-card">' + linksHtml() + "</div>"
    );
  }

  // A plain sentence saying when the TVs will sleep, or why the times don't work yet.
  function sleepNote() {
    var d = (state.data && state.data.display) || {};
    var from = SD.hhmm(d.tvSleepFrom) || SD.hhmm(CONFIG.tv.sleepFrom), to = SD.hhmm(d.tvSleepTo) || SD.hhmm(CONFIG.tv.sleepTo);
    var weekends = d.tvSleepWeekends ? d.tvSleepWeekends === "yes" : !!CONFIG.tv.sleepWeekends;
    var text;
    if (!from && !to) text = weekends ? "The TVs will sleep all Saturday and Sunday and stay on during the week." : "The TVs stay on all the time.";
    else if (!from || !to || from === to) text = "Add both a sleep time and a wake time (and make them different), or the TVs won't sleep.";
    else text = "The TVs will sleep from " + from + " to " + to + (from > to ? " the next morning" : "") + (weekends ? ", and from Friday " + from + " to Monday " + to : "") + ".";
    return '<p class="ed-hint ed-sleep-note" id="ed-sleep-note">' + esc(text) + "</p>";
  }

  // Where "Execute changes" saves (see publish()), with buttons to choose or forget the folder.
  function publishingHtml() {
    if (CONFIG.dataSource === "google-sheet") return "";
    var head = sectionHead("Putting changes on the screens", "\"Execute changes\" (in the bar along the bottom) saves your changes straight into the dashboard's data folder, and every TV and web page shows them within about " +
      (SD.toNumber(CONFIG.quickCheckSeconds) || 30) + " seconds. IT will tell you which folder to pick; the editor remembers it in this browser.");
    if (!canPublish) {
      return head + '<div class="ed-card"><p class="ed-hint">This browser can\'t save straight into a folder. Use Chrome or Edge on a school computer to publish, or click Download data file and send the file to IT.</p>' +
        '<div class="ed-actions">' + previousButton() + "</div></div>";
    }
    return head + '<div class="ed-card ed-publish">' + (state.folder
      ? "<p>" + icon("check") + "<span>Publishing into the <strong>" + esc(state.folder.name) + "</strong> folder. The last version is kept there as dashboard-data.previous.js.</span></p>" +
        '<div class="ed-actions"><button type="button" class="btn btn-sm" data-action="choose-folder">' + icon("upload") + "Choose another folder</button>" +
        '<button type="button" class="btn btn-sm btn-quiet" data-action="forget-folder">' + icon("close") + "Forget this folder</button>" + previousButton() + "</div>"
      : "<p>" + icon("help") + "<span>No folder chosen yet. You'll be asked for it the first time you click Execute changes.</span></p>" +
        '<div class="ed-actions"><button type="button" class="btn btn-sm" data-action="choose-folder">' + icon("upload") + "Choose the data folder</button>" + previousButton() + "</div>") + "</div>";
  }

  // Each Execute changes keeps the version it replaced as dashboard-data.previous.js. This loads
  // it into the editor, to look over and put back on the screens with Execute changes.
  function previousButton() {
    return '<button type="button" class="btn btn-sm btn-quiet" data-action="load-previous" title="Load the version from before the last Execute changes">' + icon("undo") + "Go back to the previous version</button>";
  }
  function loadPrevious() {
    var name = "dashboard-data.previous.js";
    var fromFolder = canPublish && state.folder ? folderReady().then(function (dir) { return readFile(dir, name); }) : Promise.resolve(null);
    fromFolder.then(function (text) {
      if (text || location.protocol === "file:") return text;
      return fetch(CONFIG.dataFile.replace(/[^\/]*$/, "") + name + "?v=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r.ok ? r.text() : null; }, function () { return null; });
    }).then(function (text) {
      if (!text) { toast("There's no earlier version yet. One is kept each time you click Execute changes."); return; }
      var raw;
      try { raw = parseFile(text); } catch (err) { window.alert("The earlier version couldn't be read. " + (err.message || "")); return; }
      if (isDirty() && !window.confirm("Replace what you're editing with the version from before the last Execute changes?")) return;
      keepForUndo("loading the previous version");
      state.data = editable(SD.normalise(raw));
      state.open = {};
      SD.applyBrand(state.data.school.color);
      render();
      saveDraft();
      toast("Loaded the version from before the last Execute changes. Look it over, then click Execute changes to put it back on the screens.", true);
    }, function (err) { toast(err && err.message ? err.message : "Couldn't open the data folder."); });
  }

  function linkRow(label, hint, url, withQr) {
    return '<div class="ed-link-row"><div class="ed-link-text"><strong>' + esc(label) + '</strong><span class="ed-hint">' + esc(hint) + "</span></div>" +
      '<div class="ed-link-box"><input type="text" readonly value="' + esc(url) + '" aria-label="' + esc(label) + ' address">' +
      '<button type="button" class="btn btn-sm" data-action="copy-link">' + icon("copy") + "Copy</button>" +
      (withQr ? qrButton(url, "dashboard") : "") + "</div></div>";
  }

  // The dashboard's own address, worked out from where this editor is.
  function dashboardUrl() { return location.href.replace(/[?#].*$/, "").replace(/[^\/]*$/, "") + "index.html"; }

  // QR codes for posters: a big, sharp picture of the code, ready to print or put in a document.
  function qrButton(url, name) {
    return '<button type="button" class="btn btn-sm" data-action="download-qr" data-url="' + esc(url) + '" data-name="' + esc(name) + '" title="Download a QR code for posters">' + icon("qr") + "QR code</button>";
  }
  function downloadQr(url, name) {
    var link = SD.qrLink(url), m = link && SD.qrMatrix(link);
    if (!m) {
      toast(link ? "That address is too long for a QR code." : "QR codes need the dashboard's web address. Open the editor from the school website, not from a file.");
      return;
    }
    var n = m.length + 8, scale = Math.max(8, Math.floor(1200 / n)), c = document.createElement("canvas");
    c.width = c.height = n * scale;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#062047";
    m.forEach(function (row, y) { row.forEach(function (on, x) { if (on) ctx.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale); }); });
    var a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "qr-" + (slug(name) || "dashboard") + ".png";
    document.body.appendChild(a);
    a.click();
    a.parentNode.removeChild(a);
    toast("Downloaded " + a.download + ". Scanning it opens " + link);
  }

  function linksHtml() {
    var base = dashboardUrl();
    var cats = state.linkCats || [];
    return (
      linkRow("Web page", "The full dashboard, for the portal menu, emails or a QR code on a poster.", base, true) +
      linkRow("TV", cats.length ? "Only the areas ticked below." : "Every project. Tick areas below for a TV that only shows some, e.g. the canteen TV.", base + "?mode=tv" + (cats.length ? "&category=" + cats.join(",") : "")) +
      '<div class="ed-link-cats">' + SD.CATEGORIES.map(function (c) {
        return '<label class="ed-check-inline"><input type="checkbox" data-link-cat="' + c.key + '"' + (cats.indexOf(c.key) !== -1 ? " checked" : "") + ">" + esc(c.label) + "</label>";
      }).join("") + "</div>" +
      linkRow("Portal summary", "A small box with the headline numbers and project progress, for the iSAMS portal home page.", base + "?mode=embed&view=summary") +
      linkRow("Portal page", "The whole dashboard inside a portal page.", base + "?mode=embed")
    );
  }

  function copyText(input) {
    input.select();
    function done() { toast("Address copied"); }
    function fallback() { try { document.execCommand("copy"); done(); } catch (e) { toast("Select the address and copy it"); } }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(done, fallback);
    else fallback();
  }

  // What every screen will circle or underline once this version is published, compared with the
  // live one: the same list of things the screens themselves keep an eye on (SD.watchedFacts).
  function changesList() {
    if (!state.liveJson) return [];
    var live = JSON.parse(state.liveJson), now = SD.normalise(stripKeys(state.data));
    var before = SD.watchedFacts(live), after = SD.watchedFacts(now), names = {}, out = [];
    live.projects.concat(now.projects).forEach(function (p) { names["project:" + p.id] = p.title; });
    function num(v) { var n = SD.toNumber(v); return n === null ? v : SD.formatNumber(n); }
    Object.keys(after).forEach(function (k) {
      var was = before[k], is = after[k];
      if (was === is) return;
      var parts = k.split("|"), thing = parts[0], detail = parts[1], name = names[thing];
      var kind = thing.split(":")[0], rest = thing.slice(kind.length + 1);
      var at = out.length;
      if (!detail && was === undefined) {
        out.push({ mark: kind === "stat" || kind === "league" ? "circle" : "underline", text:
          kind === "stat" ? "New headline number: " + rest
          : kind === "project" ? "New project: " + name
          : kind === "news" ? "New news: " + rest.replace(/^[^:]*:/, "")
          : kind === "event" ? "New event: " + rest.replace(/^[^:]*:/, "")
          : "New in the league: " + rest });
      } else if (was === undefined) {
        return;   // a detail of something new, already listed
      } else if (kind === "stat") {
        // A number worked out from a project or chart changes with it, so there's nothing to put back here
        var stNow = findBy(now.stats, "label", rest), stLive = findBy(live.stats, "label", rest);
        var worked = stNow && stNow.source && stLive && stNow.source === stLive.source && stNow.calc === stLive.calc && String(stNow.factor) === String(stLive.factor);
        out.push({ mark: "circle", text: rest + ": " + num(was) + " \u2192 " + num(is) + (worked ? " (worked out from " + (stNow.from || "its project") + ")" : ""), fixed: worked });
      } else if (kind === "league") {
        out.push({ mark: "circle", text: "League, " + rest + ": " + num(was.split("@")[0]) + " \u2192 " + num(is.split("@")[0]) });
      } else if (detail === "progress") {
        out.push({ mark: "circle", text: name + ": progress " + (was.split("@")[1] || "0") + "% \u2192 " + (is.split("@")[1] || "0") + "%" });
      } else if (detail === "status") {
        out.push({ mark: "circle", text: name + ": " + SD.status(was).label + " \u2192 " + SD.status(is).label });
      } else {
        out.push({ mark: "underline", text: name + ": " + { summary: "summary", next: "next step", help: "how you can help" }[detail] + " changed" });
      }
      if (out[at]) out[at].key = k;
    });
    Object.keys(before).forEach(function (k) {
      if (k.indexOf("|") !== -1 || k in after) return;
      var kind = k.split(":")[0], rest = k.slice(kind.length + 1);
      out.push({ mark: "gone", key: k, text: "Removed: " + (kind === "project" ? names[k] : kind === "news" || kind === "event" ? rest.replace(/^[^:]*:/, "") : rest) });
    });
    return out;
  }

  function findBy(list, field, value) {
    for (var i = 0; i < list.length; i++) if (String(list[i][field] || "").trim() === value) return list[i];
    return null;
  }

  // "Put back" on one line of the changes list: just that thing goes back to what's on the screens.
  var PROJECT_FIELDS = { summary: ["summary"], next: ["nextStep"], help: ["getInvolved"], status: ["status"] };
  function putBack(index) {
    var c = changesList()[index];
    if (!c || !c.key || c.fixed) return;
    var d = state.data, live = editable(JSON.parse(state.liveJson));
    var parts = c.key.split("|"), thing = parts[0], detail = parts[1];
    var kind = thing.split(":")[0], rest = thing.slice(kind.length + 1);
    var where = {
      stat: { list: d.stats, from: live.stats, test: function (s) { return String(s.label || "").trim() === rest; } },
      project: { list: d.projects, from: live.projects, test: function (p) { return p.id === rest; } },
      news: { list: d.updates, from: live.updates, test: function (u) { return SD.newsKey({ date: String(u.date || "").trim(), text: String(u.text || "").trim() }) === thing; } },
      event: { list: d.events, from: live.events, test: function (e) { return SD.eventKey({ date: String(e.date || "").trim(), title: String(e.title || "").trim() }) === thing; } },
      league: { list: d.leaderboard.entries, from: live.leaderboard.entries, test: function (e) { return String(e.name || "").trim() === rest; } }
    }[kind];
    if (!where) return;
    function indexIn(list) { for (var i = 0; i < list.length; i++) if (where.test(list[i])) return i; return -1; }
    var at = indexIn(where.list), from = indexIn(where.from);
    keepForUndo("putting back \"" + short(c.text) + "\"");
    if (kind === "project" && detail && at !== -1 && from !== -1) {
      // Only that part of the project, e.g. its summary or its progress numbers
      var p = where.list[at], old = where.from[from];
      var fields = PROJECT_FIELDS[detail] || Object.keys(old).filter(function (f) { return /^metric/.test(f); });
      fields.forEach(function (f) { p[f] = old[f]; });
      var same = function (x) { var y = stripKeys(x); delete y.updated; return JSON.stringify(y); };
      if (same(p) === same(old)) p.updated = old.updated;   // nothing else changed, so not "updated" either
    } else if (from === -1) {
      if (at !== -1) where.list.splice(at, 1);                // new: take it out again
    } else {
      var item = where.from[from];                            // changed or removed: the version on the screens
      if (at !== -1) { if (where.list[at]._key) item._key = where.list[at]._key; where.list[at] = item; }
      else where.list.splice(Math.min(from, where.list.length), 0, item);
    }
    changed();
    toast("Back as it is on the screens: " + short(c.text.replace(/^Removed: /, "")) + ".", true);
  }

  function renderChanges(dirty) {
    var box = document.getElementById("ed-changes");
    if (!box) return;
    var list = dirty ? changesList() : [], days = markDays();
    if (!list.length) { box.innerHTML = ""; return; }
    var wasOpen = !box.querySelector("details") || box.querySelector("details").open;
    box.innerHTML =
      '<details class="ed-changes"' + (wasOpen ? " open" : "") + "><summary>" + icon("bell") +
        (days ? "What the screens will mark as new" : "What's changed") + '<span class="ed-tab-count">' + list.length + "</span></summary>" +
        '<p class="ed-hint">' + (days ? "Once this file is published, every screen circles the changed numbers and underlines the new or changed words below for " + days + " days." : "Circles and underlines are switched off in the Screens tab.") + "</p>" +
        '<ul class="ed-changes-list">' + list.map(function (c, i) {
          return '<li class="is-' + c.mark + '"><span class="ed-mark" aria-hidden="true"></span><span class="ed-change-text">' + esc(c.text) + "</span>" +
            (c.key && !c.fixed ? '<button type="button" class="btn btn-sm btn-quiet ed-put-back" data-action="put-back" data-change="' + i + '" title="Undo just this change">Put back</button>' : "") + "</li>";
        }).join("") + "</ul>" +
      "</details>";
  }

  var TABS = [
    { key: "projects", label: "Projects", count: function () { return state.data.projects.length; }, render: sectionProjects },
    { key: "stats", label: "Headline numbers", count: function () { return state.data.stats.length; }, render: sectionStats },
    { key: "trends", label: "Over time", count: function () { return state.data.trends.length; }, render: sectionTrends },
    { key: "updates", label: "Latest news", count: function () { return state.data.updates.length; }, render: sectionUpdates },
    { key: "events", label: "Coming up", count: function () { return state.data.events.length; }, render: sectionEvents },
    { key: "leaderboard", label: "Leaderboard", count: function () { return state.data.leaderboard.entries.length; }, render: sectionLeaderboard },
    { key: "tips", label: "Eco tips", count: function () { return state.data.tips.length; }, render: sectionTips },
    { key: "gallery", label: "Photos", count: function () { return state.data.gallery.length; }, render: sectionGallery },
    { key: "involved", label: "Get involved", render: sectionInvolved },
    { key: "basics", label: "Basics", render: sectionBasics },
    { key: "screens", label: "Screens", render: sectionScreens }
  ];

  /* ---------- Page ---------- */

  function helpHtml() {
    var sheet = CONFIG.dataSource === "google-sheet";
    var firstVisit = !SD.storage.get("sd:editorSeen");
    SD.storage.set("sd:editorSeen", true);
    return (
      '<details class="ed-help"' + (firstVisit ? " open" : "") + ">" +
        "<summary>" + icon("help") + "How updating the dashboard works</summary>" +
        '<div class="ed-help-body"><ol class="ed-steps">' +
          "<li><strong>Edit</strong>Change projects, numbers and news below. Your work is saved in this browser as you type.</li>" +
          "<li><strong>Preview</strong>Click Preview to see exactly how it will look, or TV preview to see it as the TVs will. The box below the steps lists what the screens will mark as new.</li>" +
          (canPublish
            ? "<li><strong>Execute</strong>Click Execute changes in the bar along the bottom. The first time, pick the dashboard's data folder (IT will tell you which). Every TV and web page shows your changes within about " + esc(SD.toNumber(CONFIG.quickCheckSeconds) || 30) + " seconds" +
                (markDays() ? ", with whatever you changed circled or underlined for " + markDays() + " days so people notice it" : "") + ".</li>" +
              "<li><strong>Changed your mind?</strong>Discard changes (next to it) goes back to what's on the screens. No folder? Click Download data file and send it to IT instead.</li>"
            : "<li><strong>Download</strong>Click Download data file. You'll get a file called dashboard-data.js.</li>" +
              "<li><strong>Publish</strong>Send that file to IT (or put it in the dashboard's data folder if IT has given you access). Screens update within " + esc(CONFIG.refreshMinutes) + " minutes" +
                (markDays() ? ", and whatever you changed is circled or underlined there for " + markDays() + " days so people notice it" : "") + ". Chrome or Edge on a school computer can publish straight to the screens instead.</li>") +
        "</ol>" +
        '<p class="ed-help-note">Nothing you do on this page changes the live dashboard until the downloaded file is uploaded, so you can\'t break anything here.' +
        (sheet ? "" : " Working on a different computer? Use \"Open a file\" to load a dashboard-data.js you downloaded earlier.") + "</p>" +
        "</div>" +
      "</details>"
    );
  }

  function noticesHtml() {
    var out = "";
    if (CONFIG.dataSource === "google-sheet") {
      var link = SD.safeUrl(CONFIG.googleSheet && CONFIG.googleSheet.editUrl);
      out += '<div class="banner is-preview">' + icon("check") + "<div><strong>This dashboard reads from a Google Sheet.</strong> Edit the sheet instead and screens update automatically" +
        (link ? ': <a href="' + esc(link) + '" target="_blank" rel="noopener">open the sheet</a>.' : ".") + " You can still use this page to try ideas and preview them.</div></div>";
    }
    state.notices.forEach(function (n) {
      out += '<div class="banner' + (n.kind === "info" ? " is-preview" : "") + '">' + icon(n.kind === "info" ? "check" : "warning") + "<div>" + n.html + "</div></div>";
    });
    return out;
  }

  function render() {
    var active = TABS.filter(function (t) { return t.key === state.tab; })[0] || TABS[0];
    el.innerHTML =
      '<header class="ed-bar"><div class="ed-bar-inner">' +
        '<div class="ed-brand">' + brandMarkHtml() + "<div><h1>Dashboard editor</h1>" +
          '<div class="ed-status" id="ed-status"></div></div></div>' +
        '<div class="ed-bar-actions">' +
          '<button type="button" class="btn btn-sm btn-quiet" data-action="import">' + icon("upload") + "Open a file</button>" +
          '<button type="button" class="btn btn-sm" data-action="preview">' + icon("eye") + "Preview</button>" +
          '<button type="button" class="btn btn-sm" data-action="preview-tv">' + icon("tv") + "TV preview</button>" +
          '<button type="button" class="btn btn-sm" data-action="download">' + icon("download") + "Download data file</button>" +
        "</div>" +
      "</div></header>" +
      // Shown whenever there are changes that aren't on the screens yet
      '<div class="ed-savebar" id="ed-savebar" hidden><div class="ed-savebar-inner">' +
        '<p class="ed-savebar-text" id="ed-savebar-text"></p>' +
        '<div class="ed-savebar-actions">' +
          '<button type="button" class="btn btn-quiet btn-danger" data-action="discard" title="Throw away your changes and go back to what\'s on the screens">' + icon("undo") + "Discard changes</button>" +
          '<button type="button" class="btn btn-primary" data-action="execute" title="' +
            (canPublish ? "Put your changes on every TV and web page now" : "Download the file to send to IT, who put it on the screens") + '">' + icon("check") + "Execute changes</button>" +
        "</div>" +
      "</div></div>" +
      '<main class="ed-main">' +
        noticesHtml() +
        '<div id="ed-other-tab"></div>' +
        helpHtml() +
        '<div id="ed-changes"></div>' +
        '<div id="ed-checks"></div>' +
        '<div class="ed-tabs" role="tablist">' + TABS.map(function (t) {
          return '<button type="button" class="ed-tab" role="tab" data-tab="' + t.key + '" aria-selected="' + (t.key === active.key) + '">' + esc(t.label) +
            (t.count ? '<span class="ed-tab-count">' + t.count() + "</span>" : "") + "</button>";
        }).join("") + "</div>" +
        '<section id="ed-section" role="tabpanel">' + active.render() + "</section>" +
      "</main>" +
      '<input type="file" id="ed-file" accept=".js,.json,application/json,text/javascript" hidden>' +
      '<input type="file" id="ed-photo-file" accept="image/*" hidden>' +
      '<div class="ed-toast" id="ed-toast" role="status" hidden></div>';
    renderStatus();
    renderOtherTab();
    filterProjects();
  }

  /*
    The editor open in two tabs of the same browser: both keep their work in the same saved
    draft, so whichever saves last wins. Each tab says hello when it opens, checks in every 30
    seconds and says goodbye when it closes, through browser storage, and both show a warning
    while the other is open. A tab that stops checking in (crashed, or closed without a goodbye)
    is forgotten after a few minutes.
  */
  var TAB_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function renderOtherTab() {
    var box = document.getElementById("ed-other-tab");
    if (!box) return;
    var n = Object.keys(state.others).length;
    box.innerHTML = !n ? "" :
      '<div class="banner" role="alert">' + icon("warning") + "<div><strong>The editor is open in another tab too.</strong> " +
        "Both tabs save to the same place, so one can overwrite the other's changes. Finish in one tab and close the other." +
        (state.otherSaved ? ' <button type="button" class="link-button" data-action="load-other">Load the other tab\u2019s latest changes</button>' : "") +
      "</div></div>";
  }
  function tabMessage(key, value) { SD.storage.set(key, Object.assign({ id: TAB_ID, at: Date.now() }, value || {})); }
  window.addEventListener("storage", function (e) {
    var v = null;
    try { v = e.newValue ? JSON.parse(e.newValue) : null; } catch (err) { return; }
    if (e.key === "sd:editor-hello" && v && v.id !== TAB_ID) {
      state.others[v.id] = Date.now();
      tabMessage("sd:editor-here", { to: v.id });
    } else if ((e.key === "sd:editor-here" && v && v.to === TAB_ID) || (e.key === "sd:editor-ping" && v && v.id !== TAB_ID)) {
      state.others[v.id] = Date.now();
    } else if (e.key === "sd:editor-bye" && v) {
      delete state.others[v.id];
      if (!Object.keys(state.others).length) state.otherSaved = false;
    } else if (e.key === SD.DRAFT_KEY && Object.keys(state.others).length) {
      state.otherSaved = !!v;
    } else return;
    renderOtherTab();
  });
  tabMessage("sd:editor-hello");
  window.addEventListener("pagehide", function () { tabMessage("sd:editor-bye"); });
  setInterval(function () {
    tabMessage("sd:editor-ping");
    var gone = Object.keys(state.others).filter(function (id) { return Date.now() - state.others[id] > 150000; });
    gone.forEach(function (id) { delete state.others[id]; });
    if (gone.length) { if (!Object.keys(state.others).length) state.otherSaved = false; renderOtherTab(); }
  }, 30000);

  // The school crest (Basics → Logo) at the top of the editor, or the tree shield if there isn't one.
  function brandMarkHtml() {
    var logo = SD.safeImage(state.data && state.data.school.logo);
    return logo
      ? '<span class="brand-mark has-logo" id="ed-brand-mark"><img src="' + esc(logo) + '" alt=""></span>'
      : '<span class="brand-mark" id="ed-brand-mark">' + SD.logoMark() + "</span>";
  }

  function renderSection() {
    var active = TABS.filter(function (t) { return t.key === state.tab; })[0];
    document.getElementById("ed-section").innerHTML = active.render();
    filterProjects();
    var tabs = el.querySelectorAll(".ed-tab[data-tab]");
    for (var i = 0; i < tabs.length; i++) {
      var t = TABS.filter(function (x) { return x.key === tabs[i].getAttribute("data-tab"); })[0];
      tabs[i].setAttribute("aria-selected", t.key === state.tab);
      var c = tabs[i].querySelector(".ed-tab-count");
      if (c && t.count) c.textContent = t.count();
    }
  }

  function renderStatus() {
    var s = document.getElementById("ed-status"), bar = document.getElementById("ed-savebar");
    if (!s) return;
    var dirty = isDirty();
    s.className = "ed-status" + (dirty ? " is-dirty" : "");
    s.textContent = !dirty
      ? (state.publishedAt ? "Published to screens at " + new Date(state.publishedAt).toLocaleTimeString(CONFIG.locale, { hour: "2-digit", minute: "2-digit" }) + " · matches the live dashboard" : "No changes · matches the live dashboard")
      : state.storageFull
        ? "Not saved in this browser: no room left (photos take space). Download the data file to keep your work."
        : "Unsaved to the live site · draft kept in this browser" + (state.savedAt ? " at " + new Date(state.savedAt).toLocaleTimeString(CONFIG.locale, { hour: "2-digit", minute: "2-digit" }) : "");
    if (bar) {
      var n = dirty ? changesList().length : 0;
      bar.hidden = !dirty;
      document.getElementById("ed-savebar-text").innerHTML = "<strong>" + (n ? n + " change" + (n === 1 ? "" : "s") : "Changes") + "</strong> not on the screens yet." +
        (canPublish ? "" : ' <span class="ed-hint">Execute changes downloads the file for IT to put on the screens.</span>');
      document.body.classList.toggle("has-savebar", dirty);
    }
    renderChanges(dirty);
    renderChecks(dirty);
  }

  /*
    Checks before publishing: things that would look broken on the screens ("fix") and things
    worth a look ("check"). Each one has a button that goes to the right tab (and opens the project).
    Execute changes asks before publishing anything marked "fix".
  */
  function checksList() {
    var d = state.data, now = SD.normalise(stripKeys(d)), out = [], today = SD.parseDate(SD.todayISO());
    function add(level, text, tab, key) { out.push({ level: level, text: text, tab: tab, key: key || "" }); }
    function badLink(u) {
      u = String(u || "").trim();
      if (!u) return "";
      if (!SD.safeUrl(u)) return "isn't a web or email link";
      if (/^(www\.|[a-z0-9-]+\.(com|org|net|edu|gov|my|uk|io)(\/|$))/i.test(u)) return "needs https:// at the start";
      if (/^[^\s@\/]+@[^\s@]+\.[a-z]{2,}$/i.test(u)) return "needs mailto: at the start to open an email";
      if (/\s/.test(u)) return "has a space in it";
      return "";
    }
    d.projects.forEach(function (p) {
      var name = p.title ? "\u201c" + short(p.title) + "\u201d" : "A project with no name";
      if (!String(p.title || "").trim()) return;   // untitled projects are left out, and Execute changes says so
      var cur = String(p.metricCurrent || "").trim(), tgt = String(p.metricTarget || "").trim();
      if (cur && SD.toNumber(cur) === null) add("fix", name + ": the \u201cNow\u201d number isn't a number, so no progress bar shows.", "projects", p._key);
      else if (tgt && SD.toNumber(tgt) === null) add("fix", name + ": the target isn't a number, so no progress bar shows.", "projects", p._key);
      else if (cur && !tgt) add("fix", name + ": has a \u201cNow\u201d number but no target, so no progress bar shows.", "projects", p._key);
      var why = badLink(p.helpLink);
      if (why) add("fix", name + ": the sign-up link " + why + ".", "projects", p._key);
      var noAlt = (p.image && !String(p.imageAlt || "").trim() ? 1 : 0) +
        (p.gallery || []).filter(function (g) { return g && g.image && !String(g.imageAlt || "").trim(); }).length;
      if (noAlt) add("check", name + ": " + (noAlt === 1 ? "a photo has" : noAlt + " photos have") + " no description, for people who can't see it.", "projects", p._key);
      if (String(p.title).length > TITLE_LIMIT) add("check", name + ": the name is long and may be cut off on TVs.", "projects", p._key);
      if (String(p.summary || "").length > SUMMARY_LIMIT) add("check", name + ": \u201cWhat is it?\u201d is long and may be cut off on TVs.", "projects", p._key);
    });
    now.stats.forEach(function (s, i) {
      var name = "\u201c" + short(s.label) + "\u201d";
      if (s.source && !s.from) add("fix", name + " is worked out from a " + (/^chart:/.test(s.source) ? "chart" : "project") + " that isn't there any more, so the typed-in number shows.", "stats");
      else if (typeof s.value !== "number" && String(s.value).trim()) add("check", name + ": \u201c" + short(s.value) + "\u201d isn't a plain number, so it can't count up or be compared with last time. Put the unit in the Unit box.", "stats");
      else if (String(s.value).trim() === "") add("fix", name + " has no number.", "stats");
      if (i < 4 && !s.asOf && s.value !== "") add("check", name + " has no date, so people can't tell how up to date it is.", "stats");
    });
    if (now.stats.length > 4) add("check", "Only the first 4 headline numbers are shown. " + (now.stats.length - 4) + " more won't appear: move the ones you want to the top.", "stats");
    var past = now.events.filter(function (e) { return SD.parseDate(e.date) < today; }).length;
    if (past) add("check", past === 1 ? "1 event has already happened. Screens hide it, so you can delete it." : past + " events have already happened. Screens hide them, so you can delete them.", "events");
    var longNews = now.updates.filter(function (u) { return u.text.length > UPDATE_LIMIT; }).length;
    if (longNews) add("check", longNews + " news item" + (longNews === 1 ? " is" : "s are") + " long and may be cut off on TVs.", "updates");
    var whyGi = badLink(d.getInvolved && d.getInvolved.link);
    if (whyGi) add("fix", "Get involved: the link " + whyGi + ".", "involved");
    if (/yourschool\.example/i.test(now.dashboard.contact)) add("check", "The contact email is still the example address.", "basics");
    var size = buildFile(exportData(stripKeys(d))).length;
    if (size > 2.5 * 1048576) add(size > 6 * 1048576 ? "fix" : "check", "The file is " + (size / 1048576).toFixed(1) + " MB, mostly photos. Screens load it every " + (SD.toNumber(CONFIG.refreshMinutes) || 10) + " minutes, so smaller photos keep them quick.", "gallery");
    return out;
  }

  function renderChecks(dirty) {
    var box = document.getElementById("ed-checks");
    if (!box) return;
    var list = dirty ? checksList() : [];
    if (!list.length) { box.innerHTML = ""; return; }
    var fixes = list.filter(function (c) { return c.level === "fix"; }).length;
    var old = box.querySelector("details"), open = old ? old.open : fixes > 0;
    box.innerHTML =
      '<details class="ed-checks' + (fixes ? " has-fixes" : "") + '"' + (open ? " open" : "") + "><summary>" + icon(fixes ? "warning" : "help") +
        "Worth checking before you publish" + '<span class="ed-tab-count">' + list.length + "</span></summary>" +
        '<ul class="ed-checks-list">' + list.map(function (c) {
          return '<li class="is-' + c.level + '"><span class="ed-check-tag">' + (c.level === "fix" ? "Fix" : "Check") + '</span><span class="ed-change-text">' + esc(c.text) + "</span>" +
            '<button type="button" class="btn btn-sm btn-quiet ed-go" data-tab="' + c.tab + '"' + (c.key ? ' data-open="' + c.key + '"' : "") + ">Go to it</button></li>";
        }).join("") + "</ul>" +
      "</details>";
  }

  var toastTimer;
  function toast(msg, canUndo) {
    var t = document.getElementById("ed-toast");
    if (!t) return;
    t.innerHTML = "<span>" + esc(msg) + "</span>" +
      (canUndo ? '<button type="button" class="ed-toast-undo" data-action="undo">Undo</button>' : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, canUndo ? 10000 : 6000);
  }

  // Undo: deleting, putting back, discarding and opening a file can all be undone (the Undo
  // button in the message, or Ctrl+Z / Cmd+Z when you're not typing in a box).
  function short(text) { text = String(text); return text.length > 40 ? text.slice(0, 39) + "\u2026" : text; }
  function keepForUndo(what) {
    state.undo.push({ what: what, json: JSON.stringify(state.data) });
    if (state.undo.length > 20) state.undo.shift();
  }
  function undo() {
    var last = state.undo.pop();
    if (!last) { toast("Nothing to undo."); return; }
    state.data = JSON.parse(last.json);
    SD.applyBrand(state.data.school.color);
    changed();
    toast("Undone: " + last.what + ".");
  }

  /* ---------- Editing ---------- */

  function onInput(e) {
    var t = e.target;
    var picturePath = t.getAttribute && t.getAttribute("data-picture-address");
    if (picturePath) {
      setPath(state.data, picturePath, t.value.trim());
      touchProject(picturePath);
      refreshPicture(picturePath);
      saveDraft();
      return;
    }
    if (t.id === "ed-project-filter") { state.projectFilter = t.value; filterProjects(); return; }
    // Ticking areas for a TV's address (Screens tab) only changes the address shown
    var linkCat = t.getAttribute && t.getAttribute("data-link-cat");
    if (linkCat) {
      if (e.type !== "change") return;
      state.linkCats = (state.linkCats || []).filter(function (k) { return k !== linkCat; });
      if (t.checked) state.linkCats.push(linkCat);
      renderSection();
      return;
    }
    var path = t.getAttribute && t.getAttribute("data-path");
    if (!path) return;
    if (path === "school.color") {
      setPath(state.data, path, t.value);
      SD.applyBrand(t.value);
      if (e.type === "change") renderSection();
      saveDraft();
      return;
    }
    var value = t.type === "checkbox" ? t.checked : t.value;
    setPath(state.data, path, value);

    // Choosing what a headline number is worked out from redraws its card with the right choices
    var sm = /^stats\.(\d+)\.(source|calc|factor)$/.exec(path);
    if (sm && e.type === "change") {
      var st = state.data.stats[+sm[1]], kind = (/^(project|chart):/.exec(st.source || "") || [])[1];
      if (kind && !SD.CALCS[kind].some(function (c) { return c.value === st.calc; })) st.calc = "now";
      saveDraft();
      renderSection();
      return;
    }

    var m = /^projects\.(\d+)\.(.+)$/.exec(path);
    if (m) {
      var i = +m[1], p = state.data.projects[i];
      if (m[2] === "title" && e.type === "change" && !p.id) { assignId(p); saveDraft(); renderSection(); return; }
      if (m[2] !== "updated") {
        p.updated = SD.todayISO();
        var dateInput = el.querySelector('[data-path="projects.' + i + '.updated"]');
        if (dateInput) dateInput.value = p.updated;
      }
      var sum = el.querySelector('[data-summary-for="' + i + '"]');
      if (sum) sum.innerHTML = projectSummary(p);
      if (m[2] === "category") {
        var cat = SD.categoryKey(p.category) || "other";
        var item = sum && sum.parentNode;
        if (item) item.className = "ed-item cat-" + cat;
        var pv = el.querySelector('[data-preview-for="' + i + '"]');
        if (pv) pv.className = "ed-metric-preview cat-" + cat;
      }
      if (/^metric/.test(m[2])) {
        var prev = el.querySelector('[data-preview-for="' + i + '"]');
        if (prev) prev.innerHTML = metricPreview(p);
      }
    }

    if (/^display\.tvSleep/.test(path)) {
      var note = document.getElementById("ed-sleep-note");
      if (note) note.outerHTML = sleepNote();
    }

    var counter = el.querySelector('[data-count-for="' + path + '"]');
    if (counter) {
      var limit = +counter.getAttribute("data-limit");
      counter.textContent = counterText(value, limit);
      counter.className = "ed-hint" + (String(value).length > limit ? " is-over" : "");
    }
    saveDraft();
  }

  function onClick(e) {
    var tab = e.target.closest ? e.target.closest("[data-tab]") : null;
    if (tab) {
      state.tab = tab.getAttribute("data-tab");
      var key = tab.getAttribute("data-open");   // "Go to it" in the checks opens that project
      if (key) state.open[key] = true;
      renderSection();
      var target = (key && el.querySelector('.ed-item[data-key="' + key + '"]')) || (tab.classList.contains("ed-go") && el.querySelector(".ed-tabs"));
      if (target) {
        var head = el.querySelector(".ed-bar");        // sticky, so leave room below it
        window.scrollTo(0, target.getBoundingClientRect().top + window.pageYOffset - (head ? head.offsetHeight : 0) - 12);
      }
      return;
    }
    var btn = e.target.closest ? e.target.closest("[data-action]") : null;
    if (!btn) return;
    var action = btn.getAttribute("data-action");
    var d = state.data, i = +btn.getAttribute("data-index"), list = btn.getAttribute("data-list");

    if (action === "add-project") {
      var p = { _key: newKey(), id: "", title: "", category: "other", status: "planning", summary: "", team: "", metricLabel: "", metricStart: "", metricCurrent: "", metricTarget: "", metricUnit: "", nextStep: "", getInvolved: "", helpLink: "", image: "", imageAlt: "", story: "", startDate: "", endDate: "", gallery: [], milestones: [], featured: false, updated: SD.todayISO() };
      d.projects.push(p);
      state.open[p._key] = true;
      changed();
      var input = el.querySelector('[data-path="projects.' + (d.projects.length - 1) + '.title"]');
      if (input) { input.focus(); input.scrollIntoView({ block: "center" }); }
    } else if (action === "add-stat") {
      d.stats.push({ _key: newKey(), label: "", value: "", unit: "", note: "", icon: "other", asOf: SD.todayISO(), previous: "", compareLabel: "", direction: "up", source: "", calc: "now", factor: "" });
      changed();
    } else if (action === "add-update") {
      d.updates.unshift({ _key: newKey(), date: SD.todayISO(), text: "", category: "" });
      changed();
      var u = el.querySelector('[data-path="updates.0.text"]');
      if (u) u.focus();
    } else if (action === "add") {
      var arr = getPath(d, list), kind = list.split(".").pop();
      arr.push(TEMPLATES[kind] ? TEMPLATES[kind]() : {});
      touchProject(list);
      changed();
    } else if (action === "move") {
      var items = getPath(d, list);
      var j = i + +btn.getAttribute("data-dir");
      if (j < 0 || j >= items.length) return;
      var tmp = items[i]; items[i] = items[j]; items[j] = tmp;
      touchProject(list);
      changed();
      var moved = el.querySelector('[data-action="move"][data-index="' + j + '"][data-dir="' + btn.getAttribute("data-dir") + '"]');
      if (moved && !moved.disabled) moved.focus();
    } else if (action === "duplicate") {
      var copy = JSON.parse(JSON.stringify(d.projects[i]));
      copy._key = newKey(); copy.id = ""; copy.title = copy.title + " (copy)"; copy.featured = false;
      assignId(copy);
      d.projects.splice(i + 1, 0, copy);
      state.open[copy._key] = true;
      changed();
    } else if (action === "delete") {
      var all = getPath(d, list), item = all[i];
      var name = typeof item === "string" ? item : item.title || item.label || item.text || item.name;
      var what = name ? "\"" + short(name) + "\"" : (btn.getAttribute("aria-label") || "").replace(/^Delete\s*/, "") || "it";
      keepForUndo("deleting " + what);
      all.splice(i, 1);
      touchProject(list);
      changed();
      toast("Deleted " + what + ".", true);
    } else if (action === "preview" || action === "preview-tv") {
      saveDraft();
      if (!isDirty()) SD.storage.set(SD.DRAFT_KEY, { savedAt: Date.now(), data: stripKeys(state.data) });
      if (action === "preview") window.open("index.html?preview=draft", "sd-preview");
      else window.open("index.html?mode=tv&preview=draft", "sd-preview-tv");
    } else if (action === "clear-filter") {
      state.projectFilter = "";
      var fb = document.getElementById("ed-project-filter");
      if (fb) { fb.value = ""; fb.focus(); }
      filterProjects();
    } else if (action === "load-previous") {
      loadPrevious();
    } else if (action === "load-other") {
      var other = SD.storage.get(SD.DRAFT_KEY);
      if (!other || !other.data) return;
      keepForUndo("loading the other tab's changes");
      state.data = editable(other.data);
      state.savedAt = other.savedAt;
      state.otherSaved = false;
      SD.applyBrand(state.data.school.color);
      render();
      toast("Loaded the other tab's latest changes.", true);
    } else if (action === "download-qr") {
      downloadQr(btn.getAttribute("data-url"), btn.getAttribute("data-name"));
    } else if (action === "copy-link") {
      copyText(btn.parentNode.querySelector("input"));
    } else if (action === "download") {
      download();
    } else if (action === "execute" || action === "publish") {
      if (canPublish) publish();
      else download();
    } else if (action === "choose-folder") {
      chooseFolder().then(function (dir) { renderSection(); toast("Publishing into the \"" + dir.name + "\" folder."); }, function () {});
    } else if (action === "forget-folder") {
      state.folder = null;
      forgetFolder().then(renderSection);
    } else if (action === "pick-picture") {
      state.photoTarget = btn.getAttribute("data-target");
      document.getElementById("ed-photo-file").click();
    } else if (action === "remove-picture") {
      keepForUndo("removing the picture");
      setPath(d, btn.getAttribute("data-target"), "");
      touchProject(btn.getAttribute("data-target"));
      changed();
      toast("Picture removed.", true);
    } else if (action === "undo") {
      undo();
    } else if (action === "put-back") {
      putBack(+btn.getAttribute("data-change"));
    } else if (action === "reset-colour") {
      d.school.color = "";
      SD.applyBrand("");
      changed();
    } else if (action === "import") {
      document.getElementById("ed-file").click();
    } else if (action === "discard") {
      if (!window.confirm("Discard your changes and go back to what's on the screens now?")) return;
      keepForUndo("discarding your changes");
      SD.storage.remove(SD.DRAFT_KEY);
      start(true, function () { toast("Changes discarded. The editor now matches the screens.", true); });
    }
  }

  function changed() {
    renderSection();
    var mark = document.getElementById("ed-brand-mark");   // the crest may have been changed or removed
    if (mark) mark.outerHTML = brandMarkHtml();
    saveDraft();
  }

  function onToggle(e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("ed-item")) state.open[t.getAttribute("data-key")] = t.open;
  }

  /* ---------- Download / open a file ---------- */

  function buildFile(data) {
    return (
      "/*\n" +
      "  Sustainability Dashboard: content\n" +
      "  Made with editor.html on " + SD.todayISO() + ".\n" +
      "  To publish: replace data/dashboard-data.js with this file.\n" +
      "*/\n" +
      "window.DASHBOARD_DATA = " + JSON.stringify(data, null, 2) + ";\n"
    );
  }

  function untitledOk(verb) {
    var untitled = state.data.projects.filter(function (p) { return !String(p.title || "").trim(); }).length;
    return !untitled || window.confirm(untitled + " project" + (untitled === 1 ? " has" : "s have") + " no title and won't be included. " + verb + " anyway?");
  }

  function download() {
    if (!untitledOk("Download") || !checksOk("Download")) return;
    state.data.dashboard.lastUpdated = SD.todayISO();
    var data = exportData(stripKeys(state.data));
    var blob = new Blob([buildFile(data)], { type: "text/javascript" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dashboard-data.js";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.parentNode.removeChild(a); }, 1000);
    if (state.tab === "basics") renderSection();
    saveDraft();
    var size = blob.size > 1048576 ? (blob.size / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(blob.size / 1024)) + " KB";
    toast("Downloaded dashboard-data.js (" + size + "). Send it to IT, or replace data/dashboard-data.js with it.");
  }

  function parseFile(text) {
    var at = text.indexOf("DASHBOARD_DATA");
    var start = text.indexOf("{", at === -1 ? 0 : at), end = text.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("This doesn't look like a dashboard data file.");
    return JSON.parse(text.slice(start, end + 1));
  }

  function onFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var raw = parseFile(String(reader.result));
        if (isDirty() && !window.confirm("Replace what you're editing with \"" + file.name + "\"?")) return;
        keepForUndo("opening " + file.name);
        state.data = editable(SD.normalise(raw));
        state.open = {};
        render();
        saveDraft();
        toast("Opened " + file.name + ".", true);
      } catch (err) {
        window.alert("Couldn't open that file. " + (err.message || "") + "\n\nIf you edited it by hand, check for a missing comma or quote mark.");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  /* ---------- Publish straight to the screens ---------- */

  // In browsers that can save into a folder (Chrome and Edge), "Execute changes" saves the
  // content straight into the dashboard's data folder: the folder IT shares with the group
  // (IT-SETUP.md, option B). The folder is remembered in this browser. The last version is kept
  // as dashboard-data.previous.js, and data/updated.js is written so screens update within about
  // 30 seconds. Elsewhere (Safari, Firefox, iPads) it's "Download data file" as before.
  var canPublish = !!window.showDirectoryPicker && CONFIG.dataSource !== "google-sheet";

  // A tiny IndexedDB store for the chosen folder (browsers can keep a folder there, not in localStorage)
  function folderStore(mode, fn) {
    return new Promise(function (resolve, reject) {
      var open = indexedDB.open("sd-editor", 1);
      open.onupgradeneeded = function () { open.result.createObjectStore("kv"); };
      open.onerror = function () { reject(open.error); };
      open.onsuccess = function () {
        var tx = open.result.transaction("kv", mode), req = fn(tx.objectStore("kv"));
        tx.oncomplete = function () { resolve(req && req.result); };
        tx.onerror = function () { reject(tx.error); };
      };
    });
  }
  function savedFolder() { return folderStore("readonly", function (s) { return s.get("dataFolder"); }).catch(function () { return null; }); }
  function rememberFolder(dir) { return folderStore("readwrite", function (s) { return s.put(dir, "dataFolder"); }).catch(function () {}); }
  function forgetFolder() { return folderStore("readwrite", function (s) { return s.delete("dataFolder"); }).catch(function () {}); }

  // Ask for the dashboard's data folder. Picking the dashboard's main folder works too (its "data"
  // folder is used), and a folder without dashboard-data.js in it is checked with the student first.
  function chooseFolder() {
    return window.showDirectoryPicker({ id: "sd-data", mode: "readwrite" }).then(function (dir) {
      return dir.getDirectoryHandle("data").then(function (sub) { return sub; }, function () { return dir; });
    }).then(function (dir) {
      return dir.getFileHandle("dashboard-data.js").then(function () { return dir; }, function () {
        if (!window.confirm("The \"" + dir.name + "\" folder has no dashboard-data.js in it. Is it really the dashboard's data folder? Publish into it anyway?")) throw new Error("cancelled");
        return dir;
      });
    }).then(function (dir) {
      state.folder = dir;
      return rememberFolder(dir).then(function () { return dir; });
    });
  }

  // The remembered folder, asking the browser for permission again if it needs to.
  function folderReady() {
    var dir = state.folder;
    if (!dir) return chooseFolder();
    return dir.queryPermission({ mode: "readwrite" }).then(function (p) {
      return p === "granted" ? p : dir.requestPermission({ mode: "readwrite" });
    }).then(function (p) {
      if (p !== "granted") throw new Error("The browser wasn't allowed to save into the \"" + dir.name + "\" folder.");
      return dir;
    });
  }

  function writeFile(dir, name, text) {
    return dir.getFileHandle(name, { create: true }).then(function (fh) { return fh.createWritable(); })
      .then(function (w) { return w.write(text).then(function () { return w.close(); }); });
  }
  function readFile(dir, name) {
    return dir.getFileHandle(name).then(function (fh) { return fh.getFile(); })
      .then(function (f) { return f.text(); }, function () { return null; });
  }
  function updatedFile(stamp) {
    return "/* Written by the editor's \"Execute changes\" button. Screens check this tiny file every\n" +
      "   quickCheckSeconds (config.js) and load the new content as soon as the time changes. */\n" +
      "window.DASHBOARD_UPDATED = " + JSON.stringify(stamp) + ";\n";
  }

  // Things marked "fix" in the checks: ask before they go on the screens.
  function checksOk(verb) {
    var fixes = checksList().filter(function (c) { return c.level === "fix"; });
    if (!fixes.length) return true;
    return window.confirm((fixes.length === 1 ? "One thing would look broken" : fixes.length + " things would look broken") + " on the screens:\n\n" +
      fixes.slice(0, 6).map(function (c) { return "\u2022 " + c.text; }).join("\n") + (fixes.length > 6 ? "\n\u2026and " + (fixes.length - 6) + " more" : "") +
      "\n\nThey're listed under \u201cWorth checking before you publish\u201d. " + verb + " anyway?");
  }

  function publish() {
    if (!untitledOk("Publish") || !checksOk("Publish")) return;
    state.data.dashboard.lastUpdated = SD.todayISO();
    var data = exportData(stripKeys(state.data)), stamp = new Date().toISOString();
    var btn = el.querySelector('[data-action="execute"]');
    if (btn) btn.disabled = true;
    folderReady().then(function (dir) {
      return readFile(dir, "dashboard-data.js")
        .then(function (old) { return old ? writeFile(dir, "dashboard-data.previous.js", old) : null; })   // so it can be put back
        .then(function () { return writeFile(dir, "dashboard-data.js", buildFile(data)); })
        .then(function () { return writeFile(dir, "updated.js", updatedFile(stamp)); })
        .then(function () { return dir; });
    }).then(function (dir) {
      // What's published is now the live version. The draft stays in this browser until the live
      // content is seen to match it, in case the wrong folder was chosen.
      state.liveJson = JSON.stringify(SD.normalise(data));
      state.publishedAt = stamp;
      SD.storage.set("sd:published", stamp);            // dashboard tabs open in this browser update at once
      renderSection();
      renderStatus();
      toast("Published into the \"" + dir.name + "\" folder. Screens show it within " + (SD.toNumber(CONFIG.quickCheckSeconds) || 30) + " seconds.");
      checkLive(data);
    }, function (err) {
      if (err && (err.name === "AbortError" || err.message === "cancelled")) return;   // the folder picker was closed
      window.alert("Couldn't publish. " + ((err && err.message) || err) + "\n\nYou can still click Download and send the file to IT.");
    }).then(function () { if (btn) btn.disabled = false; });
  }

  // A moment later, check that this dashboard really shows what was published (i.e. the right
  // folder was chosen), and say so if it doesn't.
  function checkLive(data) {
    var want = JSON.stringify(SD.normalise(data));
    setTimeout(function () {
      SD.loadDataFile(CONFIG.dataFile).then(function (raw) {
        if (JSON.stringify(SD.normalise(raw)) === want) toast("Published and checked: the dashboard is showing your changes.");
        else {
          state.notices.push({ html: "<strong>Published, but this dashboard isn't showing it.</strong> The file was saved, but not where this dashboard reads it from. In the Screens tab, click <em>Choose another folder</em> and pick the dashboard's own data folder, or send the downloaded file to IT." });
          render();
        }
      }, function () {});
    }, 1500);
  }

  /* ---------- Start ---------- */

  function start(ignoreDraft, then) {
    state.notices = [];
    SD.load({}).then(
      function (result) {
        if (result.warning) {
          state.notices.push({ html: "<strong>Couldn't load the live content</strong>, so this is the last copy this browser saw. " + esc(result.warning) });
        }
        return result.data;
      },
      function (err) {
        state.notices.push({ html: "<strong>Couldn't load the live content.</strong> Starting with a blank dashboard. " + esc(err.message) });
        return SD.normalise({});
      }
    ).then(function (live) {
      state.liveJson = JSON.stringify(live);
      var draft = ignoreDraft ? null : SD.storage.get(SD.DRAFT_KEY);
      if (draft && draft.data && JSON.stringify(SD.normalise(draft.data)) !== state.liveJson) {
        state.data = editable(draft.data);
        state.savedAt = draft.savedAt;
        state.notices.push({
          kind: "info",
          html: "<strong>Welcome back.</strong> You have changes from " + esc(new Date(draft.savedAt).toLocaleString(CONFIG.locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) +
            " that aren't on the screens yet. Keep editing, click Execute changes to put them on the screens, or Discard changes to start again from what's there now."
        });
      } else {
        SD.storage.remove(SD.DRAFT_KEY);
        state.data = editable(live);
        state.savedAt = null;
      }
      SD.applyBrand(state.data.school.color);
      render();
      if (then) then();
    });
    if (canPublish && !state.folder) savedFolder().then(function (h) { if (h) { state.folder = h; if (state.tab === "screens") renderSection(); } });
  }

  el.addEventListener("input", onInput);
  el.addEventListener("change", onInput);
  el.addEventListener("click", onClick);
  el.addEventListener("toggle", onToggle, true);
  el.addEventListener("change", function (e) {
    if (e.target && e.target.id === "ed-file") onFile(e);
    if (e.target && e.target.id === "ed-photo-file") onPicture(e);
  });

  window.addEventListener("beforeunload", function () { if (state.data && isDirty()) saveDraft(); });
  // Ctrl+Z / Cmd+Z undoes the last delete or put back, except while typing in a box (the box undoes its own typing)
  document.addEventListener("keydown", function (e) {
    // Ctrl+S / Cmd+S out of habit: say how saving works here instead of saving a copy of this page
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      saveDraft();
      toast(isDirty()
        ? "Saved in this browser (it saves as you type). Click Execute changes to put it on the screens."
        : "Nothing to save: the editor matches what's on the screens.");
      return;
    }
    var t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === "z" || e.key === "Z") && !typing && state.undo.length) {
      e.preventDefault();
      undo();
    }
  });

  start(false);
})();
