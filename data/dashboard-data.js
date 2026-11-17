/*
  Sustainability Dashboard: content
  ------------------------------------------------------------------
  Our five projects: the living wall, rainwater from the roofs, solar
  panels, the school farm and this dashboard.

  Solar panels and the farm are already here; the wall and the rain tanks are
  proposals. The numbers, dates and news below are SAMPLE content to show the design
  (the pictures in images/sample-*.svg are sample illustrations too).
  Replace them with your real readings before the dashboard goes live.

  Easiest way to edit: open editor.html, make your changes, click
  "Download data file", and replace this file with the one you get.
*/
window.DASHBOARD_DATA = {
  "isSampleData": true,
  "school": {
    "name": "Marlborough College Malaysia",
    "logo": "images/school-crest-colour.png",
    "logoWhite": "images/school-logo-white.svg",
    "color": ""
  },
  "dashboard": {
    "title": "Sustainability Dashboard",
    "tagline": "Five projects making our school greener: what they are, how they are doing, and how you can help.",
    "banner": "images/sample-banner.svg",
    "bannerAlt": "Illustration of the main school building, with solar panels on the roof and rain trees by the lake",
    "about": "Every number here is measured or worked out by pupils. Living wall plants are counted on the first Monday of each month. Rainwater is read from the water meter on each tank. Solar electricity is our estimate, worked out from the area of the panels, until the real meter readings replace it. Farm harvests are weighed on kitchen scales. The Sustainability Group checks the readings and updates this dashboard every two weeks.",
    "aboutImage": "images/sample-dashboard.svg",
    "contact": "sustainability@yourschool.example",
    "lastUpdated": "2026-11-15",
    "madeBy": "The Sustainability Group, with the IT Department"
  },
  "stats": [
    {
      "label": "Plants on the living wall",
      "value": 180,
      "unit": "",
      "note": "counted this month",
      "icon": "nature",
      "asOf": "2026-11-02",
      "previous": 120,
      "compareLabel": "last month",
      "direction": "up",
      "source": "project:living-wall",
      "calc": "now",
      "image": "images/sample-living-wall.svg"
    },
    {
      "label": "Rainwater collected",
      "value": 9900,
      "unit": "litres",
      "note": "since July",
      "icon": "water",
      "asOf": "2026-10-31",
      "previous": null,
      "compareLabel": "",
      "direction": "up",
      "source": "chart:Rainwater collected each month",
      "calc": "total",
      "image": "images/sample-rain.svg"
    },
    {
      "label": "Solar electricity made",
      "value": 735930,
      "unit": "kWh",
      "note": "since June (our estimate)",
      "icon": "energy",
      "asOf": "2026-10-31",
      "previous": null,
      "compareLabel": "",
      "direction": "up",
      "source": "chart:Solar electricity made each month",
      "calc": "total",
      "image": "images/sample-solar.svg"
    },
    {
      "label": "Food grown on the farm",
      "value": 68,
      "unit": "kg",
      "note": "since June",
      "icon": "food",
      "asOf": "2026-10-31",
      "previous": null,
      "compareLabel": "",
      "direction": "up",
      "source": "chart:Food harvested each month",
      "calc": "total",
      "image": "images/sample-garden.svg"
    }
  ],
  "projects": [
    {
      "id": "living-wall",
      "title": "The living wall",
      "category": "nature",
      "status": "in-progress",
      "summary": "Hanging plants and flowers on the school walls, to cool the building and bring in bees and butterflies.",
      "story": "A bare wall soaks up the sun all day and heats the rooms behind it. A living wall covers it with hanging planters full of ferns, pothos and flowers. The leaves shade the wall, the flowers feed bees and butterflies, and a grey wall turns green. Pupils plant it, water it and count the plants every month.",
      "team": "Eco Committee and Grounds team",
      "metricLabel": "Plants on the wall",
      "metricStart": "",
      "metricCurrent": 180,
      "metricTarget": 400,
      "metricUnit": "plants",
      "nextStep": "The next planting session adds 60 more plants.",
      "startDate": "2026-09-07",
      "endDate": "2027-03-26",
      "milestones": [
        {
          "title": "Wall chosen and frames put up",
          "date": "2026-09-18",
          "done": true
        },
        {
          "title": "First 120 plants in",
          "date": "2026-10-05",
          "done": true
        },
        {
          "title": "180 plants counted",
          "date": "2026-11-02",
          "done": true
        },
        {
          "title": "Drip watering line fitted",
          "date": "2026-12-04",
          "done": false
        },
        {
          "title": "All 400 plants in",
          "date": "2027-03-26",
          "done": false
        }
      ],
      "getInvolved": "Adopt a planter: water it, and count it each month.",
      "helpLink": "",
      "image": "images/sample-living-wall.svg",
      "imageAlt": "Illustration of a school wall covered in hanging plants and flowers",
      "gallery": [],
      "featured": true,
      "updated": "2026-11-02"
    },
    {
      "id": "rainwater-harvesting",
      "title": "Rainwater from the roofs",
      "category": "water",
      "status": "in-progress",
      "summary": "Tanks that collect the rain from our roofs, to water the plants, the farm and the pitches.",
      "story": "It rains a lot here, and most of it runs straight off the roofs and down the drain. Gutters now lead that rain into tanks instead. We use it to water the living wall, the farm and the pitches, so we use less mains water. Each tank has a water meter on its tap, so we know exactly how much rain we have used.",
      "team": "Year 12 Design and Technology",
      "metricLabel": "Tanks installed",
      "metricStart": "",
      "metricCurrent": 2,
      "metricTarget": 4,
      "metricUnit": "tanks",
      "nextStep": "Tanks 3 and 4 go in next to the farm in December.",
      "startDate": "2026-06-08",
      "endDate": "2027-01-29",
      "milestones": [
        {
          "title": "Roofs measured",
          "date": "2026-06-19",
          "done": true
        },
        {
          "title": "First tank collecting rain",
          "date": "2026-07-06",
          "done": true
        },
        {
          "title": "Second tank collecting rain",
          "date": "2026-08-24",
          "done": true
        },
        {
          "title": "Tanks 3 and 4 installed",
          "date": "2026-12-04",
          "done": false
        }
      ],
      "getInvolved": "Use the rainwater taps when you water the plants.",
      "helpLink": "",
      "image": "images/sample-rain.svg",
      "imageAlt": "Illustration of a rainwater tank next to a building",
      "gallery": [],
      "featured": false,
      "updated": "2026-10-31"
    },
    {
      "id": "solar-panels",
      "title": "Solar panels",
      "category": "energy",
      "status": "completed",
      "summary": "Solar panels on nine of the school's roofs, turning sunshine into electricity for the school.",
      "story": "The school already has solar panels on nine roofs, from the Senior Sports Hall to Pre-Prep. We measured them on Google Earth: about 4,810 square metres of panels. They turn sunshine into electricity that the school uses straight away, so it buys less from the grid. From the area of the panels, we estimate that they make about 4,810 kWh a day: around a third of the electricity the school uses. That is our estimate. The real meter readings will replace it.",
      "team": "The school, with numbers from the Sustainability Group",
      "metricLabel": "Roofs with panels",
      "metricStart": "",
      "metricCurrent": 9,
      "metricTarget": 9,
      "metricUnit": "roofs",
      "nextStep": "Swap our estimate for the real meter readings.",
      "startDate": "",
      "endDate": "",
      "milestones": [
        {
          "title": "Solar panels fitted on nine roofs",
          "date": "",
          "done": true
        },
        {
          "title": "Panels measured from above: 4,810 square metres",
          "date": "2026-11-13",
          "done": true
        },
        {
          "title": "Electricity estimated: about 4,810 kWh a day",
          "date": "2026-11-14",
          "done": true
        },
        {
          "title": "Real meter readings on the dashboard",
          "date": "",
          "done": false
        }
      ],
      "getInvolved": "Spot the panels: nine roofs have them. How many can you find?",
      "helpLink": "",
      "image": "images/sample-solar.svg",
      "imageAlt": "Illustration of solar panels on a school roof",
      "gallery": [
        {
          "image": "images/sample-banner.svg",
          "imageAlt": "Illustration of the school with solar panels on the roof"
        }
      ],
      "featured": true,
      "updated": "2026-11-14"
    },
    {
      "id": "school-farm",
      "title": "The school farm",
      "category": "food",
      "status": "in-progress",
      "summary": "The school farm is built and growing: food from the school's own soil, weighed at every harvest.",
      "story": "The school farm is already built and growing. Pupils help to plant it, water it and pick it, and what is picked can go to the dining hall and to food lessons. Every harvest is weighed before it leaves the farm, so the whole school can see how much food it grows.",
      "team": "Farm Club and the dining hall team",
      "metricLabel": "Food grown this year",
      "metricStart": "",
      "metricCurrent": 68,
      "metricTarget": 150,
      "metricUnit": "kg",
      "nextStep": "Weigh every harvest and add it to the total.",
      "startDate": "",
      "endDate": "2027-07-02",
      "milestones": [
        {
          "title": "Farm built and planted",
          "date": "",
          "done": true
        },
        {
          "title": "First harvest weighed",
          "date": "2026-06-12",
          "done": true
        },
        {
          "title": "50 kg grown",
          "date": "2026-10-09",
          "done": true
        },
        {
          "title": "100 kg grown",
          "date": "2027-01-22",
          "done": false
        },
        {
          "title": "150 kg grown",
          "date": "2027-07-02",
          "done": false
        }
      ],
      "getInvolved": "Come to Farm Club, or help weigh the next harvest.",
      "helpLink": "",
      "image": "images/sample-garden.svg",
      "imageAlt": "Illustration of vegetable beds and a compost bin",
      "gallery": [],
      "featured": false,
      "updated": "2026-10-31"
    },
    {
      "id": "sustainability-dashboard",
      "title": "The Sustainability Dashboard",
      "category": "community",
      "status": "in-progress",
      "summary": "One place that shows how every project is doing, on the school website and the TVs.",
      "story": "Four projects, four sets of numbers, and nobody could see them together. This dashboard is the fifth project: it puts every project and every number in one place. It is shown on the school website, on the TVs around school and in the pupil portal. The Sustainability Group updates it every two weeks.",
      "team": "The Sustainability Group, with the IT Department",
      "metricLabel": "Screens showing it",
      "metricStart": "",
      "metricCurrent": 2,
      "metricTarget": 6,
      "metricUnit": "screens",
      "nextStep": "The dashboard is launched in assembly.",
      "startDate": "2026-09-07",
      "endDate": "2026-12-11",
      "milestones": [
        {
          "title": "Design agreed",
          "date": "2026-09-25",
          "done": true
        },
        {
          "title": "All four projects added",
          "date": "2026-11-06",
          "done": true
        },
        {
          "title": "Launch in assembly",
          "date": "2026-11-27",
          "done": false
        },
        {
          "title": "On every school TV",
          "date": "2026-12-11",
          "done": false
        }
      ],
      "getInvolved": "Have a number, a photo or some news? Tell the Sustainability Group.",
      "helpLink": "",
      "image": "images/sample-dashboard.svg",
      "imageAlt": "Illustration of the dashboard on a screen in a school corridor",
      "gallery": [],
      "featured": false,
      "updated": "2026-11-06"
    }
  ],
  "trends": [
    {
      "title": "Rainwater collected each month",
      "unit": "litres",
      "icon": "water",
      "direction": "up",
      "target": null,
      "note": "Read from the water meter on each tank.",
      "points": [
        {
          "label": "Jul",
          "value": 1350
        },
        {
          "label": "Aug",
          "value": 2100
        },
        {
          "label": "Sep",
          "value": 2850
        },
        {
          "label": "Oct",
          "value": 3600
        }
      ]
    },
    {
      "title": "Solar electricity made each month",
      "unit": "kWh",
      "icon": "energy",
      "direction": "up",
      "target": null,
      "note": "Our estimate: 4,810 square metres of panels, 20% efficiency, 5 hours of full sun a day.",
      "points": [
        {
          "label": "Jun",
          "value": 144300
        },
        {
          "label": "Jul",
          "value": 149110
        },
        {
          "label": "Aug",
          "value": 149110
        },
        {
          "label": "Sep",
          "value": 144300
        },
        {
          "label": "Oct",
          "value": 149110
        }
      ]
    },
    {
      "title": "Food harvested each month",
      "unit": "kg",
      "icon": "food",
      "direction": "up",
      "target": null,
      "note": "Every harvest is weighed on kitchen scales.",
      "points": [
        {
          "label": "Jun",
          "value": 6
        },
        {
          "label": "Jul",
          "value": 11
        },
        {
          "label": "Aug",
          "value": 9
        },
        {
          "label": "Sep",
          "value": 18
        },
        {
          "label": "Oct",
          "value": 24
        }
      ]
    }
  ],
  "updates": [
    {
      "date": "2026-11-14",
      "text": "We measured the school's solar panels from above: about 4,810 square metres on nine roofs. Our estimate is 4,810 kWh a day.",
      "category": "energy",
      "project": "solar-panels",
      "image": "images/sample-solar.svg"
    },
    {
      "date": "2026-11-06",
      "text": "All four projects are now on the dashboard, ready for the launch in assembly.",
      "category": "community",
      "project": "sustainability-dashboard",
      "image": "images/sample-dashboard.svg"
    },
    {
      "date": "2026-11-02",
      "text": "180 plants counted on the living wall, 60 more than last month.",
      "category": "nature",
      "project": "living-wall",
      "image": "images/sample-living-wall.svg"
    },
    {
      "date": "2026-10-31",
      "text": "3,600 litres of rainwater used in October, all of it on the farm and the living wall.",
      "category": "water",
      "project": "rainwater-harvesting",
      "image": "images/sample-rain.svg"
    },
    {
      "date": "2026-10-30",
      "text": "24 kg picked on the farm in October, the best month so far.",
      "category": "food",
      "project": "school-farm",
      "image": "images/sample-garden.svg"
    }
  ],
  "events": [
    {
      "date": "2026-11-18",
      "time": "13:15",
      "title": "Living wall planting session",
      "place": "At the living wall",
      "project": "living-wall",
      "category": "nature",
      "image": "images/sample-living-wall.svg"
    },
    {
      "date": "2026-11-21",
      "time": "09:00",
      "title": "Farm harvest morning",
      "place": "School farm",
      "project": "school-farm",
      "category": "food",
      "image": "images/sample-garden.svg"
    },
    {
      "date": "2026-11-27",
      "time": "08:30",
      "title": "Dashboard launch",
      "place": "Assembly, Main Hall",
      "project": "sustainability-dashboard",
      "category": "community",
      "image": "images/sample-dashboard.svg"
    },
    {
      "date": "2026-12-04",
      "time": "",
      "title": "Rainwater tanks 3 and 4 installed",
      "place": "Next to the farm",
      "project": "rainwater-harvesting",
      "category": "water",
      "image": "images/sample-rain.svg"
    }
  ],
  "leaderboard": {
    "title": "Farm league: harvest by house",
    "unit": "kg",
    "note": "Each house looks after a bed. Every harvest is weighed and added to the house's total.",
    "entries": [
      {
        "name": "Wallace",
        "score": 20,
        "image": ""
      },
      {
        "name": "Honan",
        "score": 18,
        "image": ""
      },
      {
        "name": "Thompson",
        "score": 16,
        "image": ""
      },
      {
        "name": "Wills",
        "score": 14,
        "image": ""
      }
    ]
  },
  "tips": [
    "Watering plants? Use the rainwater taps, not the mains taps.",
    "Scrape leftover food into the green bins. It becomes compost for the farm.",
    "Last one out of a room? Switch off the lights, screens and air-con.",
    "Passing the living wall? Look, but don't pick: the flowers are for the bees.",
    "Bring a reusable bottle, and fill it up at school.",
    "Take only the food you'll eat. You can always go back for more."
  ],
  "gallery": [
    {
      "image": "images/sample-living-wall.svg",
      "caption": "The living wall, three months after planting"
    },
    {
      "image": "images/sample-rain.svg",
      "caption": "A rainwater tank, with the meter on its tap"
    },
    {
      "image": "images/sample-solar.svg",
      "caption": "Solar panels on the Sports Hall roof"
    },
    {
      "image": "images/sample-garden.svg",
      "caption": "The school farm"
    },
    {
      "image": "images/sample-dashboard.svg",
      "caption": "The dashboard on a corridor TV"
    }
  ],
  "getInvolved": {
    "heading": "Get involved",
    "text": "Join the Sustainability Group: Tuesdays at lunchtime. Everyone is welcome.",
    "link": "",
    "linkLabel": "Find out more",
    "qrImage": "",
    "image": "images/sample-living-wall.svg"
  }
};
