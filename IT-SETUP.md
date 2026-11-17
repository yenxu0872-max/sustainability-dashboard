# Sustainability Dashboard: IT setup guide

A student sustainability dashboard for the pupil portal and corridor TVs. This guide covers hosting it, adding it to the iSAMS pupil portal, putting it on screens, and how content gets updated.

## 1. What it is

**A static website.** HTML, CSS and plain JavaScript files only.

- No server-side code, no database, no build step, no npm, no logins.
- No external requests: no CDNs, web fonts, analytics or cookies. Body text uses each device's own system font (San Francisco on Apple devices, Segoe UI on Windows, Roboto on Android and ChromeOS). Headings use a Garamond-style serif to match the school website, also from the device's own fonts (Iowan Old Style on Apple devices, Garamond or Palatino on Windows, Georgia or the default serif elsewhere). The handwritten notes use the device's handwriting font (Bradley Hand or Noteworthy on Apple devices, Segoe Print or Ink Free on Windows, the default "cursive" font elsewhere). (Exception: if you switch on the optional Google Sheet mode, it fetches the published CSVs from Google.)
- An optional rounded font (Nunito, SIL Open Font Licence) is included in `assets/fonts/` but switched off. See the comment at the top of `assets/dashboard.css` if the school wants it.
- Browser storage (`localStorage`) is used only to keep a fallback copy of the last good content and the editor's unsaved draft.
- Animations (fade-ins, count-ups, charts drawing, moving icons, hand-drawn highlighter lines and pen notes, the TV page changes) are plain CSS and JavaScript, with no libraries or plugins. The sample pictures in `images/` are animated SVGs with the movement written inside each file. All of it switches off for anyone who has *Reduce motion* turned on, and older browsers simply show everything without it.
- The whole folder is about 500 KB before real photos are added (the optional font is about 75 KB of that). Each photo adds roughly 100–200 KB (see section 6).

So it can be hosted anywhere that serves static files, and it can't be used to change anything on the server.

## 2. Quick start (5 minutes)

1. Unzip the folder.
2. To try it locally, just double-click `index.html`. It works straight from the folder. To try it with a local web server instead:
   ```bash
   python3 -m http.server 8080
   ```
   and open http://localhost:8080
3. Copy the whole folder to a web host (section 3).
4. Send the students the addresses (section 4).

## 3. Hosting

It must be served over **https**, because the pupil portal is https and browsers block http pages inside https pages.

| Option | Notes |
|---|---|
| **Existing school web server** (IIS, Apache, nginx) | Copy the folder into a site or virtual directory, e.g. `https://intranet.school/sustainability/`. Easiest if you already have one. |
| **GitHub Pages / Netlify / Cloudflare Pages** | Free static hosting with https. Good if students will later update `data/` through a reviewed pull request. |
| **Azure Static Web Apps** | Free tier, fits a Microsoft 365 school. |
| Not suitable | SharePoint/OneDrive and Google Drive download `.html` files instead of displaying them. |

### Recommended response headers

```
Cache-Control: no-cache
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self' https://marlboroughmy.students.isamshosting.cloud
```

- `no-cache` makes browsers check for new versions. The files are tiny, so this costs nothing, and design or content changes show up straight away.
- `frame-ancestors` lists the pages allowed to embed the dashboard. The value above allows the school's iSAMS pupil portal; add any other portal domains you use.
- **Don't send `X-Frame-Options: DENY` or `SAMEORIGIN`** if you'll embed it in the portal, because they block embedding. `frame-ancestors` replaces them.
- `data:` in `img-src` is needed because photos, the logo and the banner added in the editor are stored inside the data file.
- If you enable Google Sheet mode, add `https://docs.google.com https://*.googleusercontent.com` to `connect-src`. If any picture addresses point to other websites, add those sites (or `https:`) to `img-src`.
- `'unsafe-inline'` in `style-src` is needed because progress-bar widths are set as inline styles. No inline scripts are used.

<details>
<summary>Example: IIS web.config</summary>

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <clientCache cacheControlMode="DisableCache" />
    </staticContent>
    <httpProtocol>
      <customHeaders>
        <remove name="X-Frame-Options" />
        <add name="Content-Security-Policy" value="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self' https://marlboroughmy.students.isamshosting.cloud" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```
</details>

<details>
<summary>Example: nginx</summary>

```nginx
location /sustainability/ {
    add_header Cache-Control "no-cache";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self' https://marlboroughmy.students.isamshosting.cloud";
}
```
</details>

## 4. Addresses and views

Add these to the hosted folder's address, for example `https://intranet.school/sustainability/index.html?mode=tv`.

| Address | Use |
|---|---|
| `index.html` | Normal responsive page (portal link, laptops, phones) |
| `index.html?mode=tv` | TV / signage: full screen, auto-rotating, no scrolling |
| `index.html?mode=embed` | Inside a portal page (iframe) |
| `index.html?mode=embed&view=summary` | Compact widget for a portal home page or sidebar |
| `index.html#project=<id>` | Opens one project's page directly (the editor shows each project's link). Good for QR codes on posters |
| `editor.html` | Content editor for the student group |
| `portal-embed-example.html` | Demo of both embed options, with the code to copy |

Extra options (add with `&`):

| Option | Effect |
|---|---|
| `theme=light`, `theme=dark` or `theme=auto` | Colour theme. Default is light (white) everywhere; `auto` follows each device's setting. Defaults are set in `config.js` |
| `category=food,waste` | Only show these categories, e.g. a canteen TV. Values: `energy, waste, water, food, nature, transport, community, other` |
| `rotate=20` | TV: seconds per page of projects (default 15) |
| `cards=1` to `cards=4` | TV: projects per page. Default 3 side by side; `4` fits more on each page; `1` shows one big photo and project at a time (best for large or distant screens). A short last page is topped up with projects from the start, so every page has the same number of same-sized cards |
| `from=web` | TV: added by the **TV mode** button on the web page. Moving the mouse shows *Full screen* and *Exit TV mode* buttons, and Esc goes back to the web page. Leave it off the TV links, so school TVs never show these buttons |
| `header=0` | Embed: hide the title area if the portal page already has one |
| `bg=transparent` | Embed: transparent background |

## 5. Adding it to the iSAMS pupil portal

The pupil portal is at `https://marlboroughmy.students.isamshosting.cloud/`.

### Option A: menu link (works on any setup)

Add an external link in the pupil portal's menu or quick links to the full page, e.g. `https://YOUR-HOST/sustainability/index.html`. It opens in a new tab and works well on phones.

### Option B: embedded in a portal page (if iSAMS allows it)

iSAMS's public documentation doesn't say whether the pupil portal accepts custom HTML or iframes. Check in the portal's admin settings or ask iSAMS (IRIS) support. If it does, paste one of these:

```html
<!-- Full dashboard -->
<iframe src="https://YOUR-HOST/sustainability/index.html?mode=embed"
        title="Sustainability Dashboard"
        style="width:100%;height:900px;border:0;display:block" loading="lazy"></iframe>

<!-- Small summary widget -->
<iframe src="https://YOUR-HOST/sustainability/index.html?mode=embed&view=summary&bg=transparent"
        title="Sustainability progress"
        style="width:100%;height:760px;border:0;display:block" loading="lazy"></iframe>
```

Both work at a fixed height and scroll inside the frame. If the portal also allows a `<script>`, the snippet in `portal-embed-example.html` makes the frame grow to fit its content.

If the frame shows "refused to connect", the host is sending `X-Frame-Options` or the portal's domain is missing from `frame-ancestors` (section 3).

## 6. Updating content

All content is in `data/dashboard-data.js`. Open screens re-check every 10 minutes (`refreshMinutes` in `config.js`). If a new file has a mistake, screens keep showing the last good copy with a small "saved copy" notice, and the normal page explains what's wrong, including the line number.

**Photos and file size:** photos added in the editor live inside the data file. Almost every section can have a picture (projects, headline numbers, news, events, league, "Around school" photos, About, Get involved), so a fully illustrated dashboard with 30 photos is roughly 3–6 MB. Screens re-download it every `refreshMinutes`, which is negligible on a school network. To reduce it, raise `refreshMinutes` to 15–30, or host the photos in `images/` and use picture addresses instead (students can do this in the editor under *Use a picture IT has uploaded instead*).

Choose one of these workflows:

### A. Editor + IT upload (default, safest)

Students use `editor.html` and click **Download data file** (or **Execute changes**, which downloads the file in browsers that can't save into a folder). IT replaces `data/dashboard-data.js` with it. Screens pick it up within `refreshMinutes`. The editor runs entirely in the browser and can only save into a folder the student chooses.

### B. Give the student group access to just the `data` folder (recommended: screens update in about 30 seconds)

Share the dashboard's `data` folder with the student group (e.g. a network share the web server reads from, mapped on the student computers). In the editor they click **Execute changes**; the first time, Chrome or Edge asks them to choose that folder, and the editor remembers it. It then writes three files there:

- `dashboard-data.js`: the new content
- `dashboard-data.previous.js`: the version before, so a mistake can be undone by renaming it back
- `updated.js`: a tiny file with the time, which every screen checks every `quickCheckSeconds` (30) so new content appears within about half a minute

The editor then checks that this dashboard really shows the new content, and warns the student if the folder was the wrong one. Students only need write access to `data`, nothing else. Other options are an SFTP account, or a GitHub repository where students propose changes to `data/dashboard-data.js` by pull request and a teacher approves.

### C. Live from a Google Sheet (no files to send)

Students edit a spreadsheet and screens update by themselves.

1. Create a Google Sheet (a staff account is best, because Workspace admins often block "Publish to web" for students).
2. Make ten tabs: **Settings, Stats, Projects, Updates, Events, Trends, Leaderboard, Tips, Milestones, Gallery**. Into each one, import the matching CSV from `google-sheet-template/` (File → Import → Upload → *Replace current sheet*). You can skip tabs for sections you don't use.
3. For each tab: File → Share → **Publish to web** → choose the tab → *Comma-separated values (.csv)* → Publish. Copy the link.
4. In `config.js`, set `dataSource: "google-sheet"` and paste each tab's link into `googleSheet` (`settingsCsvUrl`, `statsCsvUrl`, `projectsCsvUrl`, `updatesCsvUrl`, `eventsCsvUrl`, `trendsCsvUrl`, `leaderboardCsvUrl`, `tipsCsvUrl`, `milestonesCsvUrl`, `galleryCsvUrl`). Optionally add the sheet's normal edit link as `editUrl`, so the editor page points students to it.
5. Share the sheet (Editor access) with the student group.

In the **Stats** tab, the last three columns make a headline number work itself out: *Work out from* is `project:` followed by the project's id (e.g. `project:living-wall`) or `chart:` followed by the chart's title (e.g. `chart:Rainwater collected each month`); *How* is `now`, `change` (Start to Now, or first to latest) or `total` (a chart's values added up); *Multiply by* is optional (e.g. `0.001` for kg to tonnes). Leave them empty to use the typed *Value*.

Notes:
- Published sheets can be read by anyone with the link. That's fine for this content, but never put personal data in it.
- Google may take up to about 5 minutes to update the published copy.
- **Photos:** a spreadsheet cell can't hold a photo, so in this mode every *Image* column takes a picture address instead: put the photos in the dashboard's `images/` folder and write e.g. `images/solar.jpg`, or use a public `https://` image address. Projects, Stats, Updates, Events and Leaderboard each have an *Image* column; the Gallery tab is one row per photo (*Image*, *Caption*); Settings has *Banner*, *Logo*, *About image* and *Get involved image* rows.
- Column headings are matched loosely ("Next step", "next_step" and "nextStep" all work), but keep the template's columns.
- **Link name** (Projects tab): the end of the project's own link, e.g. `solar-sports-hall` gives `index.html#project=solar-sports-hall`. Leave it empty and it's made from the title. Once a link is on a poster or QR code, don't change it.
- News, events and milestones name their project by its **title** (or link name) in the *Project* column.
- **Trends tab:** one row per point. Rows with the same *Chart* name make one chart; its settings (unit, lower is better, target) come from its first row.
- **More photos** (Projects tab): picture addresses separated by spaces. Photos added this way have no description.
- **Tested:** loading all ten template tabs gives the same dashboard as the data file (only the descriptions of extra project photos are missing, as above). **Not tested:** a live published Google Sheet. Check it once after setup.

## 7. TVs and digital signage

Use `index.html?mode=tv`. The layout scales to any resolution from 720p to 4K, and portrait screens are supported.

It rotates through pages: projects (3 big cards at a time, with photo, summary, progress, next step and how to help), a page of up to 3 "Around school" photos, the charts, and the league with upcoming events. The headline numbers stay along the top in a slim row of tiles and a news ticker with a small picture runs along the bottom. Every page uses the same columns as that bottom strip ("Get involved" sits exactly under the last card), the cards on a page are all the same size with their titles, progress bars and next steps level, and all text uses four large sizes. When new content arrives, anything new or changed is circled or underlined as it comes up, with a short handwritten note ("+6%!", "new!", "done!"), and the footer shows how many things changed this week. It is styled calm and plain like a printed notice, but in colour: the crest and title over a heavy rule, sentence-case labels, cards, numbers, charts and panels tinted in their category's colour with a colour bar on top. Pages cross-fade, progress bars fill and charts draw in; nothing else moves, and page changes use only opacity, which even modest signage players handle smoothly. If a very old player struggles with the animated sample pictures, they disappear anyway once the group swaps in real photos.

| Setup | How |
|---|---|
| **Signage software** (Xibo, ScreenCloud, Yodeck, PiSignage, Samsung MagicInfo, LG SuperSign…) | Add a "Web page / URL" item with the TV address. |
| **Mini PC or Raspberry Pi with Chromium** | `chromium-browser --kiosk --noerrdialogs --disable-session-crashed-bubble --disable-infobars "https://YOUR-HOST/sustainability/index.html?mode=tv"` and start it at login. |
| **Windows PC with Edge** | `msedge --kiosk "https://YOUR-HOST/sustainability/index.html?mode=tv" --edge-kiosk-type=fullscreen --no-first-run`, or use Windows Assigned Access (kiosk mode). |
| **Smart TV's built-in browser** | Works, but it's the least reliable option. Prefer one of the above. |

Screen tips:
- **Don't use incognito/private mode** in kiosks. It stops the "last good copy" fallback from being saved.
- Set the TV's picture size to *Just Scan*, *Screen Fit* or *Original*, so it doesn't crop the edges. The layout already leaves a safety margin.
- Turn off screen sleep, keep browser zoom at 100%, and schedule the screens to switch off overnight.
- **TV sleep (optional):** set sleep and wake times in the editor's Screens tab (or `tv.sleepFrom` / `tv.sleepTo` below) and, outside those hours, the page shows a black screen with a small dim clock that moves every minute so nothing burns in. It wakes up by itself. A black screen saves most energy on OLED and local-dimming TVs; on other TVs the backlight stays on, so the TVs' own off timer saves more. Use both if you can. Add `&sleep=off` to a TV address to test it during sleep hours.
- The page reloads itself every 12 hours to pick up design changes (`tv.reloadPageEveryHours`). The mouse cursor is hidden in TV mode.
- **TVs fix themselves.** If the screen goes blank, stops turning its pages, or a content update trips it up, it shows what went wrong and reloads itself after a minute (at most once every 10 minutes, so it can't flash). Every automatic reload, including the 12-hourly one, first checks that the web server answers; during a network cut the TV keeps showing what it has and checks again every minute, so it never gets stuck on the browser's own "no internet" page. If it can't load at all, it tries again every minute. If the content file can't be reached, it keeps showing the last good copy with a small "Saved copy" label.
- A screen in a particular place can show only relevant projects, e.g. `?mode=tv&category=food,waste` in the canteen.

## 8. Settings (`config.js`)

| Setting | Default | Meaning |
|---|---|---|
| `dataSource` | `"file"` | `"file"` or `"google-sheet"` |
| `dataFile` | `"data/dashboard-data.js"` | Path to the content file |
| `googleSheet.*CsvUrl` | empty | Published CSV links, one per tab (section 6C) |
| `googleSheet.editUrl` | empty | Sheet edit link, shown in the editor |
| `refreshMinutes` | `10` | How often screens re-check the whole content file |
| `quickCheckSeconds` | `30` | How often screens check `data/updated.js`, which the editor's **Execute changes** writes, to show new content straight away |
| `highlightNewDays` | `7` | How many days new or changed things stay circled and underlined. `0` turns the marks off. ★ |
| `theme` | `"light"` | Normal page and portal colours: `light` (white), `dark` (deep navy) or `auto`. ★ |
| `defaultView` | `"grid"` | How projects are first shown: `grid` (3 per row) or `list`. Viewers can switch; their browser remembers it. ★ |
| `tv.theme` | `"light"` | TV colour theme: `light` (white) or `dark` (deep navy). ★ |
| `tv.cardsPerPage` | `3` | Projects per TV page: `1`, `2`, `3` or `4`. ★ |
| `tv.secondsPerPage` | `15` | Time per page of projects. ★ |
| `tv.secondsPerUpdate` | `10` | Time per news item in the strip along the bottom. ★ |
| `tv.reloadPageEveryHours` | `12` | Full page reload interval for screens |
| `tv.sleepFrom`, `tv.sleepTo` | empty | Times the TVs sleep and wake, e.g. `"18:00"` and `"07:00"`. Empty keeps them on. ★ |
| `tv.sleepWeekends` | `false` | `true` also sleeps from Friday evening to Monday morning. ★ |
| `locale` | `"en-GB"` | Date and number format |
| `showEditorLink` | `false` | Show an "Edit" link in the footer |

★ These are the standard settings. Students can change them for every screen in the editor's **Screens** tab; their choice is saved in the content file (`display` in `dashboard-data.js`, or the matching rows at the bottom of the sheet's Settings tab) and used instead. An address option such as `&cards=4` or `&rotate=20` wins over both, so one TV can still be set differently.

## 9. Security and privacy

- The editor can't change the server. It only downloads a file. You can still restrict `editor.html` (e.g. intranet-only) or not deploy it, and give students the zip to run locally instead. It works from a folder too.
- Content shouldn't contain personal data. The editor tells students to use group names, and to only use photos where everyone shown has agreed, following the school's photo policy. It recommends photos of the projects themselves. A staff member should check new photos before the file is published.
- Photos added in the editor are shrunk in the browser (all photos max 1280×960 JPEG, banner max 2000×1000 JPEG, logo max 600×240 PNG) and stored inside `data/dashboard-data.js`. Photo location data (EXIF/GPS) is removed by this process, because the picture is redrawn rather than copied.
- All text is escaped before display. Links only allow `http`, `https`, `mailto` or relative paths.
- `<meta name="robots" content="noindex">` keeps search engines from listing it.
- **New-and-changed marks** need no server. Each browser keeps a small list of what it last showed (the numbers, project names, progress, next steps, news and event titles, league scores, all of it content that is already public on the page) in its own `localStorage` under `sd:seen`. Nothing is sent anywhere. If a TV player clears its storage on restart, it simply starts a fresh list and marks the next change it sees.

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| "The dashboard couldn't load its content" | The message shows the reason. Usually `data/dashboard-data.js` is missing or has a typo (the line number is shown). Re-download it from the editor. |
| Yellow "Showing a saved copy" notice | The newest content file has a mistake, so the last good one is showing. Fix or replace the file. |
| Yellow "Sample content" notice | Untick *This is sample content* in the editor's Basics tab, download and upload again. |
| A project shows a grey panel instead of its photo | The picture address is wrong or the file is missing from `images/`. Photos added with *Choose photo* in the editor are inside the data file and can't go missing. |
| Changes don't appear | Wait up to `refreshMinutes`, then refresh. Check you replaced the right file. Check that `Cache-Control: no-cache` is set. |
| Portal frame shows "refused to connect" | Check `X-Frame-Options` / `frame-ancestors` (section 3) and that the dashboard is on https. |
| Too much is circled, or nothing is | Marks last `highlightNewDays` days from when each screen first saw the change; a screen that has just been set up marks only news from the last few days until something changes. Set `highlightNewDays: 0` to turn them off. |
| TV text tiny or cut off | Make sure the address has `?mode=tv`, browser zoom is 100% and the TV isn't overscanning. |
| No QR codes | They need the dashboard's web address, so they don't appear when it's opened from a file. Also check the Get involved link starts with `https://`. |

## 11. Browser support

Current Chrome, Edge, Safari and Firefox, and Chromium-based signage players from mid-2020 onwards (Chromium 84+). The code avoids newer JavaScript syntax so older TV browsers work. Where a browser lacks a newer feature (the frosted menu bar, scroll animations), it just shows the plain version.

## 12. File map

```
index.html                 dashboard (all views)
editor.html                content editor
config.js                  settings (IT)
data/dashboard-data.js     content (written by the editor's Execute changes, or replaced by its download)
data/updated.js            the time of the last Execute changes; screens check it every 30 seconds
data/dashboard-data.previous.js  the version before the last Execute changes (appears after the first one)
assets/dashboard.css       design
assets/dashboard.js        dashboard logic
assets/shared.js           shared code: data loading, Google Sheet CSV, icons, the logo
assets/editor.css/.js      editor
assets/favicon.ico, .png   browser tab icon (the school crest)
assets/apple-touch-icon.png  icon for a phone's home screen (the crest on white)
assets/favicon.svg         the old tree-shield tab icon, no longer used
assets/logo.svg            the dashboard logo with its name, for white backgrounds (posters, slides)
assets/logo-white.svg      the same with white text, for navy backgrounds
assets/logo-mark.svg       the shield on its own (stickers, QR code posters)
assets/bg-rings.svg        faint tree-ring pattern behind the top of the page
assets/fonts/              optional Nunito font (off by default) + its licence (OFL.txt)
images/                    the school's colour crest (school-crest-colour.png), a navy one-colour crest (school-crest.svg) and the
                           white crest-and-name logo (school-logo-white.svg), all from the school website,
                           animated sample pictures of the campus incl. the banner (replace or delete), and any pictures you host
google-sheet-template/     CSV starter tabs (10) for Google Sheet mode
portal-embed-example.html  embed demo with code to copy
README.md                  guide for the student group
```
