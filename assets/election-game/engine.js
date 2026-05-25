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
  // winner seat by seat — the classic swingometer, at full granularity.
  function projectSeatsConstituency(shares) {
    var C = window.UKGAME.CONSTITUENCIES;
    var ns = normShares(shares), sw = swingFrom(ns);
    var totals = {}, seatWinners = {}, regionTally = {}, i, p;
    for (i = 0; i < C.length; i++) {
      var seat = C[i], s = seat.s, best = null, bestv = -Infinity;
      for (p in s) {
        var v = s[p] + (sw[p] || 0); if (v < 0) v = 0;
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
  function projectSeats(shares) {
    if (window.UKGAME.CONSTITUENCIES && window.UKGAME.CONSTITUENCIES.length) {
      return projectSeatsConstituency(shares);
    }
    return projectSeatsRegional(shares);
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
              pressure: 0, pendingDilemma: null, dilemmaHistory: [],
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
    return s;
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

  // Sum all policy contributions for each stat and group.
  function policyContributions(state) {
    var stats = {}, groups = {}, i, id, fn;
    for (i = 0; i < D.POLICIES.length; i++) {
      var pol = D.POLICIES[i], v = state.policies[pol.id];
      if (pol.effects.stats) for (id in pol.effects.stats) {
        fn = pol.effects.stats[id];
        stats[id] = (stats[id] || 0) + (typeof fn === "function" ? fn(v) : fn);
      }
      if (pol.effects.groups) for (id in pol.effects.groups) {
        fn = pol.effects.groups[id];
        groups[id] = (groups[id] || 0) + (typeof fn === "function" ? fn(v) : fn);
      }
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
    if (targetStats.nhs       != null) targetStats.nhs       -= 0.011 * pr;
    if (targetStats.housing   != null) targetStats.housing   -= 0.009 * pr;
    if (targetStats.education != null) targetStats.education -= 0.006 * pr;
    if (targetStats.crime     != null) targetStats.crime     += 0.006 * pr;
    if (targetStats.immigration != null) targetStats.immigration += 0.005 * pr;
    for (var k in targetStats) targetStats[k] = clamp01(targetStats[k]);

    // ---- groups: base + policy + how the country is doing ----
    var targetGroups = {};
    for (i = 0; i < D.GROUPS.length; i++) {
      gr = D.GROUPS[i];
      var t = gr.base + (contrib.groups[gr.id] || 0);
      // everyone reacts to the real economy, prices and jobs
      t += 0.32 * (mn.gdp - 0.5);
      t -= 0.28 * (mn.inflation - 0.29);
      t -= 0.22 * (mn.unemployment - 0.144);
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
  function computeFiscal(state) {
    var F = D.FISCAL, M = D.FISCAL_MAP, p, fm, v, pol;
    var mappedR = 0, mappedS = 0;
    for (p in M) { if (M[p].type === "r") mappedR += M[p].base; else mappedS += M[p].base; }
    var residualR = F.receiptsTotal - mappedR;
    var baseDebtInterest = F.debt * F.effectiveDebtRate;
    var residualS = F.spendingTotal - mappedS - baseDebtInterest;

    var lines = { r: {}, s: {} }, receipts = 0, spending = 0;
    for (p in M) {
      fm = M[p]; pol = polById(p); v = state.policies[p];
      var amt = Math.max(0, fm.base + fm.swing * (v - pol.def));
      if (fm.type === "r") { lines.r[fm.line] = amt; receipts += amt; }
      else { lines.s[fm.line] = amt; spending += amt; }
    }
    var debtInterest = state.macro.debt * F.effectiveDebtRate;
    var gdpFactor = state.macro.gdp / F.gdp;
    // demographic/inflation cost pressure grows over time; frozen tax thresholds
    // drag a little more into tax (fiscal drag) but not enough to keep pace.
    var pr = state.pressure || 0;
    var costPressure = pr * 4.5, fiscalDrag = pr * 2.0;
    receipts = (receipts + residualR) * gdpFactor + fiscalDrag;
    spending = spending + residualS + debtInterest + costPressure;
    if (costPressure > 0) lines.s["Demographic & cost pressure"] = costPressure;
    lines.s["Debt interest"] = debtInterest;
    lines.r["Other receipts (NICs, rates, duties…)"] = residualR * gdpFactor;
    lines.s["Other (local gov, services…)"] = residualS;

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
    var growthTarget = 1.4 + 7 * gdpPush - 0.5 * Math.max(0, (m.debtPct - 100) / 10);
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
    state.capital = Math.min(state.maxCapital, state.capital + 3);
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

    state.turn += 1;
    state.quarter += 1;
    if (state.quarter > 4) { state.quarter = 1; state.year += 1; }

    var electionDue = state.turn >= TERM_QUARTERS;
    // a decision lands on the desk most quarters (never on an election quarter)
    if (!electionDue && !state.gameOver && Math.random() < 0.7) state.pendingDilemma = pickDilemma(state);
    return { electionDue: electionDue };
  }

  // Choose a dilemma the player hasn't seen recently and whose condition holds.
  function pickDilemma(state) {
    var recent = state.dilemmaHistory.slice(-6);
    var pool = D.DILEMMAS.filter(function (d) {
      if (recent.indexOf(d.id) >= 0) return false;
      return d.cond ? d.cond(state) : true;
    });
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Apply a chosen dilemma option's effects and clear it.
  function resolveDilemma(state, optionIndex) {
    var d = state.pendingDilemma; if (!d) return;
    var opt = d.options[optionIndex], e = opt.effects || {}, id;
    if (e.policy) for (id in e.policy) if (state.policies[id] != null) state.policies[id] = clamp01(state.policies[id] + e.policy[id]);
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

  // Cost (in political capital) of a proposed change in a policy slider.
  function changeCost(delta) {
    return Math.max(1, Math.round(Math.abs(delta) * 10));
  }

  // Convert governing approval into a national vote share for the player's
  // party, then redistribute the rest across the other parties (the main rival
  // soaks up most of the change), and project the Commons.
  function runGeneralElection(state) {
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

    var result = projectSeats(shares);
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
      state.capital = state.maxCapital;
      state.unity = clamp01(state.unity + 0.15);
      state.discontent = 0;
      state.pledges = pickPledges();   // a fresh manifesto for the new term
      // a fresh mandate buoys the groups a little
      for (var id in state.groups) state.groups[id] = clamp01(state.groups[id] + 0.04);
    } else {
      state.gameOver = true;
      state.oustedBy = "voters";
    }
    return state;
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
    simulateTurn: simulateTurn,
    resolveDilemma: resolveDilemma,
    computeApproval: computeApproval,
    computeFiscal: computeFiscal,
    computeTargets: computeTargets,
    runGeneralElection: runGeneralElection,
    applyElectionResult: applyElectionResult,
    changeCost: changeCost,
    sharesFromPreset: sharesFromPreset,
    swingFrom: swingFrom,
    TERM_QUARTERS: TERM_QUARTERS,
    EFFICIENCY: EFFICIENCY,
    EXP: EXP,
    _allocate: allocate
  };
})();
