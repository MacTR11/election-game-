/* ============================================================================
 * NUMBER 10 — engine.js
 * Pure simulation logic: the regional seat model (swingometer), the Democracy-
 * style governing simulation, by-elections and local elections. No DOM here.
 * Exposes window.UKGAME.ENGINE.
 * ==========================================================================*/
(function () {
  "use strict";
  var D = window.UKGAME.DATA;

  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function clamp01(x) { return clamp(x, 0, 1); }

  // ---------------------------------------------------------------------------
  // SEAT MODEL
  // Per-party "efficiency" reflects how well a party converts votes to seats
  // under FPTP, calibrated so the 2024 shares reproduce roughly the 2024 seats
  // (Lib Dems very efficient, Reform very inefficient, etc.). EXP is the
  // first-past-the-post distortion exponent applied to each party's share.
  // ---------------------------------------------------------------------------
  var EFFICIENCY = {
    lab: 1.18, con: 0.95, ld: 3.30, reform: 0.16, green: 0.95,
    snp: 0.55, pc: 2.60, oth: 0.70,
    dup: 1.0, sf: 1.0, alliance: 0.85, uup: 0.9, sdlp: 0.85
  };
  var EXP = 3.0;

  // Largest-remainder allocation of `total` seats across weighted parties.
  function allocate(weights, total) {
    var ids = Object.keys(weights), sum = 0, i;
    for (i = 0; i < ids.length; i++) sum += weights[ids[i]];
    var result = {}, remainders = [], allocated = 0;
    if (sum <= 0) { for (i = 0; i < ids.length; i++) result[ids[i]] = 0; return result; }
    for (i = 0; i < ids.length; i++) {
      var exact = total * weights[ids[i]] / sum;
      var base = Math.floor(exact);
      result[ids[i]] = base;
      allocated += base;
      remainders.push({ id: ids[i], rem: exact - base });
    }
    remainders.sort(function (a, b) { return b.rem - a.rem; });
    var left = total - allocated, j = 0;
    while (left > 0 && remainders.length) {
      result[remainders[j % remainders.length].id]++;
      left--; j++;
    }
    return result;
  }

  // National swing vs the 2024 baseline, applied uniformly within each region.
  function swingFrom(shares) {
    var sw = {}, p;
    for (p in shares) sw[p] = shares[p] - (D.BASELINE[p] || 0);
    return sw;
  }

  function normShares(shares) {
    var sum = 0, p, o = {};
    for (p in shares) sum += shares[p];
    for (p in shares) o[p] = sum > 0 ? shares[p] / sum * 100 : 0;
    return o;
  }

  function regionById(id) {
    for (var i = 0; i < D.REGIONS.length; i++) if (D.REGIONS[i].id === id) return D.REGIONS[i];
    return { id: id, name: id, seats: 0 };
  }

  // Constituency-level projection across all 650 real seats. Applies uniform
  // national swing (vs 2024) to each seat's real baseline shares and takes the
  // winner seat by seat. regionAdj optionally adds campaign boosts to a party's
  // share within specific regions (e.g. { lon: { lab: 4 } }).
  // Map region id → nation, so we can keep nation-restricted parties out of
  // seats where they don't stand (SNP only in Scotland, PC only in Wales,
  // DUP/SF/Alliance/UUP/SDLP only in Northern Ireland).
  function regionNation(regId) {
    for (var i = 0; i < D.REGIONS.length; i++) if (D.REGIONS[i].id === regId) return D.REGIONS[i].nation;
    return null;
  }
  function partyEligibleInSeat(partyId, seat) {
    var party = D.PARTIES[partyId]; if (!party || !party.nation) return true;
    return party.nation === regionNation(seat.reg);
  }
  function projectSeatsConstituency(shares, regionAdj) {
    var C = window.UKGAME.CONSTITUENCIES;
    var ns = normShares(shares), sw = swingFrom(ns);
    var totals = {}, seatWinners = {}, regionTally = {}, i, p;
    for (i = 0; i < C.length; i++) {
      var seat = C[i], s = seat.s, best = null, bestv = -Infinity;
      var adj = regionAdj && regionAdj[seat.reg];
      for (p in s) {
        if (!partyEligibleInSeat(p, seat)) continue;
        var v = s[p] + (sw[p] || 0) + (adj && adj[p] ? adj[p] : 0); if (v < 0) v = 0;
        if (v > bestv) { bestv = v; best = p; }
      }
      // also consider parties that didn't stand in 2024 (eg Restore Britain),
      // but still respect nation eligibility — SNP doesn't get to win Bristol.
      for (p in sw) {
        if (p in s) continue;
        if (!partyEligibleInSeat(p, seat)) continue;
        var v2 = (sw[p] || 0) + (adj && adj[p] ? adj[p] : 0); if (v2 < 0) v2 = 0;
        if (v2 > bestv) { bestv = v2; best = p; }
      }
      if (best == null) continue; // no eligible party (shouldn't happen — every seat has GB parties)
      totals[best] = (totals[best] || 0) + 1;
      seatWinners[seat.c] = best;
      (regionTally[seat.reg] || (regionTally[seat.reg] = {}));
      regionTally[seat.reg][best] = (regionTally[seat.reg][best] || 0) + 1;
    }
    var winner = null, winnerSeats = -1;
    for (p in totals) if (totals[p] > winnerSeats) { winnerSeats = totals[p]; winner = p; }
    var majority = 2 * winnerSeats - 650;
    var byRegion = D.REGIONS.map(function (r) {
      return { region: r, seats: regionTally[r.id] || {} };
    });
    var government = formGovernment(totals);
    return {
      totals: totals, byRegion: byRegion, seatWinners: seatWinners,
      winner: winner, winnerSeats: winnerSeats, majority: majority,
      government: government,
      majorityNeeded: 326, outcome: majority > 0 ? "majority" : "hung"
    };
  }

  // Public entry point: use the full 650-seat model when the data is loaded,
  // otherwise fall back to the lighter regional model.
  function projectSeats(shares, regionAdj) {
    if (window.UKGAME.CONSTITUENCIES && window.UKGAME.CONSTITUENCIES.length) {
      return projectSeatsConstituency(shares, regionAdj);
    }
    return projectSeatsRegional(shares);
  }

  // Campaign spending → vote-share boost for a party in a region (diminishing
  // returns), and the per-region adjustment map the seat model consumes.
  function campaignBoost(points) { return 7 * (1 - Math.exp(-Math.max(0, points) / 3.5)); }
  function campaignAdj(party, allocByRegion) {
    var adj = {};
    for (var r in allocByRegion) if (allocByRegion[r] > 0) { adj[r] = {}; adj[r][party] = campaignBoost(allocByRegion[r]); }
    return adj;
  }

  // Regional fallback model: allocate each region's seats from its 2024 vote
  // shares with per-party FPTP efficiencies and a distortion exponent.
  function projectSeatsRegional(shares) {
    var sw = swingFrom(shares);
    var totals = {}, byRegion = [], r, p;
    for (r = 0; r < D.REGIONS.length; r++) {
      var region = D.REGIONS[r];
      var regShares = {}, total = 0;
      // apply uniform swing to each party that stands in the region
      for (p in region.shares) {
        var v = region.shares[p] + (sw[p] || 0);
        regShares[p] = Math.max(0, v);
        total += regShares[p];
      }
      // renormalise (only matters where clamping at 0 occurred)
      var weights = {};
      for (p in regShares) {
        var norm = total > 0 ? regShares[p] / total * 100 : 0;
        regShares[p] = norm;
        var eff = EFFICIENCY[p] != null ? EFFICIENCY[p] : 0.7;
        weights[p] = eff * Math.pow(norm, EXP);
      }
      var seats = allocate(weights, region.seats);
      for (p in seats) totals[p] = (totals[p] || 0) + seats[p];
      byRegion.push({ region: region, seats: seats, shares: regShares });
    }
    // winner + majority maths (326 line; majority = 2*seats - 650)
    var winner = null, winnerSeats = -1;
    for (p in totals) if (totals[p] > winnerSeats) { winnerSeats = totals[p]; winner = p; }
    var majority = 2 * winnerSeats - 650;
    return {
      totals: totals, byRegion: byRegion, winner: winner,
      winnerSeats: winnerSeats, majority: majority,
      government: formGovernment(totals),
      majorityNeeded: 326,
      outcome: majority > 0 ? "majority"
             : winnerSeats >= 326 ? "majority" : "hung"
    };
  }

  // ---------------------------------------------------------------------------
  // GOVERNMENT FORMATION — who can actually command the Commons. Sinn Féin
  // abstain, so the working-majority threshold is over the sitting MPs. The
  // largest party that can assemble a bloc of plausible UK partners forms the
  // government; otherwise the largest party leads a minority.
  // ---------------------------------------------------------------------------
  var ALLIES = {
    lab:    ["ld", "green", "snp", "pc", "sdlp", "alliance"],
    con:    ["reform", "dup", "uup"],
    ld:     ["lab", "con", "green", "pc"],
    reform: ["con", "dup", "uup"],
    snp:    ["lab", "ld", "green", "pc"]
  };
  function formGovernment(totals) {
    // Canonical UK Commons majority is 326 (half of 650 + 1) — this matches the
    // line drawn on the seat bar and what every newsroom reports.
    var needed = 326, sitting = 650;
    var ranked = Object.keys(totals).filter(function (p) { return totals[p] > 0 && p !== "sf"; })
      .sort(function (a, b) { return totals[b] - totals[a]; });
    if (!ranked.length) return { type: "minority", formateur: "oth", members: ["oth"], seats: 0, needed: needed, sitting: sitting };
    var largest = ranked[0];
    if (totals[largest] >= needed)
      return { type: "majority", formateur: largest, members: [largest], seats: totals[largest], needed: needed, sitting: sitting };
    var leaders = ["lab", "con", "ld", "reform", "snp"].filter(function (p) { return totals[p] > 0; })
      .sort(function (a, b) { return totals[b] - totals[a]; });
    for (var i = 0; i < leaders.length; i++) {
      var f = leaders[i], members = [f], seats = totals[f], allies = ALLIES[f] || [];
      for (var j = 0; j < allies.length && seats < needed; j++)
        if (totals[allies[j]] > 0) { members.push(allies[j]); seats += totals[allies[j]]; }
      if (seats >= needed)
        return { type: "coalition", formateur: f, members: members, seats: seats, needed: needed, sitting: sitting };
    }
    return { type: "minority", formateur: largest, members: [largest], seats: totals[largest], needed: needed, sitting: sitting };
  }

  // ---------------------------------------------------------------------------
  // BATTLEGROUNDS — every seat's projected result; the tightest marginals and
  // the seats that change hands vs 2024.
  // ---------------------------------------------------------------------------
  function seatResult(seat, shares) {
    var r = byElection(seat, shares);
    return { code: seat.c, name: seat.n, region: seat.reg, winner: r.winner,
             previousWinner: seat.w, flip: r.gain, margin: r.margin, ranked: r.ranked };
  }
  function battlegrounds(shares, n) {
    var C = window.UKGAME.CONSTITUENCIES, out = [], flips = 0, i;
    var ns = normShares(shares);
    for (i = 0; i < C.length; i++) {
      var r = byElection(C[i], ns);
      if (r.gain) flips++;
      out.push({ code: C[i].c, name: C[i].n, reg: C[i].reg, winner: r.winner,
                 prev: C[i].w, margin: r.margin, flip: r.gain,
                 runner: r.ranked[1] ? r.ranked[1].party : null });
    }
    out.sort(function (a, b) { return a.margin - b.margin; });
    return { marginal: out.slice(0, n || 12), flips: flips, total: C.length,
             gains: out.filter(function (s) { return s.flip; }).sort(function (a, b) { return b.margin - a.margin; }) };
  }
  // Per-seat result for every constituency on the current shares. Returns an
  // array of { code, name, reg, winner, runner, prev, margin, flip,
  // shareWinner, shareRunner }. Computed once; the UI then filters / sorts in
  // place rather than re-projecting per row.
  function allSeatResults(shares) {
    var C = window.UKGAME.CONSTITUENCIES || [], out = [], i;
    var ns = normShares(shares);
    for (i = 0; i < C.length; i++) {
      var seat = C[i];
      var r = byElection(seat, ns);
      var ranked = r.ranked || [];
      out.push({
        code: seat.c, name: seat.n, reg: seat.reg, nation: regionNation(seat.reg),
        winner: r.winner, prev: seat.w,
        runner: ranked[1] ? ranked[1].party : null,
        shareWinner: ranked[0] ? ranked[0].share : 0,
        shareRunner: ranked[1] ? ranked[1].share : 0,
        margin: r.margin, flip: r.gain
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // BY-ELECTION — single seat under national swing vs 2024.
  // ---------------------------------------------------------------------------
  function byElection(seat, shares) {
    var base = seat.s || seat.shares;
    var sw = swingFrom(normShares(shares)), out = {}, total = 0, p;
    // 1) parties that already stand in the seat (the 2024 baseline shares).
    //    MUST mirror projectSeatsConstituency's logic exactly so the seat-
    //    detail / explorer never disagrees with the headline projection.
    for (p in base) {
      if (!partyEligibleInSeat(p, seat)) continue;
      var v = base[p] + (sw[p] || 0); if (v < 0) v = 0;
      out[p] = v; total += v;
    }
    // 2) parties that didn't stand in 2024 but appear in this projection's
    //    national shares (e.g. Restore Britain). Same nation-eligibility rule.
    for (p in sw) {
      if (p in out) continue;
      if (!partyEligibleInSeat(p, seat)) continue;
      var v2 = (sw[p] || 0); if (v2 < 0) v2 = 0;
      out[p] = v2; total += v2;
    }
    // Rank by RAW values (identical to projectSeats' first-wins-strict-greater
    // semantics — guarantees the seat-detail winner matches the headline tally
    // even on near-floating-point ties).
    var ranked = [];
    for (p in out) ranked.push({ party: p, raw: out[p] });
    ranked.sort(function (a, b) { return b.raw - a.raw; });
    // Normalise to % for display ONLY, after ranking is locked in.
    for (var k = 0; k < ranked.length; k++) ranked[k].share = total > 0 ? ranked[k].raw / total * 100 : 0;
    var heldBy = seat.w, hi = -1;
    if (!heldBy) for (p in base) if (base[p] > hi) { hi = base[p]; heldBy = p; }
    return { ranked: ranked, winner: ranked[0].party, previousWinner: heldBy,
             gain: ranked[0].party !== heldBy,
             margin: ranked.length > 1 ? ranked[0].share - ranked[1].share : ranked[0].share };
  }

  // ---------------------------------------------------------------------------
  // LOCAL ELECTIONS — national-equivalent-vote to council seats, with a small
  // per-party local bias. Returns seat counts and councils controlled estimate.
  // ---------------------------------------------------------------------------
  function localElection(shares) {
    var weights = {}, p;
    for (p in shares) {
      if (p === "snp" || p === "pc") continue; // devolved-only, light presence
      var bias = D.LOCAL.localBias[p] != null ? D.LOCAL.localBias[p] : 1.0;
      weights[p] = bias * Math.pow(Math.max(0, shares[p]), 1.4);
    }
    var seats = allocate(weights, D.LOCAL.totalSeats);
    // councils controlled ~ proportional to seat share but rewards the leader
    var seatTotal = 0; for (p in seats) seatTotal += seats[p];
    var councils = {}, used = 0, ids = Object.keys(seats);
    ids.sort(function (a, b) { return seats[b] - seats[a]; });
    for (var i = 0; i < ids.length; i++) {
      var frac = seatTotal > 0 ? seats[ids[i]] / seatTotal : 0;
      var c = Math.round(D.LOCAL.councils * Math.pow(frac, 1.25) * 1.4);
      councils[ids[i]] = c; used += c;
    }
    councils.noOverallControl = Math.max(0, D.LOCAL.councils - used);
    return { seats: seats, councils: councils };
  }

  // ---------------------------------------------------------------------------
  // GOVERNING SIMULATION (Democracy-style)
  // ---------------------------------------------------------------------------
  var TERM_TURNS = 60; // 5-year term, one turn per month

  function pickPledges() {
    var pool = D.PLEDGES.slice(), out = [];
    for (var k = 0; k < 3 && pool.length; k++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    return out;
  }
  // The Leader of the Opposition — a named character so PMQs feel populated.
  // Picked from the biggest rival party at game start.
  function pickOppositionLeader(playerParty) {
    var rivals = {
      lab: "con", con: "lab", reform: "lab", ld: "con", green: "lab",
      snp: "lab", pc: "lab", restore: "lab"
    };
    var oppId = rivals[playerParty] || "con";
    var pool = {
      con:     [{ first: "Kemi",    last: "Badenoch", style: "combative" },
                { first: "Robert",  last: "Jenrick",  style: "sharp"     },
                { first: "James",   last: "Cleverly", style: "wry"       },
                { first: "Priti",   last: "Patel",    style: "hardline"  }],
      lab:     [{ first: "Angela",  last: "Rayner",   style: "barbed"    },
                { first: "Wes",     last: "Streeting",style: "polished"  },
                { first: "Yvette",  last: "Cooper",   style: "forensic"  },
                { first: "Bridget", last: "Phillipson", style: "steady"  }],
      reform:  [{ first: "Nigel",   last: "Farage",   style: "showman"   },
                { first: "Richard", last: "Tice",     style: "blunt"     },
                { first: "Lee",     last: "Anderson", style: "fiery"     }],
      ld:      [{ first: "Daisy",   last: "Cooper",   style: "earnest"   },
                { first: "Ed",      last: "Davey",    style: "warm"      }],
      green:   [{ first: "Carla",   last: "Denyer",   style: "principled"},
                { first: "Adrian",  last: "Ramsay",   style: "measured"  }]
    };
    var arr = pool[oppId] || pool.con;
    var pick = arr[Math.floor(Math.random() * arr.length)];
    var parties = D.PARTIES || {};
    return {
      partyId: oppId,
      partyName: (parties[oppId] && parties[oppId].name) || oppId,
      name: pick.first + " " + pick.last,
      style: pick.style
    };
  }
  function pledgeById(id) { for (var i = 0; i < D.PLEDGES.length; i++) if (D.PLEDGES[i].id === id) return D.PLEDGES[i]; return null; }
  function pledgesKept(state) {
    var kept = 0;
    state.pledges.forEach(function (id) { var pl = pledgeById(id); if (pl && pl.ok(state)) kept++; });
    return kept;
  }

  var _polById = null;
  function polById(id) {
    if (!_polById) { _polById = {}; for (var i = 0; i < D.POLICIES.length; i++) _polById[D.POLICIES[i].id] = D.POLICIES[i]; }
    return _polById[id];
  }

  // =====================================================================
  // THE CABINET — each post is held by a minister with a competence rating.
  // Competent ministers lift their department; weak ones drag it. The player
  // can reshuffle from a pool of backbenchers, spending capital and risking
  // party unity (sacking a loyal big beast bruises morale).
  // =====================================================================
  var CABINET_POSTS = [
    { id: "chancellor", title: "Chancellor of the Exchequer", area: "the economy & the books" },
    { id: "health",     title: "Health Secretary",            area: "the NHS" },
    { id: "home",       title: "Home Secretary",              area: "crime & migration" },
    { id: "education",  title: "Education Secretary",          area: "schools & skills" },
    { id: "foreign",    title: "Foreign Secretary",           area: "trade & Britain's standing" },
    { id: "chair",      title: "Party Chair & Chief Whip",    area: "party discipline" }
  ];
  var MIN_FIRST = ["Margaret", "James", "Priya", "David", "Sarah", "Tom", "Rachel", "Daniel", "Helen", "Marcus",
    "Ayesha", "George", "Fiona", "Raj", "Claire", "Stephen", "Nadia", "Paul", "Louise", "Ben", "Yvette", "Oliver", "Diane", "Wesley"];
  var MIN_LAST = ["Hartley", "Okafor", "Sinclair", "Mbeki", "Whitfield", "Greenwood", "Ashworth", "Patel", "Caldwell",
    "Donnelly", "Fairbairn", "Hughes", "Lockhart", "Bashir", "Pennington", "Crawford", "Rashid", "Thornton", "Beaumont", "Ellison", "Marsh", "Quinn", "Stroud", "Vance"];
  var MIN_TRAITS = ["Safe pair of hands", "Rising star", "Big beast", "Loyal foot-soldier", "Gaffe-prone", "Media darling", "Backroom operator", "Ideological firebrand"];
  function makeMinister(used) {
    var name;
    do { name = MIN_FIRST[Math.floor(Math.random() * MIN_FIRST.length)] + " " + MIN_LAST[Math.floor(Math.random() * MIN_LAST.length)]; }
    while (used[name]);
    used[name] = 1;
    var c = 2 + Math.floor(Math.random() * 4); // 2..5
    if ((c === 2 || c === 5) && Math.random() < 0.4) c = 3 + Math.floor(Math.random() * 2); // bias to the middle
    return { name: name, competence: c, trait: MIN_TRAITS[Math.floor(Math.random() * MIN_TRAITS.length)],
             loyalty: Math.round((0.3 + Math.random() * 0.6) * 100) / 100, tenure: 0 };
  }
  function generateCabinet() {
    var used = {}, cab = {}, pool = [], i;
    for (i = 0; i < CABINET_POSTS.length; i++) cab[CABINET_POSTS[i].id] = makeMinister(used);
    for (i = 0; i < 6; i++) pool.push(makeMinister(used));
    return { cabinet: cab, talentPool: pool };
  }
  // Per-turn modifiers from the current cabinet (competence 3 = neutral).
  function cabinetBonus(state) {
    var cab = state.cabinet, b = { nhs: 0, education: 0, crime: 0, immigration: 0, growth: 0, unity: 0, capital: 0 };
    if (!cab) return b;
    function c(id) { return cab[id] ? cab[id].competence - 3 : 0; }
    b.growth = c("chancellor") * 0.03 + c("foreign") * 0.012;
    b.capital = c("chancellor") * 0.3;
    b.nhs = c("health") * 0.03;
    b.education = c("education") * 0.03;
    b.crime = -c("home") * 0.03;
    b.immigration = -c("home") * 0.015;
    b.unity = c("chair") * 0.03;
    return b;
  }
  // Map a policy id to the cabinet post most likely to walk if it is moved.
  var POLICY_TO_POST = {
    nhs: "health", socialcare: "health", mentalhealth: "health",
    police: "home", civil: "home", immigration: "home", border: "home", prisons: "home",
    education: "education", tuition: "education", arts: "education", skills: "education",
    defence: "foreign", foreignaid: "foreign",
    welfare: "chancellor", pension: "chancellor", childcare: "chancellor", minwage: "chancellor",
    housing: "chancellor", infra: "chancellor", rail: "chancellor", netzero: "chancellor", science: "chancellor",
    businessreg: "chancellor", localgov: "chancellor",
    incometax: "chancellor", incometax_higher: "chancellor", ni: "chancellor", vat: "chancellor",
    corptax: "chancellor", cgt: "chancellor", inheritance: "chancellor", fuelduty: "chancellor",
    counciltax: "chancellor", wealthtax: "chancellor", banklevy: "chancellor",
    sintax: "chancellor", sugartax: "chancellor", stampduty: "chancellor"
  };
  // A big policy move can push a low-loyalty minister to resign in protest.
  // Returns { resigned, post, outgoing, incoming } if a resignation fires.
  function maybeMinisterResign(state, polId, cost) {
    if (!state.cabinet || !state.talentPool) return null;
    if (cost < 6) return null;
    if (state.lastResignTurn != null && state.turn - state.lastResignTurn < 4) return null;
    var postId = POLICY_TO_POST[polId]; if (!postId) return null;
    var m = state.cabinet[postId]; if (!m) return null;
    if (m.loyalty >= 0.5) return null;
    // probability scales with disloyalty and the move's size
    var p = (0.5 - m.loyalty) * 0.5 + (cost - 6) * 0.05;
    if (Math.random() > p) return null;
    // pick the best pool member to step in (highest competence)
    var pool = state.talentPool, bestIdx = 0;
    for (var i = 1; i < pool.length; i++) if (pool[i].competence > pool[bestIdx].competence) bestIdx = i;
    var incoming = pool[bestIdx];
    pool.splice(bestIdx, 1);
    pool.push(m);
    incoming.tenure = 0;
    state.cabinet[postId] = incoming;
    state.unity = clamp01(state.unity - m.loyalty * 0.05);
    state.lastResignTurn = state.turn;
    return { resigned: true, post: postId, outgoing: m, incoming: incoming };
  }
  function reshuffleCabinet(state, post, poolIndex) {
    if (!state.cabinet || !state.talentPool) return false;
    var cand = state.talentPool[poolIndex];
    if (!cand || !state.cabinet[post]) return false;
    var cost = 2;
    if (state.capital < cost) return false;
    var outgoing = state.cabinet[post];
    state.capital -= cost;
    cand.tenure = 0;                              // fresh in post
    state.cabinet[post] = cand;
    state.talentPool.splice(poolIndex, 1);
    state.talentPool.push(outgoing);
    var unityHit = outgoing.loyalty * 0.06;
    var upgrade = Math.max(0, (cand.competence - outgoing.competence) * 0.02);
    state.unity = clamp01(state.unity - unityHit + upgrade);
    return true;
  }

  // ---- shadow cabinet (opposition only) ----
  var SHADOW_POSTS = [
    { id: "schancellor", title: "Shadow Chancellor",        area: "economic credibility",       map: { attack: "economy",       promote: "capitalists" } },
    { id: "shealth",     title: "Shadow Health Secretary",  area: "the NHS attack",             map: { attack: "nhs" } },
    { id: "shome",       title: "Shadow Home Secretary",    area: "crime & migration attacks",  map: { attack: "crime",         promote: "patriots" } },
    { id: "seducation",  title: "Shadow Education",         area: "the young vote",             map: { promote: "young" } },
    { id: "sforeign",    title: "Shadow Foreign Secretary", area: "national-stage credibility", map: { blitz: true } },
    { id: "campchief",   title: "Campaign Chief",           area: "the ground game",            map: { passive: true } }
  ];
  function generateShadowCabinet() {
    var used = {}, cab = {}, pool = [], i;
    for (i = 0; i < SHADOW_POSTS.length; i++) cab[SHADOW_POSTS[i].id] = makeMinister(used);
    for (i = 0; i < 6; i++) pool.push(makeMinister(used));
    return { shadowCabinet: cab, shadowPool: pool };
  }
  // Returns a multiplier (~0.85 to 1.30) to apply to the magnitude of an
  // opposition action's vote-share / group effects.
  function shadowBoost(g, type, arg) {
    if (!g.shadowCabinet) return 1;
    var matched = null;
    for (var i = 0; i < SHADOW_POSTS.length; i++) {
      var p = SHADOW_POSTS[i], mp = p.map || {};
      if (type === "attack" && mp.attack === arg) { matched = p; break; }
      if (type === "promote" && mp.promote === arg) { matched = p; break; }
      if (type === "blitz" && mp.blitz) { matched = p; break; }
    }
    if (!matched) return 1;
    var m = g.shadowCabinet[matched.id]; if (!m) return 1;
    return 1 + (m.competence - 3) * 0.15;
  }
  function shadowChiefBonus(g) {
    if (!g.shadowCabinet || !g.shadowCabinet.campchief) return { energy: 0, decay: 0 };
    var c = g.shadowCabinet.campchief.competence - 3;
    return { energy: c * 0.5, decay: c * 0.04 }; // adds to per-turn energy regen and slows momentum decay
  }
  function reshuffleShadowCabinet(g, post, poolIndex) {
    if (!g.shadowCabinet || !g.shadowPool) return false;
    var cand = g.shadowPool[poolIndex];
    if (!cand || !g.shadowCabinet[post]) return false;
    var cost = 3;
    if (g.energy < cost) return false;
    var outgoing = g.shadowCabinet[post];
    g.energy -= cost;
    cand.tenure = 0;
    g.shadowCabinet[post] = cand;
    g.shadowPool.splice(poolIndex, 1);
    g.shadowPool.push(outgoing);
    // an upgrade brings a small momentum bump
    var upgrade = Math.max(0, (cand.competence - outgoing.competence) * 0.4);
    if (upgrade) g.momentum += upgrade;
    return true;
  }

  function newGovernState(party, opts) {
    opts = opts || {};
    var F = D.FISCAL;
    var s = { party: party, turn: 0, year: 2024, month: 9,
              capital: 8, maxCapital: 8,
              policies: {}, stats: {}, groups: {}, activeEvents: [], fiscalLines: { r: {}, s: {} },
              macro: { gdp: F.gdp, realGrowth: F.realGrowth, inflation: F.inflation,
                       unemployment: F.unemployment, debt: F.debt,
                       bankRate: F.bankRate,
                       debtInterest: Math.round(F.debt * F.effectiveDebtRate),
                       receipts: F.receiptsTotal, spending: F.spendingTotal,
                       deficit: F.spendingTotal - F.receiptsTotal,
                       debtPct: Math.round(F.debt / F.gdp * 100) },
              pressure: 0, pendingDilemma: null, dilemmaHistory: [], decisionLog: [], history: [],
              activeCrisis: null, crisisHistory: [],
              unity: 0.7, discontent: 0, pledges: pickPledges(),
              approval: 0.5, lastElection: null, termsWon: 0, gameOver: false, oustedBy: null, log: [],
              oppositionLeader: pickOppositionLeader(party) };
    var i;
    for (i = 0; i < D.POLICIES.length; i++) s.policies[D.POLICIES[i].id] = D.POLICIES[i].def;
    for (i = 0; i < D.STATS.length; i++) s.stats[D.STATS[i].id] = D.STATS[i].base;
    for (i = 0; i < D.GROUPS.length; i++) s.groups[D.GROUPS[i].id] = D.GROUPS[i].base;
    s.sectors = {}; var SS = D.SECTORS || [];
    for (i = 0; i < SS.length; i++) s.sectors[SS[i].id] = SS[i].health;
    s.industrialStrategy = null; // {id, sector, sinceTurn}
    var cab = generateCabinet(); s.cabinet = cab.cabinet; s.talentPool = cab.talentPool;
    // anchor live seat projections to the player's "winning" counterfactual
    var wb = (D.WINNING_BASELINE && D.WINNING_BASELINE[party]) || D.BASELINE;
    s.baseline = {}; for (var bp in wb) s.baseline[bp] = wb[bp];
    // settle so the starting policies are reflected in the stats and the books
    computeTargets(s, true);
    // apply the chosen scenario (absolute macro overrides + stat/group deltas)
    var scen = null, list = D.SCENARIOS || [];
    for (i = 0; i < list.length; i++) if (list[i].id === opts.scenario) scen = list[i];
    s.scenarioId = scen ? scen.id : "steady";
    if (scen) {
      if (scen.macro) for (var mk in scen.macro) s.macro[mk] = scen.macro[mk];
      if (scen.stats) for (var sk in scen.stats) if (s.stats[sk] != null) s.stats[sk] = clamp01(s.stats[sk] + scen.stats[sk]);
      if (scen.groups) for (var gk in scen.groups) if (s.groups[gk] != null) s.groups[gk] = clamp01(s.groups[gk] + scen.groups[gk]);
      if (scen.pressure) s.pressure = scen.pressure;
    }
    // apply difficulty (mechanical params + a starting mood shift)
    s.difficulty = (D.DIFFICULTY && D.DIFFICULTY[opts.difficulty]) || (D.DIFFICULTY && D.DIFFICULTY.normal) || null;
    if (s.difficulty && s.difficulty.mood) for (var di in s.groups) s.groups[di] = clamp01(s.groups[di] + s.difficulty.mood);
    // apply the chosen PM persona (leadership archetype) — opening modifiers
    applyPersona(s, opts.persona);
    computeFiscal(s);
    s.approval = computeApproval(s);
    recordHistory(s);
    return s;
  }

  // Look up a persona by id. Returns null for a missing/blank id (so a state
  // reconstructed without a persona — e.g. during loadGame — gets no mods;
  // a known persona id that isn't found falls back to the first defined one).
  function personaById(id) {
    if (!id) return null;
    var P = D.PERSONAS || [];
    for (var i = 0; i < P.length; i++) if (P[i].id === id) return P[i];
    return P[0] || null;
  }
  // Apply a persona's opening modifiers to a fresh government state. The
  // persona itself is stored on state.persona so ongoing mechanics
  // (capital regen, gaffe chance, decay) can read its mods later. With no
  // persona id (loadGame reconstruction) this is a no-op.
  function applyPersona(s, id) {
    var per = personaById(id);
    s.persona = per || null;
    if (!per || !per.mods) return;
    var m = per.mods, k;
    if (m.capital) { s.capital += m.capital; s.maxCapital += m.capital; }
    if (m.unity != null) s.unity = clamp01(s.unity + m.unity);
    if (m.growth) s.macro.realGrowth += m.growth;
    if (m.groups) for (k in m.groups) if (s.groups[k] != null) s.groups[k] = clamp01(s.groups[k] + m.groups[k]);
    if (m.cabinet && s.cabinet) for (k in s.cabinet) if (s.cabinet[k]) s.cabinet[k].competence = Math.min(5, s.cabinet[k].competence + m.cabinet);
  }

  // Snapshot the headline numbers each quarter so the UI can chart trends.
  function recordHistory(s) {
    // snapshot every voter group's satisfaction so the UI can show trajectories
    var gs = {}, gi;
    for (gi in s.groups) gs[gi] = s.groups[gi];
    // also record what the Commons would look like if an election were held now
    var seats = 0, won = false;
    try { var r = runGeneralElection(s); seats = r.playerSeats; won = r.won; } catch (e) { /* ignore */ }
    s.history.push({
      label: s.year + "-" + s.month, approval: s.approval,
      growth: s.macro.realGrowth, inflation: s.macro.inflation,
      unemployment: s.macro.unemployment, deficit: s.macro.deficit, debtPct: s.macro.debtPct,
      groups: gs, seats: seats, won: won
    });
    if (s.history.length > 60) s.history.shift();
  }

  // Translate the real macro numbers into the 0..1 signals the political model
  // reacts to (so groups still respond to growth, prices and jobs).
  function macroNorm(m) {
    return {
      gdp: clamp01(0.5 + m.realGrowth / 8),
      inflation: clamp01(m.inflation / 9),
      unemployment: clamp01((m.unemployment - 3) / 9)
    };
  }

  // Normalised deviation of a policy from its default, d ∈ roughly [-1, 1].
  function polD(pol, real) { return (real - pol.def) / (pol.max - pol.min); }

  // Sum all policy contributions for each stat and group (k · d per effect, so
  // there is no effect at the default setting).
  function policyContributions(state) {
    var stats = {}, groups = {}, i, id;
    for (i = 0; i < D.POLICIES.length; i++) {
      var pol = D.POLICIES[i], d = polD(pol, state.policies[pol.id]);
      if (!pol.effects) continue;
      if (pol.effects.stats) for (id in pol.effects.stats) stats[id] = (stats[id] || 0) + pol.effects.stats[id] * d;
      if (pol.effects.groups) for (id in pol.effects.groups) groups[id] = (groups[id] || 0) + pol.effects.groups[id] * d;
    }
    return { stats: stats, groups: groups };
  }

  // Compute target stat/group values and (optionally) snap straight to them.
  function computeTargets(state, snap) {
    var contrib = policyContributions(state);
    var i, st, gr, target, cur;

    // ---- stats: base + policy + cross-interactions ----
    var targetStats = {};
    for (i = 0; i < D.STATS.length; i++) {
      st = D.STATS[i];
      targetStats[st.id] = st.base + (contrib.stats[st.id] || 0);
    }
    // cross interactions (read from current stats for stability)
    var cs = state.stats, mn = macroNorm(state.macro);
    targetStats.crime        += -0.18 * (cs.education - 0.5) - 0.15 * (cs.equality - 0.5);
    targetStats.nhs          +=  0.10 * (cs.equality - 0.5);
    // demographic & cost pressure: services decay over time unless invested in,
    // so doing nothing steadily makes the country worse (as in real life).
    var pr = state.pressure || 0;
    if (targetStats.nhs       != null) targetStats.nhs       -= 0.013 * pr;
    if (targetStats.housing   != null) targetStats.housing   -= 0.011 * pr;
    if (targetStats.education != null) targetStats.education -= 0.008 * pr;
    if (targetStats.crime     != null) targetStats.crime     += 0.008 * pr;
    if (targetStats.immigration != null) targetStats.immigration += 0.006 * pr;
    // the cabinet's competence shifts where each department's stat settles
    var cab = cabinetBonus(state);
    if (targetStats.nhs != null)         targetStats.nhs += cab.nhs;
    if (targetStats.education != null)   targetStats.education += cab.education;
    if (targetStats.crime != null)       targetStats.crime += cab.crime;
    if (targetStats.immigration != null) targetStats.immigration += cab.immigration;
    for (var k in targetStats) targetStats[k] = clamp01(targetStats[k]);

    // ---- groups: base + policy + how the country is doing ----
    // a single "are the public services working" index that everyone feels
    var svc = (targetStats.nhs + targetStats.education + (1 - targetStats.crime) + targetStats.housing) / 4;
    var targetGroups = {};
    for (i = 0; i < D.GROUPS.length; i++) {
      gr = D.GROUPS[i];
      var t = gr.base + (contrib.groups[gr.id] || 0);
      // everyone reacts to the real economy, prices, jobs and public services
      t += 0.32 * (mn.gdp - 0.5);
      t -= 0.30 * (mn.inflation - 0.29);
      t -= 0.24 * (mn.unemployment - 0.144);
      t += 0.42 * (svc - 0.46);
      targetGroups[gr.id] = clamp01(t);
    }
    // targeted stat sensitivities
    targetGroups.pensioners   = clamp01(targetGroups.pensioners   + 0.25 * (targetStats.nhs - 0.45));
    targetGroups.poor         = clamp01(targetGroups.poor         + 0.20 * (targetStats.equality - 0.48) - 0.20 * (mn.inflation - 0.29));
    targetGroups.parents      = clamp01(targetGroups.parents      + 0.22 * (targetStats.education - 0.5) + 0.12 * (targetStats.nhs - 0.45));
    targetGroups.homeowners   = clamp01(targetGroups.homeowners   + 0.18 * (targetStats.housing - 0.4) - 0.10 * (targetStats.crime - 0.4));
    targetGroups.renters      = clamp01(targetGroups.renters      + 0.30 * (targetStats.housing - 0.4));
    targetGroups.young        = clamp01(targetGroups.young        + 0.18 * (targetStats.housing - 0.4) + 0.10 * (targetStats.environment - 0.45));
    targetGroups.environment  = clamp01(targetGroups.environment  + 0.30 * (targetStats.environment - 0.45));
    targetGroups.patriots     = clamp01(targetGroups.patriots     - 0.18 * (cs.immigration - 0.6));
    targetGroups.minorities   = clamp01(targetGroups.minorities   - 0.12 * (targetStats.crime - 0.4));

    if (snap) {
      state.stats = targetStats;
      state.groups = targetGroups;
    }
    return { stats: targetStats, groups: targetGroups };
  }

  // Real public finances (£bn). Each mapped policy sets its own budget line;
  // unmapped lines (NICs, business rates, debt interest, local government, etc.)
  // are a residual fixed to the real 2024–25 totals. Receipts scale with the
  // size of the economy; debt interest scales with the debt stock.
  function fiscalDefaultAmt(pol) { return pol.fiscal.mode === "direct" ? pol.def : pol.fiscal.base; }
  function fiscalCurrentAmt(pol, state) {
    if (pol.fiscal.mode === "direct") return Math.max(0, state.policies[pol.id]);
    return Math.max(0, pol.fiscal.base + pol.fiscal.swing * polD(pol, state.policies[pol.id]));
  }
  function computeFiscal(state) {
    var F = D.FISCAL, i, pol;
    var mappedR = 0, mappedS = 0;
    for (i = 0; i < D.POLICIES.length; i++) {
      pol = D.POLICIES[i]; if (!pol.fiscal) continue;
      var da = fiscalDefaultAmt(pol);
      if (pol.fiscal.type === "r") mappedR += da; else mappedS += da;
    }
    var residualR = F.receiptsTotal - mappedR;
    var baseDebtInterest = F.debt * F.effectiveDebtRate;
    var residualS = F.spendingTotal - mappedS - baseDebtInterest;

    var lines = { r: {}, s: {} }, receipts = 0, spending = 0;
    for (i = 0; i < D.POLICIES.length; i++) {
      pol = D.POLICIES[i]; if (!pol.fiscal) continue;
      var amt = fiscalCurrentAmt(pol, state);
      if (pol.fiscal.type === "r") { lines.r[pol.fiscal.line] = amt; receipts += amt; }
      else { lines.s[pol.fiscal.line] = amt; spending += amt; }
    }
    // debt interest carries a gilt-market premium that climbs sharply once debt
    // runs above ~95% of GDP — high debt becomes self-reinforcingly expensive.
    var dp = state.macro.debt / state.macro.gdp * 100;
    var effRate = F.effectiveDebtRate + Math.max(0, (dp - 95)) * 0.0006;
    var debtInterest = state.macro.debt * effRate;
    var gdpFactor = state.macro.gdp / F.gdp;
    // demographic/inflation cost pressure grows over time; frozen tax thresholds
    // drag a little more into tax (fiscal drag) but not enough to keep pace.
    var pr = state.pressure || 0;
    var costPressure = pr * 5.5, fiscalDrag = pr * 1.8;
    // pay and benefit indexation: most spending rises with the nominal economy
    // too, so you can't simply grow out of the deficit by standing still.
    var programme = spending + residualS;
    var uplift = 0.6 * (gdpFactor - 1) * programme;
    receipts = (receipts + residualR) * gdpFactor + fiscalDrag;
    spending = programme + uplift + debtInterest + costPressure;
    lines.r["Other receipts (NICs, rates, duties…)"] = residualR * gdpFactor;
    lines.s["Other (local gov, services…)"] = residualS;
    if (uplift > 0.5) lines.s["Inflation cost uplift"] = uplift;
    if (costPressure > 0) lines.s["Demographic & cost pressure"] = costPressure;
    lines.s["Debt interest"] = debtInterest;

    state.macro.receipts = Math.round(receipts);
    state.macro.spending = Math.round(spending);
    state.macro.debtInterest = Math.round(debtInterest);
    state.macro.deficit = Math.round(spending - receipts);
    state.macro.debtPct = Math.round(state.macro.debt / state.macro.gdp * 100);
    state.fiscalLines = lines;
    return state.macro;
  }

  // Evolve the real macroeconomy one quarter from the current policy mix.
  function evolveMacro(state) {
    var contrib = policyContributions(state), m = state.macro;
    var gdpPush = contrib.stats.gdp || 0, inflPush = contrib.stats.inflation || 0, unempPush = contrib.stats.unemployment || 0;
    var growthTarget = 1.1 + 7 * gdpPush - 0.6 * Math.max(0, (m.debtPct - 100) / 10) + cabinetBonus(state).growth;
    var inflTarget = 2.0 + 6 * inflPush + 0.35 * (m.realGrowth - 1.4);
    var unempTarget = 4.2 - 0.7 * (m.realGrowth - 1.4) + 9 * unempPush;
    var K = 0.15; // monthly easing toward targets
    m.realGrowth += (growthTarget - m.realGrowth) * K;
    m.inflation = Math.max(0, m.inflation + (inflTarget - m.inflation) * K);
    m.unemployment = Math.max(2.5, m.unemployment + (unempTarget - m.unemployment) * K);
    // nominal GDP grows by (real growth + inflation) per year, applied monthly
    m.gdp = m.gdp * (1 + (m.realGrowth + m.inflation) / 100 / 12);
    // the debt absorbs one month of the annual deficit
    m.debt = Math.max(0, m.debt + m.deficit / 12);
  }

  // =====================================================================
  // SECTORS — broad economic sectors with their own health 0..1. Each sector
  // drifts toward a target shaped by policy choices, the industrial strategy
  // and the active crisis. Sectors then feed back into growth and the wider
  // economy (markets, group satisfaction) via marketIndicators().
  // =====================================================================
  function sectorTargetHealth(state, sec) {
    var t = 0.50, w = sec.weights || {}, k;
    for (k in w) {
      var pol = polById(k); if (!pol) continue;
      // signed distance from the policy's default: above default = bigger lever
      var d = (state.policies[k] - pol.def) / (pol.max - pol.min);
      t += w[k] * d;
    }
    // active crises drag the most exposed sectors
    if (state.activeCrisis) {
      var cid = state.activeCrisis.id;
      if (cid === "energy" && (sec.id === "manufacturing" || sec.id === "services")) t -= 0.08;
      if (cid === "gilt" && sec.id === "finance") t -= 0.10;
      if (cid === "housing" && sec.id === "finance") t -= 0.05;
      if (cid === "war" && sec.id === "energy") t -= 0.05;
      if (cid === "cyber" && (sec.id === "tech" || sec.id === "finance")) t -= 0.08;
      if (cid === "ai" && sec.id === "tech") t += 0.04; // accelerating, even amid chaos
    }
    // confidence (low approval / unity) hurts business sectors a touch
    if (state.approval < 0.4) t -= 0.02;
    if (state.unity < 0.4) t -= 0.02;
    return clamp01(t);
  }
  function updateSectors(state) {
    var SS = D.SECTORS || []; if (!state.sectors) state.sectors = {};
    for (var i = 0; i < SS.length; i++) {
      var sec = SS[i];
      var cur = state.sectors[sec.id] != null ? state.sectors[sec.id] : sec.health;
      var target = sectorTargetHealth(state, sec);
      // gentle drift each month
      cur = cur + (target - cur) * 0.16;
      // industrial-strategy monthly boost on its sector
      if (state.industrialStrategy && state.industrialStrategy.sector === sec.id) {
        var st = (D.INDUSTRIAL_STRATEGIES || []).filter(function (x) { return x.id === state.industrialStrategy.id; })[0];
        if (st) cur += st.monthlyHealthBoost;
      }
      state.sectors[sec.id] = clamp01(cur);
    }
    // industrial-strategy ongoing costs: small monthly hit to deficit + group moods
    if (state.industrialStrategy) {
      var sty = (D.INDUSTRIAL_STRATEGIES || []).filter(function (x) { return x.id === state.industrialStrategy.id; })[0];
      if (sty) {
        if (sty.deficitCost) state.macro.deficit += sty.deficitCost;
        if (sty.groups) for (var gg in sty.groups) if (state.groups[gg] != null)
          state.groups[gg] = clamp01(state.groups[gg] + sty.groups[gg] * 0.04); // gentle, persistent
      }
    }
    // weighted average health → an economic "sectoral pulse" stored on macro
    var wsum = 0, num = 0;
    for (var j = 0; j < SS.length; j++) {
      var s2 = SS[j], h = state.sectors[s2.id] != null ? state.sectors[s2.id] : s2.health;
      num += h * s2.gdpShare; wsum += s2.gdpShare;
    }
    state.macro.sectorPulse = wsum > 0 ? num / wsum : 0.5;
    // sectorPulse nudges real growth each turn (small, cumulative): healthy
    // sectors = stronger underlying growth, vice versa.
    state.macro.realGrowth += (state.macro.sectorPulse - 0.5) * 0.04;
  }
  // Apply an industrial strategy at the time it is chosen.
  function chooseIndustrialStrategy(state, id) {
    var st = (D.INDUSTRIAL_STRATEGIES || []).filter(function (x) { return x.id === id; })[0];
    if (!st) return false;
    state.industrialStrategy = { id: st.id, sector: st.sector, sinceTurn: state.turn };
    // small one-off bump (signal effect) for the targeted sector
    if (state.sectors && state.sectors[st.sector] != null) state.sectors[st.sector] = clamp01(state.sectors[st.sector] + 0.05);
    return true;
  }

  // =====================================================================
  // MARKETS — derived indicators (no state of their own). Computed fresh each
  // time so they always reflect current macro / sector / approval. The UI
  // uses these for the markets dashboard in the Economy tab.
  // =====================================================================
  function marketIndicators(state) {
    var m = state.macro, sp = m.sectorPulse != null ? m.sectorPulse : 0.5;
    var ftse = 8400
      + (m.realGrowth - 1.1) * 220     // growth premium
      - Math.max(0, m.inflation - 2) * 95  // sticky-inflation drag
      - Math.max(0, m.debtPct - 100) * 14  // fiscal worry
      + (sp - 0.5) * 1100                  // sectoral pulse
      + (state.approval - 0.5) * 280;      // confidence
    var gilt10y = 4.1
      + Math.max(0, m.debtPct - 95) * 0.02
      + Math.max(0, m.deficit - 80) * 0.004
      + Math.max(0, m.inflation - 2) * 0.10
      - (state.approval - 0.5) * 0.25
      - (state.unity - 0.5) * 0.20;
    var gbp = 1.27
      + (m.bankRate - 4.5) * 0.015
      - (m.inflation - 2) * 0.010
      + (state.approval - 0.5) * 0.05
      + (sp - 0.5) * 0.06
      - Math.max(0, m.debtPct - 100) * 0.0008;
    var housePI = 100
      + (state.stats.housing - 0.4) * 30
      - (m.bankRate - 4.5) * 4
      + (m.realGrowth - 1) * 3
      - Math.max(0, m.unemployment - 4.5) * 2;
    // Trade balance as % GDP — manufacturing & services strength reduce the deficit
    var tradePct = -3.0
      + ((state.sectors && state.sectors.manufacturing ? state.sectors.manufacturing : 0.42) - 0.4) * 4
      + ((state.sectors && state.sectors.services ? state.sectors.services : 0.55) - 0.5) * 5
      - (gbp - 1.27) * 1.6; // stronger pound = worse trade balance
    // Confidence: a 0..1 composite (capitalists, businesspeople would price)
    var confidence = clamp01(0.50
      + (m.realGrowth - 1.1) * 0.08
      - Math.max(0, m.inflation - 2.5) * 0.04
      - Math.max(0, m.unemployment - 4.5) * 0.03
      + (sp - 0.5) * 0.6
      + (state.approval - 0.5) * 0.2);
    return {
      ftse: Math.round(ftse),
      gilt10y: +gilt10y.toFixed(2),
      gbp: +gbp.toFixed(3),
      housePI: Math.round(housePI),
      tradePct: +tradePct.toFixed(1),
      confidence: confidence
    };
  }

  // Weighted approval across all voter groups (by group size).
  function computeApproval(state) {
    var num = 0, den = 0, i;
    for (i = 0; i < D.GROUPS.length; i++) {
      var g = D.GROUPS[i];
      num += g.size * state.groups[g.id];
      den += g.size;
    }
    return den > 0 ? num / den : 0.5;
  }

  // Advance one quarter.
  function simulateTurn(state) {
    var targets = computeTargets(state, false), id, INERTIA = 0.2;
    for (id in targets.stats)
      state.stats[id] += (targets.stats[id] - state.stats[id]) * INERTIA;
    for (id in targets.groups)
      state.groups[id] += (targets.groups[id] - state.groups[id]) * INERTIA;

    // real economy + public finances
    evolveMacro(state);
    computeFiscal(state);

    // active events (recompute which are firing, then apply their drag)
    var firing = [], i;
    for (i = 0; i < D.EVENTS.length; i++)
      if (D.EVENTS[i].cond(state)) firing.push(D.EVENTS[i]);
    for (i = 0; i < firing.length; i++) {
      var ev = firing[i];
      if (ev.effect.stats) for (id in ev.effect.stats) if (state.stats[id] != null) state.stats[id] = clamp01(state.stats[id] + ev.effect.stats[id]);
      if (ev.effect.groups) for (id in ev.effect.groups) if (state.groups[id] != null) state.groups[id] = clamp01(state.groups[id] + ev.effect.groups[id]);
      if (ev.effect.macro) for (id in ev.effect.macro) if (state.macro[id] != null) state.macro[id] += ev.effect.macro[id];
    }
    state.activeEvents = firing;
    // active crisis drag (treated like a giant ongoing event)
    applyCrisisDrag(state);
    if (firing.length || state.activeCrisis) computeFiscal(state);

    // politics
    state.approval = computeApproval(state);
    state.pressure += (1 / 3) * (state.difficulty ? state.difficulty.pressure : 1) *
      (state.persona && state.persona.mods && state.persona.mods.pressure ? state.persona.mods.pressure : 1); // cost pressure builds monthly

    // party morale: discontent builds while approval is poor and decays when it
    // recovers. A sustained slump triggers a leadership challenge — survive it
    // if you're not heading for certain defeat, otherwise your own MPs oust you.
    if (state.approval < 0.42) state.discontent += (0.42 - state.approval) * 1.7;
    else state.discontent = Math.max(0, state.discontent * 0.5);
    state.unity = clamp01(0.62 + (state.approval - 0.45) * 1.4 - 0.5 * state.discontent + cabinetBonus(state).unity);
    state.leadershipChallenge = null;
    if (state.turn > 3 && state.discontent > 0.45) {
      if (state.approval < 0.40) { state.gameOver = true; state.oustedBy = "party"; }
      else { state.leadershipChallenge = "survived"; state.discontent = 0; state.unity = clamp01(state.unity + 0.15); }
    }

    // economic sectors drift toward their policy-shaped target each month and
    // the chosen industrial strategy adds a small monthly bump to its sector
    updateSectors(state);
    // political capital regenerates faster for a popular, united government
    state.capital = Math.min(state.maxCapital, state.capital + capitalRegen(state));

    state.turn += 1;
    state.month += 1;
    if (state.month > 12) { state.month = 1; state.year += 1; }
    // bump each minister's tenure (in months) so the cabinet panel can show
    // how long they've been at their post
    if (state.cabinet) for (var _p in state.cabinet) if (state.cabinet[_p]) state.cabinet[_p].tenure = (state.cabinet[_p].tenure || 0) + 1;
    if (state.shadowCabinet) for (var _sp in state.shadowCabinet) if (state.shadowCabinet[_sp]) state.shadowCabinet[_sp].tenure = (state.shadowCabinet[_sp].tenure || 0) + 1;
    recordHistory(state);

    var electionDue = state.turn >= TERM_TURNS;
    // Order of priority for what lands on the desk: an active crisis stage,
    // a brand-new crisis, a date-anchored fixture (Budget March, Conference
    // October, Autumn Statement November), the May local elections, by-
    // elections, PMQs, then a regular dilemma.
    if (!electionDue && !state.gameOver) {
      if (state.activeCrisis && state.activeCrisis.fireAt === state.turn) {
        state.pendingDilemma = buildCrisisDilemma(state);
      } else if (!state.activeCrisis && tryStartCrisis(state)) {
        state.pendingDilemma = buildCrisisDilemma(state);
      } else if ((state.pendingDilemma = buildScheduledEvent(state)) != null) {
        // already set above
      } else if (state.month === 5 && state.turn >= 7) state.pendingMidterm = "local";
      else if (state.turn > 4 && Math.random() < 0.05) state.pendingMidterm = "by";
      else if (state.turn % 3 === 0) state.pendingDilemma = buildPMQ(state);
      else if (Math.random() < 0.55) state.pendingDilemma = pickDilemma(state);
    }
    return { electionDue: electionDue, midterm: state.pendingMidterm || null };
  }

  // Choose a dilemma, strongly preferring ones the player has never seen, and
  // never repeating until most of the pool has been used up.
  function pickDilemma(state) {
    var seen = state.dilemmaHistory || [];
    var pool = D.DILEMMAS.filter(function (d) { return d.cond ? d.cond(state) : true; });
    if (!pool.length) return null;
    var unseen = pool.filter(function (d) { return seen.indexOf(d.id) < 0; });
    var avail = unseen;
    if (!avail.length) {
      var recent = seen.slice(-Math.floor(pool.length * 0.6));
      avail = pool.filter(function (d) { return recent.indexOf(d.id) < 0; });
    }
    if (!avail.length) avail = pool;
    return avail[Math.floor(Math.random() * avail.length)];
  }

  // SCHEDULED CALENDAR FIXTURES — the UK political year has set-piece moments
  // that always land in the same month. Each fires at most once per calendar
  // year (tracked in state.scheduledFiredYear).
  function buildScheduledEvent(state) {
    state.scheduledFiredYear = state.scheduledFiredYear || {};
    var key, dilemma = null;
    if (state.month === 2) {                  // Feb MPC + Q4 ONS data
      key = "mpc_q1_" + state.year;
      if (!state.scheduledFiredYear[key]) {
        state.scheduledFiredYear[key] = true;
        dilemma = buildMPCDilemma(state, "winter");
      }
    } else if (state.month === 3) {           // Spring Budget
      key = "budget_" + state.year;
      if (!state.scheduledFiredYear[key]) {
        state.scheduledFiredYear[key] = true;
        dilemma = buildBudgetDilemma(state);
      }
    } else if (state.month === 6) {           // Mid-year ONS economic data
      key = "ons_h1_" + state.year;
      if (!state.scheduledFiredYear[key]) {
        state.scheduledFiredYear[key] = true;
        dilemma = buildONSDataDilemma(state, "midyear");
      }
    } else if (state.month === 7) {           // G7 / NATO summer summit
      key = "summit_" + state.year;
      if (!state.scheduledFiredYear[key]) {
        state.scheduledFiredYear[key] = true;
        dilemma = buildSummitDilemma(state);
      }
    } else if (state.month === 8) {           // Aug MPC summer rate decision
      key = "mpc_q3_" + state.year;
      if (!state.scheduledFiredYear[key]) {
        state.scheduledFiredYear[key] = true;
        dilemma = buildMPCDilemma(state, "summer");
      }
    } else if (state.month === 10) {          // Party Conference season
      key = "conference_" + state.year;
      if (!state.scheduledFiredYear[key]) {
        state.scheduledFiredYear[key] = true;
        dilemma = buildConferenceDilemma(state);
      }
    } else if (state.month === 11) {          // King's Speech (odd years) or Autumn Statement (even)
      var odd = (state.year % 2) === 1;
      key = (odd ? "kingspeech_" : "autumn_") + state.year;
      if (!state.scheduledFiredYear[key]) {
        state.scheduledFiredYear[key] = true;
        dilemma = odd ? buildKingsSpeechDilemma(state) : buildAutumnStatementDilemma(state);
      }
    } else if (state.month === 12) {          // Year-end review — every December
      key = "yearend_" + state.year;
      if (!state.scheduledFiredYear[key]) {
        state.scheduledFiredYear[key] = true;
        dilemma = buildYearEndDilemma(state);
      }
    }
    return dilemma;
  }
  function buildBudgetDilemma(state) {
    return {
      id: "sched-budget-" + state.year, scheduled: true,
      title: "The Spring Budget",
      desc: "Budget Day. The Chancellor rises to a packed Commons; the lobby is full; markets and voters are watching every word. What is the shape of this Budget?",
      options: [
        { label: "Tax cuts for households",
          result: "A retail Budget — fuel and basic-rate relief steal the headlines.",
          effects: { policy: { incometax: -0.04, fuelduty: -0.06 }, all: 0.02,
            groups: { workingclass: 0.05, middleclass: 0.05, motorists: 0.04, capitalists: -0.02 } } },
        { label: "Invest in public services",
          result: "Billions for the NHS and schools — the left applauds, the markets blink.",
          effects: { policy: { nhs: 0.06, education: 0.05 }, macro: { deficit: 4 },
            groups: { publicsector: 0.06, pensioners: 0.05, parents: 0.05, capitalists: -0.04 } } },
        { label: "Hold the line — fiscal restraint",
          result: "A serious Budget for serious times. Households feel the squeeze; gilt markets purr.",
          effects: { macro: { deficit: -5 }, groups: { capitalists: 0.06, wealthy: 0.05, poor: -0.05, workingclass: -0.04 }, all: -0.01 } }
      ]
    };
  }
  function buildConferenceDilemma(state) {
    return {
      id: "sched-conference-" + state.year, scheduled: true,
      title: "Party Conference: the Keynote",
      desc: "Conference season is on. Activists fill the hall, journalists fill the press pen and the rest of the country watches the clip on the news. What does the PM say?",
      options: [
        { label: "A bold pitch for radical change",
          result: "Stirring stuff for the activists; the centre wonders if you've lost your touch.",
          effects: { groups: { young: 0.05, students: 0.05, environment: 0.04, middleclass: -0.03, pensioners: -0.03 }, unity: -0.02 } },
        { label: "Steady stewardship and continuity",
          result: "A statesmanlike speech that reassures the country and bores the room.",
          effects: { groups: { middleclass: 0.05, pensioners: 0.05, capitalists: 0.03, young: -0.03 }, unity: 0.04 } },
        { label: "Red meat for the party base",
          result: "The hall roars. The press call it divisive, the polls move.",
          effects: { groups: { patriots: 0.05, workingclass: 0.04, socialists: 0.04, liberals: -0.04 }, unity: 0.05 } }
      ]
    };
  }
  function buildAutumnStatementDilemma(state) {
    return {
      id: "sched-autumn-" + state.year, scheduled: true,
      title: "The Autumn Statement",
      desc: "Mid-fiscal-year update. The OBR forecast is in, markets are listening, and the Chancellor needs a steer.",
      options: [
        { label: "Loosen the strings — boost growth",
          result: "A growth Budget in all but name; the deficit takes the strain.",
          effects: { macro: { deficit: 6, realGrowth: 0.15 }, groups: { poor: 0.04, workingclass: 0.04, capitalists: -0.02 } } },
        { label: "Tighten belts, fiscal discipline",
          result: "Bond markets steady; households brace.",
          effects: { macro: { deficit: -5 }, groups: { capitalists: 0.06, wealthy: 0.04, poor: -0.05, workingclass: -0.04 } } },
        { label: "Targeted measures only",
          result: "A mid-table mini-Budget. Nobody storms out, nobody cheers.",
          effects: { groups: { middleclass: 0.02, pensioners: 0.02 } } }
      ]
    };
  }
  function buildSummitDilemma(state) {
    return {
      id: "sched-summit-" + state.year, scheduled: true,
      title: "G7 / NATO Summer Summit",
      desc: "The big summer summit lands. Trump, the EU leaders and a Nordic prime minister all want a piece. What is Britain's posture?",
      options: [
        { label: "Lead a transatlantic alliance",
          result: "A statesman moment in the photograph; defence and aid spending rise.",
          effects: { policy: { defence: 0.06, foreignaid: 0.04 }, macro: { deficit: 2 },
            groups: { patriots: 0.06, liberals: 0.05, capitalists: 0.03 } } },
        { label: "Pivot to Europe, mend bridges",
          result: "Berlin and Paris purr; the right calls it surrender.",
          effects: { groups: { liberals: 0.07, capitalists: 0.05, patriots: -0.06 }, macro: { realGrowth: 0.1 } } },
        { label: "Britain alone — bilateral deals",
          result: "Plenty of handshakes; few real wins.",
          effects: { groups: { patriots: 0.05, reformvoters: 0.04, liberals: -0.03 } } }
      ]
    };
  }
  function buildKingsSpeechDilemma(state) {
    return {
      id: "sched-kingspeech-" + state.year, scheduled: true,
      title: "The King's Speech",
      desc: "State Opening of Parliament. The Sovereign reads the government's legislative programme. What headlines the session?",
      options: [
        { label: "A reforming, ambitious programme",
          result: "A blockbuster session — and a year of parliamentary trench warfare.",
          effects: { groups: { liberals: 0.06, young: 0.05, socialists: 0.04, patriots: -0.03 }, unity: -0.03, capital: -1 } },
        { label: "Steady stewardship, modest bills",
          result: "Boring and credible.",
          effects: { groups: { middleclass: 0.04, pensioners: 0.04, capitalists: 0.03 }, unity: 0.04 } },
        { label: "Tough-on-crime, tough-on-borders package",
          result: "Tabloids cheer; liberal Britain warns of a culture-war session.",
          effects: { policy: { police: 0.06, immigration: 0.06 }, groups: { patriots: 0.07, pensioners: 0.04, liberals: -0.07, minorities: -0.05 } } }
      ]
    };
  }
  function buildYearEndDilemma(state) {
    // Adapt the framing based on roughly how the year has gone
    var goodYear = state.approval > 0.52, badYear = state.approval < 0.40;
    var lead = goodYear ? "A surprisingly strong year" : badYear ? "A bruising year" : "A year of mixed signals";
    return {
      id: "sched-yearend-" + state.year, scheduled: true,
      title: "The Year in Westminster",
      desc: lead + " ends. Editors are filing their year-in-review pieces; you have a chance to set the narrative for next year.",
      options: [
        { label: "A New Year speech of optimism",
          result: "A confident pitch; the country wants to believe.",
          effects: { all: 0.02, groups: { young: 0.03, capitalists: 0.02 } } },
        { label: "Acknowledge what hasn't worked",
          result: "Honesty buys a little credit; opponents call it weakness.",
          effects: { unity: 0.04, all: 0.005 } },
        { label: "Reframe and pick a fight for January",
          result: "Pick a target, set the news agenda — for better or worse.",
          effects: { unity: -0.02, groups: { patriots: 0.04, workingclass: 0.03 }, all: 0.005 } }
      ]
    };
  }
  // The Monetary Policy Committee meets quarterly. The BoE recommends a
  // direction based on the inflation gap; the player can endorse, jawbone for
  // a cut, or jawbone for a rise. Jawboning hurts BoE independence (a small
  // markets/capitalists hit) but actually moves the rate. The starting
  // bankRate field moves up or down.
  function buildMPCDilemma(state, season) {
    var infGap = state.macro.inflation - 2; // BoE's 2% target
    var leans;
    if (infGap > 1.0) leans = "rise";
    else if (infGap < -0.5 || state.macro.realGrowth < 0.5) leans = "cut";
    else leans = "hold";
    var leansLine = leans === "rise" ? "Markets and the Bank lean toward a 25bp <b>rise</b>."
      : leans === "cut" ? "The Bank is signalling a <b>cut</b> to support growth."
      : "The Bank looks set to <b>hold</b> rates steady.";
    var seasonLabel = season === "winter" ? "February MPC meeting" : "August MPC meeting";
    return {
      id: "sched-mpc-" + season + "-" + state.year, scheduled: true,
      title: seasonLabel,
      desc: "The Monetary Policy Committee meets at Threadneedle Street. " + leansLine + " The Treasury and Number 10 can stay out of it — or send signals.",
      options: [
        { label: "Publicly endorse the Bank's call",
          result: "Markets calm; the Bank salutes Number 10's restraint.",
          effects: { groups: { capitalists: 0.04, wealthy: 0.03 }, macro: leans === "rise" ? { bankRate: 0.25, inflation: -0.10 }
            : leans === "cut" ? { bankRate: -0.25, realGrowth: 0.10 }
            : {} } },
        { label: "Pressure for a cut — boost growth",
          result: "Households and the front bench cheer; the markets mutter about independence.",
          effects: { macro: { bankRate: -0.25, realGrowth: 0.15, inflation: 0.08 },
            groups: { workingclass: 0.04, homeowners: 0.05, capitalists: -0.05, wealthy: -0.03 } } },
        { label: "Pressure for a rise — fight inflation",
          result: "Pensioners and savers cheer; growth stutters.",
          effects: { macro: { bankRate: 0.25, inflation: -0.15, realGrowth: -0.10 },
            groups: { pensioners: 0.05, wealthy: 0.03, workingclass: -0.04, homeowners: -0.04 } } }
      ]
    };
  }
  // ONS data drops mid-year — the player frames how to spin the numbers.
  // Effects depend on the state of the economy at that moment.
  function buildONSDataDilemma(state, period) {
    var m = state.macro, good = m.realGrowth > 1.4 && m.inflation < 3, bad = m.realGrowth < 0 || m.inflation > 4.5;
    var lead = good ? "Solid mid-year figures — growth holding, inflation cooling."
      : bad ? "Brutal mid-year figures — the recovery has stalled or prices are still hot."
      : "Mixed mid-year figures: some encouraging, some concerning.";
    return {
      id: "sched-ons-" + period + "-" + state.year, scheduled: true,
      title: "ONS Mid-Year Data Release",
      desc: lead + " The Treasury wants to know how to spin it.",
      options: [
        { label: "Take the credit on a Sunday-morning tour",
          result: good ? "A triumphant round of broadcast — well-earned." : bad ? "A risky push that earns sneers when the numbers don't back you." : "A glass-half-full round of media — passable.",
          effects: good ? { all: 0.03, groups: { capitalists: 0.04 } } : bad ? { all: -0.02, unity: -0.02 } : { all: 0.005 } },
        { label: "Sober honesty — set out the plan",
          result: "A steady, statesmanlike response. Boring; effective.",
          effects: { unity: 0.04, all: 0.005, groups: { middleclass: 0.02 } } },
        { label: "Blame inheritance, the OBR, the world",
          result: "The base loves it; the centre rolls its eyes.",
          effects: { groups: { patriots: 0.04, workingclass: 0.03, liberals: -0.04 }, unity: 0.02 } }
      ]
    };
  }
  // Prime Minister's Questions — a recurring set-piece. The opposition attacks
  // your weakest area; you choose how to handle the dispatch box. Built as a
  // dilemma object so it reuses the same modal + resolution path.
  function buildPMQ(state) {
    var mn = macroNorm(state.macro);
    var themes = [
      { bad: 1 - state.stats.nhs, lines: [
          "Waiting lists are at record highs — the NHS is in crisis on the Prime Minister's watch!",
          "People are waiting days on trolleys in corridors — is the Prime Minister proud of that?" ],
        action: { label: "Announce emergency NHS funding", policy: { nhs: 0.04 }, group: "publicsector",
          result: "You pledge an emergency cash injection for the health service. The Chancellor blanches." } },
      { bad: clamp01(0.5 - mn.gdp + 0.2), lines: [
          "Growth is flatlining and living standards are falling — when will the PM admit the plan has failed?",
          "Britain is bottom of the G7 for growth — where is the ambition?" ],
        action: { label: "Unveil a growth & investment plan", policy: { infra: 0.05 }, group: "privatesector",
          result: "You set out a new plan for investment and infrastructure. Business cautiously welcomes it." } },
      { bad: clamp01((state.macro.inflation - 2) / 6), lines: [
          "Prices are still soaring while this out-of-touch government dithers!",
          "Families can't afford the weekly shop — when will the PM act?" ],
        action: { label: "Announce cost-of-living support", policy: { welfare: 0.04 }, group: "poor",
          result: "You promise targeted help with bills. Households are relieved; the deficit hawks grumble." } },
      { bad: state.stats.crime, lines: [
          "Crime is rising and people no longer feel safe on their own streets!",
          "Town centres have become no-go zones — the PM has lost control of law and order!" ],
        action: { label: "Promise more police on the streets", policy: { police: 0.05 }, group: "patriots",
          result: "You announce thousands more officers. The right cheers; the bill is real." } },
      { bad: state.stats.immigration, lines: [
          "The government has completely lost control of our borders!",
          "Record numbers are crossing the Channel — the PM's promises are worthless!" ],
        action: { label: "Pledge a crackdown on the crossings", policy: { border: 0.06 }, group: "patriots",
          result: "You vow to smash the smuggling gangs. Reform voters nod; lawyers and liberals bristle." } },
      { bad: clamp01((state.macro.debtPct - 90) / 40), lines: [
          "They have maxed out the nation's credit card and our children will pay!",
          "The markets have lost confidence in this government's grip on the books!" ],
        action: { label: "Set out a path to balance the books", macro: { deficit: -3 }, group: "capitalists", all: -0.015,
          result: "You promise fiscal discipline. The markets steady; voters brace for the squeeze." } },
      { bad: 1 - state.stats.housing, lines: [
          "A whole generation is locked out of a home — where is the action?",
          "Rents are unpayable and nothing gets built — when will the PM act?" ],
        action: { label: "Commit to a housebuilding blitz", policy: { housing: 0.05 }, group: "renters",
          result: "You promise to get Britain building. Renters cheer; the NIMBY shires seethe." } }
    ];
    themes.sort(function (a, b) { return b.bad - a.bad; });
    var th = themes[0], s = th.bad, v = state.turn;
    var line = th.lines[v % th.lines.length];
    var intros = ["The House is roaring.", "The benches opposite are baying.", "The Speaker struggles for order.", "The press gallery leans in."];
    var defendTxt = s < 0.45
      ? ["You list your achievements and your benches roar approval.", "A confident, fluent defence — the cameras catch you smiling."][v % 2]
      : ["Your defence rings hollow against the evidence.", "You bluster, and the Opposition smell blood."][v % 2];
    var attackTxt = ["A combative, partisan performance that fires up your own side.",
      "You pin the blame on the last lot. Red meat for the base, eye-rolls elsewhere.",
      "You go for the jugular. The clip will do numbers online tonight."][v % 3];
    var action = th.action;
    var actEffects = { unity: -0.03, capital: -1 };
    if (action.policy) actEffects.policy = action.policy;
    if (action.macro) actEffects.macro = action.macro;
    if (action.all != null) actEffects.all = action.all;
    if (action.group) { actEffects.groups = {}; actEffects.groups[action.group] = 0.08; }
    var opp = state.oppositionLeader, oppName = opp ? opp.name : "The Leader of the Opposition";
    var oppDesc = opp
      ? opp.name + " (" + opp.partyName + ") rises and, in their best " + opp.style + " manner, lets fly: “" + line + "”"
      : "The Leader of the Opposition rises: “" + line + "”";
    return {
      id: "pmq-" + state.turn, title: "Prime Minister's Questions",
      desc: oppDesc + " " + intros[v % intros.length] + " How do you respond?",
      options: [
        { label: "Defend your record at the dispatch box", result: defendTxt,
          effects: { all: 0.06 - s * 0.13, unity: 0.05 } },
        { label: "Turn your fire on the Opposition", result: attackTxt,
          effects: { unity: 0.09, all: -0.008 } },
        { label: action.label, result: action.result, effects: actEffects }
      ]
    };
  }

  // Apply a chosen dilemma option's effects and clear it.
  function resolveDilemma(state, optionIndex) {
    var d = state.pendingDilemma; if (!d) return;
    var opt = d.options[optionIndex], e = opt.effects || {}, id;
    if (e.unity != null) state.unity = clamp01(state.unity + e.unity);
    // dilemma policy nudges are fractions of a lever's range, applied in real units
    if (e.policy) for (id in e.policy) { var pol = polById(id); if (pol) state.policies[id] = clamp(state.policies[id] + e.policy[id] * (pol.max - pol.min), pol.min, pol.max); }
    if (e.macro) for (id in e.macro) if (state.macro[id] != null) state.macro[id] += e.macro[id];
    if (e.stats) for (id in e.stats) if (state.stats[id] != null) state.stats[id] = clamp01(state.stats[id] + e.stats[id]);
    if (e.groups) for (id in e.groups) if (state.groups[id] != null) state.groups[id] = clamp01(state.groups[id] + e.groups[id]);
    if (e.all != null) for (id in state.groups) state.groups[id] = clamp01(state.groups[id] + e.all);
    if (e.capital) state.capital = Math.max(0, state.capital + e.capital);
    state.dilemmaHistory.push(d.id);
    // also keep a richer journal of decisions for the briefing tab
    state.decisionLog = state.decisionLog || [];
    state.decisionLog.push({
      id: d.id, title: d.title, optionLabel: opt.label, result: opt.result,
      year: state.year, month: state.month, optionIdx: optionIndex,
      isPmq: d.id && d.id.indexOf("pmq-") === 0,
      isCrisis: !!d.crisisChain
    });
    if (state.decisionLog.length > 30) state.decisionLog.shift();
    // crisis stage advancement (if this was a crisis-chain decision)
    if (d.crisisChain && opt.crisisAdv) advanceCrisisAfterOption(state, opt);
    state.pendingDilemma = null;
    computeFiscal(state);
    state.approval = computeApproval(state);
  }

  // Cost (in political capital) of moving a policy, scaled to how far it moves
  // across its range.
  function changeCost(pol, oldVal, newVal) {
    var frac = Math.abs(newVal - oldVal) / (pol.max - pol.min);
    return Math.max(1, Math.round(frac * 14));
  }

  // ---------------------------------------------------------------------------
  // COMMONS VOTES — for big bills (total capital cost above VOTE_THRESHOLD),
  // the player has to whip a Commons vote. Pass probability is shaped by party
  // unity, the Chief Whip's competence, the player's persona, the size of the
  // bill, and whether the player chose to whip hard (an extra capital spend).
  // A defeat costs unity and discontent and writes a "defeated" entry to the
  // record; a win nudges unity up by a hair.
  // ---------------------------------------------------------------------------
  var VOTE_THRESHOLD = 5; // bills costing fewer than this many capital don't need a vote
  function computeVoteOdds(state, costStaked, extraWhip) {
    var unity = state.unity == null ? 0.5 : state.unity;
    var p = 0.58 + 0.34 * (unity - 0.5);
    var personaBump = { unifier: 0.10, statesman: 0.05, technocrat: 0.03,
                        populist: 0.0, firebrand: -0.05, reformer: -0.08 };
    if (state.persona && personaBump[state.persona.id] != null) p += personaBump[state.persona.id];
    // Chief Whip is bundled into the Party Chair post — competence matters.
    if (state.cabinet && state.cabinet.chair && state.cabinet.chair.competence != null) {
      p += (state.cabinet.chair.competence - 3) * 0.045;
    }
    // controversy: bills above the threshold get harder fast
    p -= Math.max(0, costStaked - VOTE_THRESHOLD) * 0.035;
    if (extraWhip) p += 0.20;
    if (p < 0.05) p = 0.05; if (p > 0.95) p = 0.95;
    return p;
  }
  // Resolve a Commons vote. Returns {passed, prob, roll}. The capital staked
  // is NOT deducted here — the caller already did that for a passing bill, or
  // forfeits it on a defeat. Extra-whip cost (2) IS deducted here.
  function resolveCommonsVote(state, costStaked, extraWhip) {
    var prob = computeVoteOdds(state, costStaked, extraWhip);
    var roll = Math.random(), passed = roll < prob;
    state.voteRecord = state.voteRecord || { passed: 0, failed: 0 };
    if (passed) state.voteRecord.passed += 1; else state.voteRecord.failed += 1;
    if (extraWhip) state.capital = Math.max(0, state.capital - 2);
    if (passed) state.unity = clamp01((state.unity || 0.5) + 0.015);
    else {
      state.unity = clamp01((state.unity || 0.5) - 0.06);
      state.discontent = (state.discontent || 0) + 0.5;
    }
    return { passed: passed, prob: prob, roll: roll };
  }

  // Political capital regenerated each month: a popular, united government gets
  // more done; an unpopular, divided one is paralysed.
  function capitalRegen(state) {
    var r = 1 + clamp01(state.approval) * 1.4;
    if (state.unity > 0.6) r += 0.4;
    if (state.unity < 0.35) r -= 0.4;
    r += cabinetBonus(state).capital;
    if (state.difficulty) r *= state.difficulty.regen;
    if (state.persona && state.persona.mods && state.persona.mods.regen) r *= state.persona.mods.regen;
    return Math.max(1, Math.round(r));
  }
  // Capital headroom reflects your mandate — a big majority lets you spend more.
  function maxCapitalFor(majority) {
    return 8 + Math.max(0, Math.min(5, Math.floor((majority || 0) / 70)));
  }

  // Convert governing approval into a national vote share for the player's
  // party, then redistribute the rest across the other parties (the main rival
  // soaks up most of the change), and project the Commons.
  function runGeneralElection(state, regionAdj) {
    // The player's "winning baseline" is the counterfactual election that put
    // them into office. For Labour this matches the real 2024 result; for
    // other parties it lifts them to a credible winning share so the live
    // projection doesn't show Labour still leading the day they take power.
    var pb = state.baseline || D.BASELINE;
    var base = pb[state.party] || (D.BASELINE[state.party] || 10);
    var pledgeBonus = (pledgesKept(state) - 1.5) * 1.6; // trust dividend / penalty
    // "time for a change": every government faces an anti-incumbency drag that
    // deepens the longer it has held power. Approval has to clear ~50% to
    // hold the share you won on, so a flat record loses ground.
    var antiBase = state.difficulty ? state.difficulty.antiInc : 3;
    var antiIncumbency = antiBase + 3 * (state.termsWon || 0);
    var playerShare = clamp(base + (state.approval - 0.50) * 95 + pledgeBonus - antiIncumbency, 4, 58);
    var delta = playerShare - base;

    // distribute -delta across the others in proportion to THEIR starting share
    // (in the player's baseline), with extra weight on the main rival.
    var shares = {}, p, others = [], otherBase = 0;
    var rival = mainRival(state.party);
    for (p in pb) {
      if (p === state.party) { shares[p] = playerShare; continue; }
      others.push(p); otherBase += pb[p];
    }
    for (var i = 0; i < others.length; i++) {
      p = others[i];
      var weight = otherBase > 0 ? pb[p] / otherBase : 0;
      if (p === rival) weight = Math.min(1, weight + 0.30);
      shares[p] = Math.max(0, pb[p] - delta * weight);
    }
    // renormalise to 100
    var sum = 0; for (p in shares) sum += shares[p];
    for (p in shares) shares[p] = shares[p] / sum * 100;

    var result = projectSeats(shares, regionAdj);
    result.shares = shares;
    result.playerParty = state.party;
    result.playerSeats = result.totals[state.party] || 0;
    // you remain PM if your party leads the government it forms (majority,
    // coalition or minority) — not only on an outright win.
    result.won = result.government.formateur === state.party;
    result.playerMajority = 2 * result.playerSeats - 650;
    return result;
  }

  function mainRival(party) {
    var rivals = { lab: "con", con: "lab", ld: "con", reform: "restore",
                   restore: "reform", green: "lab", snp: "lab", pc: "lab" };
    return rivals[party] || "con";
  }

  // A seat "range" projection — central plus how the seat count moves if
  // approval is a couple of points higher or lower. Reflects polling
  // uncertainty so the UI can show a credible band rather than a single number.
  function seatRange(state, isOpp) {
    var run = function () { return isOpp ? runOppositionElection(state) : runGeneralElection(state); };
    var central = run();
    var key = isOpp ? "oppShare" : "approval";
    var orig = state[key];
    var step = isOpp ? 2.5 : 0.025; // 2.5pt swing in poll share, or 2.5pt of approval
    state[key] = isOpp ? clamp(orig + step, 3, 60) : clamp(orig + step, 0, 1);
    var hi = run();
    state[key] = isOpp ? clamp(orig - step, 3, 60) : clamp(orig - step, 0, 1);
    var lo = run();
    state[key] = orig;
    // per-party seat range across the three runs (gives every party a credible
    // low–high band rather than a deterministic central number)
    var byParty = {};
    function note(t) { for (var p in t) { var n = t[p] || 0; if (!byParty[p]) byParty[p] = { low: n, high: n }; else { if (n < byParty[p].low) byParty[p].low = n; if (n > byParty[p].high) byParty[p].high = n; } } }
    note(central.totals); note(hi.totals); note(lo.totals);
    var seats = [lo.playerSeats, central.playerSeats, hi.playerSeats];
    // outcome uncertainty: do the three runs all give the same winner?
    var winners = {}; winners[lo.winner] = (winners[lo.winner]||0)+1; winners[central.winner] = (winners[central.winner]||0)+1; winners[hi.winner] = (winners[hi.winner]||0)+1;
    var wons = (lo.won?1:0) + (central.won?1:0) + (hi.won?1:0);
    var allWon = wons === 3, allLost = wons === 0;
    return { central: central.playerSeats, playerSeats: central.playerSeats,
             low: Math.min.apply(null, seats), high: Math.max.apply(null, seats),
             won: central.won, winner: central.winner, totals: central.totals, government: central.government,
             shares: central.shares, seatWinners: central.seatWinners, byRegion: central.byRegion,
             playerParty: central.playerParty, playerMajority: central.playerMajority,
             byParty: byParty, knifeEdge: !allWon && !allLost,
             winners: winners };
  }

  function applyElectionResult(state, result) {
    state.lastElection = result;
    if (result.won) {
      state.termsWon += 1;
      state.turn = 0;
      state.maxCapital = maxCapitalFor(result.playerMajority); // mandate sets headroom
      state.capital = state.maxCapital;
      state.unity = clamp01(state.unity + 0.15);
      state.discontent = 0;
      state.choosePledges = true;       // UI prompts a fresh manifesto for the new term
      state.decisionLog = [];            // wipe the journal so the new term starts fresh
      // a fresh mandate buoys the groups a little
      for (var id in state.groups) state.groups[id] = clamp01(state.groups[id] + 0.04);
    } else {
      state.gameOver = true;
      state.oustedBy = "voters";
    }
    return state;
  }

  // =====================================================================
  // MILESTONES — small celebratory achievements when the country hits a
  // notable threshold. Each one fires at most once per game.
  // =====================================================================
  var MILESTONES = [
    { id: "books",     name: "🏆 Books Balanced",      cond: function (s) { return s.macro.deficit < 50; } },
    { id: "debtdown",  name: "🏆 Debt Falling",        cond: function (s) { return s.macro.debtPct < 90; } },
    { id: "nhsfix",    name: "🏆 NHS Revived",         cond: function (s) { return s.stats.nhs > 0.65; } },
    { id: "homes",     name: "🏆 Building Boom",       cond: function (s) { return s.stats.housing > 0.6; } },
    { id: "jobs",      name: "🏆 Full Employment",     cond: function (s) { return s.macro.unemployment < 3.5; } },
    { id: "crime",     name: "🏆 Streets Safe Again",  cond: function (s) { return s.stats.crime < 0.3; } },
    { id: "schools",   name: "🏆 Schools Flourishing", cond: function (s) { return s.stats.education > 0.65; } },
    { id: "green",     name: "🏆 Climate Leader",      cond: function (s) { return s.stats.environment > 0.7; } },
    { id: "equal",     name: "🏆 Fair Country",        cond: function (s) { return s.stats.equality > 0.65; } },
    { id: "twoterms",  name: "🏆 Re-elected!",         cond: function (s) { return s.termsWon >= 2; } },
    { id: "threeterms",name: "🏆 Three-Term PM",       cond: function (s) { return s.termsWon >= 3; } }
  ];
  // PM INITIATIVES — proactive monthly actions. One per month (gated by turn).
  function usePMInitiative(state, id) {
    var INIT = D.INITIATIVES || [];
    var it = null;
    for (var i = 0; i < INIT.length; i++) if (INIT[i].id === id) { it = INIT[i]; break; }
    if (!it) return { ok: false, why: "Unknown initiative" };
    if (state.initiativeUsedTurn === state.turn) return { ok: false, why: "You've already used this month's initiative." };
    if ((state.capital || 0) < it.cost) return { ok: false, why: "Not enough political capital." };
    state.capital -= it.cost;
    state.initiativeUsedTurn = state.turn;
    // primary effects
    var e = it.effects || {}, key;
    if (e.unity != null) state.unity = clamp01(state.unity + e.unity);
    // policy nudges are fractions of a lever's range, applied in real units (as in resolveDilemma)
    if (e.policy) for (key in e.policy) { var ip = polById(key); if (ip) state.policies[key] = clamp(state.policies[key] + e.policy[key] * (ip.max - ip.min), ip.min, ip.max); }
    if (e.macro) for (key in e.macro) if (state.macro[key] != null) state.macro[key] += e.macro[key];
    if (e.stats) for (key in e.stats) if (state.stats[key] != null) state.stats[key] = clamp01(state.stats[key] + e.stats[key]);
    if (e.groups) for (key in e.groups) if (state.groups[key] != null) state.groups[key] = clamp01(state.groups[key] + e.groups[key]);
    if (e.all != null) for (key in state.groups) state.groups[key] = clamp01(state.groups[key] + e.all);
    // gaffe chance (TV interview) — a media-savvy persona reduces it, a
    // gaffe-prone one raises it.
    var gaffed = false;
    var gaffeChance = it.gaffeChance || 0;
    if (state.persona && state.persona.mods && state.persona.mods.gaffeMod) gaffeChance *= state.persona.mods.gaffeMod;
    if (gaffeChance && Math.random() < gaffeChance && it.gaffeEffects) {
      gaffed = true;
      var ge = it.gaffeEffects;
      if (ge.unity != null) state.unity = clamp01(state.unity + ge.unity);
      if (ge.all != null) for (key in state.groups) state.groups[key] = clamp01(state.groups[key] + ge.all);
      if (ge.groups) for (key in ge.groups) if (state.groups[key] != null) state.groups[key] = clamp01(state.groups[key] + ge.groups[key]);
    }
    // cabinet performance boost for Whitehall reset
    if (it.cabinetBoost && state.cabinet) {
      var posts = Object.keys(state.cabinet);
      var pick = state.cabinet[posts[Math.floor(Math.random() * posts.length)]];
      if (pick) pick.competence = Math.min(5, pick.competence + 1);
    }
    if (e.policy) computeFiscal(state);
    state.approval = computeApproval(state);
    state.decisionLog = state.decisionLog || [];
    state.decisionLog.push({ id: "init-" + it.id, title: it.name, optionLabel: gaffed ? "Took the initiative — and it backfired" : "Took the initiative",
      result: gaffed ? "A bad week of headlines undid much of the goodwill." : it.headline || "",
      year: state.year, month: state.month, isPmq: false, isCrisis: false });
    if (state.decisionLog.length > 30) state.decisionLog.shift();
    return { ok: true, gaffed: gaffed, headline: it.headline };
  }
  // Pick a random flavour event (or nothing) each month — pure atmosphere.
  function pickFlavour(state) {
    if (Math.random() > 0.40) return null;             // 40% chance of a flavour event
    var L = D.FLAVOUR || []; if (!L.length) return null;
    var f = L[Math.floor(Math.random() * L.length)];
    if (f.effect) {
      if (f.effect.unity != null) state.unity = clamp01(state.unity + f.effect.unity);
      if (f.effect.all != null) for (var key in state.groups) state.groups[key] = clamp01(state.groups[key] + f.effect.all);
    }
    return f;
  }
  function checkMilestones(state) {
    state.milestones = state.milestones || [];
    var fired = [];
    for (var i = 0; i < MILESTONES.length; i++) {
      var m = MILESTONES[i];
      if (state.milestones.indexOf(m.id) >= 0) continue;
      if (m.cond(state)) { state.milestones.push(m.id); fired.push(m.name); }
    }
    return fired;
  }

  // =====================================================================
  // NEWS HEADLINES — pick a handful of headlines reflecting today's state of
  // the country. Deterministic by turn so the briefing is stable on re-render.
  // =====================================================================
  function generateHeadlines(state, max) {
    var L = D.HEADLINES || [], out = [], i, j, eligible = [];
    for (i = 0; i < L.length; i++) {
      try { if (L[i].cond && L[i].cond(state)) eligible.push(L[i]); } catch (e) { /* skip */ }
    }
    // turn-seeded shuffle so the same set of headlines holds within a turn
    var seed = (state.turn || 0) * 9301 + 49297;
    function pick(arr) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return arr[seed % arr.length]; }
    // a stable shuffle of the eligible list by seed
    eligible = eligible.slice();
    for (i = eligible.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      j = seed % (i + 1); var t = eligible[i]; eligible[i] = eligible[j]; eligible[j] = t;
    }
    var n = Math.min(max || 3, eligible.length);
    for (i = 0; i < n; i++) {
      var h = eligible[i];
      out.push(h.fmt ? h.fmt(state) : pick(h.lines));
    }
    return out;
  }

  // =====================================================================
  // CRISIS CHAINS — multi-stage scripted events that unfold over several
  // months with persistent drag and sequential decision points.
  // =====================================================================
  function crisisById(id) { var L = D.CRISES || []; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  function tryStartCrisis(state) {
    var L = D.CRISES || [], hist = state.crisisHistory || [];
    for (var i = 0; i < L.length; i++) {
      var c = L[i];
      if (hist.indexOf(c.id) >= 0) continue;
      if (c.trigger && c.trigger(state)) {
        state.activeCrisis = { id: c.id, current: 0, fireAt: state.turn };
        return true;
      }
    }
    return false;
  }
  function applyCrisisDrag(state) {
    var ac = state.activeCrisis; if (!ac) return;
    var c = crisisById(ac.id); if (!c || !c.drag) return;
    var id;
    if (c.drag.stats) for (id in c.drag.stats) if (state.stats[id] != null) state.stats[id] = clamp01(state.stats[id] + c.drag.stats[id]);
    if (c.drag.groups) for (id in c.drag.groups) if (state.groups[id] != null) state.groups[id] = clamp01(state.groups[id] + c.drag.groups[id]);
    if (c.drag.macro) for (id in c.drag.macro) if (state.macro[id] != null) state.macro[id] += c.drag.macro[id];
  }
  function buildCrisisDilemma(state) {
    var ac = state.activeCrisis; if (!ac) return null;
    var c = crisisById(ac.id); if (!c) return null;
    var st = c.stages[ac.current]; if (!st) return null;
    // re-wrap each option so resolveDilemma sees the standard effects but can
    // also pick up the crisis advancement (next stage + delay)
    var opts = st.options.map(function (o) {
      var copy = { label: o.label, result: o.result, effects: o.effects || {}, crisisAdv: { next: o.next, in: o.in || 3 } };
      return copy;
    });
    return { id: "crisis-" + c.id + "-" + ac.current, crisisChain: c.id, crisisStage: ac.current,
             title: c.name + " · " + st.title, desc: st.desc, options: opts };
  }
  function advanceCrisisAfterOption(state, opt) {
    var ac = state.activeCrisis, adv = opt && opt.crisisAdv; if (!ac || !adv) return;
    if (adv.next == null) {
      // chain ends
      state.crisisHistory = state.crisisHistory || [];
      if (state.crisisHistory.indexOf(ac.id) < 0) state.crisisHistory.push(ac.id);
      state.activeCrisis = null;
    } else {
      state.activeCrisis = { id: ac.id, current: adv.next, fireAt: state.turn + (adv.in || 3) };
    }
  }

  // =====================================================================
  // MID-TERM ELECTORAL TESTS — local elections (each May) and by-elections
  // act as referendums on the government between general elections. They use
  // the same national-swing model as a general election and feed back into
  // party unity, political capital and backbench discontent.
  // =====================================================================
  function runLocalElections(state) {
    var shares = runGeneralElection(state).shares;
    var res = localElection(shares);
    var a = state.approval, verdict, dU, dCap, dGrp;
    if (a >= 0.5)       { verdict = "gains";    dU = 0.06;  dCap = 1;  dGrp = 0.02; }
    else if (a >= 0.43) { verdict = "steady";   dU = 0.0;   dCap = 0;  dGrp = 0.0; }
    else if (a >= 0.36) { verdict = "losses";   dU = -0.05; dCap = 0;  dGrp = -0.02; }
    else                { verdict = "drubbing"; dU = -0.10; dCap = -1; dGrp = -0.04; }
    state.unity = clamp01(state.unity + dU);
    if (dCap) state.capital = clamp(state.capital + dCap, 0, state.maxCapital);
    if (verdict === "drubbing") state.discontent += 0.12;
    if (dGrp) for (var id in state.groups) state.groups[id] = clamp01(state.groups[id] + dGrp);
    state.approval = computeApproval(state);
    var result = { kind: "local", councilSeats: res.seats, councils: res.councils,
                   party: state.party, mySeats: res.seats[state.party] || 0, verdict: verdict };
    state.lastMidterm = result;
    state.pendingMidterm = null;
    return result;
  }

  function runByElection(state) {
    var C = window.UKGAME.CONSTITUENCIES || [];
    var held = C.filter(function (s) { return s.w === state.party; });
    var pool = held.length ? held : C;
    var seat = pool[Math.floor(Math.random() * pool.length)] || null;
    if (!seat) { state.pendingMidterm = null; return null; }
    var shares = runGeneralElection(state).shares;
    var r = byElection(seat, shares);
    var holdSeat = r.winner === state.party;
    state.unity = clamp01(state.unity + (holdSeat ? 0.03 : -0.05));
    if (!holdSeat) state.discontent += 0.06;
    state.approval = computeApproval(state);
    var result = { kind: "by", seat: { c: seat.c, n: seat.n, reg: seat.reg },
                   winner: r.winner, ranked: r.ranked.slice(0, 3), held: holdSeat,
                   previousWinner: state.party };
    state.lastMidterm = result;
    state.pendingMidterm = null;
    return result;
  }

  // =====================================================================
  // OPPOSITION MODE — you don't run the country; you fight to win power.
  // The incumbent government runs at its defaults and drifts mid-term; you
  // build your party's poll share by attacking, positioning and campaigning.
  // =====================================================================
  var OPP_THEMES = {
    nhs: "the NHS", economy: "the economy", cost: "the cost of living",
    immigration: "immigration", crime: "crime", sleaze: "sleaze & competence"
  };
  function recordOppHistory(g) {
    g.oppHistory.push({ label: g.year + "-" + g.month, opp: g.oppShare, govApp: g.govApproval * 100 });
    if (g.oppHistory.length > 60) g.oppHistory.shift();
  }
  function oppWeaknesses(g) {
    var mn = macroNorm(g.macro);
    return {
      nhs: clamp01(1 - g.stats.nhs), economy: clamp01(0.55 - mn.gdp + 0.25),
      cost: clamp01((g.macro.inflation - 2) / 6), immigration: clamp01(g.stats.immigration),
      crime: clamp01(g.stats.crime), sleaze: clamp01(1 - g.unity)
    };
  }
  function newOppositionState(party, opts) {
    opts = opts || {};
    var inc = party === "lab" ? "con" : "lab";  // the AI government you face
    var g = newGovernState(inc, { difficulty: opts.difficulty });
    g.role = "opposition";
    g.party = party;                      // YOUR party
    g.incumbent = inc;
    g.energy = 6; g.maxEnergy = 6;
    g.oppShare = D.BASELINE[party] || 12;
    g.momentum = 0;
    // apply opposition scenario shifts
    var oList = D.OPP_SCENARIOS || [], scen = null;
    for (var i = 0; i < oList.length; i++) if (oList[i].id === opts.scenario) scen = oList[i];
    g.oppScenarioId = scen ? scen.id : "even";
    if (scen) {
      if (scen.oppShare) g.oppShare = clamp(g.oppShare + scen.oppShare, 3, 60);
      if (scen.govApproval) for (var gid in g.groups) g.groups[gid] = clamp01(g.groups[gid] + scen.govApproval);
    }
    g.govApproval = computeApproval(g);
    g.weak = oppWeaknesses(g);
    g.regionEffort = {};
    g.oppHistory = [];
    var sc = generateShadowCabinet();
    g.shadowCabinet = sc.shadowCabinet; g.shadowPool = sc.shadowPool;
    g.choosePledges = false; g.pledges = [];
    recordOppHistory(g);
    return g;
  }
  // An opposition action (costs energy). Returns false if too little energy.
  function oppAction(g, type, arg) {
    var cost = type === "blitz" ? 4 : 2;
    if (g.energy < cost) return false;
    g.energy -= cost;
    var b = shadowBoost(g, type, arg);
    if (type === "attack") {
      var w = g.weak[arg] != null ? g.weak[arg] : 0.3;
      if (w > 0.45) { g.oppShare += (1.2 * w + 0.6) * b; g.govApproval = clamp01(g.govApproval - 0.025 * b); g.momentum += 1.2 * w * b; }
      else { g.oppShare += 0.15 * b; g.momentum -= 0.2; }        // attacking a strength barely lands
      g.weak[arg] = clamp01(g.weak[arg] - 0.06);                 // point made; salience fades
    } else if (type === "promote") {
      g.oppShare += 0.9 * b; g.momentum += 0.8 * b;
      if (g.groups[arg] != null) g.groups[arg] = clamp01(g.groups[arg] + 0.04 * b);
      g.promoteCount = g.promoteCount || {};
      g.promoteCount[arg] = (g.promoteCount[arg] || 0) + 1;
    } else if (type === "tour") {
      g.regionEffort[arg] = (g.regionEffort[arg] || 0) + 3;      // banked ground game for polling day
      g.oppShare += 0.4;
    } else if (type === "blitz") {
      g.oppShare += 1.6 * b; g.momentum += 1.0 * b;
    }
    g.oppShare = clamp(g.oppShare, 3, 60);
    return true;
  }
  function simulateOppositionTurn(g) {
    var targets = computeTargets(g, false), id, K = 0.5;
    for (id in targets.stats) g.stats[id] += (targets.stats[id] - g.stats[id]) * K;
    for (id in targets.groups) g.groups[id] += (targets.groups[id] - g.groups[id]) * K;
    evolveMacro(g); computeFiscal(g);
    var firing = [], i;
    for (i = 0; i < D.EVENTS.length; i++) if (D.EVENTS[i].cond(g)) firing.push(D.EVENTS[i]);
    for (i = 0; i < firing.length; i++) {
      var ev = firing[i];
      if (ev.effect.stats) for (id in ev.effect.stats) if (g.stats[id] != null) g.stats[id] = clamp01(g.stats[id] + ev.effect.stats[id]);
      if (ev.effect.groups) for (id in ev.effect.groups) if (g.groups[id] != null) g.groups[id] = clamp01(g.groups[id] + ev.effect.groups[id]);
      if (ev.effect.macro) for (id in ev.effect.macro) if (g.macro[id] != null) g.macro[id] += ev.effect.macro[id];
    }
    g.activeEvents = firing;
    g.pressure += 1 / 3;
    g.unity = clamp01(g.unity - 0.004); // governing slowly erodes the incumbent
    g.govApproval = computeApproval(g);
    g.weak = oppWeaknesses(g);
    // an unpopular government lifts the opposition; your momentum adds on top
    var target = (D.BASELINE[g.party] || 12) + (0.5 - g.govApproval) * 42 + g.momentum;
    g.oppShare += (clamp(target, 3, 60) - g.oppShare) * 0.18;
    g.oppShare = clamp(g.oppShare, 3, 60);
    var cb = shadowChiefBonus(g);
    g.momentum *= Math.min(0.95, 0.7 + cb.decay);
    g.energy = Math.min(g.maxEnergy, g.energy + 2 + cb.energy);
    g.turn += 1; g.month += 1; if (g.month > 12) { g.month = 1; g.year += 1; }
    if (g.shadowCabinet) for (var _sp2 in g.shadowCabinet) if (g.shadowCabinet[_sp2]) g.shadowCabinet[_sp2].tenure = (g.shadowCabinet[_sp2].tenure || 0) + 1;
    recordOppHistory(g);
    return { electionDue: g.turn >= TERM_TURNS };
  }
  function govShareFrom(g) { return clamp((D.BASELINE[g.incumbent] || 30) + (g.govApproval - 0.46) * 70, 4, 58); }
  function runOppositionElection(g, regionAdj) {
    var govShare = govShareFrom(g), shares = {}, p;
    shares[g.party] = g.oppShare; shares[g.incumbent] = govShare;
    var others = [], ob = 0;
    for (p in D.BASELINE) if (p !== g.party && p !== g.incumbent) { others.push(p); ob += D.BASELINE[p]; }
    var remain = Math.max(6, 100 - g.oppShare - govShare);
    for (var i = 0; i < others.length; i++) shares[others[i]] = remain * (D.BASELINE[others[i]] / ob);
    var sum = 0; for (p in shares) sum += shares[p];
    for (p in shares) shares[p] = shares[p] / sum * 100;
    // fold any banked regional effort (touring battlegrounds in office) into
    // the per-region adjustments used by the seat projection
    var adj = regionAdj ? JSON.parse(JSON.stringify(regionAdj)) : {};
    if (g.regionEffort) {
      for (var r in g.regionEffort) {
        var pts = g.regionEffort[r] || 0;
        if (pts <= 0) continue;
        if (!adj[r]) adj[r] = {};
        adj[r][g.party] = (adj[r][g.party] || 0) + campaignBoost(pts);
      }
    }
    var result = projectSeats(shares, adj);
    result.shares = shares; result.playerParty = g.party;
    result.playerSeats = result.totals[g.party] || 0;
    result.won = result.government.formateur === g.party;
    result.playerMajority = 2 * result.playerSeats - 650;
    return result;
  }

  function sharesFromPreset(key) {
    var preset = D.PRESETS[key] || D.PRESETS.ge2024;
    var out = {}; for (var p in preset.shares) out[p] = preset.shares[p];
    return out;
  }

  window.UKGAME.ENGINE = {
    projectSeats: projectSeats,
    byElection: byElection,
    seatResult: seatResult,
    battlegrounds: battlegrounds,
    allSeatResults: allSeatResults,
    formGovernment: formGovernment,
    localElection: localElection,
    newGovernState: newGovernState,
    newOppositionState: newOppositionState,
    simulateTurn: simulateTurn,
    simulateOppositionTurn: simulateOppositionTurn,
    oppAction: oppAction,
    runOppositionElection: runOppositionElection,
    govShareFrom: govShareFrom,
    OPP_THEMES: OPP_THEMES,
    resolveDilemma: resolveDilemma,
    computeApproval: computeApproval,
    computeFiscal: computeFiscal,
    computeTargets: computeTargets,
    runGeneralElection: runGeneralElection,
    seatRange: seatRange,
    applyElectionResult: applyElectionResult,
    runLocalElections: runLocalElections,
    runByElection: runByElection,
    checkMilestones: checkMilestones,
    usePMInitiative: usePMInitiative,
    pickFlavour: pickFlavour,
    MILESTONES: MILESTONES,
    reshuffleCabinet: reshuffleCabinet,
    maybeMinisterResign: maybeMinisterResign,
    cabinetBonus: cabinetBonus,
    CABINET_POSTS: CABINET_POSTS,
    reshuffleShadowCabinet: reshuffleShadowCabinet,
    shadowBoost: shadowBoost,
    SHADOW_POSTS: SHADOW_POSTS,
    generateHeadlines: generateHeadlines,
    changeCost: changeCost,
    capitalRegen: capitalRegen,
    VOTE_THRESHOLD: VOTE_THRESHOLD,
    computeVoteOdds: computeVoteOdds,
    resolveCommonsVote: resolveCommonsVote,
    marketIndicators: marketIndicators,
    chooseIndustrialStrategy: chooseIndustrialStrategy,
    updateSectors: updateSectors,
    maxCapitalFor: maxCapitalFor,
    campaignBoost: campaignBoost,
    campaignAdj: campaignAdj,
    sharesFromPreset: sharesFromPreset,
    swingFrom: swingFrom,
    TERM_TURNS: TERM_TURNS,
    EFFICIENCY: EFFICIENCY,
    EXP: EXP,
    _allocate: allocate
  };
})();
