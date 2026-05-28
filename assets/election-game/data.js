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
    restore:  { id: "restore",  name: "Restore Britain",       short: "RST", color: "#3b5d99", econ:  0.5, soc:  0.95, playable: true },
    snp:      { id: "snp",      name: "Scottish National Party",short:"SNP", color: "#fdf38e", econ: -0.4, soc: -0.3, playable: true, nation: "sct" },
    pc:       { id: "pc",       name: "Plaid Cymru",           short: "PC",  color: "#3aa68b", econ: -0.5, soc: -0.3, playable: true, nation: "wal" },
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
      } },

    // ---- EXPANSION: additional levers (more distinct choices) ----
    { id: "wealthtax", name: "Wealth Tax", cat: "Taxation", icon: "💎",
      unit: "%", min: 0, max: 3, def: 0, step: 0.1, low: "None", high: "Heavy",
      fiscal: { type: "r", line: "Wealth tax", mode: "derived", base: 0, swing: 28 },
      effects: {
        stats: { equality: 0.22, gdp: -0.12 },
        groups: { wealthy: -0.60, capitalists: -0.42, socialists: 0.32, poor: 0.10, workingclass: 0.06, selfemployed: -0.10 }
      } },
    { id: "banklevy", name: "Bank & Windfall Levy", cat: "Taxation", icon: "🏦",
      unit: "/10", min: 0, max: 10, def: 3, step: 1, low: "Light touch", high: "Aggressive",
      fiscal: { type: "r", line: "Bank & windfall levy", mode: "derived", base: 5, swing: 16 },
      effects: {
        stats: { gdp: -0.08, equality: 0.12 },
        groups: { capitalists: -0.50, wealthy: -0.22, socialists: 0.28, poor: 0.06, unions: 0.08 }
      } },
    { id: "sintax", name: "Alcohol & Tobacco Duty", cat: "Taxation", icon: "🍺",
      unit: "/10", min: 0, max: 10, def: 5, step: 1, low: "Cut", high: "Hike",
      fiscal: { type: "r", line: "Alcohol & tobacco duty", mode: "derived", base: 22, swing: 14 },
      effects: {
        stats: { nhs: 0.10, inflation: 0.06 },
        groups: { workingclass: -0.18, poor: -0.12, religious: 0.10, selfemployed: -0.10, capitalists: -0.06 }
      } },
    { id: "stampduty", name: "Stamp Duty (property)", cat: "Taxation", icon: "🏠",
      unit: "%", min: 0, max: 10, def: 3, step: 0.5, low: "Cut", high: "Raise",
      fiscal: { type: "r", line: "Stamp duty", mode: "derived", base: 14, swing: 14 },
      effects: {
        stats: { housing: -0.08, equality: 0.06 },
        groups: { homeowners: -0.28, capitalists: -0.12, selfemployed: -0.06, socialists: 0.10, young: -0.05 }
      } },
    { id: "sugartax", name: "Sugar & Junk Food Levy", cat: "Taxation", icon: "🥤",
      unit: "/10", min: 0, max: 10, def: 2, step: 1, low: "None", high: "Strong",
      fiscal: { type: "r", line: "Sugar & food levy", mode: "derived", base: 1, swing: 4 },
      effects: {
        stats: { nhs: 0.10 },
        groups: { parents: 0.10, capitalists: -0.08, poor: -0.06, religious: 0.04 }
      } },
    { id: "mentalhealth", name: "Mental Health Services", cat: "Public Services", icon: "🧠",
      unit: "£bn", min: 0, max: 30, def: 12, step: 1, low: "Neglected", high: "Parity of esteem",
      fiscal: { type: "s", line: "Mental health", mode: "direct" },
      effects: {
        stats: { nhs: 0.20, equality: 0.10 },
        groups: { young: 0.18, parents: 0.12, publicsector: 0.10, poor: 0.08 }
      } },
    { id: "prisons", name: "Prisons & Courts", cat: "Public Services", icon: "⛓",
      unit: "£bn", min: 4, max: 35, def: 13, step: 1, low: "Overcrowded", high: "Expand capacity",
      fiscal: { type: "s", line: "Prisons & courts", mode: "direct" },
      effects: {
        stats: { crime: -0.30, equality: -0.03 },
        groups: { patriots: 0.20, pensioners: 0.10, homeowners: 0.08, liberals: -0.10 }
      } },
    { id: "arts", name: "Arts, Culture & Sport", cat: "Public Services", icon: "🎭",
      unit: "£bn", min: 0, max: 25, def: 6, step: 1, low: "Slashed", high: "Flourishing",
      fiscal: { type: "s", line: "Arts, culture & sport", mode: "direct" },
      effects: {
        stats: { education: 0.06, equality: 0.05 },
        groups: { young: 0.10, liberals: 0.10, students: 0.08, patriots: 0.04, capitalists: -0.04 }
      } },
    { id: "science", name: "Science & R&D", cat: "Economy", icon: "🔬",
      unit: "£bn", min: 5, max: 60, def: 20, step: 1, low: "Cut", high: "Moonshot",
      fiscal: { type: "s", line: "Science & R&D", mode: "direct" },
      effects: {
        stats: { gdp: 0.22, education: 0.06 },
        groups: { capitalists: 0.14, privatesector: 0.12, young: 0.08, environment: 0.04 }
      } },
    { id: "skills", name: "Skills & Apprenticeships", cat: "Economy", icon: "🛠",
      unit: "£bn", min: 0, max: 30, def: 8, step: 1, low: "Minimal", high: "Mass reskilling",
      fiscal: { type: "s", line: "Skills & training", mode: "direct" },
      effects: {
        stats: { unemployment: -0.16, gdp: 0.10, education: 0.08 },
        groups: { young: 0.12, workingclass: 0.10, unions: 0.08, privatesector: 0.06 }
      } },
    { id: "border", name: "Border & Asylum Enforcement", cat: "Society", icon: "🛃",
      unit: "£bn", min: 1, max: 20, def: 5, step: 1, low: "Minimal", high: "Fortress Britain",
      fiscal: { type: "s", line: "Border & asylum", mode: "direct" },
      effects: {
        stats: { immigration: -0.20, crime: -0.04 },
        groups: { patriots: 0.30, workingclass: 0.10, liberals: -0.18, minorities: -0.12, capitalists: -0.04 }
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
      effect: { groups: { environment: 0.05, young: 0.04 } } },
    { id: "wagesqueeze", name: "Falling Living Standards", type: "bad",
      desc: "Wages aren't keeping pace with prices and households feel poorer.",
      cond: function (s) { return s.macro.inflation > 4 && s.macro.realGrowth < 1; },
      effect: { groups: { workingclass: -0.05, middleclass: -0.04, young: -0.03 } } },
    { id: "fullemployment", name: "Jobs Boom", type: "good",
      desc: "Unemployment is near record lows and pay is rising.",
      cond: function (s) { return s.macro.unemployment < 3.6; },
      effect: { groups: { workingclass: 0.04, privatesector: 0.04, young: 0.03 } } },
    { id: "schoolscrisis", name: "Crumbling Schools", type: "bad",
      desc: "Reports of unsafe classrooms and teacher shortages make headlines.",
      cond: function (s) { return s.stats.education < 0.3; },
      effect: { stats: { education: -0.02 }, groups: { parents: -0.06, publicsector: -0.04 } } },
    { id: "approvalslump", name: "Mid-Term Blues", type: "bad",
      desc: "The honeymoon is long over and the press has turned on the government.",
      cond: function (s) { return s.turn > 6 && s.approval < 0.43; },
      effect: { groups: { middleclass: -0.02, young: -0.02 } } },
    { id: "intlcrisis", name: "International Crisis", type: "bad",
      desc: "A flare-up overseas tests the government and unsettles markets.",
      cond: function (s) { return s.macro.realGrowth < 0.5 && s.stats.environment < 0.5; },
      effect: { macro: { inflation: 0.1 }, groups: { patriots: -0.03, capitalists: -0.03 } } },
    { id: "techboom", name: "Tech & Investment Boom", type: "good",
      desc: "Britain is attracting record investment in tech and clean energy.",
      cond: function (s) { return s.macro.realGrowth > 2.2 && s.stats.environment > 0.55; },
      effect: { groups: { capitalists: 0.05, privatesector: 0.04, young: 0.03 } } },

    // ---- EXPANSION: more situations, good and bad ----
    { id: "honeymoon", name: "Honeymoon Period", type: "good",
      desc: "A fresh mandate buys you goodwill — the public is willing to give you a chance.",
      cond: function (s) { return s.turn <= 4 && s.termsWon === 0; },
      effect: { groups: { middleclass: 0.03, young: 0.03, privatesector: 0.02 } } },
    { id: "pensionerpoverty", name: "Pensioner Poverty Alarm", type: "bad",
      desc: "Charities warn that more pensioners are choosing between heating and eating.",
      cond: function (s) { return s.groups.pensioners < 0.36; },
      effect: { groups: { pensioners: -0.04, religious: -0.02 } } },
    { id: "braindrain", name: "Capital & Talent Flight", type: "bad",
      desc: "Entrepreneurs and high earners are quietly relocating abroad, taking investment with them.",
      cond: function (s) { return s.groups.capitalists < 0.33 || s.groups.wealthy < 0.32; },
      effect: { macro: { realGrowth: -0.15 }, groups: { capitalists: -0.04, privatesector: -0.03 } } },
    { id: "greenbacklash", name: "Net Zero Backlash", type: "bad",
      desc: "Drivers and small firms revolt against the cost of green policies on their bills.",
      cond: function (s) { return s.groups.motorists < 0.37; },
      effect: { groups: { motorists: -0.04, selfemployed: -0.03, patriots: -0.03 } } },
    { id: "buildingboom", name: "Housebuilding Boom", type: "good",
      desc: "Cranes are back on the skyline and first-time buyers can see a way in at last.",
      cond: function (s) { return s.stats.housing > 0.6; },
      effect: { groups: { renters: 0.05, young: 0.04, privatesector: 0.03 } } },
    { id: "migrationcalm", name: "Borders Under Control", type: "good",
      desc: "Crossings are down and the migration numbers have steadied. The issue cools.",
      cond: function (s) { return s.stats.immigration < 0.45; },
      effect: { groups: { patriots: 0.04, workingclass: 0.03 } } },
    { id: "nhsturnaround", name: "NHS Turnaround", type: "good",
      desc: "Waiting lists are tumbling and satisfaction with the health service is climbing.",
      cond: function (s) { return s.stats.nhs > 0.6; },
      effect: { groups: { pensioners: 0.05, parents: 0.04, publicsector: 0.03 } } },
    { id: "inequalitysurge", name: "Inequality Flashpoint", type: "bad",
      desc: "A widening gap between rich and poor fuels resentment and a sense of unfairness.",
      cond: function (s) { return s.stats.equality < 0.34; },
      effect: { groups: { poor: -0.05, socialists: -0.05, unions: -0.03 } } },
    { id: "populistsurge", name: "Populist Surge", type: "bad",
      desc: "With trust in government low, an insurgent populist message is cutting through.",
      cond: function (s) { return s.turn > 8 && s.approval < 0.4 && s.stats.immigration > 0.6; },
      effect: { groups: { patriots: -0.05, workingclass: -0.04 } } },
    { id: "climatedisaster", name: "Climate in Crisis", type: "bad",
      desc: "A run of extreme weather and degraded nature leaves the public anxious and angry.",
      cond: function (s) { return s.stats.environment < 0.3; },
      effect: { stats: { environment: -0.02 }, groups: { environment: -0.06, young: -0.03 } } },
    { id: "socialcohesion", name: "A More United Country", type: "good",
      desc: "Falling crime and a fairer settlement leave communities feeling more at ease.",
      cond: function (s) { return s.stats.equality > 0.6 && s.stats.crime < 0.34; },
      effect: { groups: { workingclass: 0.03, minorities: 0.03, religious: 0.02 } } },
    { id: "investmentsurge", name: "Confidence Returns", type: "good",
      desc: "Business confidence is the highest in years and firms are hiring and investing.",
      cond: function (s) { return s.groups.capitalists > 0.62 && s.macro.realGrowth > 1.6; },
      effect: { macro: { unemployment: -0.2 }, groups: { privatesector: 0.04, selfemployed: 0.03 } } },
    { id: "manufacturingdecline", name: "Industrial Heartlands Hurting", type: "bad",
      desc: "Plant closures and weak orders are hollowing out manufacturing towns.",
      cond: function (s) { return s.macro.unemployment > 5.5; },
      effect: { groups: { workingclass: -0.05, unions: -0.04, privatesector: -0.03 } } },
    { id: "fiscalheadroom", name: "Fiscal Headroom", type: "good",
      desc: "The Chancellor finds real headroom in the public finances for the first time in years.",
      cond: function (s) { return s.macro.deficit < 55; },
      effect: { groups: { capitalists: 0.04, middleclass: 0.03, wealthy: 0.03 } } }
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
          effects: { policy: { police: 0.12, civil: 0.18 }, stats: { crime: -0.06 }, groups: { patriots: 0.08, liberals: -0.08 } } },
        { label: "Address the root causes", result: "Long-term and humane; the right calls you soft.",
          effects: { policy: { localgov: 0.12, welfare: 0.10 }, groups: { poor: 0.06, patriots: -0.06 } } }
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
          effects: { policy: { netzero: 0.18, infra: 0.18 }, macro: { deficit: 5 }, groups: { environment: 0.10, patriots: 0.03 } } },
        { label: "Emergency repairs only", result: "Cheaper now; you look short-termist when the next flood hits.",
          effects: { stats: { environment: -0.04 }, groups: { environment: -0.06 } } }
      ] },
    { id: "cyber", title: "Major Cyber-Attack",
      desc: "A hostile state cripples hospital and council IT systems for days. Questions mount over preparedness.",
      options: [
        { label: "Invest heavily in cyber-defence", result: "Reassuring and necessary; another bill for the Exchequer.",
          effects: { policy: { defence: 0.10, civil: 0.15 }, groups: { patriots: 0.05, capitalists: 0.03 } } },
        { label: "Play it down", result: "You avoid a panic, but look complacent when the next breach lands.",
          effects: { all: -0.02, groups: { liberals: -0.02 } } }
      ] },
    { id: "royal", title: "A National Royal Occasion", cond: function (s) { return true; },
      desc: "A jubilee-style national celebration is proposed. It would lift the mood — at a cost.",
      options: [
        { label: "Fund a grand celebration", result: "A feel-good national moment; republicans grumble at the spend.",
          effects: { macro: { deficit: 2 }, all: 0.03, groups: { patriots: 0.06, socialists: -0.03 } } },
        { label: "Keep it modest", result: "Prudent, if a little joyless.",
          effects: { groups: { patriots: -0.02 } } }
      ] },
    { id: "sport", title: "Home Nations Triumph",
      desc: "A British team wins a major tournament — the country is euphoric and looking to the government to mark it.",
      options: [
        { label: "Bask in the glory (bank holiday)", result: "A popular feel-good moment; business grumbles at the lost day.",
          effects: { all: 0.04, groups: { capitalists: -0.03, workingclass: 0.04 } } },
        { label: "Congratulate and move on", result: "A missed open goal, some say.",
          effects: { all: 0.01 } }
      ] },
    { id: "tradedeal", title: "A Major Trade Deal",
      desc: "Negotiators land a big trade deal — but it means opening up sensitive sectors like farming.",
      options: [
        { label: "Sign it", result: "A growth boost and a diplomatic win; farmers feel betrayed.",
          effects: { macro: { realGrowth: 0.3 }, groups: { capitalists: 0.06, selfemployed: -0.06, patriots: -0.03 } } },
        { label: "Protect domestic sectors", result: "Safe at home; critics call you a protectionist.",
          effects: { groups: { selfemployed: 0.05, capitalists: -0.04 } } }
      ] },
    { id: "carehome", title: "Social Care Collapse",
      desc: "A big care provider goes bust, leaving thousands of vulnerable people at risk.",
      cond: function (s) { return s.stats.nhs < 0.45; },
      options: [
        { label: "Step in and fund care", result: "The right thing to do; it's a major new commitment.",
          effects: { policy: { socialcare: 0.25 }, groups: { pensioners: 0.10, parents: 0.05 } } },
        { label: "Find a private buyer", result: "Cheaper for the Treasury; continuity of care is shaky.",
          effects: { groups: { pensioners: -0.06, capitalists: 0.03 } } }
      ] },

    // ---- EXPANSION: a much wider deck of decisions (many gated by context) ----
    { id: "dentistry", title: "NHS Dental Deserts",
      desc: "Whole towns have no NHS dentist taking patients. People are pulling their own teeth — the story is everywhere.",
      cond: function (s) { return s.stats.nhs < 0.5; },
      options: [
        { label: "Emergency dentistry contract", result: "New funding lures dentists back to the NHS; the Treasury winces.",
          effects: { policy: { nhs: 0.05 }, stats: { nhs: 0.04 }, groups: { parents: 0.06, poor: 0.06, pensioners: 0.05 } } },
        { label: "Leave it to the market", result: "Private practices fill the gap; the poorest simply go without.",
          effects: { stats: { equality: -0.04 }, groups: { poor: -0.07, parents: -0.04 } } }
      ] },
    { id: "unibankrupt", title: "A University Is Going Bust",
      desc: "A large university warns it cannot make payroll. A collapse would strand thousands of students and gut a city's economy.",
      options: [
        { label: "Bail it out", result: "Jobs and courses saved; rivals ask where their cheque is.",
          effects: { macro: { deficit: 3 }, groups: { students: 0.08, young: 0.05, publicsector: 0.04 }, capital: -1 } },
        { label: "Let it merge or fold", result: "A market in higher education, you say. Campus towns are appalled.",
          effects: { stats: { education: -0.05 }, groups: { students: -0.10, young: -0.06 } } },
        { label: "Lift the cap on tuition fees", result: "You shore up finances by loading more debt on graduates.",
          effects: { policy: { tuition: 0.12 }, groups: { students: -0.12, young: -0.08, capitalists: 0.04 } } }
      ] },
    { id: "assisteddying", title: "Assisted Dying Bill",
      desc: "A backbench bill on assisted dying reaches the floor. It is a free vote, but the country wants to know where you stand.",
      options: [
        { label: "Back the reform", result: "Liberals and campaigners are moved; faith groups are dismayed.",
          effects: { groups: { liberals: 0.10, young: 0.04, religious: -0.12 } } },
        { label: "Oppose it", result: "Religious and disability groups are reassured; reformers call you timid.",
          effects: { groups: { religious: 0.10, liberals: -0.08 } } },
        { label: "Stay neutral, let the House decide", result: "Prime-ministerial detachment — or a dodge, depending who you ask.",
          effects: { all: -0.01 } }
      ] },
    { id: "smokingban", title: "A Smoke-Free Generation",
      desc: "A bill would ban tobacco sales to anyone born after a certain year for life. Liberty campaigners and the trade are furious.",
      options: [
        { label: "Push the ban through", result: "A landmark public-health win; libertarians cry nanny state.",
          effects: { stats: { nhs: 0.04 }, groups: { parents: 0.06, religious: 0.05, liberals: -0.06, capitalists: -0.05 } } },
        { label: "Drop it as illiberal", result: "You spare the corner shop and your right flank; doctors despair.",
          effects: { groups: { liberals: 0.04, selfemployed: 0.05, publicsector: -0.04 } } }
      ] },
    { id: "lords", title: "Abolish the House of Lords?",
      desc: "Reformers want the unelected second chamber replaced with an elected senate. Traditionalists warn of constitutional vandalism.",
      options: [
        { label: "Legislate for an elected chamber", result: "A radical democratic shake-up that will eat years of parliamentary time.",
          effects: { groups: { liberals: 0.08, young: 0.05, patriots: -0.06 }, capital: -2 } },
        { label: "Keep the Lords, tweak the edges", result: "You pick easier fights; reformers shrug.",
          effects: { groups: { liberals: -0.03 } } }
      ] },
    { id: "votingage", title: "Votes at 16",
      desc: "Your manifesto flirted with lowering the voting age to 16. The bill is ready — and so is the backlash.",
      options: [
        { label: "Lower the voting age", result: "Young people are enfranchised; opponents smell partisan advantage.",
          effects: { groups: { young: 0.12, students: 0.08, patriots: -0.05, pensioners: -0.04 } } },
        { label: "Keep it at 18", result: "No change — campaigners accuse you of fearing the youth vote.",
          effects: { groups: { young: -0.05 } } }
      ] },
    { id: "airport", title: "Airport Expansion",
      desc: "Plans for a new runway promise jobs and growth — and a wall of legal challenges from climate groups and residents.",
      options: [
        { label: "Approve expansion", result: "Business cheers the capacity; the green movement is incandescent.",
          effects: { macro: { realGrowth: 0.2 }, stats: { environment: -0.06 }, groups: { capitalists: 0.08, privatesector: 0.06, environment: -0.14, young: -0.05 } } },
        { label: "Block it on climate grounds", result: "Greens are delighted; aviation and unions warn of lost investment.",
          effects: { groups: { environment: 0.10, capitalists: -0.06, unions: -0.04 } } }
      ] },
    { id: "nuclear", title: "Green-Light a Nuclear Plant",
      desc: "A huge new nuclear station would secure baseload power for decades — at a vast upfront cost and with a foreign partner.",
      options: [
        { label: "Approve it", result: "Energy security and skilled jobs; the bill and the partner raise eyebrows.",
          effects: { policy: { netzero: 0.10 }, macro: { deficit: 5 }, stats: { environment: 0.05 }, groups: { unions: 0.06, capitalists: 0.05, environment: 0.04 } } },
        { label: "Back renewables instead", result: "Cheaper and greener to some; others fear the lights going out on a still, cold night.",
          effects: { policy: { netzero: 0.08 }, groups: { environment: 0.08, capitalists: -0.04 } } }
      ] },
    { id: "northsea", title: "North Sea Drilling Licences",
      desc: "New oil and gas licences would mean tax revenue and jobs now — and a torched climate reputation.",
      options: [
        { label: "Issue the licences", result: "The Exchequer and the north-east coast benefit; you own the emissions.",
          effects: { macro: { deficit: -3 }, stats: { environment: -0.08 }, groups: { workingclass: 0.05, capitalists: 0.06, patriots: 0.05, environment: -0.16, young: -0.06 } } },
        { label: "Keep them in the ground", result: "Climate credibility intact; the right calls it economic self-harm.",
          effects: { stats: { environment: 0.06 }, groups: { environment: 0.10, workingclass: -0.04, patriots: -0.05 } } }
      ] },
    { id: "travelchaos", title: "Border Force Strike Threatens Summer",
      desc: "Border Force staff vote to strike over the school holidays. Airports warn of queues snaking out of the terminals.",
      cond: function (s) { return s.groups.publicsector < 0.46; },
      options: [
        { label: "Improve the pay offer", result: "Holidays saved; another department's pay anchor is blown.",
          effects: { groups: { publicsector: 0.06, unions: 0.05 }, capital: -1 } },
        { label: "Draft in the military", result: "Queues ease, just; unions accuse you of strike-breaking.",
          effects: { policy: { defence: 0.04 }, groups: { unions: -0.06, patriots: 0.04 } } }
      ] },
    { id: "poundrun", title: "A Run on the Pound",
      desc: "Sterling tumbles on the markets after a jittery week. The Governor wants to know the government has a grip.",
      cond: function (s) { return s.macro.debtPct > 100 || s.macro.deficit > 170; },
      options: [
        { label: "Announce a credible savings plan", result: "Markets steady; the cuts will be felt across Whitehall.",
          effects: { policy: { welfare: -0.04 }, macro: { deficit: -6 }, groups: { poor: -0.05, publicsector: -0.05, capitalists: 0.05 } } },
        { label: "Tough it out and blame speculators", result: "Defiant — but the pound keeps sliding and import prices bite.",
          effects: { macro: { inflation: 0.3, realGrowth: -0.2 }, groups: { capitalists: -0.06, middleclass: -0.04 } } }
      ] },
    { id: "downgrade", title: "Credit Rating on Watch",
      desc: "A ratings agency puts the UK on negative watch, citing the debt trajectory. A downgrade would push up borrowing costs.",
      cond: function (s) { return s.macro.debtPct > 105; },
      options: [
        { label: "Pencil in tax rises", result: "Fiscal credibility restored at a cost to households.",
          effects: { policy: { incometax: 0.04 }, macro: { deficit: -5 }, all: -0.02 } },
        { label: "Reject 'austerity 2.0'", result: "Your base is relieved; the agency pulls the trigger and gilts sell off.",
          effects: { macro: { realGrowth: -0.2 }, groups: { capitalists: -0.06, wealthy: -0.05 } } }
      ] },
    { id: "payreview", title: "Pay Review Body Recommends 6%",
      desc: "The independent pay body recommends a 6% rise for millions of public-sector workers — well above what the Treasury budgeted.",
      options: [
        { label: "Accept it in full", result: "Workers and unions are delighted; the deficit takes the strain.",
          effects: { macro: { deficit: 7 }, groups: { publicsector: 0.10, unions: 0.08, capitalists: -0.05 } } },
        { label: "Phase it / partly fund it", result: "A classic fudge — nobody is thrilled, nobody walks out.",
          effects: { macro: { deficit: 3 }, groups: { publicsector: 0.02 } } },
        { label: "Reject it", result: "The books are protected; a winter of discontent looms.",
          effects: { groups: { publicsector: -0.10, unions: -0.10 } } }
      ] },
    { id: "rwanda", title: "An Offshore Asylum Scheme",
      desc: "Officials present a plan to process asylum claims in a third country. Backers call it a deterrent; critics call it unlawful and cruel.",
      cond: function (s) { return s.stats.immigration > 0.55; },
      options: [
        { label: "Press ahead", result: "Reform-leaning voters cheer; the courts and the UN are on a collision course with you.",
          effects: { policy: { immigration: 0.10 }, macro: { deficit: 2 }, groups: { patriots: 0.10, liberals: -0.12, minorities: -0.08 } } },
        { label: "Scrap it for a faster returns deal", result: "Pragmatic and cheaper; the right says you've gone soft.",
          effects: { stats: { immigration: -0.04 }, groups: { liberals: 0.05, patriots: -0.06 } } }
      ] },
    { id: "studentcap", title: "Cap on International Students?",
      desc: "Net migration figures are dominated by foreign students. Capping them would cut the numbers — and a vital income stream for universities.",
      cond: function (s) { return s.stats.immigration > 0.5; },
      options: [
        { label: "Cap student visas", result: "Migration falls on paper; universities warn of a black hole.",
          effects: { policy: { immigration: -0.08 }, stats: { immigration: -0.05, education: -0.04 }, groups: { patriots: 0.08, students: -0.06, capitalists: -0.05 } } },
        { label: "Protect the student route", result: "Universities and growth are spared; the tabloids howl at the numbers.",
          effects: { groups: { patriots: -0.06, capitalists: 0.04, students: 0.05 } } }
      ] },
    { id: "grooming", title: "Calls for a National Inquiry",
      desc: "Fresh revelations spark demands for a full statutory inquiry into historic grooming-gang failures. It will be explosive whatever you do.",
      options: [
        { label: "Order a full statutory inquiry", result: "Survivors are heard; the process will run for years and unearth uncomfortable truths.",
          effects: { groups: { patriots: 0.06, workingclass: 0.05, minorities: -0.04 }, capital: -1 } },
        { label: "Point to existing reviews", result: "You avoid a circus; campaigners accuse you of a cover-up.",
          effects: { groups: { patriots: -0.08, workingclass: -0.05 } } }
      ] },
    { id: "protestlaw", title: "Protesters Blockade the Motorways",
      desc: "Climate activists keep gluing themselves to the M25. Commuters are livid; civil-liberties groups defend the right to protest.",
      cond: function (s) { return s.stats.environment > 0.5 || s.stats.crime > 0.45; },
      options: [
        { label: "Tough new protest laws", result: "Drivers cheer the crackdown; lawyers warn of a chilling effect.",
          effects: { policy: { civil: 0.16, police: 0.06 }, stats: { crime: -0.03 }, groups: { motorists: 0.08, patriots: 0.06, liberals: -0.12, young: -0.06 } } },
        { label: "Defend the right to protest", result: "Liberals approve; the phone-ins savage you as weak.",
          effects: { groups: { liberals: 0.08, motorists: -0.08, patriots: -0.05 } } }
      ] },
    { id: "gendreform", title: "Gender Recognition Reform",
      desc: "A bill to simplify legal gender recognition has split the country — and your own party — down the middle.",
      options: [
        { label: "Back the reform", result: "Younger liberal voters rally to you; others recoil.",
          effects: { groups: { young: 0.06, liberals: 0.10, religious: -0.08, patriots: -0.06 }, unity: -0.04 } },
        { label: "Block it, protect single-sex spaces", result: "You reassure one camp and enrage the other in equal measure.",
          effects: { groups: { religious: 0.06, patriots: 0.05, liberals: -0.10, young: -0.05 }, unity: -0.04 } }
      ] },
    { id: "bbc", title: "Abolish the Licence Fee?",
      desc: "The BBC charter is up for renewal. The right wants the licence fee scrapped; others warn it would gut public broadcasting.",
      options: [
        { label: "Freeze and reform the fee", result: "A middle path that irritates the BBC and its critics alike.",
          effects: { groups: { patriots: 0.04, liberals: -0.03 } } },
        { label: "Scrap it for subscription", result: "Your right flank is thrilled; the cultural establishment is up in arms.",
          effects: { groups: { patriots: 0.08, capitalists: 0.04, liberals: -0.08, pensioners: -0.05 } } },
        { label: "Guarantee its funding", result: "Defenders of public broadcasting cheer; the right fumes.",
          effects: { macro: { deficit: 1 }, groups: { liberals: 0.06, patriots: -0.06 } } }
      ] },
    { id: "triplelock", title: "The Triple Lock Bites",
      desc: "A spike in earnings means the pension triple lock will cost billions more than forecast. The Treasury wants it suspended for a year.",
      cond: function (s) { return s.macro.deficit > 130; },
      options: [
        { label: "Honour the triple lock", result: "Pensioners are protected; the fiscal hawks despair.",
          effects: { policy: { pension: 0.06 }, macro: { deficit: 4 }, groups: { pensioners: 0.10, wealthy: -0.03 } } },
        { label: "Suspend it for a year", result: "You bank the saving and break a totemic promise.",
          effects: { macro: { deficit: -5 }, groups: { pensioners: -0.14, workingclass: -0.04 } } }
      ] },
    { id: "pip", title: "Disability Benefits Overhaul",
      desc: "Spending on health-related benefits is soaring. Reformers want tougher assessments; charities warn of pushing the sick into poverty.",
      options: [
        { label: "Tighten the assessments", result: "Big savings on paper; a backlash from disabled people and your own backbenches.",
          effects: { policy: { welfare: -0.06 }, macro: { deficit: -6 }, groups: { poor: -0.10, socialists: -0.06 }, unity: -0.05 } },
        { label: "Invest in back-to-work support", result: "Kinder and slower; the savings are years away.",
          effects: { policy: { welfare: 0.03 }, macro: { deficit: 2 }, groups: { poor: 0.06, unions: 0.04 } } }
      ] },
    { id: "gig", title: "Gig-Economy Workers' Rights",
      desc: "A court ruling forces a decision on whether app drivers and couriers are workers with full rights or self-employed contractors.",
      options: [
        { label: "Grant full employment rights", result: "Workers gain sick pay and the minimum wage; the platforms threaten to pull back.",
          effects: { policy: { businessreg: 0.10 }, stats: { equality: 0.05 }, groups: { workingclass: 0.08, young: 0.06, unions: 0.08, capitalists: -0.08, selfemployed: -0.05 } } },
        { label: "Preserve 'flexibility'", result: "Business breathes out; campaigners call it a charter for exploitation.",
          effects: { groups: { capitalists: 0.06, selfemployed: 0.05, unions: -0.08, workingclass: -0.05 } } }
      ] },
    { id: "horizon", title: "A Wrongful-Conviction Scandal",
      desc: "Hundreds were prosecuted on faulty computer evidence. The country demands swift justice and compensation for the victims.",
      options: [
        { label: "Exonerate all and pay up fast", result: "The right thing, universally applauded; the bill lands on the taxpayer.",
          effects: { macro: { deficit: 3 }, all: 0.03, groups: { selfemployed: 0.06 }, capital: -1 } },
        { label: "Let the courts grind on case by case", result: "Legally tidy; victims die waiting and the public seethes.",
          effects: { all: -0.03 } }
      ] },
    { id: "renters", title: "Ban No-Fault Evictions?",
      desc: "Campaigners demand an end to Section 21 evictions. Landlords warn they'll sell up and shrink the rental market.",
      cond: function (s) { return s.stats.housing < 0.5; },
      options: [
        { label: "Ban no-fault evictions", result: "Renters gain security; some landlords head for the exit.",
          effects: { policy: { businessreg: 0.06 }, stats: { housing: -0.03 }, groups: { renters: 0.12, young: 0.06, homeowners: -0.06, capitalists: -0.05 } } },
        { label: "Side with landlords", result: "Supply is protected, sort of; a generation of renters feels abandoned.",
          effects: { groups: { renters: -0.10, young: -0.06, homeowners: 0.05 } } }
      ] },
    { id: "mansion", title: "A Council Tax Revaluation",
      desc: "Bands are still based on 1991 values. A revaluation would be fairer — and create millions of furious losers in higher-value homes.",
      options: [
        { label: "Revalue and add higher bands", result: "Progressive and overdue; the shires and the tabloids declare war.",
          effects: { policy: { counciltax: 0.10 }, stats: { equality: 0.06 }, macro: { deficit: -3 }, groups: { wealthy: -0.12, homeowners: -0.10, poor: 0.06, socialists: 0.06 } } },
        { label: "Leave the bands frozen", result: "No new enemies today; the system stays absurd.",
          effects: { groups: { homeowners: 0.03 } } }
      ] },
    { id: "obesity", title: "Weight-Loss Jabs on the NHS",
      desc: "New weight-loss drugs could transform public health — or bankrupt the prescriptions budget if offered to everyone.",
      cond: function (s) { return s.stats.nhs > 0.35; },
      options: [
        { label: "Roll them out widely", result: "A bold bet on prevention; a huge bill upfront.",
          effects: { policy: { nhs: 0.04 }, macro: { deficit: 3 }, stats: { nhs: 0.03 }, groups: { poor: 0.05, parents: 0.04 } } },
        { label: "Restrict to the most severe", result: "Affordable and clinically cautious; campaigners want more.",
          effects: { groups: { poor: -0.02 } } }
      ] },
    { id: "fishing", title: "A Fishing Rights Row",
      desc: "Talks on coastal waters access turn ugly. Fishing communities want them out; exporters want the wider deal that depends on a compromise.",
      options: [
        { label: "Protect the fishing fleet", result: "Coastal towns cheer; a bigger trade prize slips away.",
          effects: { groups: { patriots: 0.06, selfemployed: 0.05, capitalists: -0.04 } } },
        { label: "Trade access for market deal", result: "Exporters win; the harbours feel betrayed all over again.",
          effects: { macro: { realGrowth: 0.2 }, groups: { capitalists: 0.06, patriots: -0.08, selfemployed: -0.05 } } }
      ] },
    { id: "aidappeal", title: "A Famine Appeal",
      desc: "A catastrophic famine unfolds abroad. The cameras are there, and the world is looking to Britain to lead the response.",
      options: [
        { label: "Lead a major aid package", result: "A humanitarian and diplomatic win; the right asks why charity isn't at home.",
          effects: { policy: { foreignaid: 0.15 }, groups: { liberals: 0.08, religious: 0.06, patriots: -0.06, reformvoters: -0.05 } } },
        { label: "Offer only token help", result: "Money stays at home; Britain's standing takes a knock.",
          effects: { groups: { liberals: -0.06, patriots: 0.04 } } }
      ] },
    { id: "procurement", title: "Defence Procurement Fiasco",
      desc: "A flagship military programme is years late and billions over budget. Heads, and contracts, could roll.",
      options: [
        { label: "Cancel and start over", result: "Decisive and costly; capability gaps worry the brass.",
          effects: { macro: { deficit: 2 }, groups: { patriots: -0.04, capitalists: -0.05 } } },
        { label: "Pour in more money to save it", result: "Sunk-cost diplomacy keeps allies and jobs onside.",
          effects: { policy: { defence: 0.08 }, macro: { deficit: 3 }, groups: { patriots: 0.05, unions: 0.04 } } }
      ] },
    { id: "watercap", title: "Cap Soaring Water Bills",
      desc: "After years of leaks and dividends, water firms want to hike bills to pay for upgrades. Customers are at the end of their tether.",
      options: [
        { label: "Cap bills and force investment", result: "Households relieved; investors flee a capped, leaky sector.",
          effects: { policy: { businessreg: 0.10 }, stats: { environment: 0.04 }, groups: { workingclass: 0.06, environment: 0.06, capitalists: -0.08 } } },
        { label: "Allow the rises for investment", result: "The pipes get fixed eventually; bill-payers fund it now.",
          effects: { stats: { environment: 0.05 }, groups: { workingclass: -0.06, pensioners: -0.05 } } }
      ] },
    { id: "earlyrelease", title: "AI in the Public Sector",
      desc: "Officials propose deploying AI across the civil service to cut costs — and, quietly, tens of thousands of jobs.",
      options: [
        { label: "Go all-in on automation", result: "Productivity and savings surge; the unions declare war.",
          effects: { macro: { deficit: -4, realGrowth: 0.2 }, groups: { capitalists: 0.06, publicsector: -0.10, unions: -0.08 } } },
        { label: "Adopt it slowly with safeguards", result: "Jobs protected for now; the savings are modest.",
          effects: { groups: { publicsector: 0.04, unions: 0.03 } } }
      ] }
  ];

  // ---------------------------------------------------------------------------
  // MANIFESTO PLEDGES — three are drawn at the start of a term; whether they are
  // met at the next election nudges the player's vote (a trust dividend/penalty).
  // ---------------------------------------------------------------------------
  var PLEDGES = [
    { id: "nhs",        text: "Cut NHS waiting lists",
      metric: function (s) { return s.stats.nhs; }, target: 0.55, hi: true,
      fmt: function (v) { return Math.round(v * 100) + " / 100"; },
      ok: function (s) { return s.stats.nhs > 0.55; } },
    { id: "deficit",    text: "Get the deficit below £80bn",
      metric: function (s) { return s.macro.deficit; }, target: 80, hi: false,
      fmt: function (v) { return "£" + Math.round(v) + "bn"; },
      ok: function (s) { return s.macro.deficit < 80; } },
    { id: "housing",    text: "Build the homes Britain needs",
      metric: function (s) { return s.stats.housing; }, target: 0.50, hi: true,
      fmt: function (v) { return Math.round(v * 100) + " / 100"; },
      ok: function (s) { return s.stats.housing > 0.50; } },
    { id: "growth",     text: "Grow the economy above 2%",
      metric: function (s) { return s.macro.realGrowth; }, target: 2, hi: true,
      fmt: function (v) { return v.toFixed(1) + "%"; },
      ok: function (s) { return s.macro.realGrowth > 2; } },
    { id: "crime",      text: "Cut crime",
      metric: function (s) { return s.stats.crime; }, target: 0.35, hi: false,
      fmt: function (v) { return Math.round(v * 100) + " / 100"; },
      ok: function (s) { return s.stats.crime < 0.35; } },
    { id: "migration",  text: "Bring down net migration",
      metric: function (s) { return s.stats.immigration; }, target: 0.50, hi: false,
      fmt: function (v) { return Math.round(v * 100) + " / 100"; },
      ok: function (s) { return s.stats.immigration < 0.50; } },
    { id: "debt",       text: "Get debt falling as a share of GDP",
      metric: function (s) { return s.macro.debtPct; }, target: 96, hi: false,
      fmt: function (v) { return Math.round(v) + "% GDP"; },
      ok: function (s) { return s.macro.debtPct < 96; } },
    { id: "equality",   text: "Reduce inequality",
      metric: function (s) { return s.stats.equality; }, target: 0.58, hi: true,
      fmt: function (v) { return Math.round(v * 100) + " / 100"; },
      ok: function (s) { return s.stats.equality > 0.58; } },
    { id: "education",  text: "Raise school standards",
      metric: function (s) { return s.stats.education; }, target: 0.60, hi: true,
      fmt: function (v) { return Math.round(v * 100) + " / 100"; },
      ok: function (s) { return s.stats.education > 0.60; } }
  ];

  // ---------------------------------------------------------------------------
  // POLL PRESETS — national GB vote shares used to seed the swingometer.
  // 2024 is the actual headline result. Others are illustrative scenarios.
  // ---------------------------------------------------------------------------
  var PRESETS = {
    ge2024: { name: "2024 General Election (actual)",
      shares: { lab: 33.7, con: 23.7, reform: 14.3, restore: 0, ld: 12.2, green: 6.7, snp: 2.5, pc: 0.7, oth: 6.2 } },
    may2026: { name: "Current polling (May 2026)",
      shares: { lab: 19, con: 18, reform: 26, restore: 6, ld: 12, green: 14, snp: 2.5, pc: 0.7, oth: 1.8 } },
    reformsurge: { name: "Reform surge (illustrative)",
      shares: { lab: 22, con: 16, reform: 30, restore: 4, ld: 11, green: 9, snp: 2.5, pc: 0.7, oth: 4.8 } },
    contoryrecovery: { name: "Conservative recovery (illustrative)",
      shares: { lab: 26, con: 30, reform: 10, restore: 4, ld: 12, green: 8, snp: 2.5, pc: 0.7, oth: 6.8 } },
    progressive: { name: "Progressive wave (illustrative)",
      shares: { lab: 36, con: 16, reform: 10, restore: 2, ld: 14, green: 14, snp: 2.5, pc: 0.8, oth: 4.7 } },
    restoresurge: { name: "Right splinter (illustrative)",
      shares: { lab: 24, con: 17, reform: 18, restore: 14, ld: 12, green: 8, snp: 2.5, pc: 0.7, oth: 3.8 } }
  };

  // Default GB share used to compute swing in the regional model = 2024.
  var BASELINE = PRESETS.ge2024.shares;

  // ---------------------------------------------------------------------------
  // WINNING BASELINES — for each playable party, the national vote shares of
  // the counterfactual general election they JUST won. The live projection
  // anchors the player to these (so a Con or Reform PM doesn't see Labour as
  // the largest party at the start of their term). For Labour these are the
  // actual 2024 numbers. For SNP / PC, a UK-level win is implausible so they
  // keep close to 2024 (a serious choice if you pick them).
  // ---------------------------------------------------------------------------
  var WINNING_BASELINE = {
    lab:     { lab: 33.7, con: 22.7, reform: 11.3, restore: 6.0, ld: 12.2, green: 6.7,  snp: 2.5, pc: 0.7, oth: 4.2 },
    con:     { lab: 27.0, con: 42.4, reform: 5.0,  restore: 5.0, ld: 10.5, green: 5.0,  snp: 2.5, pc: 0.7, oth: 2.9 },
    reform:  { lab: 22.0, con: 14.0, reform: 40.0, restore: 5.0, ld: 9.0,  green: 6.0,  snp: 2.5, pc: 0.7, oth: 0.8 },
    ld:      { lab: 20.0, con: 16.0, reform: 8.0,  restore: 5.0, ld: 38.0, green: 7.0,  snp: 2.5, pc: 0.7, oth: 2.8 },
    green:   { lab: 19.0, con: 14.0, reform: 8.0,  restore: 5.0, ld: 10.0, green: 35.0, snp: 2.5, pc: 0.7, oth: 5.8 },
    snp:     { lab: 32.0, con: 20.0, reform: 12.0, restore: 5.0, ld: 12.0, green: 7.0,  snp: 5.0, pc: 0.7, oth: 6.3 },
    pc:      { lab: 33.0, con: 21.0, reform: 12.0, restore: 5.0, ld: 12.0, green: 7.0,  snp: 2.5, pc: 1.0, oth: 6.5 },
    restore: { lab: 22.0, con: 13.0, reform: 12.0, restore: 35.0, ld: 9.0, green: 5.0, snp: 2.5, pc: 0.7, oth: 0.8 }
  };

  // ---------------------------------------------------------------------------
  // LOCAL ELECTIONS — a national-equivalent-vote model. Approx total principal
  // council seats up for the cycle, allocated proportionally with a small
  // incumbency/FPTP distortion handled in the engine.
  // ---------------------------------------------------------------------------
  var LOCAL = {
    totalSeats: 8000,
    councils: 230,
    // party tendency multipliers for converting national share to local seats
    localBias: { lab: 1.02, con: 1.05, ld: 1.18, green: 1.10, reform: 0.85, restore: 0.80, oth: 1.25, snp: 1.0, pc: 1.0 }
  };

  // ---------------------------------------------------------------------------
  // SCENARIOS — alternative opening positions, applied on top of the settled
  // 2024 baseline. macro fields are absolute overrides; stats/groups are deltas.
  // ---------------------------------------------------------------------------
  var SCENARIOS = [
    { id: "steady", name: "Steady Hand", blurb: "The real July 2024 inheritance — tough but stable. The default way to play." },
    { id: "recession", name: "Inherit a Recession", blurb: "The economy is shrinking and unemployment is climbing as you take office.",
      macro: { realGrowth: -1.2, unemployment: 6.3, inflation: 2.0 }, pressure: 2,
      groups: { workingclass: -0.06, privatesector: -0.06, capitalists: -0.05 } },
    { id: "costliving", name: "Cost-of-Living Crisis", blurb: "Inflation is rampant and household budgets are at breaking point.",
      macro: { inflation: 7.5, realGrowth: 0.4 },
      groups: { poor: -0.12, workingclass: -0.10, renters: -0.07, pensioners: -0.05 } },
    { id: "debt", name: "Markets on the Brink", blurb: "Debt is dangerously high and the gilt markets watch your every move.",
      macro: { debt: 3050, realGrowth: 0.6, inflation: 3.4 },
      groups: { capitalists: -0.06, wealthy: -0.05 } },
    { id: "populist", name: "Populist Surge", blurb: "An insurgent right is riding high; the mood is volatile and anti-establishment.",
      stats: { immigration: 0.12 }, groups: { patriots: -0.12, workingclass: -0.07, liberals: -0.04 } }
  ];

  // OPPOSITION SCENARIOS — starting positions for the leader of the Opposition.
  var OPP_SCENARIOS = [
    { id: "even", name: "Even Race", blurb: "The 2024 baseline — the contest is genuinely open." },
    { id: "honeymoon", name: "Honeymoon Government", blurb: "The incumbent rides a wave; you must build momentum from a low base.",
      oppShare: -5, govApproval: 0.06 },
    { id: "wounded", name: "Wounded Government", blurb: "The government is on the ropes; the prize is closer, but everyone is hunting it.",
      oppShare: 6, govApproval: -0.08 }
  ];

  // ---------------------------------------------------------------------------
  // CRISIS CHAINS — multi-stage scripted events. Each chain has a trigger, a
  // persistent per-turn drag while it is live, and a sequence of stages. Each
  // stage is a decision (lands as a dilemma); the chosen option either advances
  // the chain (in N turns) or ends it. crisisHistory prevents the same chain
  // from firing twice in one game.
  // ---------------------------------------------------------------------------
  var CRISES = [
    { id: "pandemic", name: "Respiratory Pandemic",
      trigger: function (s) { return s.turn > 8 && Math.random() < 0.025; },
      drag: { stats: { nhs: -0.012 }, groups: { pensioners: -0.015, parents: -0.010, publicsector: 0.004 }, macro: { realGrowth: -0.05 } },
      stages: [
        { title: "A New Pandemic", desc: "A novel respiratory virus is spreading fast. Modellers warn of catastrophic loss of life without action.",
          options: [
            { label: "Order a national lockdown", result: "The country goes into lockdown. A grim, expensive shock — but a clear plan.",
              effects: { macro: { realGrowth: -0.6 }, all: 0.03, policy: { welfare: 0.05 }, capital: -1 }, next: 1, in: 3 },
            { label: "Targeted shielding, keep economy open", result: "Schools and pubs stay open; the vulnerable are told to hide.",
              effects: { stats: { nhs: -0.04 }, groups: { publicsector: -0.06, pensioners: -0.08, capitalists: 0.04 } }, next: 1, in: 3 },
            { label: "Pour billions into a vaccination programme", result: "A national mobilisation that everyone watches anxiously.",
              effects: { macro: { deficit: 8, realGrowth: -0.1 }, policy: { nhs: 0.05 }, all: 0.02, capital: -2 }, next: 1, in: 3 }
          ] },
        { title: "Eye of the Storm", desc: "Hospitals are stretched to breaking, supply lines are wobbling and the public mood is volatile.",
          options: [
            { label: "Pour money into the NHS and frontline pay", result: "Doctors and nurses cheer; the Treasury looks queasy.",
              effects: { policy: { nhs: 0.08 }, macro: { deficit: 6 }, groups: { publicsector: 0.10, unions: 0.06 } }, next: 2, in: 3 },
            { label: "Suspend red tape and fast-track everything", result: "Things move at last; lawyers and liberals warn of overreach.",
              effects: { stats: { nhs: 0.04 }, groups: { capitalists: 0.05, liberals: -0.05 }, capital: -1 }, next: 2, in: 3 },
            { label: "Tighten restrictions hard", result: "More lives saved; another deep hit to growth and morale.",
              effects: { macro: { realGrowth: -0.3 }, all: -0.02, groups: { workingclass: -0.04 } }, next: 2, in: 3 }
          ] },
        { title: "The Aftermath", desc: "The virus recedes. The country wants answers and to know what comes next.",
          options: [
            { label: "Statutory inquiry & social-care reform", result: "Bereaved families heard; care reformed at lasting cost.",
              effects: { policy: { socialcare: 0.18 }, macro: { deficit: 3 }, all: 0.03 }, next: null },
            { label: "Move on quickly", result: "You change the subject; survivors and the NHS feel betrayed.",
              effects: { all: -0.02, groups: { publicsector: -0.05 } }, next: null },
            { label: "Hike taxes to pay for it", result: "Honest about the bill; households feel the squeeze.",
              effects: { policy: { incometax: 0.04 }, groups: { capitalists: -0.05, wealthy: -0.05 } }, next: null }
          ] }
      ] },
    { id: "gilt", name: "Gilt-Market Crisis",
      trigger: function (s) { return s.turn > 6 && (s.macro.debtPct > 104 || s.macro.deficit > 175) && Math.random() < 0.18; },
      drag: { macro: { inflation: 0.08, realGrowth: -0.08 }, groups: { capitalists: -0.012, wealthy: -0.010 } },
      stages: [
        { title: "Markets Sell the Pound", desc: "Gilts sell off sharply and sterling slides. The Bank wants the government to show a plan.",
          options: [
            { label: "Emergency tax rises", result: "Markets steady; households brace for the squeeze.",
              effects: { policy: { incometax: 0.05 }, macro: { deficit: -6 }, all: -0.02 }, next: 1, in: 3 },
            { label: "Sweeping spending cuts", result: "The City applauds; Whitehall and the unions reel.",
              effects: { policy: { welfare: -0.06, nhs: -0.04 }, macro: { deficit: -8 }, groups: { poor: -0.10, publicsector: -0.07 } }, next: 1, in: 3 },
            { label: "Tough it out and blame speculators", result: "Defiant — and the pound keeps sliding.",
              effects: { macro: { inflation: 0.3, realGrowth: -0.3 }, groups: { capitalists: -0.06 } }, next: 1, in: 3 }
          ] },
        { title: "The Markets Test You", desc: "Despite the package, traders are circling. A second wave of selling tests every assumption.",
          options: [
            { label: "Coordinated central-bank action", result: "The Bank and the Fed step in; the panic is bought off.",
              effects: { macro: { deficit: 2 }, groups: { capitalists: 0.06 }, capital: -1 }, next: 2, in: 3 },
            { label: "Stand by your plan", result: "Resolute and risky; the markets settle, but slowly.",
              effects: { macro: { realGrowth: -0.2 }, all: -0.01 }, next: 2, in: 3 },
            { label: "Sack the Chancellor", result: "A symbolic reset; the City takes the hint and steadies.",
              effects: { groups: { capitalists: 0.10 }, capital: -2, unity: -0.06 }, next: 2, in: 3 }
          ] },
        { title: "Storm Passes — Or Doesn't", desc: "The acute danger eases. The lessons could be permanent — or papered over.",
          options: [
            { label: "Lock fiscal rules into law", result: "Discipline cemented; the right approves, the left grumbles.",
              effects: { macro: { deficit: -3 }, groups: { capitalists: 0.08, socialists: -0.04 } }, next: null },
            { label: "OBR-style independent review", result: "Process replaces panic; a quiet, durable win.",
              effects: { capital: -1, all: 0.02 }, next: null },
            { label: "Declare victory and move on", result: "Premature, says the City; it'll be back.",
              effects: { all: -0.02, groups: { capitalists: -0.05 } }, next: null }
          ] }
      ] },
    { id: "energy", name: "Energy Supply Shock",
      trigger: function (s) { return s.turn > 6 && Math.random() < 0.025; },
      drag: { macro: { inflation: 0.08, realGrowth: -0.05 }, stats: { environment: -0.005 }, groups: { poor: -0.015, workingclass: -0.012 } },
      stages: [
        { title: "Bills Through the Roof", desc: "A sudden gas-supply shock sends household and business bills surging. Phone-ins are nuclear.",
          options: [
            { label: "Cap household bills nationally", result: "Households cheer; the deficit takes the hit.",
              effects: { macro: { deficit: 8, inflation: -0.2 }, all: 0.03, capital: -1 }, next: 1, in: 3 },
            { label: "Windfall tax on energy producers", result: "Producers howl; the public roars its approval.",
              effects: { policy: { banklevy: 0.10 }, macro: { deficit: -2 }, groups: { capitalists: -0.08, socialists: 0.06 } }, next: 1, in: 3 },
            { label: "Let the market clear", result: "Orthodox and brutal on families.",
              effects: { all: -0.04, groups: { poor: -0.06 } }, next: 1, in: 3 }
          ] },
        { title: "Industry Slams the Brakes", desc: "Energy-intensive manufacturers cut shifts; thousands of jobs are on the line.",
          options: [
            { label: "State-backed loans to keep plants open", result: "Jobs saved; the right calls it corporate welfare.",
              effects: { macro: { deficit: 4, unemployment: -0.2 }, groups: { workingclass: 0.06, unions: 0.06 } }, next: 2, in: 3 },
            { label: "Speed up the green grid build", result: "Future-facing and pricey now.",
              effects: { policy: { netzero: 0.10 }, macro: { deficit: 5 }, groups: { environment: 0.10 } }, next: 2, in: 3 },
            { label: "Cut energy taxes for industry", result: "A short-term fix; environmentalists are appalled.",
              effects: { macro: { deficit: -2 }, groups: { capitalists: 0.08, environment: -0.05 } }, next: 2, in: 3 }
          ] },
        { title: "Resetting Britain's Energy", desc: "The acute phase passes. The strategic question — what powers the country? — remains.",
          options: [
            { label: "Build new nuclear and gas baseload", result: "Security restored; greens grumble at the gas.",
              effects: { policy: { netzero: 0.06, infra: 0.08 }, macro: { deficit: 3 }, groups: { patriots: 0.05 } }, next: null },
            { label: "Go big on renewables and storage", result: "A bet on the future; the bill arrives now.",
              effects: { policy: { netzero: 0.15 }, stats: { environment: 0.06 }, macro: { deficit: 3 }, groups: { environment: 0.10 } }, next: null },
            { label: "Cut ambition to save money", result: "Cheaper today; less resilient tomorrow.",
              effects: { stats: { environment: -0.06 }, all: -0.02 }, next: null }
          ] }
      ] },
    { id: "ai", name: "AI Labour Shock",
      trigger: function (s) { return s.turn > 14 && Math.random() < 0.02; },
      drag: { macro: { unemployment: 0.04, realGrowth: 0.02 }, groups: { young: -0.008, middleclass: -0.010, unions: -0.008 } },
      stages: [
        { title: "White-Collar Layoffs", desc: "A wave of AI-driven redundancies hits law, accounting and admin firms. The middle is rattled.",
          options: [
            { label: "Pause and regulate", result: "Unions cheer; tech investors threaten to leave.",
              effects: { policy: { businessreg: 0.10 }, groups: { unions: 0.10, workingclass: 0.06, capitalists: -0.08 } }, next: 1, in: 3 },
            { label: "Massive retraining programme", result: "A future-facing bet on people.",
              effects: { policy: { skills: 0.20 }, macro: { deficit: 4 }, groups: { young: 0.08, unions: 0.06 } }, next: 1, in: 3 },
            { label: "Let the market adapt", result: "Growth surges; displaced workers feel abandoned.",
              effects: { macro: { realGrowth: 0.2, unemployment: 0.3 }, groups: { capitalists: 0.08, middleclass: -0.06 } }, next: 1, in: 3 }
          ] },
        { title: "The UBI Question", desc: "City-level UBI trials are buzzing. Pressure builds for a national rollout.",
          options: [
            { label: "Trial UBI nationally", result: "Bold and very expensive; the left is jubilant.",
              effects: { policy: { welfare: 0.10 }, macro: { deficit: 8 }, groups: { poor: 0.10, socialists: 0.10, capitalists: -0.06 } }, next: 2, in: 3 },
            { label: "Strengthen the safety net", result: "A measured upgrade to benefits.",
              effects: { policy: { welfare: 0.06 }, macro: { deficit: 3 }, groups: { poor: 0.06 } }, next: 2, in: 3 },
            { label: "Hold the line on welfare", result: "Tough on the books, tough on the displaced.",
              effects: { groups: { poor: -0.05, young: -0.05, capitalists: 0.04 } }, next: 2, in: 3 }
          ] },
        { title: "AI in the Civil Service", desc: "Officials propose deploying AI across Whitehall — vast savings and tens of thousands of jobs.",
          options: [
            { label: "Automate aggressively", result: "The Treasury loves it; the unions don't.",
              effects: { macro: { deficit: -6, realGrowth: 0.2 }, groups: { publicsector: -0.10, unions: -0.08, capitalists: 0.06 } }, next: null },
            { label: "Pilot with safeguards", result: "Slower savings, smoother politics.",
              effects: { macro: { deficit: -2 }, groups: { publicsector: 0.04 } }, next: null },
            { label: "Block automation in government", result: "Jobs protected; reform delayed.",
              effects: { groups: { publicsector: 0.08, unions: 0.06, capitalists: -0.06 } }, next: null }
          ] }
      ] },
    { id: "war", name: "Major International Conflict",
      trigger: function (s) { return s.turn > 10 && Math.random() < 0.022; },
      drag: { macro: { realGrowth: -0.06, inflation: 0.05 }, groups: { patriots: 0.005 } },
      stages: [
        { title: "An Ally Under Attack", desc: "A close ally is invaded. The world is watching London for its response.",
          options: [
            { label: "Major military aid and sanctions", result: "Decisive solidarity; the cost is real.",
              effects: { policy: { defence: 0.12, foreignaid: 0.10 }, macro: { deficit: 4 }, groups: { patriots: 0.10, liberals: 0.06 } }, next: 1, in: 3 },
            { label: "Diplomatic pressure only", result: "Measured — and to some, cowardly.",
              effects: { groups: { patriots: -0.06, liberals: 0.04 } }, next: 1, in: 3 },
            { label: "Stay out of it", result: "You preserve resources; allies are appalled.",
              effects: { groups: { patriots: -0.10, workingclass: -0.04, capitalists: -0.04 } }, next: 1, in: 3 }
          ] },
        { title: "Costs Mount at Home", desc: "Energy prices spike and refugees arrive. The war reaches every kitchen table.",
          options: [
            { label: "Cap energy bills nationally", result: "Households relieved; the bill is huge.",
              effects: { macro: { deficit: 8, inflation: -0.2 }, all: 0.03 }, next: 2, in: 3 },
            { label: "Windfall tax on energy firms", result: "Producers howl; the public cheers.",
              effects: { policy: { banklevy: 0.10 }, macro: { deficit: -2 }, groups: { capitalists: -0.08, socialists: 0.06 } }, next: 2, in: 3 },
            { label: "Let the market clear", result: "Orthodox and brutal on families.",
              effects: { all: -0.03, groups: { poor: -0.06 } }, next: 2, in: 3 }
          ] },
        { title: "After the Cease-Fire", desc: "A fragile peace holds. Britain's place in the post-war order is up for grabs.",
          options: [
            { label: "Lead the reconstruction effort", result: "A diplomatic and moral win; an open-ended commitment.",
              effects: { policy: { foreignaid: 0.10 }, macro: { deficit: 3 }, groups: { liberals: 0.08, capitalists: 0.04 } }, next: null },
            { label: "Drive a permanent rearmament", result: "Britain's defences are rebuilt; the price tag is enduring.",
              effects: { policy: { defence: 0.15 }, macro: { deficit: 5 }, groups: { patriots: 0.10 } }, next: null },
            { label: "Bring the troops home, focus inward", result: "Voters are relieved; allies are quietly disappointed.",
              effects: { groups: { workingclass: 0.05, patriots: -0.04 } }, next: null }
          ] }
      ] },
    { id: "housing", name: "Housing-Market Crash",
      trigger: function (s) { return s.turn > 9 && (s.stats.housing < 0.30 || s.macro.inflation > 5) && Math.random() < 0.025; },
      drag: { stats: { housing: -0.010 }, groups: { homeowners: -0.014, renters: -0.005, capitalists: -0.010 }, macro: { realGrowth: -0.04 } },
      stages: [
        { title: "The Bubble Bursts", desc: "House prices fall sharply for the first time in a generation. Negative equity rises by the day and builders mothball developments.",
          options: [
            { label: "Emergency Help-to-Buy package", result: "Buyers tempted back; the bill is enormous and critics call it propping up a broken market.",
              effects: { policy: { housing: 0.10 }, macro: { deficit: 5 }, groups: { homeowners: 0.08, capitalists: 0.04 } }, next: 1, in: 3 },
            { label: "State-funded affordable building blitz", result: "Renters cheer; the construction sector welcomes the contracts.",
              effects: { policy: { housing: 0.18 }, macro: { deficit: 6 }, groups: { renters: 0.10, workingclass: 0.05, young: 0.06 } }, next: 1, in: 3 },
            { label: "Let the market correct", result: "Orthodox and brutal; foreclosures keep climbing.",
              effects: { stats: { housing: -0.04 }, groups: { homeowners: -0.10, capitalists: 0.04 } }, next: 1, in: 3 }
          ] },
        { title: "Repossessions Surge", desc: "Mortgage defaults are climbing; charities warn of a wave of evictions.",
          options: [
            { label: "Ban repossessions for 12 months", result: "Households relieved; lenders threaten to pull back from the market.",
              effects: { policy: { businessreg: 0.10 }, groups: { renters: 0.06, homeowners: 0.08, capitalists: -0.10 } }, next: 2, in: 3 },
            { label: "Mortgage interest support scheme", result: "Targeted help; the deficit absorbs it.",
              effects: { macro: { deficit: 4 }, groups: { homeowners: 0.10, middleclass: 0.06 } }, next: 2, in: 3 },
            { label: "Tighten landlord rules", result: "Renters protected; some landlords sell up.",
              effects: { policy: { businessreg: 0.08 }, stats: { housing: -0.02 }, groups: { renters: 0.10, homeowners: -0.04 } }, next: 2, in: 3 }
          ] },
        { title: "Rebuilding the Market", desc: "The acute phase eases. The strategic question is what kind of housing market Britain wants next.",
          options: [
            { label: "Planning reform & build, build, build", result: "Supply surges over time; the shires fume.",
              effects: { policy: { housing: 0.15 }, stats: { housing: 0.05 }, groups: { renters: 0.08, young: 0.06, homeowners: -0.06 } }, next: null },
            { label: "Council-housing revival", result: "A return to large-scale public housebuilding.",
              effects: { policy: { housing: 0.12, localgov: 0.08 }, macro: { deficit: 4 }, groups: { workingclass: 0.06, unions: 0.06 } }, next: null },
            { label: "Cool the market with higher stamp duty", result: "Speculators dampened; movers grumble.",
              effects: { policy: { stampduty: 0.10 }, macro: { deficit: -2 }, groups: { homeowners: -0.06, socialists: 0.04 } }, next: null }
          ] }
      ] }
  ];

  // ---------------------------------------------------------------------------
  // NEWS HEADLINES — short rotating headlines generated from the state of the
  // country. Each template has a cond and a small bank of variants. fmt(s)
  // optionally substitutes numbers from the state into the line.
  // ---------------------------------------------------------------------------
  var HEADLINES = [
    { id: "nhsCrisis", cond: function (s) { return s.stats.nhs < 0.32; },
      lines: ["NHS MELTDOWN: A&E waits at record highs, 'corridor care' the new normal",
        "Hospitals on the brink: patients sleeping on trolleys for days",
        "'NHS is on its knees' — top doctors demand emergency action"] },
    { id: "nhsGood", cond: function (s) { return s.stats.nhs > 0.62; },
      lines: ["Hospital waits tumble — government hails 'NHS turnaround'",
        "Britain's NHS revival: satisfaction climbs to a decade high"] },
    { id: "housingCrisis", cond: function (s) { return s.stats.housing < 0.30; },
      lines: ["Generation Rent: 'housing market is broken', say campaigners",
        "Homelessness charities warn of unfolding catastrophe",
        "First-time buyer dream 'dead', as deposits hit 12 years of savings"] },
    { id: "housingBoom", cond: function (s) { return s.stats.housing > 0.55; },
      lines: ["Building boom: housing starts at decade high",
        "Cranes return to the skyline as planning reforms bear fruit"] },
    { id: "recession", cond: function (s) { return s.macro.realGrowth < 0; },
      lines: ["BRITAIN IN RECESSION as economy contracts again",
        "Recession watch: factory output and high-street sales fall",
        "Markets jittery as recession deepens"] },
    { id: "boom", cond: function (s) { return s.macro.realGrowth > 2.5; },
      lines: ["BOOM: economy roars ahead, FTSE smashes through records",
        "Investment surges — Britain 'firing on all cylinders', say analysts"] },
    { id: "inflation", cond: function (s) { return s.macro.inflation > 4.5; },
      lines: ["Inflation stuck high as families face another grim shop",
        "Bank under pressure on rates as prices keep rising"],
      fmt: function (s) { return "Inflation hits " + s.macro.inflation.toFixed(1) + "% — Bank under pressure on rates"; } },
    { id: "softlanding", cond: function (s) { return s.macro.inflation < 2 && s.macro.realGrowth > 1.4; },
      lines: ["Soft landing: prices steady and the economy grows",
        "Chancellor cheers 'goldilocks' figures: low inflation, decent growth"] },
    { id: "unemp", cond: function (s) { return s.macro.unemployment > 5.5; },
      lines: ["Unemployment climbs — manufacturing towns hit hardest",
        "Jobless total at five-year high, ONS warns"] },
    { id: "jobs", cond: function (s) { return s.macro.unemployment < 3.8; },
      lines: ["Jobs boom: unemployment near record low",
        "Britain at work: pay packets and confidence climbing"] },
    { id: "debtcrisis", cond: function (s) { return s.macro.debtPct > 108; },
      lines: ["Gilt market jitters as debt tops 110% of GDP",
        "Bond traders 'losing patience' with the Chancellor"] },
    { id: "fiscalwin", cond: function (s) { return s.macro.deficit < 70; },
      lines: ["Public finances back on track — deficit at decade low",
        "Chancellor delivers a budget surplus moment"] },
    { id: "approvalHigh", cond: function (s) { return s.approval > 0.58; },
      lines: ["PM riding high — pollsters see a 'commanding' lead",
        "Voters back the government in latest YouGov tracker"],
      fmt: function (s) { return "PM riding high — approval at " + (s.approval * 100).toFixed(0) + "%"; } },
    { id: "approvalLow", cond: function (s) { return s.approval < 0.40 && s.turn > 4; },
      lines: ["Slump: government approval crashes",
        "Voters turn on the PM — 'time for a change' say focus groups",
        "Whitehall in turmoil as ministers fear the worst"] },
    { id: "crime", cond: function (s) { return s.stats.crime > 0.6; },
      lines: ["Crime fears grip the front pages",
        "Town centres 'no-go zones' in tabloid blitz",
        "Police chiefs demand more officers as crime climbs"] },
    { id: "envGood", cond: function (s) { return s.stats.environment > 0.65; },
      lines: ["Britain praised at COP for climate leadership",
        "Green Britain: emissions fall sharply, target in sight"] },
    { id: "envBad", cond: function (s) { return s.stats.environment < 0.30; },
      lines: ["Sewage, smog and silent rivers: nature in crisis",
        "Climate inaction: Britain slips down green league tables"] },
    { id: "migrationHigh", cond: function (s) { return s.stats.immigration > 0.72; },
      lines: ["Record migration figures spark political fury",
        "Channel crossings: tabloid front pages turn up the heat"] },
    { id: "migrationLow", cond: function (s) { return s.stats.immigration < 0.45; },
      lines: ["Border numbers fall — Home Office claims vindication",
        "Migration debate cools as Channel figures drop"] },
    { id: "unityLow", cond: function (s) { return s.unity != null && s.unity < 0.4; },
      lines: ["Party in revolt: backbenches openly attack the leadership",
        "Cabinet split deepens — sources hint at imminent challenge"] },
    { id: "eqBad", cond: function (s) { return s.stats.equality < 0.34; },
      lines: ["Inequality at a decade high, charity warns",
        "Britain divided: food banks at record use"] },
    { id: "midtermBlues", cond: function (s) { return s.turn > 20 && s.approval < 0.45; },
      lines: ["Mid-term blues: the honeymoon is well and truly over",
        "Local councillors brace for an angry doorstep"] },
    { id: "pandemicStage", cond: function (s) { return s.activeCrisis && s.activeCrisis.id === "pandemic"; },
      lines: ["Pandemic latest: ICU pressures mount nationwide",
        "Vaccine rollout in full swing — but cases climb again"] },
    { id: "giltStage", cond: function (s) { return s.activeCrisis && s.activeCrisis.id === "gilt"; },
      lines: ["Gilts gyrate as markets read every Treasury comment",
        "Pound under pressure as fiscal credibility wobbles"] },
    // a handful of gentler templates so the front pages are never empty
    { id: "costLivingFront", cond: function (s) { return s.macro.inflation > 2.4; },
      lines: ["Cost of living tops voters' concerns in latest tracker",
        "Bills, bills, bills — pollsters say the squeeze still bites"] },
    { id: "housingFront", cond: function (s) { return s.stats.housing < 0.45; },
      lines: ["Housing crisis grips young Britain",
        "Rents soar, deposits balloon — and homes don't get built"] },
    { id: "nhsFront", cond: function (s) { return s.stats.nhs < 0.5; },
      lines: ["NHS pressures dominate the news again",
        "Waiting-list anxieties test the government's promises"] },
    { id: "firstHundred", cond: function (s) { return s.turn >= 0 && s.turn <= 3 && s.termsWon === 0; },
      lines: ["PM faces a packed first 100 days",
        "Cabinet settles in as the in-tray piles up"] },
    { id: "migrationFront", cond: function (s) { return s.stats.immigration > 0.55; },
      lines: ["Migration row simmers on talk radio",
        "Channel crossings keep a place on the front pages"] },
    { id: "warStage", cond: function (s) { return s.activeCrisis && s.activeCrisis.id === "war"; },
      lines: ["Conflict latest: refugees arrive, sanctions tightened",
        "Energy bills surge as the conflict abroad bites at home"] }
  ];

  // DIFFICULTY — antiInc: anti-incumbency points at an election; regen: capital
  // regeneration multiplier; pressure: how fast the country decays; mood: a
  // starting shift to every group's contentment.
  var DIFFICULTY = {
    easy:   { id: "easy",   name: "Easy",   antiInc: 1.5, regen: 1.3, pressure: 0.7,  mood: 0.05 },
    normal: { id: "normal", name: "Normal", antiInc: 3.0, regen: 1.0, pressure: 1.0,  mood: 0.0 },
    hard:   { id: "hard",   name: "Hard",   antiInc: 4.5, regen: 0.8, pressure: 1.35, mood: -0.05 }
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
    WINNING_BASELINE: WINNING_BASELINE,
    LOCAL: LOCAL,
    SCENARIOS: SCENARIOS,
    OPP_SCENARIOS: OPP_SCENARIOS,
    DIFFICULTY: DIFFICULTY,
    CRISES: CRISES,
    HEADLINES: HEADLINES,
    // ordered list of the main GB parties for charts/legends
    MAIN_PARTIES: ["lab", "con", "reform", "restore", "ld", "green", "snp", "pc", "oth"]
  };
})();
