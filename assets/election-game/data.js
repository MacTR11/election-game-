/* ============================================================================
 * NUMBER 10 — UK Election & Government Simulator
 * data.js — real-world data layer (parties, regions, voter groups, policies,
 *           events, poll presets). Loaded as a classic script; exposes
 *           window.UKGAME.DATA so the game works from file:// and GitHub Pages.
 *
 * Electoral baseline: UK General Election, 4 July 2024 (650 seats).
 * Regional vote shares are approximations of the published regional results
 * and are used to drive a regional first-past-the-post seat model.
 * ==========================================================================*/
(function () {
  "use strict";
  window.UKGAME = window.UKGAME || {};

  /* ---- small helpers for declaring policy effects ----
   * v is the normalised slider value in [0, 1].
   * lin(k)      -> contribution centred on the slider midpoint (0.5)
   * linN(k, n)  -> contribution centred on a custom neutral point n
   * Returned deltas are added by the engine; keep them modest (|x| < ~0.4). */
  function lin(k) { return function (v) { return k * (v - 0.5); }; }
  function linN(k, n) { return function (v) { return k * (v - n); }; }

  // ---------------------------------------------------------------------------
  // PARTIES
  // economic: -1 (left) .. +1 (right)   social: -1 (liberal) .. +1 (authoritarian)
  // ---------------------------------------------------------------------------
  var PARTIES = {
    lab:      { id: "lab",      name: "Labour",                short: "LAB", color: "#e4003b", econ: -0.5, soc: -0.2, playable: true },
    con:      { id: "con",      name: "Conservative",          short: "CON", color: "#0087dc", econ:  0.6, soc:  0.4, playable: true },
    ld:       { id: "ld",       name: "Liberal Democrats",     short: "LD",  color: "#faa61a", econ: -0.1, soc: -0.5, playable: true },
    reform:   { id: "reform",   name: "Reform UK",             short: "RFM", color: "#12b6cf", econ:  0.5, soc:  0.8, playable: true },
    green:    { id: "green",    name: "Green Party",           short: "GRN", color: "#02a95b", econ: -0.7, soc: -0.6, playable: true },
    snp:      { id: "snp",      name: "Scottish National Party",short:"SNP", color: "#fdf38e", econ: -0.4, soc: -0.3, playable: true, nation: "sct" },
    pc:       { id: "pc",       name: "Plaid Cymru",           short: "PC",  color: "#005b54", econ: -0.5, soc: -0.3, playable: true, nation: "wal" },
    dup:      { id: "dup",      name: "DUP",                   short: "DUP", color: "#d46a4c", econ:  0.4, soc:  0.7, nation: "ni" },
    sf:       { id: "sf",       name: "Sinn Féin",             short: "SF",  color: "#326760", econ: -0.5, soc: -0.2, nation: "ni" },
    alliance: { id: "alliance", name: "Alliance",              short: "APNI",color: "#f6cb2f", econ:  0.0, soc: -0.4, nation: "ni" },
    uup:      { id: "uup",      name: "UUP",                   short: "UUP", color: "#48a5ee", econ:  0.3, soc:  0.4, nation: "ni" },
    sdlp:     { id: "sdlp",     name: "SDLP",                  short: "SDLP",color: "#2aa82c", econ: -0.3, soc: -0.2, nation: "ni" },
    oth:      { id: "oth",      name: "Others / Independents",  short: "OTH", color: "#9aa0a6", econ:  0.0, soc:  0.0 }
  };

  // ---------------------------------------------------------------------------
  // NATIONS / REGIONS — seat counts sum to 650; shares are 2024 approximations.
  // ---------------------------------------------------------------------------
  var REGIONS = [
    { id: "ne",  name: "North East",            nation: "eng", seats: 27,
      shares: { lab: 41, con: 18, reform: 18, ld: 6,  green: 7,  oth: 10 } },
    { id: "nw",  name: "North West",            nation: "eng", seats: 73,
      shares: { lab: 43, con: 20, reform: 14, ld: 9,  green: 6,  oth: 8 } },
    { id: "yh",  name: "Yorkshire & The Humber", nation: "eng", seats: 54,
      shares: { lab: 39, con: 22, reform: 17, ld: 8,  green: 7,  oth: 7 } },
    { id: "em",  name: "East Midlands",         nation: "eng", seats: 47,
      shares: { lab: 34, con: 27, reform: 18, ld: 8,  green: 5,  oth: 8 } },
    { id: "wm",  name: "West Midlands",         nation: "eng", seats: 57,
      shares: { lab: 36, con: 26, reform: 17, ld: 7,  green: 6,  oth: 8 } },
    { id: "ee",  name: "East of England",       nation: "eng", seats: 61,
      shares: { lab: 30, con: 28, reform: 15, ld: 14, green: 7,  oth: 6 } },
    { id: "lon", name: "London",                nation: "eng", seats: 75,
      shares: { lab: 43, con: 22, reform: 8,  ld: 12, green: 11, oth: 4 } },
    { id: "se",  name: "South East",            nation: "eng", seats: 91,
      shares: { lab: 28, con: 30, reform: 13, ld: 18, green: 8,  oth: 3 } },
    { id: "sw",  name: "South West",            nation: "eng", seats: 58,
      shares: { lab: 27, con: 29, reform: 13, ld: 20, green: 8,  oth: 3 } },
    { id: "sct", name: "Scotland",              nation: "sct", seats: 57,
      shares: { snp: 30, lab: 35, con: 13, ld: 10, reform: 7,  green: 4, oth: 1 } },
    { id: "wal", name: "Wales",                 nation: "wal", seats: 32,
      shares: { lab: 37, pc: 15, con: 18, reform: 17, ld: 6,  green: 5, oth: 2 } },
    { id: "ni",  name: "Northern Ireland",      nation: "ni",  seats: 18,
      shares: { sf: 27, dup: 22, alliance: 15, uup: 12, sdlp: 11, oth: 13 } }
  ];

  var NATIONS = {
    eng: "England", sct: "Scotland", wal: "Wales", ni: "Northern Ireland"
  };

  // ---------------------------------------------------------------------------
  // VOTER GROUPS — size is share of the electorate (groups overlap, so they do
  // not sum to 100). Each has a baseline contentment and ideological leaning.
  // ---------------------------------------------------------------------------
  var GROUPS = [
    { id: "pensioners",   name: "Pensioners",         size: 23, base: 0.55, econ:  0.2, soc:  0.4 },
    { id: "young",        name: "Young Voters (18-30)",size: 18, base: 0.45, econ: -0.3, soc: -0.5 },
    { id: "parents",      name: "Parents",            size: 30, base: 0.50, econ:  0.0, soc:  0.1 },
    { id: "students",     name: "Students",           size: 8,  base: 0.45, econ: -0.4, soc: -0.5 },
    { id: "workingclass", name: "Working Class",      size: 35, base: 0.48, econ: -0.3, soc:  0.2 },
    { id: "middleclass",  name: "Middle Class",       size: 38, base: 0.52, econ:  0.1, soc: -0.1 },
    { id: "wealthy",      name: "High Earners",       size: 9,  base: 0.55, econ:  0.6, soc:  0.0 },
    { id: "poor",         name: "Low Income",         size: 22, base: 0.40, econ: -0.5, soc:  0.0 },
    { id: "homeowners",   name: "Homeowners",         size: 45, base: 0.55, econ:  0.3, soc:  0.1 },
    { id: "renters",      name: "Renters",            size: 30, base: 0.42, econ: -0.3, soc: -0.2 },
    { id: "publicsector", name: "Public Sector",      size: 17, base: 0.48, econ: -0.3, soc: -0.1 },
    { id: "privatesector",name: "Private Sector",     size: 40, base: 0.50, econ:  0.2, soc:  0.0 },
    { id: "selfemployed", name: "Self-Employed",      size: 13, base: 0.50, econ:  0.4, soc:  0.1 },
    { id: "motorists",    name: "Motorists",          size: 50, base: 0.52, econ:  0.2, soc:  0.2 },
    { id: "environment",  name: "Environmentalists",  size: 20, base: 0.45, econ: -0.4, soc: -0.4 },
    { id: "patriots",     name: "Patriots",           size: 28, base: 0.50, econ:  0.3, soc:  0.7 },
    { id: "liberals",     name: "Social Liberals",    size: 26, base: 0.48, econ: -0.1, soc: -0.7 },
    { id: "socialists",   name: "Socialists",         size: 16, base: 0.45, econ: -0.8, soc: -0.2 },
    { id: "capitalists",  name: "Business / Capital",  size: 14, base: 0.50, econ:  0.7, soc:  0.1 },
    { id: "religious",    name: "Religious Voters",   size: 20, base: 0.50, econ:  0.1, soc:  0.4 },
    { id: "minorities",   name: "Ethnic Minorities",  size: 16, base: 0.48, econ: -0.2, soc: -0.3 },
    { id: "unions",       name: "Trade Unionists",    size: 12, base: 0.45, econ: -0.6, soc: -0.1 }
  ];

  // ---------------------------------------------------------------------------
  // STATS — the simulated state of the country. value in [0,1].
  // higherIsBetter flags whether a high value is good (for colour coding).
  // ---------------------------------------------------------------------------
  var STATS = [
    { id: "gdp",          name: "Economic Growth",   base: 0.52, higherIsBetter: true },
    { id: "unemployment", name: "Unemployment",      base: 0.30, higherIsBetter: false },
    { id: "inflation",    name: "Inflation",         base: 0.40, higherIsBetter: false },
    { id: "nhs",          name: "NHS / Health",      base: 0.42, higherIsBetter: true },
    { id: "education",    name: "Education",         base: 0.50, higherIsBetter: true },
    { id: "crime",        name: "Crime",             base: 0.40, higherIsBetter: false },
    { id: "housing",      name: "Housing Supply",    base: 0.35, higherIsBetter: true },
    { id: "immigration",  name: "Net Migration",     base: 0.62, higherIsBetter: false },
    { id: "environment",  name: "Environment",       base: 0.45, higherIsBetter: true },
    { id: "equality",     name: "Equality",          base: 0.48, higherIsBetter: true }
  ];

  // ---------------------------------------------------------------------------
  // POLICIES — each slider value v in [0,1].
  //   budget(v): net effect on the annual deficit in £bn
  //              (positive = costs money / raises deficit,
  //               negative = raises revenue / cuts deficit).
  //   effects.stats[id](v)  -> additive delta to a stat   (apply each turn)
  //   effects.groups[id](v) -> additive delta to a group's contentment
  //   labels: text shown at the low and high ends of the slider.
  // ---------------------------------------------------------------------------
  var POLICIES = [
    // ---- TAXATION ----
    { id: "incometax", name: "Income Tax", cat: "Taxation", icon: "£",
      def: 0.5, low: "Tax cuts", high: "Higher rates",
      budget: function (v) { return -(v - 0.3) * 220; },
      effects: {
        stats: { gdp: lin(-0.18), equality: lin(0.22), inflation: lin(-0.05) },
        groups: { wealthy: lin(-0.45), middleclass: lin(-0.30), workingclass: lin(-0.18),
                  poor: lin(0.10), socialists: lin(0.30), capitalists: lin(-0.40),
                  publicsector: lin(0.12) }
      } },
    { id: "vat", name: "VAT", cat: "Taxation", icon: "£",
      def: 0.6, low: "Reduced", high: "Raised",
      budget: function (v) { return -(v - 0.3) * 160; },
      effects: {
        stats: { inflation: lin(0.20), gdp: lin(-0.10), equality: lin(-0.12) },
        groups: { poor: lin(-0.30), workingclass: lin(-0.22), pensioners: lin(-0.15),
                  capitalists: lin(0.05) }
      } },
    { id: "corptax", name: "Corporation Tax", cat: "Taxation", icon: "£",
      def: 0.5, low: "Business-friendly", high: "High",
      budget: function (v) { return -(v - 0.3) * 90; },
      effects: {
        stats: { gdp: lin(-0.20), unemployment: lin(0.12), equality: lin(0.15) },
        groups: { capitalists: lin(-0.55), selfemployed: lin(-0.25), privatesector: lin(-0.15),
                  socialists: lin(0.25), wealthy: lin(-0.25) }
      } },
    { id: "wealthtax", name: "Wealth & Capital Gains Tax", cat: "Taxation", icon: "£",
      def: 0.35, low: "Light touch", high: "Aggressive",
      budget: function (v) { return -(v) * 70; },
      effects: {
        stats: { equality: lin(0.30), gdp: lin(-0.12) },
        groups: { wealthy: linN(-0.7, 0.2), capitalists: linN(-0.55, 0.2), socialists: lin(0.35),
                  poor: lin(0.15), workingclass: lin(0.12) }
      } },
    { id: "fuelduty", name: "Fuel Duty", cat: "Taxation", icon: "⛽",
      def: 0.5, low: "Frozen / cut", high: "Raised",
      budget: function (v) { return -(v - 0.3) * 40; },
      effects: {
        stats: { environment: lin(0.18), inflation: lin(0.10) },
        groups: { motorists: lin(-0.50), environment: lin(0.30), selfemployed: lin(-0.20),
                  workingclass: lin(-0.15) }
      } },
    { id: "counciltax", name: "Council Tax", cat: "Taxation", icon: "🏘",
      def: 0.5, low: "Capped", high: "Unrestricted",
      budget: function (v) { return -(v - 0.5) * 30; },
      effects: {
        stats: { crime: lin(-0.06), housing: lin(0.04) },
        groups: { homeowners: lin(-0.35), pensioners: lin(-0.22), middleclass: lin(-0.20),
                  renters: lin(-0.05) }
      } },

    // ---- PUBLIC SERVICES ----
    { id: "nhs", name: "NHS Funding", cat: "Public Services", icon: "🏥",
      def: 0.55, low: "Squeeze", high: "Record investment",
      budget: function (v) { return v * 200; },
      effects: {
        stats: { nhs: lin(0.55), unemployment: lin(-0.08), equality: lin(0.10) },
        groups: { publicsector: lin(0.30), pensioners: lin(0.28), poor: lin(0.18),
                  unions: lin(0.18), parents: lin(0.15), capitalists: lin(-0.10) }
      } },
    { id: "education", name: "Schools & Education", cat: "Public Services", icon: "🎓",
      def: 0.55, low: "Cuts", high: "Major boost",
      budget: function (v) { return v * 110; },
      effects: {
        stats: { education: lin(0.55), gdp: lin(0.10), equality: lin(0.15) },
        groups: { parents: lin(0.35), young: lin(0.18), publicsector: lin(0.22),
                  teachers: lin(0.3) }
      } },
    { id: "police", name: "Policing & Justice", cat: "Public Services", icon: "🚔",
      def: 0.5, low: "Reduced", high: "Tough on crime",
      budget: function (v) { return v * 60; },
      effects: {
        stats: { crime: lin(-0.45), equality: lin(-0.05) },
        groups: { patriots: lin(0.30), pensioners: lin(0.20), homeowners: lin(0.15),
                  liberals: lin(-0.20), minorities: lin(-0.18) }
      } },
    { id: "defence", name: "Defence Spending", cat: "Public Services", icon: "🛡",
      def: 0.5, low: "2% of GDP", high: "3%+ of GDP",
      budget: function (v) { return v * 70; },
      effects: {
        stats: { unemployment: lin(-0.05), gdp: lin(0.04) },
        groups: { patriots: lin(0.45), capitalists: lin(0.12), socialists: lin(-0.25),
                  liberals: lin(-0.15), young: lin(-0.10) }
      } },

    // ---- WELFARE & PENSIONS ----
    { id: "pension", name: "State Pension (Triple Lock)", cat: "Welfare", icon: "👵",
      def: 0.6, low: "Frozen", high: "Generous uplift",
      budget: function (v) { return v * 130; },
      effects: {
        stats: { equality: lin(0.12), inflation: lin(0.04) },
        groups: { pensioners: linN(0.7, 0.2), poor: lin(0.12), capitalists: lin(-0.12),
                  young: lin(-0.10), wealthy: lin(-0.08) }
      } },
    { id: "welfare", name: "Universal Credit & Benefits", cat: "Welfare", icon: "🤝",
      def: 0.45, low: "Sanctions / cuts", high: "Expanded",
      budget: function (v) { return v * 120; },
      effects: {
        stats: { equality: lin(0.30), crime: lin(-0.12), unemployment: lin(0.10) },
        groups: { poor: linN(0.6, 0.2), workingclass: lin(0.20), socialists: lin(0.28),
                  unions: lin(0.18), capitalists: lin(-0.22), wealthy: lin(-0.18) }
      } },
    { id: "minwage", name: "Minimum Wage", cat: "Welfare", icon: "💷",
      def: 0.5, low: "Held down", high: "Real living wage+",
      budget: function (v) { return 0; },
      effects: {
        stats: { equality: lin(0.22), inflation: lin(0.12), unemployment: lin(0.14), gdp: lin(-0.04) },
        groups: { poor: lin(0.35), workingclass: lin(0.30), young: lin(0.18),
                  capitalists: lin(-0.30), selfemployed: lin(-0.25), unions: lin(0.20) }
      } },
    { id: "childcare", name: "Childcare & Family Support", cat: "Welfare", icon: "🍼",
      def: 0.45, low: "Minimal", high: "Universal free",
      budget: function (v) { return v * 45; },
      effects: {
        stats: { equality: lin(0.15), gdp: lin(0.10), unemployment: lin(-0.06) },
        groups: { parents: linN(0.55, 0.2), young: lin(0.15), women: lin(0.2),
                  capitalists: lin(-0.06) }
      } },

    // ---- ECONOMY & HOUSING ----
    { id: "housing", name: "Housebuilding Programme", cat: "Economy", icon: "🏗",
      def: 0.4, low: "Market-led", high: "Mass council housing",
      budget: function (v) { return v * 50; },
      effects: {
        stats: { housing: lin(0.55), gdp: lin(0.12), environment: lin(-0.08), unemployment: lin(-0.08) },
        groups: { renters: linN(0.5, 0.2), young: lin(0.25), homeowners: lin(-0.12),
                  privatesector: lin(0.10), environment: lin(-0.12) }
      } },
    { id: "rail", name: "Public Transport & Rail", cat: "Economy", icon: "🚆",
      def: 0.5, low: "Privatised", high: "Nationalised & subsidised",
      budget: function (v) { return v * 35; },
      effects: {
        stats: { environment: lin(0.18), gdp: lin(0.06) },
        groups: { commuters: lin(0.3), unions: lin(0.22), environment: lin(0.20),
                  socialists: lin(0.18), capitalists: lin(-0.20), motorists: lin(0.05) }
      } },
    { id: "tuition", name: "University Tuition Fees", cat: "Economy", icon: "📚",
      def: 0.55, low: "Abolished (free)", high: "Full fees",
      budget: function (v) { return -(v - 0.2) * 20; },
      effects: {
        stats: { education: lin(-0.10), equality: lin(-0.18) },
        groups: { students: linN(-0.7, 0.2), young: lin(-0.30), parents: lin(-0.12),
                  socialists: lin(-0.18) }
      } },
    { id: "businessreg", name: "Business Regulation", cat: "Economy", icon: "🏢",
      def: 0.5, low: "Deregulate", high: "Strong protections",
      budget: function (v) { return 0; },
      effects: {
        stats: { gdp: lin(-0.10), equality: lin(0.12), environment: lin(0.10) },
        groups: { capitalists: lin(-0.30), selfemployed: lin(-0.20), unions: lin(0.20),
                  environment: lin(0.12), workingclass: lin(0.08) }
      } },

    // ---- SOCIETY ----
    { id: "immigration", name: "Immigration Policy", cat: "Society", icon: "🛂",
      def: 0.5, low: "Open / liberal", high: "Strict / closed",
      budget: function (v) { return (v - 0.5) * 10; },
      effects: {
        stats: { immigration: lin(-0.45), gdp: lin(-0.18), nhs: lin(-0.06), unemployment: lin(-0.05) },
        groups: { patriots: lin(0.45), reformvoters: lin(0.4), minorities: lin(-0.35),
                  liberals: lin(-0.35), capitalists: lin(-0.18), young: lin(-0.12),
                  workingclass: lin(0.12) }
      } },
    { id: "netzero", name: "Net Zero & Climate", cat: "Society", icon: "🌍",
      def: 0.5, low: "Roll back", high: "Accelerate",
      budget: function (v) { return v * 40; },
      effects: {
        stats: { environment: lin(0.50), gdp: lin(-0.10), inflation: lin(0.06), unemployment: lin(0.04) },
        groups: { environment: linN(0.6, 0.2), young: lin(0.22), green: 0.4, motorists: lin(-0.25),
                  capitalists: lin(-0.20), patriots: lin(-0.18), workingclass: lin(-0.10) }
      } },
    { id: "foreignaid", name: "Foreign Aid", cat: "Society", icon: "🌐",
      def: 0.45, low: "Cut to 0.3%", high: "0.7%+ of GNI",
      budget: function (v) { return v * 18; },
      effects: {
        stats: { equality: lin(0.04) },
        groups: { liberals: lin(0.18), religious: lin(0.12), patriots: lin(-0.25),
                  reformvoters: lin(-0.3), poor: lin(-0.08) }
      } },
    { id: "civil", name: "Civil Liberties & Surveillance", cat: "Society", icon: "⚖",
      def: 0.5, low: "Maximise freedoms", high: "Security-first",
      budget: function (v) { return v * 8; },
      effects: {
        stats: { crime: lin(-0.14), equality: lin(-0.06) },
        groups: { patriots: lin(0.25), pensioners: lin(0.12), liberals: lin(-0.40),
                  young: lin(-0.15), minorities: lin(-0.15) }
      } }
  ];

  // Some effect maps reference groups/leanings that aren't first-class groups
  // (e.g. "teachers", "women", "commuters", "green", "reformvoters"). The engine
  // ignores deltas whose target group id doesn't exist, so these act as harmless
  // flavour — kept intentionally so the data reads naturally.

  // ---------------------------------------------------------------------------
  // EVENTS / SITUATIONS — triggered when a condition holds at end of turn.
  // effect: per-turn deltas applied while active. cond(state) -> bool.
  // ---------------------------------------------------------------------------
  var EVENTS = [
    { id: "nhscrisis", name: "NHS Winter Crisis", type: "bad",
      desc: "A&E waiting times have hit record highs. The public is furious.",
      cond: function (s) { return s.stats.nhs < 0.30; },
      effect: { stats: { nhs: -0.03 }, groups: { pensioners: -0.06, publicsector: -0.05, parents: -0.04 } } },
    { id: "costofliving", name: "Cost of Living Crisis", type: "bad",
      desc: "Soaring prices are squeezing household budgets across the country.",
      cond: function (s) { return s.stats.inflation > 0.62; },
      effect: { stats: { gdp: -0.02 }, groups: { poor: -0.07, workingclass: -0.06, renters: -0.05, pensioners: -0.04 } } },
    { id: "recession", name: "Recession", type: "bad",
      desc: "The economy has contracted for two consecutive quarters.",
      cond: function (s) { return s.stats.gdp < 0.28; },
      effect: { stats: { unemployment: 0.03 }, groups: { workingclass: -0.05, privatesector: -0.05, capitalists: -0.05 } } },
    { id: "channelcrossings", name: "Small Boats Surge", type: "bad",
      desc: "Channel crossings dominate the front pages and talk radio.",
      cond: function (s) { return s.stats.immigration > 0.70; },
      effect: { groups: { patriots: -0.06, reformvoters: -0.06, workingclass: -0.03 } } },
    { id: "strikes", name: "Public Sector Strikes", type: "bad",
      desc: "Nurses, teachers and rail workers are walking out over pay.",
      cond: function (s) { return s.groups.publicsector < 0.34 || s.groups.unions < 0.32; },
      effect: { stats: { gdp: -0.02, nhs: -0.02 }, groups: { commuters: -0.04, parents: -0.03 } } },
    { id: "housingcrisis", name: "Housing Crisis", type: "bad",
      desc: "Rents and house prices are out of reach for a generation.",
      cond: function (s) { return s.stats.housing < 0.28; },
      effect: { groups: { renters: -0.06, young: -0.05 } } },
    { id: "crimewave", name: "Rising Crime", type: "bad",
      desc: "Headlines warn of a breakdown in law and order.",
      cond: function (s) { return s.stats.crime > 0.66; },
      effect: { groups: { pensioners: -0.05, homeowners: -0.04, patriots: -0.05 } } },
    { id: "debtcrisis", name: "Markets Spooked by Debt", type: "bad",
      desc: "The gilt markets are jittery about an unsustainable deficit.",
      cond: function (s) { return s.debt > 130; },
      effect: { stats: { gdp: -0.03, inflation: 0.02 }, groups: { capitalists: -0.06, wealthy: -0.05 } } },
    { id: "boom", name: "Economic Boom", type: "good",
      desc: "Strong growth is lifting confidence and the public finances.",
      cond: function (s) { return s.stats.gdp > 0.72 && s.stats.unemployment < 0.25; },
      effect: { groups: { privatesector: 0.04, middleclass: 0.04, capitalists: 0.05 } } },
    { id: "greenleader", name: "Global Climate Leader", type: "good",
      desc: "Britain is praised as a world leader on the environment.",
      cond: function (s) { return s.stats.environment > 0.72; },
      effect: { groups: { environment: 0.05, young: 0.04 } } }
  ];

  // ---------------------------------------------------------------------------
  // POLL PRESETS — national GB vote shares used to seed the swingometer.
  // 2024 is the actual headline result. Others are illustrative scenarios.
  // ---------------------------------------------------------------------------
  var PRESETS = {
    ge2024: { name: "2024 General Election (actual)",
      shares: { lab: 33.7, con: 23.7, reform: 14.3, ld: 12.2, green: 6.7, snp: 2.5, pc: 0.7, oth: 6.2 } },
    reformsurge: { name: "Reform surge (illustrative)",
      shares: { reform: 28, lab: 24, con: 18, ld: 12, green: 9, snp: 2.5, pc: 0.7, oth: 5.8 } },
    contoryrecovery: { name: "Conservative recovery (illustrative)",
      shares: { lab: 28, con: 30, reform: 12, ld: 12, green: 8, snp: 2.5, pc: 0.7, oth: 6.8 } },
    progressive: { name: "Progressive wave (illustrative)",
      shares: { lab: 38, con: 18, reform: 11, ld: 14, green: 12, snp: 2.5, pc: 0.8, oth: 3.7 } }
  };

  // Default GB share used to compute swing in the regional model = 2024.
  var BASELINE = PRESETS.ge2024.shares;

  // ---------------------------------------------------------------------------
  // BY-ELECTION seats — a small selection of real constituencies with notional
  // 2024 result shares, used by by-election mode.
  // ---------------------------------------------------------------------------
  var BYELECTION_SEATS = [
    { id: "clacton", name: "Clacton", region: "ee",
      shares: { reform: 46, con: 24, lab: 19, ld: 4, green: 3, oth: 4 } },
    { id: "islington", name: "Islington North", region: "lon",
      shares: { oth: 49, lab: 34, green: 7, ld: 5, con: 4, reform: 1 } },
    { id: "richmond", name: "Richmond Park", region: "lon",
      shares: { ld: 49, con: 32, lab: 10, green: 6, reform: 3 } },
    { id: "boston", name: "Boston & Skegness", region: "em",
      shares: { reform: 41, con: 30, lab: 20, ld: 4, green: 3, oth: 2 } },
    { id: "hartlepool", name: "Hartlepool", region: "ne",
      shares: { lab: 41, reform: 25, con: 18, ld: 6, green: 6, oth: 4 } },
    { id: "perth", name: "Perth & Kinross-shire", region: "sct",
      shares: { snp: 38, con: 30, lab: 20, ld: 7, reform: 4, oth: 1 } },
    { id: "uxbridge", name: "Uxbridge & South Ruislip", region: "lon",
      shares: { con: 38, lab: 37, reform: 9, ld: 7, green: 6, oth: 3 } }
  ];

  // ---------------------------------------------------------------------------
  // LOCAL ELECTIONS — a national-equivalent-vote model. Approx total principal
  // council seats up for the cycle, allocated proportionally with a small
  // incumbency/FPTP distortion handled in the engine.
  // ---------------------------------------------------------------------------
  var LOCAL = {
    totalSeats: 8000,
    councils: 230,
    // party tendency multipliers for converting national share to local seats
    localBias: { lab: 1.02, con: 1.05, ld: 1.18, green: 1.10, reform: 0.85, oth: 1.25, snp: 1.0, pc: 1.0 }
  };

  window.UKGAME.DATA = {
    PARTIES: PARTIES,
    REGIONS: REGIONS,
    NATIONS: NATIONS,
    GROUPS: GROUPS,
    STATS: STATS,
    POLICIES: POLICIES,
    EVENTS: EVENTS,
    PRESETS: PRESETS,
    BASELINE: BASELINE,
    BYELECTION_SEATS: BYELECTION_SEATS,
    LOCAL: LOCAL,
    // ordered list of the main GB parties for charts/legends
    MAIN_PARTIES: ["lab", "con", "reform", "ld", "green", "snp", "pc", "oth"]
  };
})();
