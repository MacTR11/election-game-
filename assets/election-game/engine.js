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
  function projectSeatsConstituency(shares, regionAdj) {
    var C = window.UKGAME.CONSTITUENCIES;
    var ns = normShares(shares), sw = swingFrom(ns);
    var totals = {}, seatWinners = {}, regionTally = {}, i, p;
    for (i = 0; i < C.length; i++) {
      var seat = C[i], s = seat.s, best = null, bestv = -Infinity;
      var adj = regionAdj && regionAdj[seat.reg];
      for (p in s) {
        var v = s[p] + (sw[p] || 0) + (adj && adj[p] ? adj[p] : 0); if (v < 0) v = 0;
        if (v > bestv) { bestv = v; best = p; }
      }
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
    var sf = totals.sf || 0, sitting = 650 - sf, needed = Math.floor(sitting / 2) + 1;
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

  // ---------------------------------------------------------------------------
  // BY-ELECTION — single seat under national swing vs 2024.
  // ---------------------------------------------------------------------------
  function byElection(seat, shares) {
    var base = seat.s || seat.shares;
    var sw = swingFrom(normShares(shares)), out = {}, total = 0, p;
    for (p in base) {
      var v = Math.max(0, base[p] + (sw[p] || 0));
      out[p] = v; total += v;
    }
    var ranked = [];
    for (p in out) { out[p] = total > 0 ? out[p] / total * 100 : 0; ranked.push({ party: p, share: out[p] }); }
    ranked.sort(function (a, b) { return b.share - a.share; });
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
  var TERM_QUARTERS = 20; // 5-year fixed term

  function pickPledges() {
    var pool = D.PLEDGES.slice(), out = [];
    for (var k = 0; k < 3 && pool.length; k++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    return out;
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

  function newGovernState(party) {
    var F = D.FISCAL;
    var s = { party: party, turn: 0, year: 2024, quarter: 3,
              capital: 8, maxCapital: 8,
              policies: {}, stats: {}, groups: {}, activeEvents: [], fiscalLines: { r: {}, s: {} },
              macro: { gdp: F.gdp, realGrowth: F.realGrowth, inflation: F.inflation,
                       unemployment: F.unemployment, debt: F.debt,
                       debtInterest: Math.round(F.debt * F.effectiveDebtRate),
                       receipts: F.receiptsTotal, spending: F.spendingTotal,
                       deficit: F.spendingTotal - F.receiptsTotal,
                       debtPct: Math.round(F.debt / F.gdp * 100) },
              pressure: 0, pendingDilemma: null, dilemmaHistory: [], history: [],
              unity: 0.7, discontent: 0, pledges: pickPledges(),
              approval: 0.5, lastElection: null, termsWon: 0, gameOver: false, oustedBy: null, log: [] };
    var i;
    for (i = 0; i < D.POLICIES.length; i++) s.policies[D.POLICIES[i].id] = D.POLICIES[i].def;
    for (i = 0; i < D.STATS.length; i++) s.stats[D.STATS[i].id] = D.STATS[i].base;
    for (i = 0; i < D.GROUPS.length; i++) s.groups[D.GROUPS[i].id] = D.GROUPS[i].base;
    // settle so the starting policies are reflected in the stats and the books
    computeTargets(s, true);
    computeFiscal(s);
    s.approval = computeApproval(s);
    recordHistory(s);
    return s;
  }

  // Snapshot the headline numbers each quarter so the UI can chart trends.
  function recordHistory(s) {
    s.history.push({
      label: s.year + " Q" + s.quarter, approval: s.approval,
      growth: s.macro.realGrowth, inflation: s.macro.inflation,
      unemployment: s.macro.unemployment, deficit: s.macro.deficit, debtPct: s.macro.debtPct
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
    var growthTarget = 1.1 + 7 * gdpPush - 0.6 * Math.max(0, (m.debtPct - 100) / 10);
    var inflTarget = 2.0 + 6 * inflPush + 0.35 * (m.realGrowth - 1.4);
    var unempTarget = 4.2 - 0.7 * (m.realGrowth - 1.4) + 9 * unempPush;
    var K = 0.4;
    m.realGrowth += (growthTarget - m.realGrowth) * K;
    m.inflation = Math.max(0, m.inflation + (inflTarget - m.inflation) * K);
    m.unemployment = Math.max(2.5, m.unemployment + (unempTarget - m.unemployment) * K);
    // nominal GDP grows by (real growth + inflation) per year, applied quarterly
    m.gdp = m.gdp * (1 + (m.realGrowth + m.inflation) / 100 / 4);
    // the debt absorbs a quarter of the annual deficit
    m.debt = Math.max(0, m.debt + m.deficit / 4);
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
    var targets = computeTargets(state, false), id, INERTIA = 0.5;
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
    if (firing.length) computeFiscal(state);

    // politics
    state.approval = computeApproval(state);
    state.pressure += 1; // demographic & cost pressure keeps building

    // party morale: discontent builds while approval is poor and decays when it
    // recovers. A sustained slump triggers a leadership challenge — survive it
    // if you're not heading for certain defeat, otherwise your own MPs oust you.
    if (state.approval < 0.42) state.discontent += (0.42 - state.approval) * 1.7;
    else state.discontent = Math.max(0, state.discontent * 0.5);
    state.unity = clamp01(0.62 + (state.approval - 0.45) * 1.4 - 0.5 * state.discontent);
    state.leadershipChallenge = null;
    if (state.turn > 3 && state.discontent > 0.45) {
      if (state.approval < 0.40) { state.gameOver = true; state.oustedBy = "party"; }
      else { state.leadershipChallenge = "survived"; state.discontent = 0; state.unity = clamp01(state.unity + 0.15); }
    }

    // political capital regenerates faster for a popular, united government
    state.capital = Math.min(state.maxCapital, state.capital + capitalRegen(state));

    state.turn += 1;
    state.quarter += 1;
    if (state.quarter > 4) { state.quarter = 1; state.year += 1; }
    recordHistory(state);

    var electionDue = state.turn >= TERM_QUARTERS;
    // PMQs every third quarter; otherwise a decision lands on the desk most weeks
    if (!electionDue && !state.gameOver) {
      if (state.turn % 3 === 0) state.pendingDilemma = buildPMQ(state);
      else if (Math.random() < 0.72) state.pendingDilemma = pickDilemma(state);
    }
    return { electionDue: electionDue };
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

  // Prime Minister's Questions — a recurring set-piece. The opposition attacks
  // your weakest area; you choose how to handle the dispatch box. Built as a
  // dilemma object so it reuses the same modal + resolution path.
  function buildPMQ(state) {
    var mn = macroNorm(state.macro);
    var themes = [
      { bad: 1 - state.stats.nhs, line: "Waiting lists are at record highs — the NHS is in crisis on the Prime Minister's watch!" },
      { bad: clamp01(0.5 - mn.gdp + 0.2), line: "Growth is flatlining, living standards are falling — when will the PM admit their plan has failed?" },
      { bad: clamp01((state.macro.inflation - 2) / 6), line: "Prices are still soaring while this out-of-touch government dithers!" },
      { bad: state.stats.crime, line: "Crime is rising and people no longer feel safe on their own streets!" },
      { bad: state.stats.immigration, line: "The government has completely lost control of our borders!" },
      { bad: clamp01((state.macro.debtPct - 90) / 40), line: "They have maxed out the nation's credit card and our children will pay!" },
      { bad: 1 - state.stats.housing, line: "A whole generation is locked out of a home — where is the action?" }
    ];
    themes.sort(function (a, b) { return b.bad - a.bad; });
    var s = themes[0].bad;
    return {
      id: "pmq-" + state.turn, title: "Prime Minister's Questions",
      desc: "The Leader of the Opposition rises: “" + themes[0].line + "” The House is roaring. How do you respond?",
      options: [
        { label: "Defend your record at the dispatch box",
          result: s < 0.45 ? "You list your achievements and the benches cheer." : "Your defence rings hollow against the evidence.",
          effects: { all: 0.06 - s * 0.13, unity: 0.05 } },
        { label: "Turn your fire on the Opposition",
          result: "A combative, partisan performance that fires up your own side.",
          effects: { unity: 0.09, all: -0.008 } },
        { label: "Acknowledge concerns and promise action",
          result: "Statesmanlike, but your backbenchers wince at the concession.",
          effects: { all: 0.03, unity: -0.06 } }
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

  // Political capital regenerated each quarter: a popular, united government
  // gets more done; an unpopular, divided one is paralysed.
  function capitalRegen(state) {
    var r = 2 + Math.round(clamp01(state.approval) * 3);
    if (state.unity > 0.6) r += 1;
    if (state.unity < 0.35) r -= 1;
    return Math.max(1, r);
  }
  // Capital headroom reflects your mandate — a big majority lets you spend more.
  function maxCapitalFor(majority) {
    return 8 + Math.max(0, Math.min(5, Math.floor((majority || 0) / 70)));
  }

  // Convert governing approval into a national vote share for the player's
  // party, then redistribute the rest across the other parties (the main rival
  // soaks up most of the change), and project the Commons.
  function runGeneralElection(state, regionAdj) {
    var base = D.BASELINE[state.party] || 10;
    var pledgeBonus = (pledgesKept(state) - 1.5) * 1.6; // trust dividend / penalty
    var playerShare = clamp(base + (state.approval - 0.46) * 70 + pledgeBonus, 4, 58);
    var delta = playerShare - base;

    // distribute -delta across the others in proportion to their baseline,
    // but send extra to the player's main ideological rival.
    var shares = {}, p, others = [], otherBase = 0;
    var rival = mainRival(state.party);
    for (p in D.BASELINE) {
      if (p === state.party) { shares[p] = playerShare; continue; }
      others.push(p); otherBase += D.BASELINE[p];
    }
    for (var i = 0; i < others.length; i++) {
      p = others[i];
      var weight = D.BASELINE[p] / otherBase;
      if (p === rival) weight = Math.min(1, weight + 0.30);
      shares[p] = Math.max(0, D.BASELINE[p] - delta * weight);
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
    var rivals = { lab: "con", con: "lab", ld: "con", reform: "con",
                   green: "lab", snp: "lab", pc: "lab" };
    return rivals[party] || "con";
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
      // a fresh mandate buoys the groups a little
      for (var id in state.groups) state.groups[id] = clamp01(state.groups[id] + 0.04);
    } else {
      state.gameOver = true;
      state.oustedBy = "voters";
    }
    return state;
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
    g.oppHistory.push({ label: g.year + " Q" + g.quarter, opp: g.oppShare, govApp: g.govApproval * 100 });
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
  function newOppositionState(party) {
    var inc = party === "lab" ? "con" : "lab";  // the AI government you face
    var g = newGovernState(inc);
    g.role = "opposition";
    g.party = party;                      // YOUR party
    g.incumbent = inc;
    g.energy = 6; g.maxEnergy = 6;
    g.oppShare = D.BASELINE[party] || 12;
    g.momentum = 0;
    g.govApproval = computeApproval(g);
    g.weak = oppWeaknesses(g);
    g.regionEffort = {};
    g.oppHistory = [];
    g.choosePledges = false; g.pledges = [];
    recordOppHistory(g);
    return g;
  }
  // An opposition action (costs energy). Returns false if too little energy.
  function oppAction(g, type, arg) {
    var cost = type === "blitz" ? 4 : 2;
    if (g.energy < cost) return false;
    g.energy -= cost;
    if (type === "attack") {
      var w = g.weak[arg] != null ? g.weak[arg] : 0.3;
      if (w > 0.45) { g.oppShare += 1.2 * w + 0.6; g.govApproval = clamp01(g.govApproval - 0.025); g.momentum += 1.2 * w; }
      else { g.oppShare += 0.15; g.momentum -= 0.2; }            // attacking a strength barely lands
      g.weak[arg] = clamp01(g.weak[arg] - 0.06);                 // point made; salience fades
    } else if (type === "promote") {
      g.oppShare += 0.9; g.momentum += 0.8;
      if (g.groups[arg] != null) g.groups[arg] = clamp01(g.groups[arg] + 0.04);
    } else if (type === "tour") {
      g.regionEffort[arg] = (g.regionEffort[arg] || 0) + 3;      // banked ground game for polling day
      g.oppShare += 0.4;
    } else if (type === "blitz") {
      g.oppShare += 1.6; g.momentum += 1.0;
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
    g.pressure += 1;
    g.unity = clamp01(g.unity - 0.01); // governing erodes the incumbent over time
    g.govApproval = computeApproval(g);
    g.weak = oppWeaknesses(g);
    // an unpopular government lifts the opposition; your momentum adds on top
    var target = (D.BASELINE[g.party] || 12) + (0.5 - g.govApproval) * 42 + g.momentum;
    g.oppShare += (clamp(target, 3, 60) - g.oppShare) * 0.4;
    g.oppShare = clamp(g.oppShare, 3, 60);
    g.momentum *= 0.55;
    g.energy = Math.min(g.maxEnergy, g.energy + 4);
    g.turn += 1; g.quarter += 1; if (g.quarter > 4) { g.quarter = 1; g.year += 1; }
    recordOppHistory(g);
    return { electionDue: g.turn >= TERM_QUARTERS };
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
    var result = projectSeats(shares, regionAdj);
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
    applyElectionResult: applyElectionResult,
    changeCost: changeCost,
    capitalRegen: capitalRegen,
    maxCapitalFor: maxCapitalFor,
    campaignBoost: campaignBoost,
    campaignAdj: campaignAdj,
    sharesFromPreset: sharesFromPreset,
    swingFrom: swingFrom,
    TERM_QUARTERS: TERM_QUARTERS,
    EFFICIENCY: EFFICIENCY,
    EXP: EXP,
    _allocate: allocate
  };
})();
