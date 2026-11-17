# Sustainability Dashboard

A dashboard that shows students and staff how our school is doing on sustainability. It has:

- headline numbers, compared with last time
- every project, with photos, progress, milestones and its own page, and a search box to find one quickly
- events coming up (each with **Add to calendar**, for Outlook, Google Calendar or a phone), the latest news, and charts of our numbers over time
- a house league and an eco tip of the day
- "Around school": a photo album (one big photo and four smaller ones) that opens a full-screen photo viewer
- an "About this data" section saying where the numbers come from

Almost everything has a space for a picture: projects, headline numbers, news, events, the league, About and Get involved.

It's styled to match **Marlborough College Malaysia**. Every colour comes from the school website's palette: navy and deep navy, sand, lime, gold, sky blue, light grey, with headings in deep navy. There are Garamond-style serif headings like the website's, and the house names (Wallace, Honan, Thompson, Wills) in the sample league. Each project category has its own school colour: Energy gold, Waste & recycling navy, Water sky blue, Food sand, Nature lime, Travel olive and Community bronze (always with its name or icon, so nobody has to rely on the colour). The sample pictures are drawn from the campus: white rendered blocks with red-brick piers and stair towers, white columns, verandas with grey railings, terracotta and grey roofs with deep eaves, rain trees, palms, the red running track, the louvred Sports Hall and terracotta-tiled floors.

**The logos are the school's own**, taken from the school website (marlboroughcollegemalaysia.org): the crest beside the school's name and the dashboard's title in the header, on the TVs, in the portal widget, at the top of the editor and as the browser tab and phone home-screen icon, and the white crest with "Marlborough College Malaysia" in the navy footer, as on the website. The colour crest (`images/school-crest-colour.png`, 699×750 with a see-through background) is the one inside the website's colour logo; `images/school-crest.svg` is a sharp one-colour navy version for print or if you prefer it (it turns white on the dark theme). They're set in the editor under Basics → Logo and White logo; if they're removed, the dashboard falls back to its own rain-tree shield (`assets/logo.svg`, `logo-white.svg`, `logo-mark.svg`). Check with the marketing office before printing the crest on posters, as schools usually have rules for how it's used.

**The design follows the school website** (marlboroughcollegemalaysia.org), with white as the main colour:

- **Headings** are big Garamond serif with one word in italics ("Our *projects*", "What's *happening*?"), each with a small label in spaced capitals above it.
- **The opening** has the title, intro and buttons on the left and the banner photo on the right.
- **Photos have square corners**, with a sand-coloured bar peeking out from behind the banner and the About photo.
- **Every project card is the same size**, on the web page and the TVs. Inside each card the title, summary, progress bar and next steps line up with the cards beside it, and long text stops neatly after a few lines (the full text is on the project's own page).
- **Buttons are rounded**, in small spaced capitals, in navy, sky blue, sand or gold.
- **Labels** look like the school's news labels: news dates on lime, project status on sky (in progress), sand (planning), lime (completed) or grey (on hold), and a gold "Most improved" label on the headline number that improved most.
- The eco tip sits in a **lime block** like the website's "Follow us on" box. *Get involved* is a navy tile like its "Looking for admissions?" box.
- **The footer is deep navy** like the website's, with the school's white crest and name, quick links to each section and the contact email.
- **Sections stand apart:** each starts with its label and a thin line across the page, and they alternate between light grey and white.

It also has **school notes** on top, like an exercise book:

- **Gold highlighter lines** under the italic word of every title, a circle round the most improved number and a crown on the league leader.
- **Blue-pen notes** in handwriting: "start here!" with an arrow to the main button, "all getting better!" beside the headline numbers, "2 done already!" beside the projects, and "over halfway!" or "nearly there!" beside a project's progress. They're worked out from your real numbers, so they change by themselves.
- **Blue-pen ticks** on finished projects.
- **New and changed things are marked by themselves**, like a teacher's corrections, for 7 days:
  - **Numbers that change are circled** in blue pen: headline numbers, a project's percentage, its stage label (when it moves from Planning to In progress or Completed) and league scores.
  - **Words that change are underlined** in highlighter: a project's summary, next step or how to help, and the name of a new project, news item or event.
  - **A short note** pinned on a scrap of paper says what happened: "+20!" on a headline number, "+6%!" beside a project's progress, "new!", "done!" when a project is finished, "updated!" or "up 1!" when a house climbs the league.
  - **A key** under the title (and along the bottom of the TVs) says how many things are new or changed this week.

  Nobody has to do anything: each screen remembers what it showed last time and marks whatever is different when new content arrives (TVs check every 10 minutes). News also counts as new for 7 days after its date. Undo a change and its mark goes; after 7 days the marks fade away. Swapping the sample projects for your real ones doesn't circle everything. To see it, open *Preview* from the editor and change a number: it gets circled straight away.
- **The eco tip of the day** is written in pen on a lined exercise-book page, with the red margin line.

The handwriting uses whatever handwriting font the device has (Segoe Print on Windows, Bradley Hand on Macs), so it looks a little different from screen to screen.

Things move smoothly: the opening rises in line by line while the banner photo settles and its sand bar grows out, the highlighter lines draw themselves in and then the pen notes appear, sections slide up as you scroll to them, the big numbers count up, charts draw themselves, progress bars fill, and project pages zoom open. There are lots of little animations too:

- **Moving icons:** each category has its own (lightning flickers, recycling arrows turn, a water drop falls, an apple wobbles, a leaf waves, a bike rides past) and each section has one too (a bell rings, a trophy jumps, a flag flutters).
- **Moving pictures:** the sample campus pictures come alive (flags wave outside the main building, light sweeps across the solar panels, rain trees sway, clouds and birds drift by, the lake shimmers, a cyclist rides past the pavilion, a chicken pecks in the school farm, rain fills the tank, a battery drops into the bin). **Your real photos won't move, and that's normal.** The icons keep moving whatever pictures you use.

This is all built in, with no plugins. Anyone whose device has *Reduce motion* turned on gets a still version.

Visitors can switch the web page between white and dark-navy colours with the sun/moon button in the menu bar; their browser remembers it (TVs and the portal keep the colours set in the Screens tab).

Under *About this data*, **Download the numbers** gives a spreadsheet (CSV) of every number on the page: headline numbers, each project's start, now and target, every chart's values and the league. It opens in Excel, Numbers or Google Sheets, ready for maths, geography or science lessons.

It's built to be easy for everyone to use: text and buttons are dark or light enough to read in both the white and dark-navy colours, every photo can have a description for screen readers, keyboard users get a **Skip to the dashboard** link and can open and close project pages without a mouse, and search results are read out ("3 projects match").

The content follows public data dashboards: numbers compared with last time, status tags, and an "About this data" section.

One set of files gives you:

| View | Address (add to the end of the dashboard link) | Where it's used |
|---|---|---|
| **Normal page** | `index.html` | Link in the pupil portal, laptops, phones |
| **One project's page** | `index.html#project=tree-planting` | Share a project, or put a QR code on a poster |
| **TV screen** | `index.html?mode=tv` | Corridor and canteen TVs. No scrolling. The headline numbers sit in a slim strip along the top, so the projects get most of the screen: 3 big cards at a time, each with its photo, summary, progress, next step and how to help. Then a page of photos, a page of charts, and the league with upcoming events. Every page uses the same columns as the strip along the bottom, so all the edges line up, and the text is in four big sizes (nothing smaller than about 20px on a 1080p TV). It's calm and plain like a printed school notice (the crest and title over a rule, labels in ordinary words, no pills, doodles or bouncing), but in colour: each project card, headline number, chart and panel is tinted in its category's colour (energy gold, nature green, water blue and so on) with a bright colour bar on top, so categories can be told apart from across the corridor |
| **TV mode button** | The **TV mode** button at the top of the web page (and in the footer) | Shows anyone what the TVs show. Move the mouse to get **Full screen** and **Exit TV mode** buttons; Esc also goes back. Handy for plugging a laptop into a TV or projector |
| **TV, more projects at once** | `index.html?mode=tv&cards=4` | 4 projects per page (each shows its next step but not "how to help") |
| **TV, one project at a time** | `index.html?mode=tv&cards=1` | One big photo and project per screen, for large or far-away TVs |
| **Portal embed** | `index.html?mode=embed` | Inside a school portal page |
| **Portal widget** | `index.html?mode=embed&view=summary` | Small summary box for a portal home page |
| **Editor** | `editor.html` | Where our group updates the content |

> **For IT:** everything you need is in [IT-SETUP.md](IT-SETUP.md).

---

## How it works

```
  Our group                      IT                         Everyone
 ┌───────────────┐   file    ┌────────────────┐        ┌───────────────────┐
 │  editor.html  │ ───────►  │  data/          │ ─────► │ Portal · TVs ·    │
 │  edit, preview│ download  │  dashboard-     │ every  │ phones update     │
 │  and download │           │  data.js        │ 10 min │ automatically     │
 └───────────────┘           └────────────────┘        └───────────────────┘
```

- **All the content** (projects, photos, numbers, news, events, charts) lives in one file: `data/dashboard-data.js`.
- **You never have to edit code.** Use the editor page and it writes that file for you.
- Screens check for new content every 10 minutes, so there's nothing to restart.
- If something goes wrong with the file, screens keep showing the last good version instead of going blank.
- Any section you leave empty (no events, no league, no charts) is simply hidden.

IT can also switch it to read from a **Google Sheet** instead, so our group can update it directly without sending files (see IT-SETUP.md, section 6).

---

## Updating the dashboard

1. Open **editor.html** (same address as the dashboard, with `editor.html` on the end).
2. Make your changes. They're saved in your browser as you type.
3. Click **Preview** to check how it looks, and **TV preview** to see it as the TVs will. The box *What the screens will mark as new* lists everything you've changed that the screens will circle or underline.
4. When you're happy, click **Execute changes** in the bar along the bottom (it appears as soon as you change something, with how many changes aren't on the screens yet). The first time, choose the dashboard's `data` folder (IT will tell you which); the editor remembers it. Every TV and web page shows your changes within about 30 seconds, with what changed circled or underlined. The editor keeps the last version in that folder as `dashboard-data.previous.js`, so nothing is lost.
5. Changed your mind? **Discard changes**, next to it, goes back to what's on the screens now. To undo just one thing, click **Put back** beside it in *What the screens will mark as new*.

**Deleted something by mistake?** Click **Undo** in the message that pops up, or press Ctrl+Z (Cmd+Z on a Mac) when you're not typing in a box. Undo also works after Put back, Discard changes and Open a file.

**Published something by mistake?** In the Screens tab, **Go back to the previous version** loads the version from before the last Execute changes. Look it over, then click Execute changes to put it back on the screens.

There's no need to press Ctrl+S: the editor saves your work in the browser as you type (pressing it just says so). With more than 6 projects, a **Find a project** box at the top of the Projects tab narrows the list.

Execute changes saves straight into the folder in Chrome and Edge. In other browsers, or if IT hasn't given you a folder, it downloads `dashboard-data.js` instead (so does **Download data file** at the top): send that file to IT, who put it in the `data` folder. Nothing changes on the screens until you execute, so you can try things without breaking anything.

**Using a different computer?** Click **Open a file** in the editor and choose the `dashboard-data.js` you downloaded last time.

**Use one editor tab at a time.** Two tabs of the editor in the same browser share one saved draft, so one could overwrite the other. If you open a second tab, both show a warning, and you can load the other tab's latest changes into the one you keep.

The editor has a tab for each part:

| Tab | What's in it |
|---|---|
| Projects | Every project and everything on its page |
| Headline numbers | The 4 big numbers at the top, with the date, last time's number and a picture. Each can be worked out from a project or chart (see below) |
| Over time | Charts, e.g. electricity used each month |
| Latest news | Short updates, newest first, each with a picture and linked to a project if you like |
| Coming up | Events with dates and a picture. Past events disappear by themselves |
| Leaderboard | A competition table, e.g. houses in the farm league, with a crest or picture for each |
| Eco tips | One is shown each day as "Eco tip of the day" |
| Photos | The "Around school" photos, each with a short caption |
| Get involved | How students can join in, with a background photo |
| Basics | Title, opening line, "About this data" and its photo, contact, school colour, the school crest and white logo, banner photo |
| Screens | How every screen shows the dashboard: TV projects per page (1 to 4), seconds per page and per news item, TV and page colours, cards or list, how many days new things stay circled, and TV sleep times (a black screen with a small clock outside school hours, waking by itself). Also the ready-made address for each screen (web page, TV, a TV for only some areas such as the canteen, portal summary and portal page) with a Copy button |

Along the top, **Preview** shows your changes on the web page and **TV preview** shows them as the TVs will. As soon as you change something, a box called **What the screens will mark as new** lists it, e.g. *Plants on the wall: 180 → 240* or *The school farm: next step changed*: these are exactly the things every screen will circle or underline for a week once the file is published. It also lists anything removed. Each line has a **Put back** button that undoes just that change.

Under it, **Worth checking before you publish** lists anything that would look broken or could be better, each with a **Go to it** button:

- **Fix**: a progress number with no target (or one that isn't a number), a link missing `https://`, a headline number with no number, or one worked out from a project or chart that has been deleted. Execute changes asks before publishing these.
- **Check**: photos with no description, events that have already happened, text that may be cut off on TVs, a headline number written as words (e.g. "about 3,400 kWh" instead of 3400 with kWh in the Unit box) or with no date, more than 4 headline numbers (only the first 4 show), the example contact email, and a very large file (usually big photos).

---

## Adding your projects

Right now the dashboard shows **sample projects** so you can see the design. Replace them with ours.

For each project, fill in the fields below. The editor counts the characters as you type and warns you in bold when text is too long to fit the TV cards in big, easy-to-read letters.

| Field | What to write | Example |
|---|---|---|
| Project name | Short and clear, under 40 characters so it fits the TV cards | Solar panels on the Sports Hall |
| Category | Energy, Waste & recycling, Water, Food, Nature, Travel, Community, Other | Energy |
| Status | Planning, In progress, Completed, On hold | In progress |
| What is it? | One sentence a Year 7 would understand, under 85 characters so it fits two lines on the TV. Shown on the card | Installing solar panels on the roof to make our own clean electricity. |
| About this project | **One paragraph** for the project's own page: why it matters, what you're doing, what difference it makes | |
| Who's running it | A group name, **not students' full names** | Eco Committee |
| Started / Aiming to finish | Dates | 7 Sep 2026 / 29 Jan 2027 |
| Next step | What happens next, with a date if possible. Under 60 characters | Second batch of panels arrives after half-term. |
| How students can help | Something a student can actually do. Under 60 characters | Join the energy monitors on Thursdays. |
| Sign-up link | Optional link to a sign-up form. Adds a Sign up button | |
| Progress numbers | What you measure (under 28 characters), the number now, the target and the unit | Panels installed: 24 of 60 panels |
| Photo | A wide (landscape) photo of the project | Solar panels on the roof |
| More photos | Up to 6 extra photos for the project's page, e.g. before and after | |
| Milestones | The big steps, with dates. Tick the ones that are done | Proposal approved ✓, First 24 panels ✓, Second batch, Connected |
| Featured | Tick to show it first, with a gold "Featured" label on its photo | |

### Each project's own page

Click any project to open its page. It shows the photos, the "About this project" paragraph, the milestones as a big numbered timeline (the next one is marked **Next**), upcoming events and news linked to the project, progress, how to help, and the dates.

Every project page has its own link, shown in the editor (for example `index.html#project=solar-sports-hall`). Put it after the dashboard's address to share it. On a phone, the **Share this project** button on the project's page opens the phone's own share menu (WhatsApp, Teams, email and so on); on a computer it copies the link.

### QR codes

The dashboard makes its own QR codes, so you don't need another website:

- **Get involved:** put a sign-up link in the Get involved tab and a QR code for it appears on the web page and on every TV, so people walking past can scan it.
- **Project pages** have a QR code that opens the page on a phone.
- **For posters:** each project in the editor has a **QR code** button, and so does the web page address in the Screens tab. Each downloads a big, sharp picture to print or put in a document.

QR codes only work once the dashboard is online, because a phone needs a web address to open (they don't appear when the dashboard is opened from a file).

### Printing

Print the web page (Ctrl+P, or Cmd+P on a Mac) for a short report for a noticeboard or newsletter: the headline numbers in a row, every project three to a row without photos, the charts as tables of numbers, and a QR code to the live dashboard at the top. With a project's page open, it prints just that project on one page, with its QR code: a ready-made poster.

### Photos

- In the editor, open a project and click **Choose photo**. Pick any photo from your computer. Headline numbers, news, events, the league, About and Get involved have the same button.
- Quicker: **drag a photo** from your desktop or another window onto the picture box, or copy a photo, click the picture box and **paste** it (Ctrl+V, or Cmd+V on a Mac).
- For the "Around school" album, use the **Photos** tab: add as many as you like (up to 24) with a one-line caption. The first 5 show in the album (the first one big), and *See all photos* opens every one full screen. The first 3 also appear on the TVs.
- It's shrunk automatically and saved inside the data file, so there are no extra files to send.
- **Wide (landscape) photos look best.** The middle of the photo is what shows on the cards, so keep the important part in the centre.
- **Photos of the project itself are best** (panels, gardens, bins, posters). Only use photos with people in them if everyone shown has agreed, following the school's photo rules.
- **Real photos make the biggest difference.** The cartoon pictures in the sample are stand-ins and make it look less real.
- No photo yet? The card shows a plain grey box saying "No photo yet". Elsewhere, an empty picture space shows a small picture icon.
- iPhone photos sometimes won't open in Chrome. If that happens, share or export the photo as JPG first.

### Progress numbers

- **Counting up** (trees planted, panels installed): fill in *Now* and *Target*. Leave *Start* empty.
  Example: Now 320, Target 500, Unit trees, shown as **64%**.
- **Cutting down** (electricity used, waste sent to landfill): also fill in *Start*.
  Example: Start 52,000, Now 48,600, Target 45,000, Unit kWh, shown as **49%** of the way there.
- **No numbers yet?** Leave them empty and the card shows which stage the project is at (Planning, In progress, Completed).
- Going past the target is fine: it shows "Target reached" or, e.g., "128% of target".

---

## The other sections

- **Headline numbers work themselves out.** Under *Work this number out from*, pick a project or a chart and how to use it:
  - **A project's "Now" number**, e.g. *Trees planted* = the tree project's 320.
  - **How far a project has moved, from Start to Now**, e.g. *Electricity saved* = an energy-saving project's 52,000 kWh at the start minus 48,600 kWh now = 3,400 kWh.
  - **A chart's latest value**, or **all its values added up**, e.g. *Rainwater collected* = every month of *Rainwater collected each month* added up.
  - **Multiply by** turns units round, e.g. 0.001 turns the compost project's kg into tonnes.

  The number, its date and the change (↑ +79%) then update by themselves whenever someone updates that project or chart, so nobody types the same number twice. The editor shows the answer as you choose, and each number on the web page says "Worked out from …" with a link to the project or chart. A number worked out from a chart is compared with the chart's value before its latest one, unless you fill in *Number last time*. All four sample numbers are worked out like this.
- **Headline numbers you type in:** for each one, add the date it was counted ("Up to"), and last time's number and what that was ("last term"). Each card then shows the change as a badge, e.g. **↑ +79%**, on lime if it's good news and red if not, with two bars comparing last time with now. The one that improved most gets a gold "Most improved" label. Choose "Lower is better" for things like electricity used.
- **Over time (charts):** add a number each week or month, oldest first. Say which way is good, and add a target if you have one (shown as a dashed line). The chart shows whether things are improving, and has a "See the numbers" table underneath.
- **Coming up:** add events with a date (and time and place if you know them). The dashboard counts down ("In 3 days") and hides events once they've passed. Link an event to a project and it also appears on that project's page.
- **Latest news:** link news to a project and it also appears on that project's page.
- **Leaderboard:** sorted by score automatically. Leave it empty to hide it.
- **Eco tips:** a different one each day.
- **About this data (Basics tab):** say where the numbers come from, who collects them and how often you update the dashboard, and give a group or staff contact email. Real dashboards always have this, and it helps people trust the numbers.

### School colour, logo and banner

All in the editor's **Basics** tab:

- **Main colour:** the school colour, used for the header bar, buttons and the TV header. Text switches between white and dark automatically so it's always readable. It starts as the school's navy; *Back to school navy* undoes any change.
- **Logo:** the school's colour crest (`images/school-crest-colour.png`), next to the dashboard's name at the top of every screen. A navy one-colour version is in `images/school-crest.svg`. Remove it to use the dashboard's own tree shield instead.
- **White logo:** the school's white crest and name (`images/school-logo-white.svg`), in the navy footer.
- **Banner photo:** a wide photo shown under the title, with its description as a caption.

### Tips for good content

- **Keep it short.** TVs are read by people walking past. Long text gets cut off.
- **Add a real photo to every project** if you can.
- **Use real, measurable numbers.** Say when they were counted and compare them with last time.
- **Make numbers relatable** in the small note, e.g. "about the same as 300 phone charges".
- **Update the news and events** at least every couple of weeks so the dashboard feels alive.
- **No personal information.** Use group names, not names of individual students.

---

## Before it goes live: checklist

- [ ] All sample projects replaced with ours
- [ ] Sample pictures replaced with real photos everywhere: projects, headline numbers, news, events, league, Photos tab, About and Get involved (or removed)
- [ ] Headline numbers, charts, events, league and tips replaced with real ones (or removed)
- [ ] School name, "Run by", "About this data" and contact filled in (Basics tab)
- [ ] "Get involved" message filled in
- [ ] School colour, logo and banner photo set (Basics tab), or the sample banner removed
- [ ] **"This is sample content" unticked** in the Basics tab (this removes the yellow "Sample content" label)
- [ ] Previewed on the normal view, a project page and the TV view
- [ ] File downloaded and sent to IT

---

## What's in this folder

| File | What it is | Who changes it |
|---|---|---|
| `index.html` | The dashboard | Nobody (unless changing the design) |
| `editor.html` | The editor | Nobody |
| `data/dashboard-data.js` | **All the content** | Replaced by the file from the editor |
| `config.js` | Settings (Google Sheet, refresh time, TV timing) | IT |
| `assets/` | Design and code | Only to change the design |
| `images/` | Sample pictures (and any pictures IT uploads) | IT |
| `google-sheet-template/` | Starter tabs if IT uses the Google Sheet option | IT, once |
| `portal-embed-example.html` | Shows IT how embedding in the portal looks | Nobody |
| `IT-SETUP.md` | Setup guide for IT | |
