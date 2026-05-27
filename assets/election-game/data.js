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
  // STATS — qualitative state of the country, value in [0,1]. The hard economic
  // numbers (GDP, growth, inflation, unemployment, the public finances) are held
  // as real figures in FISCAL / the macro model below, not here.
  // higherIsBetter flags whether a high value is good (for colour coding).
  // ---------------------------------------------------------------------------
  var STATS = [
    { id: "nhs",          name: "NHS / Health",      base: 0.42, higherIsBetter: true },
    { id: "education",    name: "Education",         base: 0.50, higherIsBetter: true },
    { id: "crime",        name: "Crime",             base: 0.40, higherIsBetter: false },
    { id: "housing",      name: "Housing Supply",    base: 0.35, higherIsBetter: true },
    { id: "immigration",  name: "Net Migration",     base: 0.62, higherIsBetter: false },
    { id: "environment",  name: "Environment",       base: 0.45, higherIsBetter: true },
    { id: "equality",     name: "Equality",          base: 0.48, higherIsBetter: true }
  ];

  // ---------------------------------------------------------------------------
  // FISCAL — real UK public finances used as the starting point (£ billion).
  // Figures are the 2024–25 position from OBR (Budget Oct 2024 / public finances
  // databank) and ONS public-sector-finances & national-accounts releases:
  //   GDP ≈ £2.79tn; receipts ≈ £1,141bn; spending ≈ £1,270bn; borrowing ≈
  //   £128bn (~4.6% of GDP); net debt ≈ £2.7tn (~97% of GDP); debt interest
  //   ≈ £110bn. Income tax + NICs + VAT ≈ £648bn of receipts. Welfare + state
  //   pension ≈ £333bn of spending. These are the well-published headline
  //   aggregates; the game evolves them from here as you govern.
  // ---------------------------------------------------------------------------
  var FISCAL = {
    asOf: "2024–25 (OBR / ONS)",
    gdp: 2790,            // nominal GDP, £bn
    realGrowth: 1.1,      // real GDP growth, % per year (latest)
    inflation: 2.6,       // CPI inflation, %
    unemployment: 4.3,    // ILO unemployment rate, %
    bankRate: 4.75,       // Bank of England base rate, %
    debt: 2700,           // public sector net debt, £bn
    effectiveDebtRate: 0.0407, // average interest on the debt stock (→ ~£110bn)
    receiptsTotal: 1141,  // total public sector receipts, £bn
    spendingTotal: 1270   // total managed expenditure, £bn
  };

  // Each policy carries its own real-world control (units, range, default) and
  // its budget line is defined inline on the policy (see POLICIES / `fiscal`).

  // ---------------------------------------------------------------------------
  // POLICIES — each is a real-world control: a value in real units (a tax rate,
  // a £bn budget, pence per litre, £/month, % of GDP …) between `min` and `max`,
  // starting at the real 2024–25 `def`.
  //   fiscal: the budget line this lever sets. mode "direct" means the £bn line
  //           equals the slider value (e.g. the NHS budget); mode "derived"
  //           means the line = base + swing·d, where d = (value−def)/(max−min)
  //           (e.g. a tax rate moving receipts). type "r" receipt / "s" spend.
  //   effects.stats[id] / groups[id]: a coefficient k; the engine applies k·d,
  //           so there is no effect at the default and the sign sets direction.
  // ---------------------------------------------------------------------------
  var POLICIES = [
    // ---- TAXATION ----
    { id: "incometax", name: "Income Tax — Basic Rate", cat: "Taxation", icon: "£",
      unit: "%", min: 10, max: 35, def: 20, step: 1, low: "Cut", high: "Raise",
      fiscal: { type: "r", line: "Income tax (basic rate)", mode: "derived", base: 243, swing: 230 },
      effects: {
        stats: { gdp: -0.16, equality: 0.20, inflation: -0.05 },
        groups: { wealthy: -0.28, middleclass: -0.34, workingclass: -0.22, poor: 0.08,
                  socialists: 0.28, capitalists: -0.28, publicsector: 0.12 }
      } },
    { id: "incometax_higher", name: "Income Tax — Higher Rate", cat: "Taxation", icon: "£",
      unit: "%", min: 30, max: 60, def: 40, step: 1, low: "Cut", high: "Raise",
      fiscal: { type: "r", line: "Income tax (higher rate)", mode: "derived", base: 60, swing: 95 },
      effects: {
        stats: { gdp: -0.12, equality: 0.22 },
        groups: { wealthy: -0.55, middleclass: -0.12, capitalists: -0.28, socialists: 0.26, selfemployed: -0.15 }
      } },
    { id: "ni", name: "National Insurance", cat: "Taxation", icon: "£",
      unit: "%", min: 0, max: 16, def: 8, step: 0.5, low: "Cut", high: "Raise",
      fiscal: { type: "r", line: "National Insurance", mode: "derived", base: 170, swing: 190 },
      effects: {
        stats: { gdp: -0.14, equality: -0.04, inflation: -0.03 },
        groups: { workingclass: -0.34, privatesector: -0.22, middleclass: -0.20, selfemployed: -0.16,
                  capitalists: -0.16, pensioners: 0.05 }
      } },
    { id: "vat", name: "VAT", cat: "Taxation", icon: "£",
      unit: "%", min: 0, max: 30, def: 20, step: 1, low: "Cut", high: "Raise",
      fiscal: { type: "r", line: "VAT", mode: "derived", base: 175, swing: 150 },
      effects: {
        stats: { inflation: 0.22, gdp: -0.10, equality: -0.14 },
        groups: { poor: -0.30, workingclass: -0.22, pensioners: -0.15, capitalists: 0.05 }
      } },
    { id: "corptax", name: "Corporation Tax", cat: "Taxation", icon: "£",
      unit: "%", min: 15, max: 38, def: 25, step: 1, low: "Business-friendly", high: "High",
      fiscal: { type: "r", line: "Corporation tax", mode: "derived", base: 105, swing: 110 },
      effects: {
        stats: { gdp: -0.22, unemployment: 0.12, equality: 0.12 },
        groups: { capitalists: -0.55, selfemployed: -0.22, privatesector: -0.18, socialists: 0.24, wealthy: -0.22 }
      } },
    { id: "cgt", name: "Capital Gains Tax", cat: "Taxation", icon: "£",
      unit: "%", min: 10, max: 50, def: 24, step: 1, low: "Light touch", high: "Aligned with income",
      fiscal: { type: "r", line: "Capital gains tax", mode: "derived", base: 18, swing: 30 },
      effects: {
        stats: { equality: 0.22, gdp: -0.12 },
        groups: { wealthy: -0.55, capitalists: -0.45, socialists: 0.30, poor: 0.10, workingclass: 0.10 }
      } },
    { id: "inheritance", name: "Inheritance Tax", cat: "Taxation", icon: "£",
      unit: "%", min: 0, max: 55, def: 40, step: 1, low: "Abolish", high: "Raise",
      fiscal: { type: "r", line: "Inheritance tax", mode: "derived", base: 8, swing: 14 },
      effects: {
        stats: { equality: 0.18, gdp: -0.03 },
        groups: { wealthy: -0.45, homeowners: -0.22, capitalists: -0.14, socialists: 0.20, poor: 0.06 }
      } },
    { id: "fuelduty", name: "Fuel Duty", cat: "Taxation", icon: "⛽",
      unit: "p", min: 30, max: 80, def: 53, step: 1, low: "Cut / freeze", high: "Raise",
      fiscal: { type: "r", line: "Fuel duty", mode: "derived", base: 25, swing: 28 },
      effects: {
        stats: { environment: 0.16, inflation: 0.10 },
        groups: { motorists: -0.50, environment: 0.30, selfemployed: -0.20, workingclass: -0.15 }
      } },
    { id: "counciltax", name: "Council Tax (Band D)", cat: "Taxation", icon: "🏘",
      unit: "£", min: 1600, max: 3200, def: 2200, step: 50, low: "Capped", high: "Unrestricted",
      fiscal: { type: "r", line: "Council tax", mode: "derived", base: 45, swing: 40 },
      effects: {
        stats: { crime: -0.05, housing: 0.03 },
        groups: { homeowners: -0.35, pensioners: -0.24, middleclass: -0.20, renters: -0.06 }
      } },

    // ---- PUBLIC SERVICES (budgets in £bn) ----
    { id: "nhs", name: "NHS Budget", cat: "Public Services", icon: "🏥",
      unit: "£bn", min: 150, max: 330, def: 212, step: 2, low: "Squeeze", high: "Invest",
      fiscal: { type: "s", line: "Health (NHS)", mode: "direct" },
      effects: {
        stats: { nhs: 0.85, unemployment: -0.08, equality: 0.10 },
        groups: { publicsector: 0.30, pensioners: 0.28, poor: 0.18, unions: 0.18, parents: 0.15, capitalists: -0.10 }
      } },
    { id: "education", name: "Schools & Education", cat: "Public Services", icon: "🎓",
      unit: "£bn", min: 80, max: 180, def: 116, step: 1, low: "Cut", high: "Invest",
      fiscal: { type: "s", line: "Education", mode: "direct" },
      effects: {
        stats: { education: 0.85, gdp: 0.10, equality: 0.15 },
        groups: { parents: 0.35, young: 0.18, publicsector: 0.22, teachers: 0.3 }
      } },
    { id: "police", name: "Policing & Justice", cat: "Public Services", icon: "🚔",
      unit: "£bn", min: 30, max: 85, def: 47, step: 1, low: "Cut", high: "Tough on crime",
      fiscal: { type: "s", line: "Police & justice", mode: "direct" },
      effects: {
        stats: { crime: -0.70, equality: -0.04 },
        groups: { patriots: 0.30, pensioners: 0.20, homeowners: 0.15, liberals: -0.20, minorities: -0.18 }
      } },
    { id: "defence", name: "Defence Spending", cat: "Public Services", icon: "🛡",
      unit: "%GDP", min: 1.5, max: 4, def: 2.3, step: 0.1, low: "Cut", high: "Rearm",
      fiscal: { type: "s", line: "Defence", mode: "derived", base: 64, swing: 70 },
      effects: {
        stats: { unemployment: -0.05, gdp: 0.04 },
        groups: { patriots: 0.45, capitalists: 0.12, socialists: -0.25, liberals: -0.15, young: -0.10 }
      } },
    { id: "socialcare", name: "Social Care", cat: "Public Services", icon: "🧑‍🦽",
      unit: "£bn", min: 15, max: 65, def: 28, step: 1, low: "Minimal", high: "Fix it",
      fiscal: { type: "s", line: "Social care", mode: "direct" },
      effects: {
        stats: { nhs: 0.25, equality: 0.14 },
        groups: { pensioners: 0.30, parents: 0.10, publicsector: 0.12, unions: 0.08, capitalists: -0.06 }
      } },
    { id: "localgov", name: "Local Government", cat: "Public Services", icon: "🏛",
      unit: "£bn", min: 40, max: 115, def: 60, step: 1, low: "Austerity", high: "Well-funded",
      fiscal: { type: "s", line: "Local government", mode: "direct" },
      effects: {
        stats: { crime: -0.14, housing: 0.10, education: 0.05 },
        groups: { workingclass: 0.10, poor: 0.10, homeowners: 0.06, publicsector: 0.10, capitalists: -0.06 }
      } },

    // ---- WELFARE & PENSIONS ----
    { id: "pension", name: "State Pension uprating", cat: "Welfare", icon: "👵",
      unit: "%", min: 0, max: 10, def: 4.1, step: 0.1, low: "Freeze", high: "Generous",
      fiscal: { type: "s", line: "State pension", mode: "derived", base: 138, swing: 95 },
      effects: {
        stats: { equality: 0.12, inflation: 0.04 },
        groups: { pensioners: 0.85, poor: 0.12, capitalists: -0.12, young: -0.12, wealthy: -0.08 }
      } },
    { id: "welfare", name: "Universal Credit (monthly)", cat: "Welfare", icon: "🤝",
      unit: "£/mo", min: 250, max: 700, def: 400, step: 10, low: "Sanctions / cuts", high: "Expanded",
      fiscal: { type: "s", line: "Welfare & UC", mode: "derived", base: 195, swing: 150 },
      effects: {
        stats: { equality: 0.30, crime: -0.12, unemployment: 0.10 },
        groups: { poor: 0.65, workingclass: 0.20, socialists: 0.28, unions: 0.16, capitalists: -0.22, wealthy: -0.18 }
      } },
    { id: "minwage", name: "National Minimum Wage", cat: "Welfare", icon: "💷",
      unit: "£/hr", min: 8, max: 16, def: 11.44, step: 0.1, low: "Held down", high: "Living wage+",
      effects: {
        stats: { equality: 0.22, inflation: 0.12, unemployment: 0.16, gdp: -0.04 },
        groups: { poor: 0.35, workingclass: 0.30, young: 0.18, capitalists: -0.30, selfemployed: -0.28, unions: 0.20 }
      } },
    { id: "childcare", name: "Childcare & Family Support", cat: "Welfare", icon: "🍼",
      unit: "£bn", min: 0, max: 45, def: 10, step: 1, low: "Minimal", high: "Universal free",
      fiscal: { type: "s", line: "Family & childcare", mode: "direct" },
      effects: {
        stats: { equality: 0.15, gdp: 0.10, unemployment: -0.06 },
        groups: { parents: 0.55, young: 0.15, women: 0.2, capitalists: -0.06 }
      } },

    // ---- ECONOMY & HOUSING ----
    { id: "housing", name: "Housebuilding", cat: "Economy", icon: "🏗",
      unit: "k/yr", min: 100, max: 500, def: 200, step: 10, low: "Market-led", high: "State programme",
      fiscal: { type: "s", line: "Housing", mode: "derived", base: 12, swing: 45 },
      effects: {
        stats: { housing: 0.65, gdp: 0.12, environment: -0.08, unemployment: -0.08 },
        groups: { renters: 0.5, young: 0.25, homeowners: -0.14, privatesector: 0.10, environment: -0.12 }
      } },
    { id: "infra", name: "Infrastructure Investment", cat: "Economy", icon: "🏗",
      unit: "£bn", min: 10, max: 95, def: 30, step: 1, low: "Minimal", high: "Build big",
      fiscal: { type: "s", line: "Infrastructure", mode: "direct" },
      effects: {
        stats: { gdp: 0.24, housing: 0.10, environment: -0.04, unemployment: -0.10 },
        groups: { privatesector: 0.12, workingclass: 0.10, capitalists: 0.10, environment: -0.05 }
      } },
    { id: "rail", name: "Public Transport & Rail", cat: "Economy", icon: "🚆",
      unit: "£bn", min: 10, max: 85, def: 44, step: 1, low: "Cut subsidy", high: "Subsidise / nationalise",
      fiscal: { type: "s", line: "Transport", mode: "direct" },
      effects: {
        stats: { environment: 0.18, gdp: 0.06 },
        groups: { commuters: 0.3, unions: 0.22, environment: 0.20, socialists: 0.18, capitalists: -0.20, motorists: 0.05 }
      } },
    { id: "netzero", name: "Net Zero & Energy", cat: "Economy", icon: "🌍",
      unit: "£bn", min: 0, max: 65, def: 15, step: 1, low: "Roll back", high: "Accelerate",
      fiscal: { type: "s", line: "Net zero & energy", mode: "direct" },
      effects: {
        stats: { environment: 0.55, gdp: -0.06, inflation: 0.05, unemployment: 0.02 },
        groups: { environment: 0.6, young: 0.22, green: 0.4, motorists: -0.22, capitalists: -0.18, patriots: -0.18, workingclass: -0.10 }
      } },
    { id: "tuition", name: "University Tuition Fees", cat: "Economy", icon: "📚",
      unit: "£/yr", min: 0, max: 15000, def: 9250, step: 250, low: "Abolish", high: "Full fees",
      effects: {
        stats: { education: -0.10, equality: -0.18 },
        groups: { students: -0.7, young: -0.30, parents: -0.12, socialists: -0.18 }
      } },
    { id: "businessreg", name: "Business Regulation", cat: "Economy", icon: "🏢",
      unit: "/10", min: 0, max: 10, def: 5, step: 1, low: "Deregulate", high: "Strong protections",
      effects: {
        stats: { gdp: -0.12, equality: 0.12, environment: 0.10 },
        groups: { capitalists: -0.30, selfemployed: -0.20, unions: 0.20, environment: 0.12, workingclass: 0.08 }
      } },

    // ---- SOCIETY ----
    { id: "immigration", name: "Net Migration (target)", cat: "Society", icon: "🛂",
      unit: "k/yr", min: 0, max: 700, def: 350, step: 10, low: "Closed", high: "Open",
      effects: {
        stats: { immigration: 0.55, gdp: 0.20, nhs: 0.05, unemployment: 0.04 },
        groups: { patriots: -0.45, reformvoters: -0.4, minorities: 0.35, liberals: 0.35,
                  capitalists: 0.20, young: 0.12, workingclass: -0.14 }
      } },
    { id: "foreignaid", name: "Foreign Aid", cat: "Society", icon: "🌐",
      unit: "%GNI", min: 0, max: 0.7, def: 0.5, step: 0.05, low: "Cut", high: "0.7% target",
      fiscal: { type: "s", line: "Foreign aid", mode: "derived", base: 15, swing: 18 },
      effects: {
        stats: { equality: 0.04 },
        groups: { liberals: 0.18, religious: 0.12, patriots: -0.25, reformvoters: -0.3, poor: -0.08 }
      } },
    { id: "civil", name: "Civil Liberties ↔ Security", cat: "Society", icon: "⚖",
      unit: "/10", min: 0, max: 10, def: 5, step: 1, low: "Freedoms", high: "Security-first",
      fiscal: { type: "s", line: "Security & surveillance", mode: "derived", base: 8, swing: 8 },
      effects: {
        stats: { crime: -0.16, equality: -0.06 },
        groups: { patriots: 0.25, pensioners: 0.12, liberals: -0.40, young: -0.15, minorities: -0.15 }
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
      cond: function (s) { return s.macro.inflation > 5.5; },
      effect: { macro: { realGrowth: -0.2 }, groups: { poor: -0.07, workingclass: -0.06, renters: -0.05, pensioners: -0.04 } } },
    { id: "recession", name: "Recession", type: "bad",
      desc: "The economy has contracted for two consecutive quarters.",
      cond: function (s) { return s.macro.realGrowth < 0; },
      effect: { macro: { unemployment: 0.35 }, groups: { workingclass: -0.05, privatesector: -0.05, capitalists: -0.05 } } },
    { id: "channelcrossings", name: "Small Boats Surge", type: "bad",
      desc: "Channel crossings dominate the front pages and talk radio.",
      cond: function (s) { return s.stats.immigration > 0.70; },
      effect: { groups: { patriots: -0.06, reformvoters: -0.06, workingclass: -0.03 } } },
    { id: "strikes", name: "Public Sector Strikes", type: "bad",
      desc: "Nurses, teachers and rail workers are walking out over pay.",
      cond: function (s) { return s.groups.publicsector < 0.34 || s.groups.unions < 0.32; },
      effect: { stats: { nhs: -0.02 }, macro: { realGrowth: -0.15 }, groups: { commuters: -0.04, parents: -0.03 } } },
    { id: "housingcrisis", name: "Housing Crisis", type: "bad",
      desc: "Rents and house prices are out of reach for a generation.",
      cond: function (s) { return s.stats.housing < 0.28; },
      effect: { groups: { renters: -0.06, young: -0.05 } } },
    { id: "crimewave", name: "Rising Crime", type: "bad",
      desc: "Headlines warn of a breakdown in law and order.",
      cond: function (s) { return s.stats.crime > 0.66; },
      effect: { groups: { pensioners: -0.05, homeowners: -0.04, patriots: -0.05 } } },
    { id: "debtcrisis", name: "Markets Spooked by Debt", type: "bad",
      desc: "The gilt markets are jittery about an unsustainable debt burden.",
      cond: function (s) { return s.macro.debtPct > 110; },
      effect: { macro: { realGrowth: -0.25, inflation: 0.15 }, groups: { capitalists: -0.06, wealthy: -0.05 } } },
    { id: "boom", name: "Economic Boom", type: "good",
      desc: "Strong growth is lifting confidence and the public finances.",
      cond: function (s) { return s.macro.realGrowth > 2.8 && s.macro.unemployment < 4; },
      effect: { groups: { privatesector: 0.04, middleclass: 0.04, capitalists: 0.05 } } },
    { id: "greenleader", name: "Global Climate Leader", type: "good",
      desc: "Britain is praised as a world leader on the environment.",
      cond: function (s) { return s.stats.environment > 0.72; },
      effect: { groups: { environment: 0.05, young: 0.04 } } }
  ];

  // ---------------------------------------------------------------------------
  // DILEMMAS — decision cards in the style of political sims. Each turn one may
  // land on the PM's desk; the player must choose, and each option moves real
  // policy levers (which flow through the budget), the macro economy, voter
  // groups and political capital. cond(state) optionally gates a dilemma.
  // effects: policy{id:Δslider}, macro{field:Δ}, stats{id:Δ}, groups{id:Δ},
  //          all:Δ (every group), capital:Δ.
  // ---------------------------------------------------------------------------
  var DILEMMAS = [
    { id: "doctors", title: "Junior Doctors Threaten to Strike",
      desc: "The BMA is balloting for walkouts over pay. A&E is already creaking and the headlines are brutal.",
      options: [
        { label: "Award a 22% pay deal", result: "Strikes called off, but it costs billions and the markets wince.",
          effects: { policy: { nhs: 0.10 }, groups: { publicsector: 0.10, unions: 0.10, capitalists: -0.05 }, capital: -1 } },
        { label: "Hold firm on pay", result: "You face months of strikes and waiting lists balloon.",
          effects: { stats: { nhs: -0.06 }, groups: { publicsector: -0.10, unions: -0.10, parents: -0.04 } } },
        { label: "Offer a one-off bonus", result: "A fudge that buys time without fixing the underlying grievance.",
          effects: { groups: { publicsector: 0.03, unions: 0.02 }, capital: -1 } }
      ] },
    { id: "winterfuel", title: "Winter Fuel Payments",
      desc: "The Treasury wants to means-test the pensioner winter fuel allowance to save money.",
      options: [
        { label: "Means-test it", result: "You save around £1.5bn — but pensioners are furious.",
          effects: { groups: { pensioners: -0.14, wealthy: 0.02 }, macro: { deficit: -2 } } },
        { label: "Keep it universal", result: "Pensioners are relieved; the deficit hawks grumble.",
          effects: { groups: { pensioners: 0.06, capitalists: -0.03 } } }
      ] },
    { id: "smallboats", title: "Channel Crossings Spike",
      desc: "A record week of small-boat crossings dominates every front page and phone-in.",
      options: [
        { label: "Hardline removals law", result: "Reform voters cheer; lawyers and liberals are up in arms.",
          effects: { policy: { immigration: 0.18 }, groups: { patriots: 0.10, liberals: -0.10, minorities: -0.08 } } },
        { label: "Speed up asylum processing", result: "A pragmatic fix that pleases liberals but not the right.",
          effects: { stats: { immigration: -0.04 }, groups: { liberals: 0.06, patriots: -0.06 }, capital: -1 } }
      ] },
    { id: "carplant", title: "Carmaker Threatens to Pull Out",
      desc: "A major manufacturer says it will move production abroad without state support for the transition to EVs.",
      options: [
        { label: "Offer a £2bn subsidy", result: "Thousands of jobs saved; critics call it corporate welfare.",
          effects: { macro: { unemployment: -0.2 }, groups: { workingclass: 0.06, unions: 0.05, capitalists: 0.04 }, policy: { netzero: 0.05 } } },
        { label: "Let the market decide", result: "The plant closes. A region loses its biggest employer.",
          effects: { macro: { unemployment: 0.4, realGrowth: -0.2 }, groups: { workingclass: -0.08, unions: -0.06 } } }
      ] },
    { id: "sewage", title: "Sewage Scandal",
      desc: "A water company is caught dumping sewage while paying huge dividends. The public is disgusted.",
      options: [
        { label: "Heavy fines & tough regulation", result: "Voters approve; investors flee the sector.",
          effects: { policy: { businessreg: 0.12 }, stats: { environment: 0.05 }, groups: { environment: 0.10, capitalists: -0.08 } } },
        { label: "Bring it into public ownership", result: "The left is delighted; it lands a big bill on the taxpayer.",
          effects: { macro: { deficit: 6 }, groups: { socialists: 0.10, environment: 0.06, capitalists: -0.10 }, capital: -1 } },
        { label: "Issue a stern warning", result: "Seen as weak. The scandal rumbles on.",
          effects: { groups: { environment: -0.06 }, all: -0.01 } }
      ] },
    { id: "twochild", title: "Two-Child Benefit Cap",
      desc: "Campaigners and your own backbenchers demand you scrap the two-child limit on benefits.",
      options: [
        { label: "Scrap the cap", result: "Child poverty falls; it costs around £3.5bn a year.",
          effects: { policy: { welfare: 0.06 }, stats: { equality: 0.05 }, groups: { poor: 0.10, socialists: 0.08, parents: 0.05 } } },
        { label: "Keep the cap", result: "You hold the line on spending and enrage the left of the party.",
          effects: { groups: { poor: -0.06, socialists: -0.08 }, capital: -1 } }
      ] },
    { id: "defence", title: "NATO Pressure on Defence",
      desc: "Allies and the Pentagon are pressing Britain to commit to 3% of GDP on defence.",
      options: [
        { label: "Commit to 3%", result: "Allies are reassured; the cost is enormous.",
          effects: { policy: { defence: 0.25 }, groups: { patriots: 0.10, socialists: -0.06 } } },
        { label: "Stick to 2.5%", result: "A compromise that satisfies nobody entirely.",
          effects: { policy: { defence: 0.08 }, groups: { patriots: -0.03 } } }
      ] },
    { id: "rebellion", title: "Backbench Welfare Rebellion",
      desc: "Dozens of your MPs threaten to vote down planned disability benefit cuts.",
      options: [
        { label: "Back down on the cuts", result: "You keep the party together but lose fiscal credibility.",
          effects: { policy: { welfare: 0.05 }, groups: { poor: 0.06, socialists: 0.05 }, capital: -2 } },
        { label: "Push it through", result: "You win the vote but burn huge political capital.",
          effects: { macro: { deficit: -4 }, groups: { poor: -0.08, socialists: -0.06 }, capital: -3, all: -0.02 } }
      ] },
    { id: "schoolmeals", title: "Free School Meals Campaign",
      desc: "A celebrity-backed campaign demands free school meals for all primary pupils.",
      options: [
        { label: "Fund it nationally", result: "Hugely popular with families; another line on the bill.",
          effects: { policy: { childcare: 0.20 }, groups: { parents: 0.10, poor: 0.06 } } },
        { label: "Target the poorest only", result: "A measured response that mutes the campaign.",
          effects: { groups: { parents: 0.02, poor: 0.03 } } }
      ] },
    { id: "energy", title: "Energy Bills Surge",
      desc: "A cold snap and volatile gas prices send household energy bills soaring.",
      cond: function (s) { return s.macro.inflation > 3; },
      options: [
        { label: "Freeze bills with a subsidy", result: "Households relieved; it's expensive and props up inflation.",
          effects: { macro: { deficit: 8, inflation: 0.2 }, all: 0.03, groups: { capitalists: -0.04 } } },
        { label: "Targeted help for the poorest", result: "Cheaper and fairer, but middle earners feel the squeeze.",
          effects: { macro: { deficit: 3 }, groups: { poor: 0.08, middleclass: -0.04 } } },
        { label: "Let the market work", result: "The Treasury is happy; voters are cold and angry.",
          effects: { groups: { poor: -0.10, workingclass: -0.06, pensioners: -0.05 } } }
      ] },
    { id: "housing", title: "Planning Reform Showdown",
      desc: "You can override local objections to hit housing targets — but Tory shire and NIMBY voters revolt.",
      options: [
        { label: "Build, build, build", result: "Supply rises; homeowners and locals are furious.",
          effects: { policy: { housing: 0.18 }, groups: { renters: 0.10, young: 0.06, homeowners: -0.08 } } },
        { label: "Respect local vetoes", result: "Communities placated; the housing crisis deepens.",
          effects: { stats: { housing: -0.05 }, groups: { homeowners: 0.05, renters: -0.06, young: -0.05 } } }
      ] },
    { id: "scandal", title: "A Minister Is Caught Out",
      desc: "A cabinet minister is embroiled in a lobbying scandal. The lobby is baying.",
      options: [
        { label: "Sack them immediately", result: "Decisive — but you lose an ally and look chaotic.",
          effects: { capital: -1, all: 0.01 } },
        { label: "Stand by them", result: "Loyal, but the story runs for weeks and tars the government.",
          effects: { all: -0.03, groups: { liberals: -0.03 } } }
      ] },
    { id: "rail", title: "National Rail Strike",
      desc: "The RMT calls an all-out strike that will paralyse the network for a fortnight.",
      options: [
        { label: "Meet their pay demand", result: "Trains run; the bill and the precedent worry the Treasury.",
          effects: { policy: { rail: 0.12 }, groups: { unions: 0.10, commuters: 0.04, capitalists: -0.05 }, capital: -1 } },
        { label: "Face down the unions", result: "Commuters suffer for weeks; your base on the right approves.",
          effects: { macro: { realGrowth: -0.2 }, groups: { unions: -0.12, commuters: -0.06, patriots: 0.04 } } }
      ] },
    { id: "prisons", title: "Prisons Are Full",
      desc: "The justice system warns there are no cells left. Judges are being told to delay sentencing.",
      options: [
        { label: "Early-release scheme", result: "Space is freed up — but a soft-on-crime backlash is inevitable.",
          effects: { stats: { crime: 0.05 }, groups: { patriots: -0.08, pensioners: -0.05, liberals: 0.03 } } },
        { label: "Emergency prison-building", result: "The right approves; it's a multi-billion-pound commitment.",
          effects: { policy: { police: 0.10 }, macro: { deficit: 4 }, groups: { patriots: 0.06 } } }
      ] },
    { id: "farmers", title: "Farmers Revolt",
      desc: "Changes to agricultural inheritance tax bring tractors to Whitehall and the rural vote is seething.",
      options: [
        { label: "Back down on the tax", result: "Rural anger cools; urban progressives call it a capitulation.",
          effects: { macro: { deficit: 2 }, groups: { selfemployed: 0.06, patriots: 0.04, socialists: -0.04 } } },
        { label: "Hold firm", result: "You bank the revenue and own the countryside's fury.",
          effects: { macro: { deficit: -2 }, groups: { selfemployed: -0.10, patriots: -0.06 } } }
      ] },
    { id: "pensionage", title: "Raise the Pension Age?",
      desc: "Rising longevity and the cost of the triple lock force the question of a higher state pension age.",
      options: [
        { label: "Raise it to 68 sooner", result: "The OBR is delighted; older workers are not.",
          effects: { macro: { deficit: -6 }, groups: { pensioners: -0.10, workingclass: -0.05, capitalists: 0.05 } } },
        { label: "Leave it well alone", result: "Politically safe, fiscally costly.",
          effects: { macro: { deficit: 3 }, groups: { pensioners: 0.06 } } }
      ] },
    { id: "ai", title: "AI Disrupts the Workforce",
      desc: "A wave of automation threatens white-collar jobs. Unions want protections; tech wants a free hand.",
      options: [
        { label: "Invest & retrain", result: "A future-facing bet that costs money up front.",
          effects: { policy: { education: 0.08 }, macro: { realGrowth: 0.2 }, groups: { young: 0.05, unions: 0.04 } } },
        { label: "Let innovation rip", result: "Growth and investment surge; displaced workers feel abandoned.",
          effects: { macro: { realGrowth: 0.3, unemployment: 0.3 }, groups: { capitalists: 0.08, workingclass: -0.06 } } }
      ] },
    { id: "water", title: "Drought & Hosepipe Bans",
      desc: "A long dry summer leaves reservoirs low and questions about decades of under-investment.",
      options: [
        { label: "Fund new reservoirs & pipes", result: "Sensible long-term investment; another call on the budget.",
          effects: { policy: { netzero: 0.06 }, macro: { deficit: 3 }, groups: { environment: 0.06 } } },
        { label: "Leave it to the water firms", result: "Bills rise and nothing much changes.",
          effects: { groups: { environment: -0.06, capitalists: 0.03 } } }
      ] },
    { id: "tax", title: "An Autumn Budget Black Hole",
      desc: "The OBR finds a multi-billion-pound shortfall. The Chancellor needs a decision before the statement.",
      options: [
        { label: "Raise taxes to fill it", result: "Credibility with the markets, pain for households.",
          effects: { policy: { incometax: 0.06 }, macro: { deficit: -8 }, all: -0.02 } },
        { label: "Cut public spending", result: "The right cheers; services and their workforce take the hit.",
          effects: { policy: { welfare: -0.05 }, macro: { deficit: -7 }, groups: { poor: -0.06, publicsector: -0.06 } } },
        { label: "Borrow through it", result: "Households spared for now; the debt and the gilt market groan.",
          effects: { macro: { deficit: 10 }, groups: { capitalists: -0.05 } } }
      ] },
    { id: "gambling", title: "Online Safety & Gambling",
      desc: "Campaigners demand a crackdown on gambling firms and harmful online content.",
      options: [
        { label: "Tough new regulation", result: "Popular with families; the industry lobbies hard against you.",
          effects: { policy: { businessreg: 0.08 }, groups: { parents: 0.06, religious: 0.05, capitalists: -0.05 } } },
        { label: "A lighter, voluntary code", result: "Industry-friendly; campaigners are unimpressed.",
          effects: { groups: { capitalists: 0.03, parents: -0.03 } } }
      ] },
    { id: "devolution", title: "Demands for More Devolution",
      desc: "Metro mayors and the devolved nations want more powers and money over their own affairs.",
      options: [
        { label: "Devolve power & funding", result: "Regions cheer; Whitehall loses some grip and some cash.",
          effects: { macro: { deficit: 3 }, groups: { workingclass: 0.05, liberals: 0.04 } } },
        { label: "Keep control in Westminster", result: "Tidy for the Treasury; resentment builds in the regions.",
          effects: { groups: { workingclass: -0.04 } } }
      ] },
    { id: "indyref", title: "Demand for a Second Scottish Referendum",
      desc: "After strong nationalist results, Holyrood demands the power to hold another independence vote.",
      options: [
        { label: "Refuse a referendum", result: "Unionists are reassured; nationalist grievance hardens.",
          effects: { groups: { patriots: 0.06, liberals: -0.04 } } },
        { label: "Grant a Section 30 order", result: "A democratic gesture — and a constitutional gamble.",
          effects: { all: -0.02, groups: { patriots: -0.10, liberals: 0.06 } } }
      ] },
    { id: "mortgages", title: "Mortgage Rate Shock",
      desc: "The Bank holds rates high to fight inflation and millions face a brutal remortgage cliff-edge.",
      cond: function (s) { return s.macro.inflation > 3.5; },
      options: [
        { label: "Launch a mortgage support scheme", result: "Households relieved; it adds to borrowing and props up prices.",
          effects: { macro: { deficit: 6 }, groups: { homeowners: 0.10, middleclass: 0.05 } } },
        { label: "Respect Bank independence, do nothing", result: "Orthodox and prudent; squeezed homeowners are furious.",
          effects: { groups: { homeowners: -0.10, middleclass: -0.06 } } }
      ] },
    { id: "riots", title: "Disorder on the Streets",
      desc: "A spell of rioting and looting erupts across several cities. The police are stretched.",
      cond: function (s) { return s.stats.crime > 0.5 || s.groups.poor < 0.4; },
      options: [
        { label: "Crackdown & fast-track courts", result: "Order restored hard; civil-liberties groups object.",
          effects: { policy: { police: 6, civil: 2 }, stats: { crime: -0.06 }, groups: { patriots: 0.08, liberals: -0.08 } } },
        { label: "Address the root causes", result: "Long-term and humane; the right calls you soft.",
          effects: { policy: { localgov: 8, welfare: 20 }, groups: { poor: 0.06, patriots: -0.06 } } }
      ] },
    { id: "steel", title: "The Last Steelworks Faces Closure",
      desc: "Britain's remaining primary steel plant will shut without state help, taking thousands of jobs.",
      options: [
        { label: "Nationalise / subsidise it", result: "Jobs and sovereignty saved; a heavy, ongoing cost.",
          effects: { macro: { deficit: 4, unemployment: -0.2 }, groups: { workingclass: 0.08, unions: 0.08, capitalists: -0.05 } } },
        { label: "Let it close", result: "Fiscally clean; a heartland community is devastated.",
          effects: { macro: { unemployment: 0.3 }, groups: { workingclass: -0.10, unions: -0.08 } } }
      ] },
    { id: "brexit", title: "A Chance to Reset EU Relations",
      desc: "Brussels offers a deal: closer trade alignment in return for accepting some rules and contributions.",
      options: [
        { label: "Pursue closer alignment", result: "Business and growth welcome it; sovereignty hawks revolt.",
          effects: { macro: { realGrowth: 0.3 }, groups: { capitalists: 0.08, liberals: 0.06, patriots: -0.12, reformvoters: -0.12 } } },
        { label: "Keep your distance", result: "The base is happy; exporters keep grumbling about friction.",
          effects: { macro: { realGrowth: -0.1 }, groups: { patriots: 0.08, capitalists: -0.05 } } }
      ] },
    { id: "fourday", title: "The Four-Day Week",
      desc: "Unions and trial schemes push for a shorter working week with no loss of pay.",
      options: [
        { label: "Back public-sector trials", result: "Workers delighted; business and the Treasury are sceptical.",
          effects: { groups: { unions: 0.10, workingclass: 0.06, young: 0.05, capitalists: -0.08 }, macro: { realGrowth: -0.1 } } },
        { label: "Reject it", result: "The orthodox choice; you look out of touch to younger voters.",
          effects: { groups: { unions: -0.06, young: -0.04 } } }
      ] },
    { id: "flooding", title: "Catastrophic Floods",
      desc: "Record rainfall devastates towns and farmland. The clean-up bill is enormous and climate questions loom.",
      options: [
        { label: "Big resilience & green investment", result: "Praised for leadership; it's expensive.",
          effects: { policy: { netzero: 8, infra: 10 }, macro: { deficit: 5 }, groups: { environment: 0.10, patriots: 0.03 } } },
        { label: "Emergency repairs only", result: "Cheaper now; you look short-termist when the next flood hits.",
          effects: { stats: { environment: -0.04 }, groups: { environment: -0.06 } } }
      ] }
  ];

  // ---------------------------------------------------------------------------
  // MANIFESTO PLEDGES — three are drawn at the start of a term; whether they are
  // met at the next election nudges the player's vote (a trust dividend/penalty).
  // ---------------------------------------------------------------------------
  var PLEDGES = [
    { id: "nhs",        text: "Cut NHS waiting lists",        ok: function (s) { return s.stats.nhs > 0.55; } },
    { id: "deficit",    text: "Get the deficit below £80bn",  ok: function (s) { return s.macro.deficit < 80; } },
    { id: "housing",    text: "Build the homes Britain needs", ok: function (s) { return s.stats.housing > 0.50; } },
    { id: "growth",     text: "Grow the economy above 2%",     ok: function (s) { return s.macro.realGrowth > 2; } },
    { id: "crime",      text: "Cut crime",                     ok: function (s) { return s.stats.crime < 0.35; } },
    { id: "migration",  text: "Bring down net migration",      ok: function (s) { return s.stats.immigration < 0.50; } },
    { id: "debt",       text: "Get debt falling as a share of GDP", ok: function (s) { return s.macro.debtPct < 96; } },
    { id: "equality",   text: "Reduce inequality",             ok: function (s) { return s.stats.equality > 0.58; } },
    { id: "education",  text: "Raise school standards",         ok: function (s) { return s.stats.education > 0.60; } }
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
    FISCAL: FISCAL,
    DILEMMAS: DILEMMAS,
    PLEDGES: PLEDGES,
    POLICIES: POLICIES,
    EVENTS: EVENTS,
    PRESETS: PRESETS,
    BASELINE: BASELINE,
    LOCAL: LOCAL,
    // ordered list of the main GB parties for charts/legends
    MAIN_PARTIES: ["lab", "con", "reform", "ld", "green", "snp", "pc", "oth"]
  };
})();
