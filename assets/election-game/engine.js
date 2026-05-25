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
    return {
      totals: totals, byRegion: byRegion, seatWinners: seatWinners,
      winner: winner, winnerSeats: winnerSeats, majority: majority,
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

  function newGovernState(party) {
    var s = { party: party, turn: 0, year: 2024, quarter: 3,
              capital: 8, maxCapital: 8, debt: 98, deficit: 0,
              policies: {}, stats: {}, groups: {}, activeEvents: [],
              approval: 0.5, lastElection: null, termsWon: 0, gameOver: false, log: [] };
    var i;
    for (i = 0; i < D.POLICIES.length; i++) s.policies[D.POLICIES[i].id] = D.POLICIES[i].def;
    for (i = 0; i < D.STATS.length; i++) s.stats[D.STATS[i].id] = D.STATS[i].base;
    for (i = 0; i < D.GROUPS.length; i++) s.groups[D.GROUPS[i].id] = D.GROUPS[i].base;
    // settle so the starting policies are reflected in the stats and books
    computeTargets(s, true);
    s.approval = computeApproval(s);
    s.deficit = computeDeficit(s);
    return s;
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
    var cs = state.stats;
    targetStats.gdp          += -0.25 * (cs.unemployment - 0.3) - 0.20 * (cs.inflation - 0.4) - 0.15 * Math.max(0, (state.debt - 100) / 100);
    targetStats.unemployment += -0.30 * (cs.gdp - 0.5);
    targetStats.inflation    +=  0.20 * (cs.gdp - 0.5);
    targetStats.crime        += -0.18 * (cs.education - 0.5) - 0.15 * (cs.equality - 0.5);
    targetStats.nhs          +=  0.10 * (cs.equality - 0.5);
    for (var k in targetStats) targetStats[k] = clamp01(targetStats[k]);

    // ---- groups: base + policy + how the country is doing ----
    var targetGroups = {};
    for (i = 0; i < D.GROUPS.length; i++) {
      gr = D.GROUPS[i];
      var t = gr.base + (contrib.groups[gr.id] || 0);
      // everyone reacts to the economy, prices and jobs
      t += 0.30 * (cs.gdp - 0.5);
      t -= 0.25 * (cs.inflation - 0.4);
      t -= 0.20 * (cs.unemployment - 0.3);
      targetGroups[gr.id] = clamp01(t);
    }
    // targeted stat sensitivities
    targetGroups.pensioners   = clamp01(targetGroups.pensioners   + 0.25 * (targetStats.nhs - 0.45));
    targetGroups.poor         = clamp01(targetGroups.poor         + 0.20 * (targetStats.equality - 0.48) - 0.20 * (cs.inflation - 0.4));
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

  // Annual deficit (£bn). Anchored to a realistic UK structural deficit; each
  // policy contributes only its change *relative to its default setting*, so
  // leaving everything alone yields roughly the structural figure. A weak
  // economy widens the deficit; a strong one narrows it.
  var STRUCTURAL_DEFICIT = 120;
  function computeDeficit(state) {
    var i, total = STRUCTURAL_DEFICIT;
    for (i = 0; i < D.POLICIES.length; i++) {
      var pol = D.POLICIES[i];
      total += pol.budget(state.policies[pol.id]) - pol.budget(pol.def);
    }
    total += -160 * (state.stats.gdp - 0.5);
    total += 80 * (state.stats.unemployment - 0.3);
    return Math.round(total);
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

    // active events (recompute which are firing, then apply their drag)
    var firing = [], i;
    for (i = 0; i < D.EVENTS.length; i++)
      if (D.EVENTS[i].cond(state)) firing.push(D.EVENTS[i]);
    for (i = 0; i < firing.length; i++) {
      var ev = firing[i];
      if (ev.effect.stats) for (id in ev.effect.stats) state.stats[id] = clamp01(state.stats[id] + ev.effect.stats[id]);
      if (ev.effect.groups) for (id in ev.effect.groups) if (state.groups[id] != null) state.groups[id] = clamp01(state.groups[id] + ev.effect.groups[id]);
    }
    state.activeEvents = firing;

    // finances: a turn is one quarter. £28bn ≈ 1% of GDP of debt; nominal
    // growth erodes the debt-to-GDP ratio when the economy is healthy.
    state.deficit = computeDeficit(state);
    var debtChange = (state.deficit / 4) / 28 - (state.stats.gdp - 0.35) * 1.2;
    state.debt = Math.max(0, state.debt + debtChange);

    // politics
    state.approval = computeApproval(state);
    state.capital = Math.min(state.maxCapital, state.capital + 3);
    state.turn += 1;
    state.quarter += 1;
    if (state.quarter > 4) { state.quarter = 1; state.year += 1; }

    return { electionDue: state.turn >= TERM_QUARTERS };
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
    var playerShare = clamp(base + (state.approval - 0.46) * 70, 4, 58);
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
    result.won = result.winner === state.party;
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
      // a fresh mandate buoys the groups a little
      for (var id in state.groups) state.groups[id] = clamp01(state.groups[id] + 0.04);
    } else {
      state.gameOver = true;
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
    localElection: localElection,
    newGovernState: newGovernState,
    simulateTurn: simulateTurn,
    computeApproval: computeApproval,
    computeDeficit: computeDeficit,
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
