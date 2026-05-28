/* ============================================================================
 * NUMBER 10 — main.js
 * App controller: state, screen routing, event wiring. Depends on
 * UKGAME.DATA / ENGINE / UI. Renders into #app.
 * ==========================================================================*/
(function () {
  "use strict";
  var D = window.UKGAME.DATA, E = window.UKGAME.ENGINE, U = window.UKGAME.UI;
  var $ = function (sel, r) { return (r || document).querySelector(sel); };
  var app;

  var SHARE_PARTIES = ["lab", "con", "reform", "restore", "ld", "green", "snp", "pc", "oth"];

  var S = {
    screen: "home",
    shares: E.sharesFromPreset("ge2024"),
    govern: null,
    governTab: "policies",
    setupRole: "government",
    scenario: "steady",
    difficulty: "normal",
    policyCat: "Taxation",
    policyDetail: null,
    reshufflePost: null,
    shadowReshufflePost: null,
    policyPending: {},   // { polId: pendingValue } — staged changes awaiting Confirm
    statDetail: null,    // stat id whose cause-and-effect modal is open
    groupDetail: null,   // voter group id whose modal is open
    compareA: "approval",
    compareB: "growth",
    pledgeSel: [],
    campaign: null,
    byseat: null,
    selectedSeat: null,
    mapType: "geo",
    livePolls: [],      // polls pulled from the live refresh this session
    onShareChange: null
  };

  // All loadable polls = bundled (real) + any fetched live this session.
  function allPolls() {
    return (window.UKGAME.POLLS ? window.UKGAME.POLLS.entries : []).concat(S.livePolls);
  }
  function pollById(id) {
    var all = allPolls();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  // --------------------------------------------------------------------- utils
  function toast(msg, ms) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, ms || (msg.length > 40 ? 3200 : 1900));
  }
  function normShares(src) {
    var sum = 0, p, out = {};
    for (p in src) sum += src[p];
    for (p in src) out[p] = sum > 0 ? src[p] / sum * 100 : 0;
    return out;
  }
  function fmtMoney(bn) {
    var sign = bn < 0 ? "−" : "";
    return sign + "£" + Math.abs(bn).toLocaleString() + "bn";
  }
  var MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dateLabel(g) { return (MONTHS[g.month] || "") + " " + g.year; }

  // -------------------------------------------------------- save / load
  var SAVE_KEY = "uknumber10_save_v3";
  function saveGame() {
    var g = S.govern; if (!g) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        role: g.role || "government", incumbent: g.incumbent,
        party: g.party, turn: g.turn, year: g.year, month: g.month,
        capital: g.capital, maxCapital: g.maxCapital, policies: g.policies,
        stats: g.stats, groups: g.groups, macro: g.macro, pressure: g.pressure,
        unity: g.unity, discontent: g.discontent, pledges: g.pledges, history: g.history,
        dilemmaHistory: g.dilemmaHistory, decisionLog: g.decisionLog, termsWon: g.termsWon, approval: g.approval,
        difficulty: g.difficulty, scenarioId: g.scenarioId,
        cabinet: g.cabinet, talentPool: g.talentPool,
        shadowCabinet: g.shadowCabinet, shadowPool: g.shadowPool, regionEffort: g.regionEffort,
        activeCrisis: g.activeCrisis, crisisHistory: g.crisisHistory,
        milestones: g.milestones, promoteCount: g.promoteCount,
        oppShare: g.oppShare, govApproval: g.govApproval, energy: g.energy, maxEnergy: g.maxEnergy,
        momentum: g.momentum, oppHistory: g.oppHistory,
        pendingDilemma: g.pendingDilemma ? g.pendingDilemma.id : null,
        activeEvents: g.activeEvents.map(function (e) { return e.id; })
      }));
    } catch (e) { /* storage unavailable */ }
  }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
  function loadGame() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (!s) return false;
      var opp = s.role === "opposition";
      var g = opp ? E.newOppositionState(s.party) : E.newGovernState(s.party);
      ["turn", "year", "month", "capital", "maxCapital", "pressure", "unity", "discontent", "termsWon", "approval",
       "oppShare", "govApproval", "energy", "maxEnergy", "momentum", "incumbent"]
        .forEach(function (k) { if (s[k] != null) g[k] = s[k]; });
      if (s.policies) g.policies = s.policies;
      if (s.stats) g.stats = s.stats;
      if (s.groups) g.groups = s.groups;
      if (s.macro) g.macro = s.macro;
      if (s.pledges) g.pledges = s.pledges;
      if (s.difficulty) g.difficulty = s.difficulty;
      if (s.scenarioId) g.scenarioId = s.scenarioId;
      if (s.cabinet) g.cabinet = s.cabinet;
      if (s.talentPool) g.talentPool = s.talentPool;
      if (s.shadowCabinet) g.shadowCabinet = s.shadowCabinet;
      if (s.shadowPool) g.shadowPool = s.shadowPool;
      if (s.regionEffort) g.regionEffort = s.regionEffort;
      if (s.activeCrisis) g.activeCrisis = s.activeCrisis;
      if (s.crisisHistory) g.crisisHistory = s.crisisHistory;
      if (s.milestones) g.milestones = s.milestones;
      if (s.promoteCount) g.promoteCount = s.promoteCount;
      g.dilemmaHistory = s.dilemmaHistory || [];
      g.decisionLog = s.decisionLog || [];
      g.history = s.history && s.history.length ? s.history : g.history;
      if (opp) { g.oppHistory = s.oppHistory && s.oppHistory.length ? s.oppHistory : g.oppHistory; }
      g.activeEvents = (s.activeEvents || []).map(function (id) {
        return D.EVENTS.filter(function (e) { return e.id === id; })[0];
      }).filter(Boolean);
      g.pendingDilemma = s.pendingDilemma ? (D.DILEMMAS.filter(function (d) { return d.id === s.pendingDilemma; })[0] || null) : null;
      g.gameOver = false; g.lastElection = null;
      S.govern = g; S.loadedRole = opp ? "opposition" : "government"; return true;
    } catch (e) { return false; }
  }
  function autosave() {
    if (S.govern && !S.govern.gameOver) saveGame(); else clearSave();
  }

  // map view = a hex/geographic toggle plus the chosen map (used in every mode)
  function mapView(seatWinners, opts) {
    var toggle = '<div class="maptoggle">' +
      '<button class="tab' + (S.mapType === "hex" ? " active" : "") + '" data-map="hex">⬡ Hex</button>' +
      '<button class="tab' + (S.mapType === "geo" ? " active" : "") + '" data-map="geo">🗺 Geographic</button></div>';
    var svg = S.mapType === "geo" ? U.geomap(seatWinners, opts) : U.hexmap(seatWinners, opts);
    return toggle + '<div class="map-wrap">' + svg + '</div>';
  }

  // ------------------------------------------------------------------- routing
  function go(screen) { S.screen = screen; window.scrollTo(0, 0); render(); }

  function render() {
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-nav") === S.screen);
    });
    // preserve scroll position when re-rendering the same screen (e.g. after a
    // policy nudge) so the player doesn't get bounced to the top mid-edit
    var preserveScroll = (S.screen === S.lastScreen) && (S.screen === "govern" || S.screen === "opposition");
    var sy = preserveScroll ? (document.scrollingElement || document.documentElement).scrollTop : 0;
    S.lastScreen = S.screen;
    var html;
    switch (S.screen) {
      case "home":        html = viewHome(); break;
      case "simulator":   html = viewSimulator(); break;
      case "govern-setup":html = viewGovernSetup(); break;
      case "pledges":     html = viewPledgeSelect(); break;
      case "campaign":    html = viewCampaign(); break;
      case "opposition":  html = viewOpposition(); break;
      case "govern":      html = viewGovern(); break;
      case "midterm":     html = viewMidterm(); break;
      case "election":    html = viewElectionNight(); break;
      default:            html = viewHome();
    }
    app.innerHTML = html;
    if (preserveScroll && sy > 0) {
      requestAnimationFrame(function () { (document.scrollingElement || document.documentElement).scrollTop = sy; });
    }
    if ((S.screen === "govern" || S.screen === "opposition") && S.govern) autosave();
    afterRender();
  }

  // ----------------------------------------------------------------- home view
  function viewHome() {
    var modes = [
      { s: "govern-setup", ico: "🏛", h: "Lead a Party", tag: "Flagship mode",
        p: "Govern as PM — set 28 real policies (tax rates, £bn budgets, the triple lock) on the real UK 2024–25 finances, weather PMQs and dilemmas, and win re-election. Or lead the Opposition: attack the government, win over voters and campaign your way into Number 10." },
      { s: "simulator", ico: "🗳", h: "General Election Simulator", tag: "Swingometer + map",
        p: "Dial in national vote shares — or load the latest polls — and project all 650 real constituencies seat-by-seat, with a full UK map, swing chart, battlegrounds and the Commons hemicycle. Click any seat for detail." }
    ];
    return '<div class="hero"><div class="brand" style="justify-content:center"><div class="door">10</div></div>' +
      '<h1>Number <span class="n10">10</span></h1>' +
      '<p>The most comprehensive UK political simulator on the web — govern Britain, fight elections and model the next vote, all grounded in the real 2024 General Election result.</p></div>' +
      '<div class="modes">' + modes.map(function (m) {
        return '<div class="mode-card" data-go="' + m.s + '"><div class="ico">' + m.ico + '</div>' +
          '<h2>' + m.h + '</h2><p>' + m.p + '</p><div class="tag">' + m.tag + ' →</div></div>';
      }).join("") + '</div>' +
      '<p class="foot">Electoral baseline: UK General Election, 4 July 2024 (650 seats). Seat projections apply uniform national swing across all 650 constituencies and are estimates for entertainment, not forecasts.</p>';
  }

  // --------------------------------------------------- shared share controls
  function shareControls() {
    var rows = SHARE_PARTIES.map(function (p) {
      var v = S.shares[p] != null ? S.shares[p] : 0;
      return '<div class="slider-row"><div class="name" style="color:' + U.pcolor(p) + '">' + U.pname(p) +
        '</div><input type="range" min="0" max="55" step="0.1" value="' + v + '" data-share="' + p + '">' +
        '<input class="share-input" data-shareinput="' + p + '" value="' + v.toFixed(1) + '"></div>';
    }).join("");
    var sum = SHARE_PARTIES.reduce(function (a, p) { return a + (S.shares[p] || 0); }, 0);
    var src = S.lastPollSource ? '<p class="notice" style="color:var(--commons-l)">Loaded: ' + U.esc(S.lastPollSource) + '</p>' : "";
    return '<div class="panel"><h3>National Vote Share (GB %)</h3>' +
      '<div class="row" style="margin-bottom:10px">' +
        '<button class="btn sm" data-act="fetchpolls" id="fetchbtn">↻ Load latest polls</button>' +
        '<button class="btn sm" data-act="reset2024">2024 result</button>' +
        '<button class="btn sm" data-act="normalise">Normalise 100%</button>' +
        '<button class="btn sm" data-act="share">🔗 Share</button>' +
        '<span class="spacer"></span><span class="muted" id="sharesum">Total: ' + sum.toFixed(1) + '%</span></div>' +
      rows + src +
      '<p class="notice"><b>Load latest polls</b> fetches the current poll-of-polls live, in your browser, from Wikipedia’s article <i>“Opinion polling for the next United Kingdom general election”</i> — which aggregates the British Polling Council member firms (YouGov, Opinium, More in Common, Survation, Techne, JL Partners, BMG, Find Out Now…). If it can’t be reached it keeps your current figures. Shares are normalised before projection; swing is measured versus the 2024 result.</p></div>';
  }

  // --------------------------------------------------------- simulator view
  function viewSimulator() {
    return '<h2 class="section-title">General Election Simulator</h2>' +
      '<p class="subtitle">Adjust the national vote and watch the Commons recompose, seat by seat.</p>' +
      '<div class="split" id="simgrid">' +
      shareControls() +
      '<div id="sim-results"></div></div>';
  }
  function simResults() {
    var shares = normShares(pickShares());
    var r = E.projectSeats(shares);
    var bg = E.battlegrounds(shares, 12);
    return U.headline(r) + governmentPanel(r.government) +
      '<div class="viz2">' +
        '<div class="panel"><h3>National Vote &amp; Swing vs 2024</h3>' + U.voteSwing(shares) + '</div>' +
        '<div class="panel"><h3>House of Commons — 650 seats</h3>' + U.hemicycle(r.totals) + U.seatBar(r.totals) + '</div>' +
      '</div>' +
      '<div class="panel" style="margin-top:16px"><h3>Constituency Map — projected winners <span class="faint" style="font-weight:400;text-transform:none;letter-spacing:0">· click a seat for detail</span></h3>' +
        U.legend(r.totals, { shares: shares }) + mapView(r.seatWinners) + '</div>' +
      seatDetailPanel(shares) +
      battlegroundPanel(bg) +
      regionTable(r) +
      '<div class="panel" style="margin-top:16px"><h3>How seats are modelled</h3>' +
      '<p class="muted" style="font-size:13px;margin:0 0 8px">Every one of the 650 constituencies carries its <b>real July 2024 result</b> (actual Conservative / Labour / Reform vote shares and the real winning party; the remaining parties are region-calibrated to the published regional results). To project an outcome the model takes your national vote shares, works out each party’s <b>swing versus 2024</b>, applies that swing uniformly to every seat, then awards each seat to the highest share — first-past-the-post, aggregated across all 650. At zero swing it reproduces the exact 2024 Commons (Lab 411, Con 121, LD 72, SNP 9, Reform 5…).</p>' +
      '<p class="muted" style="font-size:13px;margin:0">This is the classic <b>uniform national swing</b> swingometer. It’s an estimate, not a forecast: in reality swing varies by region and demographic, and tactical voting, incumbency and local candidates aren’t captured. Professional models (Electoral Calculus, YouGov MRP) layer regional/demographic transition models on much more data. Boundary data: mySociety; 2024 results: House of Commons Library / published constituency results.</p></div>';
  }
  function governmentPanel(g) {
    if (!g) return "";
    var members = g.members.map(function (p) {
      return '<span class="item"><span class="sw" style="background:' + U.pcolor(p) + '"></span>' + U.pshort(p) + ' ' + (g.type === "majority" ? "" : "") + '</span>';
    }).join('<span class="plus">+</span>');
    var typeTxt = g.type === "majority" ? "Single-party majority" : g.type === "coalition" ? "Coalition government" : "Minority government";
    var ok = g.seats >= g.needed;
    return '<div class="panel gov-panel"><div class="gov-head"><div><div class="lab2">Most likely government</div>' +
      '<div class="gov-name" style="color:' + U.pcolor(g.formateur) + '">' + U.pname(g.formateur) +
      (g.type === "coalition" ? "-led coalition" : g.type === "minority" ? " minority" : "") + '</div></div>' +
      '<div style="text-align:right"><div class="lab2">' + typeTxt + '</div>' +
      '<div class="big ' + (ok ? "outcome-maj" : "outcome-hung") + '" style="font-size:20px">' + g.seats + ' / ' + g.needed + '</div>' +
      '<div class="faint" style="font-size:11px">majority line is 326 of 650</div></div></div>' +
      '<div class="legend" style="margin-top:8px">' + members + '</div></div>';
  }
  function seatDetailPanel(shares) {
    if (!S.selectedSeat) return '<div class="panel" style="margin-top:16px"><h3>Seat Detail</h3>' +
      '<p class="muted">Click any constituency on the map (or a battleground below) to see its projected result, the 2024 baseline and the majority.</p></div>';
    var seat = seatByCode(S.selectedSeat);
    var d = E.seatResult(seat, shares);
    return '<div class="panel" style="margin-top:16px"><h3>Seat Detail</h3>' + U.seatCard(d) + '</div>';
  }
  function battlegroundPanel(bg) {
    var rows = bg.marginal.map(function (s) {
      var flip = s.flip ? '<span class="pill" style="background:' + U.pcolor(s.winner) + '22;color:' + U.pcolor(s.winner) + '">' + U.pshort(s.winner) + ' gain</span>' : '<span class="faint">hold</span>';
      return '<tr data-seat="' + s.code + '" class="clickrow"><td>' + U.esc(s.name) + '</td>' +
        '<td style="color:' + U.pcolor(s.winner) + '">' + U.pshort(s.winner) + '</td>' +
        '<td class="muted">' + U.pshort(s.runner || s.prev) + '</td>' +
        '<td class="num">' + s.margin.toFixed(1) + '</td><td>' + flip + '</td></tr>';
    }).join("");
    return '<div class="panel" style="margin-top:16px"><h3>Key Battlegrounds — ' + bg.flips + ' of ' + bg.total + ' seats change hands</h3>' +
      '<table class="tbl"><thead><tr><th>Constituency</th><th>Winner</th><th>2nd</th><th class="num">Maj (pts)</th><th>vs 2024</th></tr></thead><tbody>' +
      rows + '</tbody></table><p class="notice">The tightest seats on this projection — click a row to inspect it.</p></div>';
  }
  function regionTable(r) {
    var rows = r.byRegion.map(function (br) {
      var seats = br.seats;
      var top = U.orderedParties(seats).slice().sort(function (a, b) { return seats[b] - seats[a]; });
      var cells = top.slice(0, 4).map(function (p) {
        return '<span class="pill" style="background:' + U.pcolor(p) + '22;color:' + U.pcolor(p) + '">' +
          U.pshort(p) + ' ' + seats[p] + '</span>';
      }).join(" ");
      return '<tr><td>' + U.esc(br.region.name) + '</td><td class="num">' + br.region.seats + '</td><td>' + cells + '</td></tr>';
    }).join("");
    return '<div class="panel" style="margin-top:16px"><h3>Seats by Nation & Region</h3>' +
      '<table class="tbl"><thead><tr><th>Region</th><th class="num">Seats</th><th>Result</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
  }
  function pickShares() {
    var out = {}; SHARE_PARTIES.forEach(function (p) { out[p] = S.shares[p] || 0; });
    return out;
  }

  // helper: find a constituency object by ONS code (used by seat-detail clicks)
  function seatByCode(code) {
    var C = window.UKGAME.CONSTITUENCIES;
    for (var i = 0; i < C.length; i++) if (C[i].c === code) return C[i];
    return C[0];
  }

  // --------------------------------------------------------- govern: setup
  function viewGovernSetup() {
    var opp = S.setupRole === "opposition";
    var cards = D.MAIN_PARTIES.filter(function (p) { return D.PARTIES[p].playable; }).map(function (p) {
      var party = D.PARTIES[p];
      var econ = party.econ < -0.2 ? "Left" : party.econ > 0.2 ? "Right" : "Centre";
      var soc = party.soc < -0.2 ? "Liberal" : party.soc > 0.2 ? "Authoritarian" : "Centrist";
      return '<div class="mode-card" data-party="' + p + '" style="border-top:4px solid ' + party.color + '">' +
        '<div class="ico" style="color:' + party.color + '">●</div><h2>' + party.name + '</h2>' +
        '<p>' + econ + ' on economics · ' + soc + ' on social issues.<br>2024 vote: ' + (D.BASELINE[p] || "<1") + '%</p>' +
        '<div class="tag">' + (opp ? "Lead " + party.short + " in opposition" : "Govern as " + party.short) + ' →</div></div>';
    }).join("");
    var resume = hasSave()
      ? '<div class="panel" style="margin-bottom:18px;display:flex;align-items:center;gap:14px">' +
        '<div><div class="lab2">Saved game</div><div style="font-weight:800">You have a game in progress.</div></div>' +
        '<span class="spacer"></span><button class="btn primary" data-act="continuesave">Continue ▶</button>' +
        '<button class="btn sm" data-act="discardsave">Discard</button></div>'
      : "";
    var roleToggle = '<div class="tabs" style="margin-bottom:6px">' +
      '<div class="tab' + (!opp ? " active" : "") + '" data-setuprole="government">🏛 Lead the Government</div>' +
      '<div class="tab' + (opp ? " active" : "") + '" data-setuprole="opposition">📣 Lead the Opposition</div></div>';
    var blurb = opp
      ? "You start out of power. Attack the government, win over voters and campaign to take office at the next election."
      : "You take charge as Prime Minister and set the country's policies from day one.";
    var scenList = opp ? D.OPP_SCENARIOS : D.SCENARIOS;
    var scenCards = scenList.map(function (sc) {
      return '<button class="opt-card' + (S.scenario === sc.id ? " on" : "") + '" data-scenario="' + sc.id + '">' +
        '<b>' + U.esc(sc.name) + '</b><span>' + U.esc(sc.blurb) + '</span></button>';
    }).join("");
    var diffCards = Object.keys(D.DIFFICULTY).map(function (k) {
      var d = D.DIFFICULTY[k];
      var desc = k === "easy" ? "Forgiving economy, gentle voters, more capital."
        : k === "normal" ? "A fair challenge — the intended balance."
        : "Brutal decay, scarce capital and an unforgiving electorate.";
      return '<button class="opt-card' + (S.difficulty === k ? " on" : "") + '" data-difficulty="' + k + '">' +
        '<b>' + U.esc(d.name) + '</b><span>' + desc + '</span></button>';
    }).join("");
    var setupOpts = '<div class="panel" style="margin-top:14px"><h3>Starting Scenario</h3>' +
      '<div class="opt-grid">' + scenCards + '</div>' +
      '<h3 style="margin-top:16px">Difficulty</h3><div class="opt-grid">' + diffCards + '</div></div>';
    return '<h2 class="section-title">Choose Your Role</h2>' +
      '<p class="subtitle">' + blurb + '</p>' + resume + roleToggle + setupOpts +
      '<div class="modes" style="margin-top:14px">' + cards + '</div>';
  }

  // ----------------------------------------------------- manifesto pledges
  function viewPledgeSelect() {
    var g = S.govern;
    var chips = D.PLEDGES.map(function (pl) {
      var on = S.pledgeSel.indexOf(pl.id) >= 0;
      return '<div class="pledge-chip' + (on ? " on" : "") + '" data-pledge="' + pl.id + '">' +
        '<span class="tick">' + (on ? "✓" : "+") + '</span>' + U.esc(pl.text) + '</div>';
    }).join("");
    var ready = S.pledgeSel.length === 3;
    return '<h2 class="section-title">Your Manifesto</h2>' +
      '<p class="subtitle">Pick the <b>three</b> pledges you will be judged on at the next election. Keeping them earns a trust dividend at the ballot box; breaking them costs you. (' + S.pledgeSel.length + '/3 chosen)</p>' +
      '<div class="panel"><div class="pledge-grid">' + chips + '</div>' +
      '<div class="row" style="margin-top:16px;justify-content:flex-end">' +
      '<button class="btn primary" data-act="confirmpledges"' + (ready ? "" : " disabled") + '>' +
      (g.termsWon > 0 ? "Begin the new term ▶" : "Enter Number 10 ▶") + '</button></div>' +
      '<p class="notice">Choose a mix you can actually deliver — an over-ambitious manifesto is hard to keep.</p></div>';
  }

  // ----------------------------------------------------------- campaign
  function startCampaign() {
    S.campaign = { budget: 14, alloc: {} };
    D.REGIONS.forEach(function (r) { S.campaign.alloc[r.id] = 0; });
  }
  function campaignSpent() {
    return D.REGIONS.reduce(function (a, r) { return a + (S.campaign.alloc[r.id] || 0); }, 0);
  }
  function viewCampaign() {
    var g = S.govern, c = S.campaign;
    var spent = campaignSpent(), left = c.budget - spent;
    var adj = E.campaignAdj(g.party, c.alloc);
    var proj = g.role === "opposition" ? E.runOppositionElection(g, adj) : E.runGeneralElection(g, adj);
    var byReg = {}; proj.byRegion.forEach(function (br) { byReg[br.region.id] = br.seats; });
    var rows = D.REGIONS.map(function (r) {
      var seats = byReg[r.id] || {}, mine = seats[g.party] || 0;
      var al = c.alloc[r.id] || 0;
      var boost = al > 0 ? "+" + E.campaignBoost(al).toFixed(1) + "pts" : "—";
      return '<div class="camp-row"><div class="camp-reg">' + U.esc(r.region || r.name) + '<small>' + r.seats + ' seats · you win ' + mine + ' · ' + boost + '</small></div>' +
        '<div class="camp-ctrl"><button class="btn sm" data-camp="' + r.id + '" data-dir="-1"' + (al <= 0 ? " disabled" : "") + '>−</button>' +
        '<span class="camp-n">' + al + '</span>' +
        '<button class="btn sm" data-camp="' + r.id + '" data-dir="1"' + (left <= 0 ? " disabled" : "") + '>+</button></div></div>';
    }).join("");
    return '<h2 class="section-title">The Campaign</h2>' +
      '<p class="subtitle">' + D.PARTIES[g.party].name + ' is going to the country. Spend your campaign effort where it counts — concentrate on the battlegrounds.</p>' +
      U.headline(proj) + governmentPanel(proj.government) +
      '<div class="split"><div class="panel"><h3>War chest · <span style="color:var(--gold)">' + left + ' / ' + c.budget + ' left</span></h3>' +
      '<div class="camp-list">' + rows + '</div>' +
      '<p class="notice">Each point of effort lifts your vote in that region (with diminishing returns). The projection above updates as you allocate.</p>' +
      '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="pollingday" style="flex:1;justify-content:center">Polling Day ▶</button>' +
      '<button class="btn" data-act="resetcamp">Reset</button></div></div>' +
      '<div class="panel"><h3>Projected Commons</h3>' + U.hemicycle(proj.totals) + U.seatBar(proj.totals) + U.legend(proj.totals, { shares: proj.shares }) + '</div></div>';
  }

  // ------------------------------------------------------------- opposition
  function viewOpposition() {
    var g = S.govern;
    if (g.gameOver) return viewGameOver();
    var party = D.PARTIES[g.party], inc = D.PARTIES[g.incumbent];
    var govShare = E.govShareFrom(g);
    var live = E.seatRange(g, true);
    var termPct = Math.min(100, g.turn / E.TERM_TURNS * 100);
    var head = '<div class="headline">' +
      '<span class="sw" style="width:34px;height:34px;border-radius:8px;background:' + party.color + '"></span>' +
      '<div><div class="lab2">' + party.name + ' · Leader of the Opposition</div><div class="big">' + dateLabel(g) + '</div></div>' +
      '<div class="spacer"></div>' +
      '<div style="text-align:right"><div class="lab2">Your poll share</div><div class="big" style="color:' + party.color + '">' + g.oppShare.toFixed(1) + '%</div></div></div>';
    var kpis = '<div class="kpis">' +
      kpi("You (" + party.short + ")", g.oppShare.toFixed(1) + "<small>%</small>", party.color) +
      kpi(inc.short + " govt", govShare.toFixed(1) + "<small>%</small>", inc.color) +
      kpi("Govt approval", (g.govApproval * 100).toFixed(0) + "<small>%</small>", g.govApproval < 0.42 ? "var(--good)" : "var(--warn)") +
      kpi("Seats if voted today", live.low + "–" + live.high + "<small>/650</small>", live.won ? "var(--good)" : "var(--bad)") +
      kpi("Govt seats", (live.totals[g.incumbent] || 0) + "<small>/650</small>") +
      '</div>';
    // poll chart
    var oppSeries = g.oppHistory.map(function (x) { return x.opp; });
    var govSeries = g.oppHistory.map(function (x) { return x.govApp; });
    var chart = '<div class="panel" style="margin-top:16px"><h3>The Polls</h3><div class="viz2">' +
      '<div class="chart-card"><div class="chart-h"><span>Your vote share</span><b style="color:' + party.color + '">' + g.oppShare.toFixed(1) + '%</b></div>' + U.lineChart(oppSeries, { color: party.color }) + '</div>' +
      '<div class="chart-card"><div class="chart-h"><span>Government approval</span><b>' + (g.govApproval * 100).toFixed(0) + '%</b></div>' + U.lineChart(govSeries, { color: inc.color, band: [42, 60] }) + '</div>' +
      '</div></div>';
    // government scorecard — attack targets
    var weakRows = Object.keys(E.OPP_THEMES).map(function (k) {
      var w = g.weak[k] || 0;
      var col = w > 0.55 ? "var(--bad)" : w > 0.4 ? "var(--warn)" : "var(--good)";
      return '<div class="stat-row"><div class="name" style="text-transform:capitalize">' + E.OPP_THEMES[k] + '</div>' +
        '<div class="statbar"><i style="width:' + (w * 100) + '%;background:' + col + '"></i></div>' +
        '<button class="btn sm" data-opp="attack:' + k + '"' + (g.energy < 2 ? " disabled" : "") + '>Attack</button></div>';
    }).join("");
    var scorecard = '<div class="panel"><h3>Attack the Government</h3>' + weakRows +
      '<p class="notice">The longer bars are where the government is weakest — attacks land hardest there.</p></div>';
    // positioning + ground game
    var stances = [["pensioners", "Protect pensions"], ["workingclass", "Side with working families"], ["patriots", "Control immigration"],
      ["capitalists", "Cut business taxes"], ["environment", "A green new deal"], ["young", "A future for the young"]];
    var promote = '<div class="panel"><h3>Promote Your Party</h3><div class="row" style="gap:6px;flex-wrap:wrap">' +
      stances.map(function (s) { return '<button class="btn sm" data-opp="promote:' + s[0] + '"' + (g.energy < 2 ? " disabled" : "") + '>' + s[1] + '</button>'; }).join("") +
      '</div><div class="row" style="gap:6px;margin-top:10px"><button class="btn" data-opp="blitz"' + (g.energy < 4 ? " disabled" : "") + '>📣 National media blitz (4)</button></div>' +
      '<p class="notice">Win over a voter bloc, or spend big on a national blitz. Each move costs campaign energy.</p></div>';
    // tour the battleground regions: banks regional effort that lands at the election
    var totalEffort = 0; var re = g.regionEffort || {};
    var tourCells = D.REGIONS.map(function (r) {
      var pts = re[r.id] || 0; totalEffort += pts;
      var pill = pts > 0 ? '<span class="pill" style="background:' + party.color + '22;color:' + party.color + '">+' + E.campaignBoost(pts).toFixed(1) + 'pts</span>' : '<span class="faint">—</span>';
      return '<div class="tour-cell"><div class="tour-name">' + U.esc(r.name) + '<small>' + r.seats + ' seats · ' + pill + '</small></div>' +
        '<button class="btn sm" data-opp="tour:' + r.id + '"' + (g.energy < 2 ? " disabled" : "") + '>Tour (2)</button></div>';
    }).join("");
    var tour = '<div class="panel" style="margin-top:16px"><h3>Tour the Country</h3>' +
      '<div class="tour-grid">' + tourCells + '</div>' +
      '<p class="notice">Banks ground-game effort in each region (' + (totalEffort > 0 ? "banked: " + totalEffort + " visits" : "no visits yet") + '). It pays off as a vote-share boost in that region when polling day arrives.</p></div>';
    // shadow cabinet — opposition parity with the government's cabinet
    var shadow = "";
    if (g.shadowCabinet) {
      var sCards = E.SHADOW_POSTS.map(function (post) {
        var m = g.shadowCabinet[post.id]; if (!m) return "";
        var perf = ministerPerf(m.competence);
        return '<div class="min-card">' +
          '<div class="min-top"><div><div class="lab2">' + U.esc(post.title) + '</div>' +
          '<div class="min-name">' + U.esc(m.name) + '</div></div>' +
          '<button class="btn sm" data-shadowreshuffle="' + post.id + '"' + (g.energy < 3 ? " disabled" : "") + '>Reshuffle (3)</button></div>' +
          '<div class="min-meta">' + stars(m.competence) + ' <span style="color:' + perf.col + '">' + perf.t + '</span></div>' +
          '<div class="min-trait">“' + U.esc(m.trait) + '” · ' + post.area + '</div></div>';
      }).join("");
      shadow = '<div class="panel" style="margin-top:16px"><h3>Your Shadow Cabinet</h3>' +
        '<p class="notice" style="margin-top:0">A strong shadow team makes your campaign actions hit harder. The Shadow Chancellor boosts economy attacks, the Shadow Home Secretary boosts crime and migration attacks, and so on. The Campaign Chief speeds up energy regen and protects your momentum. Reshuffles cost <b>3</b> campaign energy.</p>' +
        '<div class="min-grid">' + sCards + '</div></div>';
    }
    // headlines reflect the country's mood from your vantage point
    var heads = E.generateHeadlines(g, 4);
    var headPanel = heads.length
      ? '<div class="panel news-panel" style="margin-top:16px"><h3>📰 Today\'s Headlines</h3>' +
          '<ul class="news-list">' + heads.map(function (h) { return '<li>' + U.esc(h) + '</li>'; }).join("") + '</ul></div>'
      : "";
    var dots = ""; for (var i = 0; i < g.maxEnergy; i++) dots += '<i class="' + (i < g.energy ? "on" : "") + '"></i>';
    var sidebar = '<div class="panel"><h3>The Parliament</h3>' +
      '<div class="statbar" style="margin-bottom:6px"><i style="width:' + termPct + '%;background:' + party.color + '"></i></div>' +
      '<div class="muted" style="font-size:12px">Month ' + g.turn + ' of ' + E.TERM_TURNS + ' until the election you must win.</div>' +
      '<div style="margin:14px 0 4px"><div class="lab2">Campaign energy · <b style="color:var(--gold)">' + g.energy + ' / ' + g.maxEnergy + '</b></div><div class="capital-dots">' + dots + '</div></div>' +
      '<div class="muted" style="font-size:11.5px;margin-bottom:14px">Spent on attacks, positioning and the ground game. Regenerates each month.</div>' +
      '<button class="btn primary" data-act="endturn" style="width:100%;justify-content:center;margin-bottom:8px">End Month ▶</button>' +
      '<button class="btn sm" data-act="callelection" style="width:100%;justify-content:center;margin-bottom:8px">Force an Election</button>' +
      '<button class="btn sm" data-act="quitgovern" style="width:100%;justify-content:center">Stand down</button>' +
      '<div class="panel" style="margin-top:14px;padding:12px"><div class="lab2" style="margin-bottom:6px">If an election were held today</div>' +
      U.seatBar(live.totals) + U.legend(live.totals, { byParty: live.byParty, shares: live.shares }) +
      '<div class="muted" style="font-size:11.5px;margin-top:6px"><span class="faint">Every figure is a band — polling uncertainty.</span></div>' +
      '</div></div>';
    return head + nowStrip(g) + kpis + chart + headPanel +
      '<div class="dash" style="margin-top:16px"><div>' + scorecard + '<div style="height:16px"></div>' + promote + tour + shadow + '</div>' + sidebar + '</div>' +
      dilemmaModal() + shadowReshuffleModal() + endTurnFab(g);
  }
  function shadowReshuffleModal() {
    var g = S.govern, post = S.shadowReshufflePost; if (!post || !g.shadowCabinet) return "";
    var meta = E.SHADOW_POSTS.filter(function (p) { return p.id === post; })[0];
    var current = g.shadowCabinet[post];
    var rows = (g.shadowPool || []).map(function (m, i) {
      var perf = ministerPerf(m.competence);
      var better = m.competence > current.competence;
      return '<button class="appoint-row" data-shadowappoint="' + post + ':' + i + '"' + (g.energy < 3 ? " disabled" : "") + '>' +
        '<div><div class="min-name">' + U.esc(m.name) + (better ? ' <span class="pill" style="background:var(--good)22;color:var(--good)">upgrade</span>' : "") + '</div>' +
        '<div class="min-trait">“' + U.esc(m.trait) + '”</div></div>' +
        '<div style="text-align:right">' + stars(m.competence) + '<div class="faint" style="font-size:11px;color:' + perf.col + '">' + perf.t + '</div></div></button>';
    }).join("");
    return '<div class="modal-overlay"><div class="modal">' +
      '<div class="modal-tag">Shadow reshuffle · ' + U.esc(meta.title) + '</div>' +
      '<h2>Appoint a new ' + U.esc(meta.title) + '</h2>' +
      '<p class="muted">Replacing <b>' + U.esc(current.name) + '</b> costs <b>3</b> campaign energy. A clear upgrade gives a small bump to momentum.</p>' +
      '<div class="appoint-list">' + rows + '</div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closeshadowreshuffle">Cancel</button></div>' +
      '</div></div>';
  }

  // --------------------------------------------------------- govern: main
  function viewGovern() {
    var g = S.govern;
    if (g.gameOver) return viewGameOver();
    var party = D.PARTIES[g.party];
    var live = E.seatRange(g);
    var approvalPct = (g.approval * 100).toFixed(1);
    var termPct = Math.min(100, g.turn / E.TERM_TURNS * 100);

    var head = '<div class="headline">' +
      '<span class="sw" style="width:34px;height:34px;border-radius:8px;background:' + party.color + '"></span>' +
      '<div><div class="lab2">' + party.name + ' Government · Term ' + (g.termsWon + 1) + '</div>' +
      '<div class="big">' + dateLabel(g) + '</div></div>' +
      '<div class="spacer"></div>' +
      '<div style="text-align:right"><div class="lab2">Approval</div><div class="big ' +
      (g.approval > 0.5 ? "outcome-maj" : g.approval < 0.4 ? "outcome-hung" : "") + '">' + approvalPct + '%</div></div></div>';

    var m = g.macro, pv = g.history.length > 1 ? g.history[g.history.length - 2] : null;
    var kpis = '<div class="kpis">' +
      kpi("GDP growth", m.realGrowth.toFixed(1) + "<small>%/yr</small>" + trend(m.realGrowth, pv && pv.growth, true), m.realGrowth > 1.5 ? "var(--good)" : m.realGrowth > 0 ? "var(--warn)" : "var(--bad)") +
      kpi("Inflation", m.inflation.toFixed(1) + "<small>% CPI</small>" + trend(m.inflation, pv && pv.inflation, false), m.inflation < 3 ? "var(--good)" : m.inflation < 5 ? "var(--warn)" : "var(--bad)") +
      kpi("Unemployment", m.unemployment.toFixed(1) + "<small>%</small>" + trend(m.unemployment, pv && pv.unemployment, false), m.unemployment < 4.5 ? "var(--good)" : m.unemployment < 6 ? "var(--warn)" : "var(--bad)") +
      kpi("Deficit / yr", fmtMoney(m.deficit) + trend(m.deficit, pv && pv.deficit, false), m.deficit > 180 ? "var(--bad)" : m.deficit > 120 ? "var(--warn)" : "var(--good)") +
      kpi("National debt", m.debtPct + "<small>% GDP</small>" + trend(m.debtPct, pv && pv.debtPct, false), m.debtPct > 105 ? "var(--bad)" : m.debtPct > 97 ? "var(--warn)" : "var(--good)") +
      kpi("Seats today", live.low + "–" + live.high + "<small>/650</small>", live.won ? "var(--good)" : "var(--bad)") +
      '</div>';

    var tabs = '<div class="tabs">' + [["policies", "Policies"], ["economy", "Economy"], ["voters", "Voters"], ["cabinet", "Cabinet"], ["briefing", "Briefing"]]
      .map(function (t) { return '<div class="tab' + (S.governTab === t[0] ? " active" : "") + '" data-tab="' + t[0] + '">' + t[1] + '</div>'; }).join("") + '</div>';

    var body;
    if (S.governTab === "policies") body = tabPolicies();
    else if (S.governTab === "economy") body = tabEconomy();
    else if (S.governTab === "voters") body = tabVoters();
    else if (S.governTab === "cabinet") body = tabCabinet();
    else body = tabBriefing(live);

    var dots = "";
    for (var i = 0; i < g.maxCapital; i++) dots += '<i class="' + (i < g.capital ? "on" : "") + '"></i>';
    var unityCol = g.unity > 0.55 ? "var(--good)" : g.unity > 0.38 ? "var(--warn)" : "var(--bad)";
    var unityWarn = g.unity < 0.4 ? '<div class="muted" style="font-size:11px;color:var(--bad);margin-top:4px">Your backbenchers are restless — a leadership challenge looms.</div>' : "";
    var regen = E.capitalRegen(g);
    var sidebar = '<div class="panel"><h3>The Term</h3>' +
      '<div class="statbar" style="margin-bottom:6px"><i style="width:' + termPct + '%;background:var(--commons-l)"></i></div>' +
      '<div class="muted" style="font-size:12px">Month ' + g.turn + ' of ' + E.TERM_TURNS + ' before the next scheduled election.</div>' +
      '<div style="margin:14px 0 4px"><div class="lab2">Party unity · ' + Math.round(g.unity * 100) + '%</div>' +
      '<div class="statbar"><i style="width:' + (g.unity * 100) + '%;background:' + unityCol + '"></i></div>' + unityWarn + '</div>' +
      '<div style="margin:14px 0 4px"><div class="lab2">Political capital · <b style="color:var(--gold)">' + g.capital + ' / ' + g.maxCapital + '</b> <span class="faint">(+' + regen + '/mo)</span></div>' +
      '<div class="capital-dots">' + dots + '</div></div>' +
      '<div class="muted" style="font-size:11.5px;margin-bottom:10px">Spent to change policy. Regenerates <b>+' + regen + '/month</b> — more when popular and united.</div>' +
      pledgesMini(g) +
      '<button class="btn primary" data-act="endturn" style="width:100%;justify-content:center;margin-bottom:8px">End Month ▶</button>' +
      '<button class="btn sm" data-act="callelection" style="width:100%;justify-content:center;margin-bottom:8px">Call General Election</button>' +
      '<button class="btn sm" data-act="quitgovern" style="width:100%;justify-content:center">Resign</button>' +
      '<div class="panel" style="margin-top:14px;padding:12px"><div class="lab2" style="margin-bottom:6px">If an election were held today</div>' +
      U.seatBar(live.totals) + U.legend(live.totals, { byParty: live.byParty, shares: live.shares }) +
      '<div class="muted" style="font-size:12px;margin-top:8px">' +
        (live.knifeEdge
          ? '<b style="color:var(--gold)">⚖ Knife-edge</b> — the result could go either way. Your range: <b>' + live.low + '–' + live.high + '</b> seats (central ' + live.central + ').'
          : live.won
          ? 'You hold power — <b style="color:var(--good)">' + live.low + '–' + live.high + '</b> seats (central ' + live.central + ').'
          : 'You lose power — <b style="color:var(--bad)">' + (U.pname(live.winner) || "the opposition") + '</b> would form the next government. Your range: <b>' + live.low + '–' + live.high + '</b> seats.') +
        '<br><span class="faint">Every figure here is a band, not a forecast — normal polling uncertainty.</span>' +
      '</div></div></div>';

    return head + nowStrip(g) + kpis + '<div class="dash" style="margin-top:16px"><div>' + tabs + body + '</div>' + sidebar + '</div>' + dilemmaModal() + policyDetailModal() + cabinetReshuffleModal() + statDetailModal() + groupDetailModal() + endTurnFab(g);
  }
  function trend(cur, prev, goodHigh) {
    if (prev == null) return "";
    var d = cur - prev;
    if (Math.abs(d) < 0.05) return "";
    var up = d > 0, good = goodHigh ? up : !up;
    return ' <span style="font-size:12px;color:' + (good ? "var(--good)" : "var(--bad)") + '">' + (up ? "▲" : "▼") + "</span>";
  }
  function dilemmaModal() {
    var g = S.govern, d = g.pendingDilemma;
    if (!d) return "";
    var hardMode = g.difficulty && g.difficulty.id === "hard";
    var opts = d.options.map(function (o, i) {
      var previewHtml = "";
      if (!hardMode) {
        var preview = decisionSummary(o);
        if (preview) previewHtml = '<span class="opt-preview">📊 ' + U.esc(preview) + '</span>';
      }
      return '<button class="dilemma-opt" data-dilemma="' + i + '"><b>' + U.esc(o.label) + '</b>' +
        '<span>' + U.esc(o.result) + '</span>' + previewHtml + '</button>';
    }).join("");
    return '<div class="modal-overlay"><div class="modal">' +
      '<div class="modal-tag">Decision on your desk · ' + dateLabel(g) + '</div>' +
      '<h2>' + U.esc(d.title) + '</h2><p class="muted">' + U.esc(d.desc) + '</p>' +
      '<div class="dilemma-opts">' + opts + '</div></div></div>';
  }
  function kpi(k, v, color) {
    return '<div class="kpi"><div class="k">' + k + '</div><div class="v" style="color:' + (color || "var(--ink)") + '">' + v + '</div></div>';
  }

  function fmtPolicyVal(pol, v) {
    var u = pol.unit;
    switch (u) {
      case "%": return (Number.isInteger(v) ? v : v.toFixed(1)) + "%";
      case "£bn": return "£" + v + "bn";
      case "p": return v + "p";
      case "£": return "£" + v.toLocaleString();
      case "£/mo": return "£" + v + "/mo";
      case "£/hr": return "£" + v.toFixed(2);
      case "£/yr": return "£" + v.toLocaleString();
      case "%GDP": return v.toFixed(1) + "%";
      case "%GNI": return v.toFixed(2) + "%";
      case "k/yr": return v + "k";
      case "/10": return v + "/10";
      default: return "" + v;
    }
  }
  // net effect of a policy's current setting on the annual deficit (£bn);
  // positive = worsens the deficit, negative = improves it.
  function deficitImpact(pol, v) {
    if (!pol.fiscal) return 0;
    var delta = pol.fiscal.mode === "direct" ? (v - pol.def) : pol.fiscal.swing * (v - pol.def) / (pol.max - pol.min);
    return pol.fiscal.type === "s" ? delta : -delta;
  }
  var POLICY_CATS = ["Taxation", "Public Services", "Welfare", "Economy", "Society"];
  var STAT_NAME = { gdp: "Growth", inflation: "Inflation", unemployment: "Unemployment",
    nhs: "NHS / Health", education: "Education", crime: "Crime", housing: "Housing",
    immigration: "Net migration", environment: "Environment", equality: "Equality" };
  function statIsBadWhenHigh(id) { return id === "inflation" || id === "unemployment" || id === "crime" || id === "immigration"; }

  function tabPolicies() {
    var g = S.govern;
    var pills = POLICY_CATS.map(function (c) {
      return '<div class="tab' + (S.policyCat === c ? " active" : "") + '" data-polcat="' + c + '">' + c + '</div>';
    }).join("");
    // pending-changes summary across all policies (not just the visible cat)
    var pendingKeys = Object.keys(S.policyPending || {});
    var totalPendingCost = 0, totalDeficitDelta = 0;
    pendingKeys.forEach(function (pid) {
      var pp = D.POLICIES.filter(function (x) { return x.id === pid; })[0]; if (!pp) return;
      var ov = g.policies[pid], nv = S.policyPending[pid];
      totalPendingCost += E.changeCost(pp, ov, nv);
      totalDeficitDelta += deficitImpact(pp, nv) - deficitImpact(pp, ov);
    });
    var pendingBar = "";
    if (pendingKeys.length) {
      var canAfford = totalPendingCost <= g.capital;
      var defTxt = Math.abs(totalDeficitDelta) < 0.5 ? "no budget impact"
        : (totalDeficitDelta > 0 ? "+£" + Math.round(totalDeficitDelta) + "bn deficit" : "−£" + Math.abs(Math.round(totalDeficitDelta)) + "bn (saves money)");
      pendingBar = '<div class="pending-bar' + (canAfford ? '' : ' over') + '">' +
        '<div class="pending-info"><b>' + pendingKeys.length + ' pending change' + (pendingKeys.length === 1 ? '' : 's') + '</b>' +
        ' · cost <b>' + totalPendingCost + ' ⚡</b> of your <b>' + g.capital + '</b> · ' + defTxt + '</div>' +
        '<div class="pending-btns">' +
          '<button class="btn sm" data-act="cancelpending">Cancel</button>' +
          '<button class="btn primary sm" data-act="confirmpending"' + (canAfford ? '' : ' disabled') + '>Confirm</button>' +
        '</div></div>';
    }
    var rows = D.POLICIES.filter(function (p) { return p.cat === S.policyCat; }).map(function (pol) {
      var currentVal = g.policies[pol.id];
      var pendingVal = S.policyPending[pol.id];
      var hasPending = pendingVal != null && pendingVal !== currentVal;
      var displayVal = hasPending ? pendingVal : currentVal;
      var imp = deficitImpact(pol, displayVal);
      var impTxt = Math.abs(imp) < 0.5 ? '<span class="faint">±0</span>'
        : '<span style="color:' + (imp > 0 ? "var(--bad)" : "var(--good)") + '">' + (imp > 0 ? "+" : "−") + "£" + Math.abs(Math.round(imp)) + "bn</span>";
      var moved = Math.abs(displayVal - pol.def) > 1e-9;
      var canDown = displayVal > pol.min;
      var canUp = displayVal < pol.max;
      var valHtml = hasPending
        ? '<span class="pol-pending">' + fmtPolicyVal(pol, currentVal) + ' → <b>' + fmtPolicyVal(pol, pendingVal) + '</b></span>'
        : fmtPolicyVal(pol, displayVal);
      return '<div class="pol-row' + (hasPending ? ' pending' : '') + '" data-poldetail="' + pol.id + '">' +
        '<div class="pol-ic">' + pol.icon + '</div>' +
        '<div class="pol-name">' + pol.name + (moved ? ' <span class="moved">●</span>' : "") + '<small>' + pol.low + " ↔ " + pol.high + '</small></div>' +
        '<div class="pol-val">' + valHtml + '</div>' +
        '<div class="pol-nudge-cell">' +
          '<button class="pol-nudge" data-polnudge="' + pol.id + ':-1" title="Step down — stage a change"' + (canDown ? '' : ' disabled') + '>−</button>' +
          '<button class="pol-nudge" data-polnudge="' + pol.id + ':1" title="Step up — stage a change"' + (canUp ? '' : ' disabled') + '>+</button>' +
        '</div>' +
        '<div class="pol-imp">' + impTxt + '</div><div class="pol-go">›</div></div>';
    }).join("");
    return '<div class="panel">' + pendingBar + '<div class="tabs subtabs">' + pills + '</div>' +
      '<div class="pol-list">' + rows + '</div>' +
      '<p class="notice">Use ± to stage a change (it costs nothing until you Confirm), or click a row for the full slider. Pending changes appear in gold.</p></div>';
  }

  // Democracy-style policy detail: the lever plus a clear impact breakdown.
  function policyDetailModal() {
    var g = S.govern, id = S.policyDetail; if (!id) return "";
    var pol = D.POLICIES.filter(function (p) { return p.id === id; })[0]; if (!pol) return "";
    var v = g.policies[id], imp = deficitImpact(pol, v);
    // how far this lever can move with the capital you have right now
    var range = pol.max - pol.min;
    var maxDelta = (g.capital + 0.49) / 14 * range; // inverse of changeCost
    var affLo = Math.max(pol.min, v - maxDelta), affHi = Math.min(pol.max, v + maxDelta);
    var pct = function (x) { return (x - pol.min) / range * 100; };
    var bandL = pct(affLo), bandW = pct(affHi) - bandL, nowPct = pct(v);
    var impLine = !pol.fiscal ? '<span class="faint">no direct budget cost</span>'
      : '<b style="color:' + (imp > 0 ? "var(--bad)" : "var(--good)") + '">' + (imp > 0 ? "+£" + Math.round(imp) + "bn to the deficit" : "−£" + Math.abs(Math.round(imp)) + "bn (saves money)") + '</b>';
    // economic effects of raising this lever
    var econ = Object.keys(pol.effects.stats || {}).map(function (sid) {
      var k = pol.effects.stats[sid]; if (!k) return "";
      var up = k > 0, good = up ? !statIsBadWhenHigh(sid) : statIsBadWhenHigh(sid);
      var mag = Math.min(3, Math.ceil(Math.abs(k) / 0.18));
      return '<div class="eff-row"><span>' + (STAT_NAME[sid] || sid) + '</span>' +
        '<span style="color:' + (good ? "var(--good)" : "var(--bad)") + '">' + (up ? "▲" : "▼") + " ".repeat(0) +
        '<span class="faint" style="margin-left:4px">' + "▮".repeat(mag) + '</span></span></div>';
    }).join("") || '<div class="faint">No direct economic effect.</div>';
    // voter winners / losers if raised
    var gains = [], loses = [];
    Object.keys(pol.effects.groups || {}).forEach(function (gid) {
      var grp = D.GROUPS.filter(function (x) { return x.id === gid; })[0]; if (!grp) return;
      var k = pol.effects.groups[gid]; if (!k) return;
      (k > 0 ? gains : loses).push(grp.name);
    });
    function pills(arr, col) {
      return arr.length ? arr.map(function (nm) { return '<span class="pill" style="background:' + col + '22;color:' + col + '">' + U.esc(nm) + '</span>'; }).join(" ") : '<span class="faint">—</span>';
    }
    return '<div class="modal-overlay pol-overlay"><div class="modal">' +
      '<div class="modal-tag">' + pol.cat + '</div><h2>' + pol.icon + " " + U.esc(pol.name) + '</h2>' +
      '<div class="pol-detail-set"><div class="row" style="justify-content:space-between;align-items:baseline">' +
        '<span class="faint">' + U.esc(pol.low) + '</span><span class="pdval pv" style="font-size:22px;font-weight:800">' + fmtPolicyVal(pol, v) + '</span>' +
        '<span class="faint">' + U.esc(pol.high) + '</span></div>' +
      '<input type="range" style="width:100%" min="' + pol.min + '" max="' + pol.max + '" step="' + (pol.step || 1) + '" value="' + v + '" data-policy="' + pol.id + '">' +
      '<div class="afford-track"><i class="afford-fill" style="left:' + bandL + '%;width:' + bandW + '%"></i><i class="afford-now" style="left:' + nowPct + '%"></i></div>' +
      '<div class="pol-cost" data-pol-cost style="margin-top:4px;font-size:12px">Drag the slider — nothing is spent until you Confirm. You have <b>' + g.capital + '</b> political capital.</div>' +
      '<div class="pol-impact" data-pol-impact style="margin-top:4px;font-size:12px;color:var(--ink-dim);min-height:18px">📊 Move the slider to preview the impact.</div>' +
      '<div style="margin-top:6px">Budget impact at this setting: ' + impLine + '</div></div>' +
      '<div class="viz2" style="margin-top:14px">' +
        '<div><div class="lab2" style="margin-bottom:6px">Raising this affects</div>' + econ + '</div>' +
        '<div><div class="lab2" style="margin-bottom:6px">Pleases</div>' + pills(gains, "#2ecc71") +
        '<div class="lab2" style="margin:10px 0 6px">Upsets</div>' + pills(loses, "#e74c3c") + '</div>' +
      '</div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px;gap:8px">' +
        '<button class="btn" data-act="closepolicy">Done</button>' +
        '<button class="btn primary" data-confirmpolicy="' + pol.id + '" disabled>Confirm change</button>' +
      '</div>' +
      '</div></div>';
  }
  // Preview a policy move's biggest effects (stats, groups, deficit Δ).
  function policyMovePreview(pol, oldVal, newVal) {
    if (oldVal === newVal) return null;
    var range = pol.max - pol.min;
    var d = (newVal - oldVal) / range;
    var parts = [];
    function add(label, val, fmtFn) {
      if (Math.abs(val) < 0.005) return;
      parts.push({ mag: Math.abs(val), txt: (val > 0 ? "▲" : "▼") + " " + label + " " + (fmtFn ? fmtFn(val) : val.toFixed(2)) });
    }
    var imp = deficitImpact(pol, newVal) - deficitImpact(pol, oldVal);
    if (Math.abs(imp) >= 0.5) add("deficit", imp, function (v) { return (v > 0 ? "+£" : "−£") + Math.abs(Math.round(v)) + "bn"; });
    if (pol.effects && pol.effects.stats) for (var sid in pol.effects.stats) {
      var sv = pol.effects.stats[sid] * d;
      var label = STAT_NAME[sid] || sid;
      add(label, sv, function (v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(0) + "pts"; });
    }
    if (pol.effects && pol.effects.groups) for (var gid in pol.effects.groups) {
      var grp = D.GROUPS.filter(function (g) { return g.id === gid; })[0]; if (!grp) continue;
      var gv = pol.effects.groups[gid] * d;
      add(grp.name, gv, function (v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(0) + "pts"; });
    }
    if (!parts.length) return null;
    parts.sort(function (a, b) { return b.mag - a.mag; });
    return parts.slice(0, 3).map(function (p) { return p.txt; }).join(" · ");
  }

  function tabEconomy() {
    var g = S.govern, m = g.macro, h = g.history;
    function ser(key) { return h.map(function (x) { return x[key]; }); }
    var seatsSeries = ser("seats");
    var lastSeats = seatsSeries[seatsSeries.length - 1] || 0;
    var charts = [
      { t: "Approval", v: (g.approval * 100).toFixed(1) + "%", s: ser("approval").map(function (x) { return x * 100; }), c: "#c9a227", band: [45, 60] },
      { t: "Seats if voted today", v: lastSeats + "/650", s: seatsSeries, c: D.PARTIES[g.party].color, band: [326, 650] },
      { t: "GDP growth", v: m.realGrowth.toFixed(1) + "%", s: ser("growth"), c: "#2ecc71", band: [1.5, 3] },
      { t: "Inflation", v: m.inflation.toFixed(1) + "%", s: ser("inflation"), c: "#f5a623", band: [0, 2] },
      { t: "Unemployment", v: m.unemployment.toFixed(1) + "%", s: ser("unemployment"), c: "#12b6cf" },
      { t: "Deficit", v: fmtMoney(m.deficit), s: ser("deficit"), c: "#e74c3c" },
      { t: "Debt", v: m.debtPct + "% GDP", s: ser("debtPct"), c: "#faa61a" }
    ];
    var cards = charts.map(function (c) {
      return '<div class="chart-card"><div class="chart-h"><span>' + c.t + '</span><b>' + c.v + '</b></div>' +
        U.lineChart(c.s, { color: c.c, band: c.band }) + '</div>';
    }).join("");
    var chartPanel = '<div class="panel" style="margin-bottom:16px"><h3>The Economy over time</h3>' +
      '<div class="chart-grid">' + cards + '</div>' +
      '<p class="notice">Each chart tracks a headline figure month by month. Shaded bands show a healthy range. Watch how your policies move them.</p></div>';

    // Side-by-side overlay so you can see whether (e.g.) approval and growth
    // are tracking each other. Each series is normalised to its own y-axis so
    // they're comparable in shape even when the units differ wildly.
    var cmpMetrics = charts.map(function (c) {
      var key = c.t === "Approval" ? "approval" : c.t === "Seats if voted today" ? "seats"
        : c.t === "GDP growth" ? "growth" : c.t === "Inflation" ? "inflation"
        : c.t === "Unemployment" ? "unemployment" : c.t === "Deficit" ? "deficit" : c.t === "Debt" ? "debtPct" : c.t;
      var fmt;
      if (c.t === "Deficit") fmt = function (v) { return "£" + Math.round(v) + "bn"; };
      else if (c.t === "Seats if voted today") fmt = function (v) { return Math.round(v) + " seats"; };
      else if (c.t === "Debt") fmt = function (v) { return Math.round(v) + "% GDP"; };
      else fmt = function (v) { return v.toFixed(1) + "%"; };
      return { key: key, label: c.t, color: c.c, series: c.s, fmt: fmt };
    });
    function findM(k) { for (var i = 0; i < cmpMetrics.length; i++) if (cmpMetrics[i].key === k) return cmpMetrics[i]; return cmpMetrics[0]; }
    var mA = findM(S.compareA), mB = findM(S.compareB);
    function dualChart(A, B) {
      var W = 480, H = 150, padL = 8, padR = 8, padT = 26, padB = 14;
      function pathFor(series, color) {
        var n = series.length;
        if (!n) return "";
        var lo = Math.min.apply(null, series), hi = Math.max.apply(null, series);
        var marg = (hi - lo) * 0.18 || 1; lo -= marg; hi += marg;
        if (hi === lo) hi = lo + 1;
        var X = function (i) { return padL + (n <= 1 ? 0 : i / (n - 1) * (W - padL - padR)); };
        var Y = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB); };
        var pts = series.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
        var lastIdx = n - 1, lx = X(lastIdx), ly = Y(series[lastIdx]);
        return '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + color +
          '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
          '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="3.4" fill="' + color + '"/>';
      }
      var sA = A.series || [], sB = B.series || [];
      // align lengths from the end (the most recent points are what matter)
      var n = Math.min(sA.length, sB.length);
      sA = sA.slice(-n); sB = sB.slice(-n);
      var lastA = sA[n - 1], lastB = sB[n - 1];
      return '<svg class="dualchart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img">' +
        '<text x="8" y="16" font-size="12" fill="' + A.color + '" font-weight="800">' +
          U.esc(A.label) + ' · ' + (lastA != null ? A.fmt(lastA) : "—") + '</text>' +
        '<text x="' + (W - 8) + '" y="16" font-size="12" fill="' + B.color + '" font-weight="800" text-anchor="end">' +
          U.esc(B.label) + ' · ' + (lastB != null ? B.fmt(lastB) : "—") + '</text>' +
        pathFor(sA, A.color) + pathFor(sB, B.color) +
        '</svg>';
    }
    function cmpPills(slot, current) {
      return cmpMetrics.map(function (m) {
        var on = m.key === current;
        return '<button class="cmp-pill' + (on ? " on" : "") + '" data-cmp="' + slot + ':' + m.key + '"' +
          (on ? ' style="border-color:' + m.color + ';color:' + m.color + '"' : '') + '>' + U.esc(m.label) + '</button>';
      }).join("");
    }
    var comparePanel = '<div class="panel" style="margin-bottom:16px"><h3>Compare two metrics</h3>' +
      '<div class="cmp-chart">' + dualChart(mA, mB) + '</div>' +
      '<div class="cmp-row"><span class="lab2">Series A</span><div class="cmp-pills">' + cmpPills("a", S.compareA) + '</div></div>' +
      '<div class="cmp-row"><span class="lab2">Series B</span><div class="cmp-pills">' + cmpPills("b", S.compareB) + '</div></div>' +
      '<p class="notice">Each line is normalised to its own range so you can see how they move together even when the units don\'t match.</p></div>';

    function fLines(obj) {
      return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).map(function (k) {
        return '<tr><td>' + U.esc(k) + '</td><td class="num">£' + Math.round(obj[k]) + 'bn</td></tr>';
      }).join("");
    }
    // Visual stacked bar of receipts and spending — Democracy-style at-a-glance
    // breakdown of where the money comes from and goes.
    var RX_COLORS = ["#2ecc71","#27ae60","#1abc9c","#16a085","#3498db","#2980b9","#9b59b6","#8e44ad","#5d6d7e","#85929e","#7f8c8d"];
    var SX_COLORS = ["#e74c3c","#c0392b","#e67e22","#d35400","#f39c12","#f1c40f","#16a085","#9b59b6","#8e44ad","#2980b9","#7f8c8d","#5d6d7e","#95a5a6","#bdc3c7","#a93226"];
    function stackedBar(obj, palette, total) {
      var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
      var segs = keys.map(function (k, i) {
        var v = obj[k]; if (v <= 0) return "";
        var w = (v / total) * 100;
        return '<i class="bb-seg" style="width:' + w.toFixed(2) + '%;background:' + palette[i % palette.length] + '" title="' + U.esc(k) + ': £' + Math.round(v) + 'bn (' + w.toFixed(1) + '%)"></i>';
      }).join("");
      var leg = keys.map(function (k, i) {
        var v = obj[k]; if (v <= 0) return "";
        return '<span class="bb-key"><i style="background:' + palette[i % palette.length] + '"></i>' + U.esc(k) + ' <b>£' + Math.round(v) + 'bn</b></span>';
      }).join("");
      return '<div class="bb-bar">' + segs + '</div><div class="bb-legend">' + leg + '</div>';
    }
    var defCol = m.deficit > 0 ? "var(--bad)" : "var(--good)";
    var budget = '<div class="panel" style="margin-bottom:16px"><h3>The Public Finances</h3>' +
      '<div class="bb-line"><div class="bb-title">Receipts <small>· £' + m.receipts + 'bn</small></div>' + stackedBar(g.fiscalLines.r, RX_COLORS, m.receipts) + '</div>' +
      '<div class="bb-line"><div class="bb-title">Spending <small>· £' + m.spending + 'bn</small></div>' + stackedBar(g.fiscalLines.s, SX_COLORS, m.spending) + '</div>' +
      '<div class="bb-summary">' +
        '<div><span class="lab2">Deficit / yr</span><b style="color:' + defCol + '">' + fmtMoney(m.deficit) + '</b></div>' +
        '<div><span class="lab2">Net debt</span><b>£' + (m.debt / 1000).toFixed(2) + 'tn <small class="faint">' + m.debtPct + '% GDP</small></b></div>' +
        '<div><span class="lab2">Debt interest</span><b>' + fmtMoney(m.debtInterest) + '</b></div>' +
      '</div>' +
      '<p class="notice">Hover any segment for the line and the £bn. Starting figures are the real 2024–25 position (OBR / ONS).</p>' +
      '<details style="margin-top:10px"><summary class="bb-toggle">Show the full table</summary>' +
      '<div class="viz2" style="margin-top:10px"><div><table class="tbl"><thead><tr><th>Receipts</th><th class="num">£bn</th></tr></thead><tbody>' +
        fLines(g.fiscalLines.r) + '<tr style="font-weight:800"><td>Total</td><td class="num">£' + m.receipts + 'bn</td></tr></tbody></table></div>' +
      '<div><table class="tbl"><thead><tr><th>Spending</th><th class="num">£bn</th></tr></thead><tbody>' +
        fLines(g.fiscalLines.s) + '<tr style="font-weight:800"><td>Total</td><td class="num">£' + m.spending + 'bn</td></tr></tbody></table></div></div>' +
      '</details></div>';

    var rows = D.STATS.map(function (st) {
      var v = g.stats[st.id];
      return '<div class="stat-row clickrow" data-statdetail="' + st.id + '" title="Click to see what\'s pushing this number"><div class="name">' + st.name + '</div>' +
        '<div class="statbar"><i style="width:' + (v * 100) + '%;background:' + U.statColor(st, v) + '"></i></div>' +
        '<div class="v">' + Math.round(v * 100) + '</div></div>';
    }).join("");
    var services = '<div class="panel"><h3>State of the Nation</h3>' + rows +
      '<p class="notice">Click any line to see <b>what\'s pushing it</b> — the policy levers, cabinet performance and demographic pressure most responsible for where the number is right now.</p></div>';
    return chartPanel + comparePanel + budget + services;
  }
  // Compute the top influences on a stat right now: each policy whose lever
  // has moved away from default, the cabinet bonus (if any), and the
  // demographic / cost pressure drag baked into computeTargets.
  function statInfluences(g, statId) {
    var out = [];
    D.POLICIES.forEach(function (pol) {
      var k = pol.effects && pol.effects.stats && pol.effects.stats[statId];
      if (!k) return;
      var v = g.policies[pol.id], range = pol.max - pol.min;
      var nv = range > 0 ? (v - pol.def) / range : 0;
      var contribution = k * nv;
      if (Math.abs(contribution) < 0.005) return;
      out.push({ source: pol.name, icon: pol.icon, contribution: contribution,
        detail: "Set to " + fmtPolicyVal(pol, v) + " (default " + fmtPolicyVal(pol, pol.def) + ")",
        type: "policy", id: pol.id });
    });
    if (E.cabinetBonus) {
      var cab = E.cabinetBonus(g);
      if (cab && cab[statId] && Math.abs(cab[statId]) > 0.005) {
        // identify the relevant minister
        var post = null;
        if (statId === "nhs") post = "health";
        else if (statId === "education") post = "education";
        else if (statId === "crime" || statId === "immigration") post = "home";
        var minister = post && g.cabinet ? g.cabinet[post] : null;
        out.push({ source: "Cabinet performance" + (minister ? " (" + minister.name + ")" : ""),
          icon: "💼", contribution: cab[statId], detail: minister ? "Competence " + minister.competence + "/5" : "",
          type: "cabinet" });
      }
    }
    // pressure drag — coefficients lifted from computeTargets in engine.js
    var pressureDrag = { nhs: -0.013, housing: -0.011, education: -0.008, crime: 0.008, immigration: 0.006 };
    if (pressureDrag[statId] != null && (g.pressure || 0) > 0) {
      var pd = pressureDrag[statId] * (g.pressure || 0);
      if (Math.abs(pd) >= 0.005) out.push({ source: "Cost & demographic pressure", icon: "⏳",
        contribution: pd, detail: "Services decay unless invested in", type: "pressure" });
    }
    out.sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution); });
    return out;
  }
  // What's pushing a voter bloc's contentment up or down — direct policy
  // effects plus the cross-stat sensitivities baked into computeTargets.
  function groupInfluences(g, groupId) {
    var out = [];
    // policy contributions
    D.POLICIES.forEach(function (pol) {
      var k = pol.effects && pol.effects.groups && pol.effects.groups[groupId];
      if (!k) return;
      var v = g.policies[pol.id], range = pol.max - pol.min;
      var nv = range > 0 ? (v - pol.def) / range : 0;
      var contribution = k * nv;
      if (Math.abs(contribution) < 0.005) return;
      out.push({ source: pol.name, icon: pol.icon, contribution: contribution,
        detail: "Set to " + fmtPolicyVal(pol, v) + " (default " + fmtPolicyVal(pol, pol.def) + ")", type: "policy" });
    });
    // stat-sensitivities lifted from computeTargets
    var SENS = {
      pensioners:  [{ stat: "nhs", k: 0.25, pivot: 0.45 }],
      poor:        [{ stat: "equality", k: 0.20, pivot: 0.48 }],
      parents:     [{ stat: "education", k: 0.22, pivot: 0.5 }, { stat: "nhs", k: 0.12, pivot: 0.45 }],
      homeowners:  [{ stat: "housing", k: 0.18, pivot: 0.4 }, { stat: "crime", k: -0.10, pivot: 0.4 }],
      renters:     [{ stat: "housing", k: 0.30, pivot: 0.4 }],
      young:       [{ stat: "housing", k: 0.18, pivot: 0.4 }, { stat: "environment", k: 0.10, pivot: 0.45 }],
      environment: [{ stat: "environment", k: 0.30, pivot: 0.45 }],
      patriots:    [{ stat: "immigration", k: -0.18, pivot: 0.6 }],
      minorities:  [{ stat: "crime", k: -0.12, pivot: 0.4 }]
    };
    if (SENS[groupId]) SENS[groupId].forEach(function (s) {
      var diff = (g.stats[s.stat] || 0) - s.pivot;
      var contribution = s.k * diff;
      if (Math.abs(contribution) < 0.005) return;
      out.push({ source: (STAT_NAME[s.stat] || s.stat) + " level", icon: "📊", contribution: contribution,
        detail: "Currently at " + Math.round((g.stats[s.stat] || 0) * 100) + " (this bloc compares against " + Math.round(s.pivot * 100) + ")",
        type: "stat" });
    });
    // shared economy hits — affect every group
    var m = g.macro;
    function macroNormPart(v, lo, hi) { return Math.max(0, Math.min(1, (v - lo) / (hi - lo))); }
    var gdpN = macroNormPart(m.realGrowth, -2, 4);
    var inflN = macroNormPart(m.inflation, 0, 8);
    var unempN = macroNormPart(m.unemployment, 2, 10);
    var svc = ((g.stats.nhs || 0) + (g.stats.education || 0) + (1 - (g.stats.crime || 0)) + (g.stats.housing || 0)) / 4;
    var econContribs = [
      { src: "Real growth", icon: "📈", val: 0.32 * (gdpN - 0.5), detail: m.realGrowth.toFixed(1) + "% per year" },
      { src: "Inflation",    icon: "🔥", val: -0.30 * (inflN - 0.29), detail: m.inflation.toFixed(1) + "% CPI" },
      { src: "Unemployment", icon: "🛠", val: -0.24 * (unempN - 0.144), detail: m.unemployment.toFixed(1) + "%" },
      { src: "Public services", icon: "🏥", val: 0.42 * (svc - 0.46), detail: "Composite NHS + schools + housing + (1-crime)" }
    ];
    econContribs.forEach(function (e) {
      if (Math.abs(e.val) < 0.005) return;
      out.push({ source: e.src, icon: e.icon, contribution: e.val, detail: e.detail, type: "macro" });
    });
    out.sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution); });
    return out;
  }
  function groupDetailModal() {
    var g = S.govern, id = S.groupDetail; if (!id) return "";
    var gr = D.GROUPS.filter(function (x) { return x.id === id; })[0]; if (!gr) return "";
    var v = g.groups[id], pct = Math.round(v * 100);
    var col = v > 0.55 ? "var(--good)" : v > 0.42 ? "var(--warn)" : "var(--bad)";
    var first = g.history && g.history.length ? g.history[0] : null;
    var startV = (first && first.groups && first.groups[id] != null) ? first.groups[id] : gr.base;
    var delta = v - startV;
    var series = (g.history || []).map(function (h) { return (h.groups && h.groups[id] != null) ? h.groups[id] * 100 : null; }).filter(function (x) { return x != null; });
    var sparkline = series.length > 1 ? U.lineChart(series, { color: col }) : "";
    var infl = groupInfluences(g, id);
    var maxMag = Math.max.apply(null, infl.map(function (i) { return Math.abs(i.contribution); }).concat([0.01]));
    var rows = infl.length ? infl.map(function (it) {
      var up = it.contribution > 0;
      var col2 = up ? "var(--good)" : "var(--bad)";
      var w = Math.abs(it.contribution) / maxMag * 100;
      return '<div class="cause-row">' +
        '<div class="cause-ic">' + it.icon + '</div>' +
        '<div class="cause-body">' +
          '<div class="cause-name">' + U.esc(it.source) + '<small>' + U.esc(it.detail || "") + '</small></div>' +
          '<div class="cause-bar"><i style="width:' + w + '%;background:' + col2 + '"></i></div>' +
        '</div>' +
        '<div class="cause-arrow" style="color:' + col2 + '">' + (up ? "▲" : "▼") + '</div></div>';
    }).join("") : '<p class="muted" style="margin-top:8px">Nothing notable is pushing this bloc right now — they\'re sitting near baseline.</p>';
    var deltaTxt = Math.abs(delta) < 0.005 ? "no change since term start" : (delta > 0 ? "+" : "") + (delta * 100).toFixed(1) + "pts since term start";
    return '<div class="modal-overlay" data-closegroup><div class="modal" style="max-width:580px">' +
      '<div class="modal-tag">' + U.esc(gr.name) + ' · what\'s driving their mood</div>' +
      '<h2>' + U.esc(gr.name) + ' · <b style="color:' + col + '">' + pct + '</b><small style="font-weight:400;color:var(--ink-dim);margin-left:8px;font-size:14px">' + gr.size + '% of electorate</small></h2>' +
      '<div class="cause-bar-big"><i style="width:' + (v * 100) + '%;background:' + col + '"></i></div>' +
      '<p class="muted" style="margin:8px 0 4px">Trajectory: ' + U.esc(deltaTxt) + '</p>' +
      (sparkline ? '<div style="margin:6px 0 10px">' + sparkline + '</div>' : '') +
      '<p class="muted" style="margin:6px 0 4px">The biggest forces pushing this bloc right now, ranked by current contribution.</p>' +
      '<div class="cause-list">' + rows + '</div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closegroup">Close</button></div>' +
      '</div></div>';
  }
  function statDetailModal() {
    var g = S.govern, id = S.statDetail; if (!id) return "";
    var st = D.STATS.filter(function (s) { return s.id === id; })[0]; if (!st) return "";
    var v = g.stats[id], pct = Math.round(v * 100);
    var infl = statInfluences(g, id);
    var maxMag = Math.max.apply(null, infl.map(function (i) { return Math.abs(i.contribution); }).concat([0.01]));
    var rows = infl.length ? infl.map(function (it) {
      var up = it.contribution > 0;
      var good = up ? !statIsBadWhenHigh(id) : statIsBadWhenHigh(id);
      var col = good ? "var(--good)" : "var(--bad)";
      var w = Math.abs(it.contribution) / maxMag * 100;
      return '<div class="cause-row">' +
        '<div class="cause-ic">' + it.icon + '</div>' +
        '<div class="cause-body">' +
          '<div class="cause-name">' + U.esc(it.source) + '<small>' + U.esc(it.detail || "") + '</small></div>' +
          '<div class="cause-bar"><i style="width:' + w + '%;background:' + col + '" data-side="' + (up ? "up" : "down") + '"></i></div>' +
        '</div>' +
        '<div class="cause-arrow" style="color:' + col + '">' + (up ? "▲" : "▼") + '</div></div>';
    }).join("") : '<p class="muted" style="margin-top:8px">Nothing notable is pushing this stat right now — it\'s sitting near its baseline.</p>';
    return '<div class="modal-overlay" data-closestat><div class="modal" style="max-width:560px">' +
      '<div class="modal-tag">' + U.esc(st.name) + ' · what\'s driving it</div>' +
      '<h2>' + U.esc(st.name) + ' · <b style="color:' + U.statColor(st, v) + '">' + pct + '</b></h2>' +
      '<div class="cause-bar-big"><i style="width:' + (v * 100) + '%;background:' + U.statColor(st, v) + '"></i></div>' +
      '<p class="muted" style="margin:10px 0 4px">The biggest forces pushing this number right now, ranked by current contribution. <span style="color:var(--good)">Green ▲</span> is moving it in a good direction, <span style="color:var(--bad)">red ▼</span> against you.</p>' +
      '<div class="cause-list">' + rows + '</div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closestat">Close</button></div>' +
      '</div></div>';
  }

  function tabVoters() {
    var g = S.govern;
    var sorted = D.GROUPS.slice().sort(function (a, b) { return g.groups[b.id] - g.groups[a.id]; });
    // Democracy-style voter bubble cluster — bubble size scales with group
    // population, colour shows contentment, and a small ▲/▼ shows the delta
    // since the term began.
    var firstSnap = g.history.length ? g.history[0] : null;
    var bubbles = D.GROUPS.slice().sort(function (a, b) { return b.size - a.size; }).map(function (gr) {
      var v = g.groups[gr.id];
      var startV = (firstSnap && firstSnap.groups && firstSnap.groups[gr.id] != null) ? firstSnap.groups[gr.id] : gr.base;
      var delta = v - startV;
      var col = v > 0.55 ? "var(--good)" : v > 0.42 ? "var(--warn)" : "var(--bad)";
      var ringPct = Math.round(v * 100);
      // bubble diameter scales smoothly with the group's share of the electorate
      var d = Math.round(56 + Math.sqrt(gr.size) * 11);  // ~70px for size 8 → ~134px for size 50
      var deltaTxt = Math.abs(delta) < 0.005 ? "" : (delta > 0 ? "▲" : "▼") + " " + (Math.abs(delta) * 100).toFixed(0);
      return '<div class="vbubble" data-groupdetail="' + gr.id + '" style="width:' + d + 'px;height:' + d + 'px" title="' +
        U.esc(gr.name) + ' — ' + ringPct + '% content, ' + gr.size + '% of electorate' + (delta ? ', ' + (delta > 0 ? '+' : '') + (delta * 100).toFixed(1) + 'pts since term start' : '') + '. Click for detail.">' +
        '<svg viewBox="0 0 100 100" class="vbubble-ring" aria-hidden="true">' +
          '<circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"></circle>' +
          '<circle cx="50" cy="50" r="46" fill="none" stroke="' + col + '" stroke-width="6" stroke-dasharray="' +
            (ringPct * 2.89) + ' 289" stroke-linecap="round" transform="rotate(-90 50 50)"></circle>' +
        '</svg>' +
        '<div class="vbubble-inner">' +
          '<div class="vbubble-pct" style="color:' + col + '">' + ringPct + '</div>' +
          '<div class="vbubble-name">' + U.esc(gr.name) + '</div>' +
          (deltaTxt ? '<div class="vbubble-delta" style="color:' + (delta > 0 ? "var(--good)" : "var(--bad)") + '">' + deltaTxt + '</div>' : '') +
        '</div></div>';
    }).join("");
    var bubblePanel = '<div class="panel" style="margin-bottom:16px"><h3>The Electorate</h3>' +
      '<div class="vbubble-grid">' + bubbles + '</div>' +
      '<p class="notice">Bubble size = share of the electorate · ring fill = contentment · arrows = movement since you took office. Approval is the size-weighted average across every bloc.</p></div>';
    // compact list view kept below for at-a-glance reading
    var cells = sorted.map(function (gr) {
      var v = g.groups[gr.id];
      var col = v > 0.55 ? "var(--good)" : v > 0.42 ? "var(--warn)" : "var(--bad)";
      return '<div class="gcell"><div class="gn">' + gr.name + ' <span>' + gr.size + '%</span></div>' +
        '<div class="gbar"><i style="width:' + (v * 100) + '%;background:' + col + '"></i></div></div>';
    }).join("");
    // movers since the start of the current term — needs >=2 history snapshots
    var moversPanel = "";
    if (g.history.length >= 2) {
      var first = g.history[0];
      var movers = D.GROUPS.map(function (gr) {
        var startV = (first.groups && first.groups[gr.id] != null) ? first.groups[gr.id] : gr.base;
        var nowV = g.groups[gr.id];
        return { gr: gr, start: startV, now: nowV, delta: nowV - startV };
      }).sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); }).slice(0, 6);
      var rows = movers.map(function (mv) {
        var pct = (mv.delta * 100).toFixed(1);
        var col = mv.delta >= 0 ? "var(--good)" : "var(--bad)";
        var arrow = mv.delta >= 0 ? "▲" : "▼";
        var series = g.history.map(function (h) { return (h.groups && h.groups[mv.gr.id] != null) ? h.groups[mv.gr.id] * 100 : null; }).filter(function (x) { return x != null; });
        return '<div class="mover-row"><div class="mover-name">' + U.esc(mv.gr.name) + '<small> · since you took office</small></div>' +
          '<div class="mover-spark">' + U.lineChart(series, { color: col, mini: true }) + '</div>' +
          '<div class="mover-delta" style="color:' + col + '">' + arrow + ' ' + (mv.delta >= 0 ? "+" : "") + pct + ' pts</div></div>';
      }).join("");
      moversPanel = '<div class="panel" style="margin-top:16px"><h3>Biggest Movers Since You Took Office</h3>' + rows +
        '<p class="notice">The voter groups whose mood has shifted most — these are the blocs your policies and decisions are reaching.</p></div>';
    }
    // Per-region breakdown — who's winning where if an election were held today.
    var live = E.seatRange ? E.seatRange(g) : E.runGeneralElection(g);
    var regionPanel = "";
    if (live.byRegion) {
      var regionRows = live.byRegion.map(function (br) {
        var seats = br.seats || {};
        // sort parties present in this region's seat distribution
        var keys = Object.keys(seats).filter(function (k) { return seats[k] > 0; })
          .sort(function (a, b) { return seats[b] - seats[a]; });
        var total = keys.reduce(function (a, k) { return a + seats[k]; }, 0) || br.region.seats;
        var segs = keys.map(function (k) {
          return '<i style="width:' + (seats[k] / total * 100).toFixed(2) + '%;background:' + U.pcolor(k) + '" title="' + U.pshort(k) + ' ' + seats[k] + '"></i>';
        }).join("");
        var top = keys.slice(0, 3).map(function (k) {
          return '<span class="pill" style="background:' + U.pcolor(k) + '22;color:' + U.pcolor(k) + '">' + U.pshort(k) + ' ' + seats[k] + '</span>';
        }).join(" ");
        var mine = seats[g.party] || 0;
        var lead = keys[0];
        var leadCol = lead === g.party ? "var(--good)" : "var(--bad)";
        return '<div class="region-row">' +
          '<div class="region-name">' + U.esc(br.region.name) + '<small>' + br.region.seats + ' seats · you win <b style="color:' + leadCol + '">' + mine + '</b></small></div>' +
          '<div class="region-bar">' + segs + '</div>' +
          '<div class="region-pills">' + top + '</div>' +
        '</div>';
      }).join("");
      regionPanel = '<div class="panel" style="margin-top:16px"><h3>Britain by Region · on today\'s projection</h3>' +
        '<div class="region-list">' + regionRows + '</div>' +
        '<p class="notice">Each bar shows the seat split inside that region right now. Click the Briefing tab for the full constituency map.</p></div>';
    }
    return bubblePanel +
      regionPanel +
      '<div class="panel" style="margin-top:16px"><h3>Voter Groups · ranked</h3><div class="group-grid">' + cells + '</div>' +
      '<p class="notice">Groups overlap (a renter can also be a young environmentalist), so sizes do not sum to 100%.</p></div>' +
      moversPanel;
  }

  // Build a one-line summary of a dilemma option's biggest effects, so the
  // player gets immediate "this is what just changed" feedback — and an
  // identical preview shown inside each option button BEFORE they choose.
  function decisionSummary(opt) {
    if (!opt || !opt.effects) return null;
    var e = opt.effects, parts = [], grpLookup = {}, polLookup = {};
    D.GROUPS.forEach(function (gr) { grpLookup[gr.id] = gr.name; });
    D.POLICIES.forEach(function (p) { polLookup[p.id] = p; });
    function add(label, val, fmtFn, magOverride) {
      if (val == null || Math.abs(val) < 0.005) return;
      parts.push({ label: label, mag: magOverride != null ? magOverride : Math.abs(val),
        txt: (val > 0 ? "▲" : "▼") + " " + label + " " + (fmtFn ? fmtFn(val) : Math.abs(val).toFixed(2)) });
    }
    if (e.all) add("all groups", e.all, function (v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "pts"; });
    if (e.unity) add("unity", e.unity, function (v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(0) + "pts"; });
    if (e.capital) add("capital", e.capital, function (v) { return (v > 0 ? "+" : "") + v; });
    if (e.macro) {
      Object.keys(e.macro).forEach(function (k) {
        if (k === "deficit") add("deficit", e.macro[k], function (v) { return (v > 0 ? "+£" : "−£") + Math.abs(Math.round(v)) + "bn"; }, Math.abs(e.macro[k]) / 5);
        else if (k === "realGrowth") add("growth", e.macro[k], function (v) { return (v > 0 ? "+" : "") + v.toFixed(2) + "%"; }, Math.abs(e.macro[k]) * 4);
        else if (k === "inflation") add("inflation", e.macro[k], function (v) { return (v > 0 ? "+" : "") + v.toFixed(2) + "%"; }, Math.abs(e.macro[k]) * 4);
        else if (k === "unemployment") add("unemp.", e.macro[k], function (v) { return (v > 0 ? "+" : "") + v.toFixed(2) + "%"; }, Math.abs(e.macro[k]) * 4);
        else add(k, e.macro[k], function (v) { return (v > 0 ? "+" : "") + v.toFixed(2); });
      });
    }
    if (e.policy) Object.keys(e.policy).forEach(function (pid) {
      var pol = polLookup[pid]; if (!pol) return;
      var v = e.policy[pid]; if (!v) return;
      // £bn impact for direct fiscal lines; otherwise just an arrow with the lever name
      var label = pol.name.replace(/ ?\(.*\)/, "");
      var realDelta = v * (pol.max - pol.min);
      var fmt;
      if (pol.fiscal && pol.fiscal.mode === "direct") fmt = function (val) { return (val > 0 ? "+£" : "−£") + Math.abs(Math.round(realDelta)) + "bn"; };
      else if (pol.unit) fmt = function (val) { return (val > 0 ? "+" : "−") + Math.abs(realDelta).toFixed(pol.step && pol.step < 1 ? 1 : 0) + (pol.unit === "%" ? "%" : pol.unit === "£bn" ? "bn" : ""); };
      else fmt = function (val) { return val > 0 ? "raise" : "cut"; };
      add(label, v, fmt, Math.abs(v));
    });
    if (e.groups) Object.keys(e.groups).forEach(function (gid) {
      var name = grpLookup[gid] || gid;
      add(name, e.groups[gid], function (v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(0) + "pts"; });
    });
    if (e.stats) Object.keys(e.stats).forEach(function (sid) {
      add(STAT_NAME[sid] || sid, e.stats[sid], function (v) { return (v > 0 ? "+" : "") + (v * 100).toFixed(0) + "pts"; });
    });
    if (!parts.length) return null;
    parts.sort(function (a, b) { return b.mag - a.mag; });
    return parts.slice(0, 3).map(function (p) { return p.txt; }).join(" · ");
  }

  // Always-visible floating End Month button so you never have to scroll to advance.
  // It greys itself out while a decision modal is up and shows the current date.
  // Brief pulse on the KPI values right after an end-of-turn render — gives
  // a tactile sense that the numbers have just moved.
  function flashKpis() {
    requestAnimationFrame(function () {
      document.querySelectorAll(".kpis .v").forEach(function (el) {
        el.classList.remove("kpi-pulse");
        // force reflow so the animation restarts when the class is re-added
        void el.offsetWidth;
        el.classList.add("kpi-pulse");
      });
    });
  }
  // Compact pledge tracker for the sidebar so the player doesn't have to
  // switch to the Briefing tab to see how the manifesto is going.
  function pledgesMini(g) {
    if (!g.pledges || !g.pledges.length) return "";
    var kept = 0, rows = g.pledges.map(function (id) {
      var pl = D.PLEDGES.filter(function (p) { return p.id === id; })[0];
      if (!pl) return "";
      var ok = pl.ok(g); if (ok) kept++;
      return '<div class="pl-mini-row"><span class="pl-mini-tick">' + (ok ? "✓" : "○") +
        '</span><span style="color:' + (ok ? "var(--good)" : "var(--ink-dim)") + '">' + U.esc(pl.text) + '</span></div>';
    }).join("");
    return '<div style="margin:0 0 12px"><div class="lab2" style="margin-bottom:6px">Pledges · ' + kept + '/' + g.pledges.length + ' kept</div>' + rows + '</div>';
  }
  function endTurnFab(g) {
    // Don't render the FAB at all while a modal is open — it would just sit
    // disabled and overlap the modal's controls.
    if (g.pendingDilemma || S.policyDetail || S.reshufflePost || S.shadowReshufflePost || S.selectedSeat || S.statDetail || S.groupDetail) return "";
    var hint = dateLabel(g);
    var disabled = g.gameOver;
    return '<div class="fab-cluster">' +
      '<button class="fab-endturn" data-act="endturn"' + (disabled ? " disabled" : "") + ' title="End the month">' +
      '<span class="fab-label">End Month ▶</span>' +
      '<span class="fab-hint">' + U.esc(hint) + '</span></button>' +
      '</div>';
  }
  // A compact "what's happening this month" strip — surfaces active crisis,
  // a top headline and any pending decision, so context is never a tab away.
  function nowStrip(g) {
    // Status pills row (crisis / decision / struggling minister / help) —
    // kept separate from the newspaper banner so each is easy to scan.
    var pills = [];
    if (g.activeCrisis) {
      var ch = (D.CRISES || []).filter(function (c) { return c.id === g.activeCrisis.id; })[0];
      if (ch) pills.push('<span class="now-pill bad" data-tab="briefing">⚠ ' + U.esc(ch.name) + '</span>');
    }
    if (g.pendingDilemma) pills.push('<span class="now-pill warn">📋 Decision on your desk</span>');
    if (g.cabinet) {
      var weak = null;
      E.CABINET_POSTS.forEach(function (post) {
        var m = g.cabinet[post.id];
        if (m && m.competence <= 2 && (!weak || m.competence < weak.minister.competence)) weak = { post: post, minister: m };
      });
      if (weak) pills.push('<span class="now-pill warn" data-tab="cabinet">💼 ' + U.esc(weak.minister.name) + ' is struggling at ' + U.esc(weak.post.title) + '</span>');
    }

    // Front-page newspaper banner — one lead headline + 2 secondary lines.
    var heads = E.generateHeadlines ? E.generateHeadlines(g, 3) : [];
    var lead = heads[0] || "Westminster looks ahead";
    var secondary = heads.slice(1, 3).map(function (h) { return '<li>' + U.esc(h) + '</li>'; }).join("");
    var paper = '<div class="newspaper">' +
      '<div class="np-mast"><span>The Number 10 Gazette</span><span class="np-date">' + dateLabel(g) + '</span></div>' +
      '<h3 class="np-headline">' + U.esc(lead) + '</h3>' +
      (secondary ? '<ul class="np-secondary">' + secondary + '</ul>' : '') +
      '<div class="np-pills">' + pills.join("") + '</div>' +
      '</div>';
    return paper;
  }

  function stars(c) { return '<span class="stars">' + "★".repeat(c) + '<span class="faint">' + "★".repeat(5 - c) + '</span></span>'; }
  function ministerPerf(c) {
    return c >= 5 ? { t: "Excelling", col: "var(--good)" } : c === 4 ? { t: "Performing well", col: "var(--good)" }
      : c === 3 ? { t: "Competent", col: "var(--warn)" } : c === 2 ? { t: "Struggling", col: "var(--bad)" }
      : { t: "A liability", col: "var(--bad)" };
  }
  function tabCabinet() {
    var g = S.govern;
    if (!g.cabinet) return '<div class="panel"><p class="muted">No cabinet formed.</p></div>';
    var cards = E.CABINET_POSTS.map(function (post) {
      var m = g.cabinet[post.id]; if (!m) return "";
      var perf = ministerPerf(m.competence);
      return '<div class="min-card">' +
        '<div class="min-top"><div><div class="lab2">' + U.esc(post.title) + '</div>' +
        '<div class="min-name">' + U.esc(m.name) + '</div></div>' +
        '<button class="btn sm" data-reshuffle="' + post.id + '"' + (g.capital < 2 ? " disabled" : "") + '>Reshuffle</button></div>' +
        '<div class="min-meta">' + stars(m.competence) + ' <span style="color:' + perf.col + '">' + perf.t + '</span></div>' +
        '<div class="min-trait">“' + U.esc(m.trait) + '” · oversees ' + post.area + '</div></div>';
    }).join("");
    return '<div class="panel"><h3>Your Cabinet</h3>' +
      '<p class="notice" style="margin-top:0">Competent ministers lift their department over time; weak ones drag it. The Chancellor also shapes growth and your capital, the Chief Whip your party unity. Reshuffles cost <b>2</b> capital and can unsettle the party.</p>' +
      '<div class="min-grid">' + cards + '</div></div>';
  }
  function cabinetReshuffleModal() {
    var g = S.govern, post = S.reshufflePost; if (!post || !g.cabinet) return "";
    var meta = E.CABINET_POSTS.filter(function (p) { return p.id === post; })[0];
    var current = g.cabinet[post];
    var rows = (g.talentPool || []).map(function (m, i) {
      var perf = ministerPerf(m.competence);
      var better = m.competence > current.competence;
      return '<button class="appoint-row" data-appoint="' + post + ':' + i + '"' + (g.capital < 2 ? " disabled" : "") + '>' +
        '<div><div class="min-name">' + U.esc(m.name) + (better ? ' <span class="pill" style="background:var(--good)22;color:var(--good)">upgrade</span>' : "") + '</div>' +
        '<div class="min-trait">“' + U.esc(m.trait) + '”</div></div>' +
        '<div style="text-align:right">' + stars(m.competence) + '<div class="faint" style="font-size:11px;color:' + perf.col + '">' + perf.t + '</div></div></button>';
    }).join("");
    return '<div class="modal-overlay"><div class="modal">' +
      '<div class="modal-tag">Reshuffle · ' + U.esc(meta.title) + '</div>' +
      '<h2>Appoint a new ' + U.esc(meta.title) + '</h2>' +
      '<p class="muted">Sacking <b>' + U.esc(current.name) + '</b> and promoting from the back benches costs <b>2</b> political capital. Sacking a loyal minister will bruise party unity.</p>' +
      '<div class="appoint-list">' + rows + '</div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closereshuffle">Cancel</button></div>' +
      '</div></div>';
  }

  function tabBriefing(live) {
    var g = S.govern;
    var crisisBanner = "";
    if (g.activeCrisis) {
      var ch = (D.CRISES || []).filter(function (c) { return c.id === g.activeCrisis.id; })[0];
      if (ch) {
        var stIdx = g.activeCrisis.current, st = ch.stages[stIdx];
        var fireAt = g.activeCrisis.fireAt, dueIn = Math.max(0, fireAt - g.turn);
        crisisBanner = '<div class="panel crisis-banner" style="margin-bottom:16px"><div class="lab2" style="color:var(--bad)">⚠ National crisis · stage ' + (stIdx + 1) + ' of ' + ch.stages.length + '</div>' +
          '<div class="big" style="font-size:18px;color:var(--bad)">' + U.esc(ch.name) + '</div>' +
          '<p class="muted" style="margin:6px 0 0">Next decision: <b>' + U.esc(st.title) + '</b> — ' +
          (dueIn === 0 ? "lands on your desk this month" : "expected in " + dueIn + " month" + (dueIn === 1 ? "" : "s")) +
          '. The country is feeling the strain in every department until this chain resolves.</p></div>';
      }
    }
    var events = g.activeEvents.length
      ? g.activeEvents.map(function (e) {
          return '<div class="event' + (e.type === "good" ? " good" : "") + '"><div class="et">' + e.name + '</div><div class="ed">' + e.desc + '</div></div>';
        }).join("")
      : '<p class="muted">No crises on the desk this morning. Enjoy it while it lasts.</p>';
    var lead = live.playerSeats - Math.max.apply(null, U.SEAT_ORDER.map(function (p) { return p === g.party ? 0 : (live.totals[p] || 0); }));
    var mood = g.approval > 0.55 ? "The country is broadly behind you." :
               g.approval > 0.45 ? "The public mood is finely balanced." :
               "Discontent is spreading — you are in trouble.";
    var fin = g.macro.debtPct > 108 ? "The markets are alarmed by the debt pile." :
              g.macro.deficit > 180 ? "The deficit is uncomfortably wide." :
              g.macro.deficit < 60 ? "The public finances are in good order." :
              "The books are roughly where the markets expect.";
    var govType = live.government.type === "majority" ? "govern with a majority"
      : live.government.formateur === g.party ? "lead a " + (live.government.type === "coalition" ? "coalition" : "minority") + " government"
      : "be out of office";
    var pledges = g.pledges.map(function (id) {
      var pl = D.PLEDGES.filter(function (x) { return x.id === id; })[0]; if (!pl) return "";
      var done = pl.ok(g);
      // progress toward target — works for both "higher is better" pledges and
      // "lower is better" ones (deficit, crime, migration, debt).
      var cur = pl.metric ? pl.metric(g) : 0;
      var prog = 0;
      if (pl.metric && pl.target != null) {
        if (pl.hi) prog = Math.min(1, cur / pl.target);
        else       prog = cur <= 0 ? 1 : Math.min(1, pl.target / cur);
        if (done) prog = 1;
      }
      var col = done ? "var(--good)" : prog >= 0.75 ? "var(--warn)" : "var(--bad)";
      var icon = done ? "✅" : prog >= 0.95 ? "⌛" : "⬜";
      var detail = pl.metric ? (pl.fmt ? pl.fmt(cur) : cur) + (done ? "" : " · target " + (pl.hi ? "≥" : "≤") + " " + (pl.fmt ? pl.fmt(pl.target) : pl.target)) : "";
      return '<div class="pledge-prog">' +
        '<div class="pledge-prog-head">' +
          '<span class="pledge-prog-icon">' + icon + '</span>' +
          '<span class="pledge-prog-name" style="color:' + (done ? "var(--good)" : "var(--ink)") + '">' + U.esc(pl.text) + '</span>' +
          '<span class="pledge-prog-val" style="color:' + col + '">' + U.esc(detail) + '</span>' +
        '</div>' +
        '<div class="pledge-prog-bar"><i style="width:' + (prog * 100).toFixed(1) + '%;background:' + col + '"></i></div>' +
      '</div>';
    }).join("");
    var heads = E.generateHeadlines(g, 4);
    var headPanel = heads.length
      ? '<div class="panel news-panel" style="margin-bottom:16px"><h3>📰 Today\'s Headlines</h3>' +
          '<ul class="news-list">' + heads.map(function (h) { return '<li>' + U.esc(h) + '</li>'; }).join("") + '</ul></div>'
      : "";
    var milesPanel = "";
    if (g.milestones && g.milestones.length) {
      var ms = g.milestones.map(function (id) {
        var def = (window.UKGAME.ENGINE.MILESTONES || []).filter(function (x) { return x.id === id; })[0];
        return def ? '<span class="pill" style="background:rgba(201,162,39,.18);color:var(--gold);font-weight:800">' + U.esc(def.name) + '</span>' : "";
      }).join(" ");
      milesPanel = '<div class="panel" style="margin-bottom:16px"><h3>Milestones Achieved</h3><div style="display:flex;gap:6px;flex-wrap:wrap">' + ms + '</div></div>';
    }
    return crisisBanner + headPanel + milesPanel + '<div class="panel" style="margin-bottom:16px"><h3>Cabinet Briefing</h3>' +
      '<p>' + mood + ' ' + fin + ' On today\'s numbers you would ' +
      (live.won ? govType + " (" + live.playerSeats + " seats)" : "lose office, falling to " + live.playerSeats + " seats") + '.</p></div>' +
      '<div class="panel" style="margin-bottom:16px"><h3>Manifesto Pledges</h3>' + pledges +
      '<p class="notice">Keeping your pledges by the next election earns a trust dividend at the ballot box; breaking them costs you.</p></div>' +
      '<div class="panel" style="margin-bottom:16px"><h3>In the In-Tray</h3>' + events + '</div>' +
      decisionsJournal(g) +
      politicalCompass(g) +
      '<div class="panel"><h3>Electoral Map — if an election were held today</h3>' +
      mapView(live.seatWinners) + '</div>';
  }

  // Recent-decisions journal for the briefing tab — surfaces the running
  // narrative of what the player has chosen this term.
  function decisionsJournal(g) {
    var log = (g.decisionLog || []).slice().reverse();
    if (!log.length) return "";
    var shown = log.slice(0, 10);
    var rows = shown.map(function (d) {
      var tag = d.isCrisis ? '<span class="dj-tag bad">CRISIS</span>'
              : d.isPmq ? '<span class="dj-tag warn">PMQ</span>'
              : '<span class="dj-tag">DECISION</span>';
      var when = (MONTHS[d.month] || "") + " " + d.year;
      return '<div class="dj-row">' +
        '<div class="dj-meta">' + tag + '<span class="dj-date">' + when + '</span></div>' +
        '<div class="dj-title">' + U.esc(d.title) + '</div>' +
        '<div class="dj-choice">▸ ' + U.esc(d.optionLabel) + '</div>' +
        (d.result ? '<div class="dj-result">' + U.esc(d.result) + '</div>' : '') +
      '</div>';
    }).join("");
    var more = log.length > 10 ? '<p class="muted" style="font-size:11.5px;margin:8px 0 0">…' + (log.length - 10) + ' earlier this term.</p>' : "";
    return '<div class="panel" style="margin-bottom:16px"><h3>Decisions This Term</h3>' +
      '<div class="dj-list">' + rows + '</div>' + more + '</div>';
  }
  // Compute the player's position on a 2-D political compass — starts at their
  // party's baseline (econ left/right, social libertarian/authoritarian) and
  // drifts as their policies move away from defaults, weighted by which voter
  // blocs each policy pleases.
  function compassPosition(g) {
    var party = D.PARTIES[g.party];
    var ec = (party && party.econ) || 0;
    var sc = (party && party.soc) || 0;
    var grpById = {}; D.GROUPS.forEach(function (gr) { grpById[gr.id] = gr; });
    D.POLICIES.forEach(function (pol) {
      if (!pol.effects || !pol.effects.groups) return;
      var v = g.policies[pol.id], range = pol.max - pol.min;
      var nv = range > 0 ? (v - pol.def) / range : 0;
      if (Math.abs(nv) < 0.001) return;
      var biasE = 0, biasS = 0;
      Object.keys(pol.effects.groups).forEach(function (gid) {
        var gr = grpById[gid]; if (!gr) return;
        var k = pol.effects.groups[gid];
        biasE += k * (gr.econ || 0);
        biasS += k * (gr.soc || 0);
      });
      ec += biasE * nv * 0.55;
      sc += biasS * nv * 0.55;
    });
    return { econ: Math.max(-1, Math.min(1, ec)), soc: Math.max(-1, Math.min(1, sc)) };
  }
  function politicalCompass(g) {
    var pos = compassPosition(g);
    var party = D.PARTIES[g.party];
    // every playable party + Restore + Reform plotted at their baseline
    var playable = ["lab", "con", "ld", "reform", "restore", "green", "snp", "pc"];
    var dots = playable.map(function (pid) {
      var p = D.PARTIES[pid]; if (!p) return "";
      var x = (p.econ + 1) / 2 * 100, y = (1 - (p.soc + 1) / 2) * 100;
      var isMe = pid === g.party;
      return '<div class="cmp-dot' + (isMe ? " ghost" : "") + '" style="left:' + x + '%;top:' + y + '%;background:' + p.color + '" title="' + U.esc(p.name) + '">' +
        '<span class="cmp-dot-lab" style="color:' + p.color + '">' + U.esc(p.short) + '</span></div>';
    }).join("");
    var px = (pos.econ + 1) / 2 * 100, py = (1 - (pos.soc + 1) / 2) * 100;
    var youDot = '<div class="cmp-dot cmp-dot-you" style="left:' + px + '%;top:' + py + '%;background:' + party.color + '" title="Your current policy position">' +
      '<span class="cmp-dot-lab" style="color:' + party.color + '">YOU</span></div>';
    var drift = '<span class="cmp-drift">Drift from ' + U.esc(party.name) + ' baseline · econ ' + ((pos.econ - (party.econ || 0)) >= 0 ? "+" : "") + (pos.econ - (party.econ || 0)).toFixed(2) + ', social ' + ((pos.soc - (party.soc || 0)) >= 0 ? "+" : "") + (pos.soc - (party.soc || 0)).toFixed(2) + '</span>';
    return '<div class="panel" style="margin-bottom:16px"><h3>Your Political Position</h3>' +
      '<div class="cmp-grid"><div class="cmp-axis-y">authoritarian<br><span class="faint">↕</span><br>liberal</div>' +
      '<div class="cmp-plot">' +
        '<div class="cmp-line cmp-line-h"></div><div class="cmp-line cmp-line-v"></div>' +
        '<div class="cmp-quad nw">left ·<br>authoritarian</div>' +
        '<div class="cmp-quad ne">right ·<br>authoritarian</div>' +
        '<div class="cmp-quad sw">left ·<br>liberal</div>' +
        '<div class="cmp-quad se">right ·<br>liberal</div>' +
        dots + youDot +
      '</div></div>' +
      '<div class="cmp-axis-x"><span>economic left</span><span class="faint">↔</span><span>economic right</span></div>' +
      '<p class="notice" style="margin-top:8px">' + drift + ' — your faded party dot shows where the party stands at default; the bright YOU dot is where your current policy mix lands.</p>' +
      '</div>';
  }

  function viewGameOver() {
    var g = S.govern, el = g.lastElection;
    var party = D.PARTIES[g.party];
    var tag, line, sub;
    if (g.oustedBy === "party") {
      tag = "OUSTED BY YOUR OWN PARTY";
      line = "After a sustained collapse in the polls, your own MPs withdrew their confidence and triggered a leadership challenge you could not survive.";
      sub = "Final approval: " + (g.approval * 100).toFixed(1) + "% · " + g.termsWon + " term" + (g.termsWon === 1 ? "" : "s") + " in office";
    } else if (el) {
      tag = "OUT OF OFFICE";
      line = U.pname(el.government.formateur) + " has formed a " + el.government.type + " government. After " + g.termsWon + " term" + (g.termsWon === 1 ? "" : "s") + " in power, " + party.name + " has been turned out by the voters.";
      sub = "Left with " + el.playerSeats + " seats · " + (el.shares && el.shares[g.party] ? el.shares[g.party].toFixed(1) + "% of the vote" : "");
    } else {
      tag = "OUT OF OFFICE";
      line = "Your government has fallen.";
      sub = "";
    }
    // headline stats — what kind of country you leave behind
    var m = g.macro;
    var stats = '<div class="hero-stats" style="margin-top:18px">' +
      '<div><div class="lab2">GDP growth</div><div class="big">' + m.realGrowth.toFixed(1) + '<small>%/yr</small></div></div>' +
      '<div><div class="lab2">Inflation</div><div class="big">' + m.inflation.toFixed(1) + '<small>%</small></div></div>' +
      '<div><div class="lab2">Deficit</div><div class="big">' + fmtMoney(m.deficit) + '</div></div>' +
      '<div><div class="lab2">National debt</div><div class="big">' + m.debtPct + '<small>%</small></div></div>' +
      '<div><div class="lab2">NHS</div><div class="big">' + Math.round(g.stats.nhs * 100) + '</div></div>' +
      '<div><div class="lab2">Housing</div><div class="big">' + Math.round(g.stats.housing * 100) + '</div></div>' +
      '</div>';
    var hero = '<div class="election-hero" style="border-left:6px solid var(--bad)">' +
      '<div class="lab2">Game Over</div>' +
      '<div class="verdict" style="color:var(--bad)">' + tag + '</div>' +
      '<div class="verdict-line">' + U.esc(line) + '</div>' +
      (sub ? '<div class="muted" style="font-size:13px;margin-top:8px">' + U.esc(sub) + '</div>' : "") +
      stats + '</div>';
    return hero +
      '<div class="row" style="justify-content:center;margin-top:18px"><button class="btn primary" data-act="restart">Try Again</button>' +
      '<button class="btn" data-go="home">Main Menu</button></div>';
  }

  // ----------------------------------------------------- mid-term elections
  function viewMidterm() {
    var g = S.govern, r = g.lastMidterm;
    if (!r) return viewGovern();
    var party = D.PARTIES[g.party];
    if (r.kind === "local") {
      var V = {
        gains:    { h: "Local Elections: A Strong Night", t: "swept to gains across the country",
                    c: "Your activists are jubilant. The result steadies the party and lifts your authority — unity rises and you bank political capital." },
        steady:   { h: "Local Elections: Holding Steady", t: "broadly held its ground",
                    c: "A solid-enough night. No breakthrough, but no rout — the party is reassured for now." },
        losses:   { h: "Local Elections: Losing Ground", t: "lost councillors and councils",
                    c: "A disappointing set of results. Nervous backbenchers are starting to mutter about the direction of travel." },
        drubbing: { h: "Local Elections: A Hammering", t: "suffered heavy losses",
                    c: "A brutal night on the doorstep. The backbenches are in open revolt, your authority is dented and the whips are working overtime." }
      }[r.verdict];
      var councilLines = Object.keys(r.councils)
        .filter(function (k) { return k !== "noOverallControl" && r.councils[k] > 0; })
        .sort(function (a, b) { return r.councils[b] - r.councils[a]; })
        .slice(0, 5)
        .map(function (k) { return '<span class="pill" style="background:' + U.pcolor(k) + '22;color:' + U.pcolor(k) + '">' + U.pname(k) + ' ' + r.councils[k] + '</span>'; })
        .join(" ") + ' <span class="pill" style="background:#9aa0a622;color:#9aa0a6">No overall control ' + (r.councils.noOverallControl || 0) + '</span>';
      return '<h2 class="section-title">' + V.h + '</h2>' +
        '<p class="subtitle">' + party.name + ' has <b style="color:' + party.color + '">' + V.t + '</b>, winning <b>' + r.mySeats + '</b> of around ' + D.LOCAL.totalSeats.toLocaleString() + ' council seats up for election.</p>' +
        '<div class="panel"><h3>Council seats won</h3>' + U.seatBar(r.councilSeats) + U.legend(r.councilSeats) +
        '<div style="margin-top:12px"><div class="lab2" style="margin-bottom:6px">Councils controlled</div>' + councilLines + '</div></div>' +
        '<div class="panel" style="margin-top:16px"><h3>The verdict in Westminster</h3><p>' + V.c + '</p>' +
        '<div class="kpis" style="margin-top:8px">' +
          kpi("Party unity", Math.round(g.unity * 100) + "%", g.unity > 0.55 ? "var(--good)" : g.unity > 0.4 ? "var(--warn)" : "var(--bad)") +
          kpi("Approval", (g.approval * 100).toFixed(1) + "%", g.approval > 0.5 ? "var(--good)" : g.approval < 0.4 ? "var(--bad)" : "var(--warn)") +
        '</div></div>' +
        '<div class="row" style="margin-top:16px;justify-content:center"><button class="btn primary" data-act="continuemid">Back to Number 10 ▶</button></div>';
    }
    // by-election
    var won = r.held;
    var rankRows = r.ranked.map(function (x, i) {
      return '<div class="stat-row" style="grid-template-columns:1fr auto"><div class="name" style="color:' + U.pcolor(x.party) + '">' +
        (i === 0 ? "🏆 " : "") + U.pname(x.party) + '</div><div class="v">' + x.share.toFixed(1) + '%</div></div>';
    }).join("");
    return '<h2 class="section-title">By-Election: ' + U.esc(r.seat.n) + '</h2>' +
      '<p class="subtitle">A seat ' + party.name + ' held falls vacant and goes to the voters.</p>' +
      '<div class="panel"><h3>' + (won ? party.name + " HOLDS the seat" : U.pname(r.winner) + " GAINS the seat from " + party.name) + '</h3>' + rankRows + '</div>' +
      '<div class="panel" style="margin-top:16px"><h3>The verdict in Westminster</h3><p>' +
      (won ? "A hold — a quiet sigh of relief in the whips' office, and a small boost to party morale."
           : "An embarrassing loss. The result emboldens your opponents and unsettles your own benches.") + '</p></div>' +
      '<div class="row" style="margin-top:16px;justify-content:center"><button class="btn primary" data-act="continuemid">Back to Number 10 ▶</button></div>';
  }

  // --------------------------------------------------------- election night
  // ---- election night helpers ----
  var _base2024Seats = null;
  function base2024Seats() {
    if (_base2024Seats) return _base2024Seats;
    var C = window.UKGAME.CONSTITUENCIES || [], out = {};
    for (var i = 0; i < C.length; i++) out[C[i].w] = (out[C[i].w] || 0) + 1;
    return (_base2024Seats = out);
  }
  function electionVerdict(r, isOpp) {
    var maj = r.playerMajority, gv = r.government, seats = r.playerSeats;
    if (r.won) {
      if (maj > 100) return { tag: "LANDSLIDE", col: "var(--good)", line: "An emphatic victory of historic scale." };
      if (maj > 30)  return { tag: "SOLID MAJORITY", col: "var(--good)", line: "A clear mandate to govern as you see fit." };
      if (maj > 0)   return { tag: "WORKING MAJORITY", col: "var(--good)", line: "Enough to govern — but every vote will count." };
      if (gv.type === "coalition") return { tag: "COALITION DEAL", col: "var(--warn)", line: "You'll lead a coalition; the bargaining begins now." };
      if (gv.type === "minority")  return { tag: "MINORITY GOVERNMENT", col: "var(--warn)", line: "Largest party — but you'll govern vote by vote." };
      return { tag: "HUNG PARLIAMENT", col: "var(--warn)", line: "No clear winner; talks begin." };
    }
    if (seats < 80)              return { tag: "WIPEOUT", col: "var(--bad)", line: "An historic rout. Decades to rebuild." };
    if (maj < -100)              return { tag: "HEAVY DEFEAT", col: "var(--bad)", line: "A punishing verdict from the electorate." };
    return { tag: "OUT OF OFFICE", col: "var(--bad)", line: "The voters have decided it's time for a change." };
  }
  function netChangePanel(totals) {
    var base = base2024Seats();
    var ids = Object.keys(totals).concat(Object.keys(base))
      .filter(function (v, i, a) { return a.indexOf(v) === i && (totals[v] || 0) + (base[v] || 0) > 0; })
      .sort(function (a, b) { return (totals[b] || 0) - (totals[a] || 0); });
    var rows = ids.map(function (p) {
      var nw = totals[p] || 0, bs = base[p] || 0, d = nw - bs;
      var dCol = d > 0 ? "var(--good)" : d < 0 ? "var(--bad)" : "var(--ink-dim)";
      var dTxt = d === 0 ? "±0" : (d > 0 ? "+" + d : d);
      return '<div class="netchg-row"><div class="netchg-name" style="color:' + U.pcolor(p) + '">' + U.pshort(p) + '</div>' +
        '<div class="netchg-now">' + nw + '</div>' +
        '<div class="netchg-d" style="color:' + dCol + ';font-weight:800">' + dTxt + '</div></div>';
    }).join("");
    return '<div class="netchg-list">' + rows + '</div>';
  }
  function notableFlipsPanel(playerParty, seatWinners) {
    var C = window.UKGAME.CONSTITUENCIES || [];
    var gains = [], losses = [];
    for (var i = 0; i < C.length; i++) {
      var seat = C[i], prev = seat.w, now = seatWinners[seat.c];
      if (now === prev) continue;
      if (now === playerParty) gains.push({ name: seat.n, from: prev });
      else if (prev === playerParty) losses.push({ name: seat.n, to: now });
    }
    function rows(list, key, prefix) {
      if (!list.length) return '<p class="muted" style="font-size:13px;margin:4px 0 0">No ' + prefix + ' this time.</p>';
      return list.slice(0, 6).map(function (s) {
        return '<div class="flip-row"><span class="flip-seat">' + U.esc(s.name) + '</span>' +
          '<span class="pill" style="background:' + U.pcolor(s[key]) + '22;color:' + U.pcolor(s[key]) + '">' +
          (key === "from" ? "from " : "to ") + U.pshort(s[key]) + '</span></div>';
      }).join("");
    }
    var more = function (n) { return n > 6 ? '<div class="muted" style="font-size:12px;margin-top:4px">…and ' + (n - 6) + ' more.</div>' : ""; };
    return '<div class="flip-cols">' +
      '<div><div class="lab2" style="margin-bottom:6px;color:var(--good)">Notable gains (' + gains.length + ')</div>' + rows(gains, "from", "gains") + more(gains.length) + '</div>' +
      '<div><div class="lab2" style="margin-bottom:6px;color:var(--bad)">Notable losses (' + losses.length + ')</div>' + rows(losses, "to", "losses") + more(losses.length) + '</div>' +
      '</div>';
  }

  function viewElectionNight() {
    var g = S.govern, r = g.lastElection, won = r.won, gv = r.government;
    var isOpp = g.role === "opposition";
    var party = D.PARTIES[r.playerParty];
    var v = electionVerdict(r, isOpp);
    var contLabel = gv.type === "majority" ? "Continue — majority of " + r.playerMajority
      : gv.type === "coalition" ? "Continue — form your coalition ▶" : "Continue — lead a minority ▶";
    var btn;
    if (isOpp && won) btn = '<button class="btn primary" data-act="takepower">Enter Number 10 ▶</button>';
    else if (isOpp) btn = '<button class="btn" data-act="fighton">Carry on as Opposition ▶</button>';
    else if (won) btn = '<button class="btn primary" data-act="continueterm">' + contLabel + '</button>';
    else btn = '<button class="btn danger" data-act="seegameover">See the damage</button>';
    var hero = '<div class="election-hero" style="border-left:6px solid ' + v.col + '">' +
      '<div class="lab2">Election Night · ' + dateLabel(g) + '</div>' +
      '<div class="verdict" style="color:' + v.col + '">' + v.tag + '</div>' +
      '<div class="verdict-line">' + U.esc(v.line) + '</div>' +
      '<div class="hero-stats">' +
        '<div><div class="lab2">' + party.name + '</div><div class="big" style="color:' + party.color + '">' + r.shares[r.playerParty].toFixed(1) + '%</div></div>' +
        '<div><div class="lab2">Seats</div><div class="big">' + r.playerSeats + '<small>/650</small></div></div>' +
        '<div><div class="lab2">Majority</div><div class="big" style="color:' + (r.playerMajority > 0 ? "var(--good)" : "var(--bad)") + '">' + (r.playerMajority > 0 ? "+" : "") + r.playerMajority + '</div></div>' +
      '</div></div>';
    return hero + governmentPanel(gv) +
      '<div class="panel" style="margin-top:16px"><h3>The New House of Commons</h3>' + U.hemicycle(r.totals) + U.seatBar(r.totals) + U.legend(r.totals, { shares: r.shares }) + '</div>' +
      '<div class="dash" style="margin-top:16px"><div class="panel"><h3>National Vote — swing vs 2024</h3>' + U.voteSwing(r.shares) + '</div>' +
      '<div class="panel"><h3>Net Seat Changes (vs 2024)</h3>' + netChangePanel(r.totals) + '</div></div>' +
      '<div class="panel" style="margin-top:16px"><h3>' + party.name + ': Where the Seats Moved</h3>' + notableFlipsPanel(r.playerParty, r.seatWinners) + '</div>' +
      '<div class="panel" style="margin-top:16px"><h3>Constituency Map</h3>' + mapView(r.seatWinners) + '</div>' +
      '<div class="row" style="margin-top:16px;justify-content:center">' + btn + '</div>' +
      seatDetailOverlay(r);
  }
  function seatDetailOverlay(r) {
    if (!S.selectedSeat) return "";
    var seat = seatByCode(S.selectedSeat); if (!seat) return "";
    var d = E.seatResult(seat, r.shares);
    return '<div class="modal-overlay" data-closeseat><div class="modal" style="max-width:520px">' +
      '<div class="modal-tag">Constituency · ' + U.esc(seat.reg || "") + '</div>' +
      '<h2>' + U.esc(seat.n) + '</h2>' +
      U.seatCard(d) +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closeseat">Close</button></div>' +
      '</div></div>';
  }

  // -------------------------------------------------------------- listeners
  function afterRender() {
    // mode-card / data-go navigation
    app.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { go(el.getAttribute("data-go")); });
    });
    // party selection
    app.querySelectorAll("[data-setuprole]").forEach(function (el) {
      el.addEventListener("click", function () {
        S.setupRole = el.getAttribute("data-setuprole");
        // reset scenario to that role's default if the current id isn't valid for it
        var roleScenList = S.setupRole === "opposition" ? D.OPP_SCENARIOS : D.SCENARIOS;
        if (!roleScenList.some(function (x) { return x.id === S.scenario; })) S.scenario = roleScenList[0].id;
        render();
      });
    });
    app.querySelectorAll("[data-scenario]").forEach(function (el) {
      el.addEventListener("click", function () { S.scenario = el.getAttribute("data-scenario"); render(); });
    });
    app.querySelectorAll("[data-difficulty]").forEach(function (el) {
      el.addEventListener("click", function () { S.difficulty = el.getAttribute("data-difficulty"); render(); });
    });
    app.querySelectorAll("[data-party]").forEach(function (el) {
      el.addEventListener("click", function () {
        var party = el.getAttribute("data-party");
        if (S.setupRole === "opposition") {
          S.govern = E.newOppositionState(party, { scenario: S.scenario, difficulty: S.difficulty });
          go("opposition");
        } else {
          S.govern = E.newGovernState(party, { scenario: S.scenario, difficulty: S.difficulty });
          S.governTab = "policies";
          S.pledgeSel = S.govern.pledges.slice(); // pre-seed with sensible defaults
          go("pledges");
        }
      });
    });
    // opposition actions (attack / promote / blitz)
    app.querySelectorAll("[data-opp]").forEach(function (el) {
      el.addEventListener("click", function () {
        var parts = el.getAttribute("data-opp").split(":");
        if (E.oppAction(S.govern, parts[0], parts[1])) render();
        else toast("Not enough campaign energy.");
      });
    });
    // cabinet reshuffle: open picker / appoint a minister
    app.querySelectorAll("[data-reshuffle]").forEach(function (el) {
      el.addEventListener("click", function () { S.reshufflePost = el.getAttribute("data-reshuffle"); render(); });
    });
    app.querySelectorAll("[data-appoint]").forEach(function (el) {
      el.addEventListener("click", function () {
        var parts = el.getAttribute("data-appoint").split(":");
        if (E.reshuffleCabinet(S.govern, parts[0], parseInt(parts[1], 10))) {
          S.reshufflePost = null; render(); toast("Cabinet reshuffled.");
        } else toast("Not enough political capital.");
      });
    });
    app.querySelectorAll("[data-confirmpolicy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-confirmpolicy");
        var pol = D.POLICIES.filter(function (p) { return p.id === id; })[0]; if (!pol) return;
        var range = document.querySelector('[data-policy="' + id + '"]'); if (!range) return;
        var g = S.govern, newVal = parseFloat(range.value), oldVal = g.policies[id];
        var cost = E.changeCost(pol, oldVal, newVal);
        if (newVal === oldVal) return;
        if (cost > g.capital) { toast("Not enough political capital."); return; }
        g.capital -= cost;
        g.policies[id] = newVal;
        // Clear any conflicting pending nudge for this lever and refresh fiscal
        if (S.policyPending && S.policyPending[id] != null) delete S.policyPending[id];
        E.computeFiscal(g);
        var resigned = E.maybeMinisterResign(g, id, cost);
        if (resigned) toast("💼 " + resigned.outgoing.name + " resigns in protest — " + resigned.incoming.name + " takes the brief.", 4200);
        render();
      });
    });
    app.querySelectorAll("[data-shadowreshuffle]").forEach(function (el) {
      el.addEventListener("click", function () { S.shadowReshufflePost = el.getAttribute("data-shadowreshuffle"); render(); });
    });
    app.querySelectorAll("[data-shadowappoint]").forEach(function (el) {
      el.addEventListener("click", function () {
        var parts = el.getAttribute("data-shadowappoint").split(":");
        if (E.reshuffleShadowCabinet(S.govern, parts[0], parseInt(parts[1], 10))) {
          S.shadowReshufflePost = null; render(); toast("Shadow team reshuffled.");
        } else toast("Not enough campaign energy.");
      });
    });
    // manifesto pledge chips (max 3)
    app.querySelectorAll("[data-pledge]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-pledge"), i = S.pledgeSel.indexOf(id);
        if (i >= 0) S.pledgeSel.splice(i, 1);
        else if (S.pledgeSel.length < 3) S.pledgeSel.push(id);
        render();
      });
    });
    // campaign allocation +/-
    app.querySelectorAll("[data-camp]").forEach(function (el) {
      el.addEventListener("click", function () {
        var r = el.getAttribute("data-camp"), dir = parseInt(el.getAttribute("data-dir"), 10);
        var left = S.campaign.budget - campaignSpent();
        if (dir > 0 && left <= 0) return;
        S.campaign.alloc[r] = Math.max(0, (S.campaign.alloc[r] || 0) + dir);
        render();
      });
    });
    // tabs
    app.querySelectorAll("[data-tab]").forEach(function (el) {
      el.addEventListener("click", function () { S.governTab = el.getAttribute("data-tab"); render(); });
    });
    // policy category pills + opening a policy's detail panel
    app.querySelectorAll("[data-polcat]").forEach(function (el) {
      el.addEventListener("click", function () { S.policyCat = el.getAttribute("data-polcat"); render(); });
    });
    app.querySelectorAll("[data-poldetail]").forEach(function (el) {
      el.addEventListener("click", function () { S.policyDetail = el.getAttribute("data-poldetail"); render(); });
    });
    app.querySelectorAll("[data-statdetail]").forEach(function (el) {
      el.addEventListener("click", function () { S.statDetail = el.getAttribute("data-statdetail"); render(); });
    });
    app.querySelectorAll("[data-groupdetail]").forEach(function (el) {
      el.addEventListener("click", function () { S.groupDetail = el.getAttribute("data-groupdetail"); render(); });
    });
    app.querySelectorAll("[data-cmp]").forEach(function (el) {
      el.addEventListener("click", function () {
        var parts = el.getAttribute("data-cmp").split(":");
        if (parts[0] === "a") S.compareA = parts[1]; else S.compareB = parts[1];
        render();
      });
    });
    // inline ± stages a pending change — nothing is spent until Confirm
    app.querySelectorAll("[data-polnudge]").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var parts = btn.getAttribute("data-polnudge").split(":");
        var pol = D.POLICIES.filter(function (p) { return p.id === parts[0]; })[0]; if (!pol) return;
        var dir = parseInt(parts[1], 10);
        var g = S.govern, currentVal = g.policies[pol.id];
        var step = pol.step || 1;
        var basis = S.policyPending[pol.id] != null ? S.policyPending[pol.id] : currentVal;
        var newVal = Math.min(pol.max, Math.max(pol.min, basis + dir * step));
        if (newVal === basis) return;
        // round to step grain to avoid float drift
        newVal = Math.round(newVal * 1e6) / 1e6;
        if (newVal === currentVal) delete S.policyPending[pol.id];
        else S.policyPending[pol.id] = newVal;
        render();
      });
    });
    // generic actions
    app.querySelectorAll("[data-act]").forEach(function (el) {
      el.addEventListener("click", function () { action(el.getAttribute("data-act")); });
    });

    bindShareControls();
    bindPolicySliders();

    // first paint of the live simulator results panel
    if (S.screen === "simulator") { var sr = $("#sim-results"); if (sr) sr.innerHTML = simResults(); }
  }

  function refreshShareResults() {
    if (S.screen === "simulator") $("#sim-results").innerHTML = simResults();
    var sum = SHARE_PARTIES.reduce(function (a, p) { return a + (S.shares[p] || 0); }, 0);
    var el = $("#sharesum"); if (el) el.textContent = "Total: " + sum.toFixed(1) + "%";
  }

  function bindShareControls() {
    app.querySelectorAll("[data-share]").forEach(function (range) {
      var p = range.getAttribute("data-share");
      range.addEventListener("input", function () {
        S.shares[p] = parseFloat(range.value);
        var inp = app.querySelector('[data-shareinput="' + p + '"]'); if (inp) inp.value = S.shares[p].toFixed(1);
        refreshShareResults();
      });
    });
    app.querySelectorAll("[data-shareinput]").forEach(function (inp) {
      var p = inp.getAttribute("data-shareinput");
      inp.addEventListener("change", function () {
        var v = parseFloat(inp.value); if (isNaN(v)) v = 0; v = Math.max(0, Math.min(55, v));
        S.shares[p] = v; inp.value = v.toFixed(1);
        var range = app.querySelector('[data-share="' + p + '"]'); if (range) range.value = v;
        refreshShareResults();
      });
    });
  }

  function bindPolicySliders() {
    app.querySelectorAll("[data-policy]").forEach(function (range) {
      var id = range.getAttribute("data-policy");
      var pol = D.POLICIES.filter(function (p) { return p.id === id; })[0];
      var oldVal = S.govern.policies[id];
      var min = pol.min, span = pol.max - pol.min;
      var costEl = range.parentNode.querySelector("[data-pol-cost]");
      var impEl = range.parentNode.querySelector("[data-pol-impact]");
      var nowEl = range.parentNode.querySelector(".afford-now");
      // The Confirm button lives outside the slider's parentNode — find it via the modal.
      var confirmBtn = document.querySelector('[data-confirmpolicy="' + id + '"]');
      // Live preview as the user drags — nothing is spent until Confirm.
      function reflect() {
        var g = S.govern, newVal = parseFloat(range.value);
        var cell = range.parentNode.querySelector(".pv");
        if (cell) cell.textContent = fmtPolicyVal(pol, newVal);
        if (nowEl) nowEl.style.left = (newVal - min) / span * 100 + "%";
        var cost = E.changeCost(pol, oldVal, newVal);
        if (costEl) {
          if (newVal === oldVal) {
            costEl.className = "pol-cost";
            costEl.innerHTML = "Drag the slider — nothing is spent until you Confirm. You have <b>" + g.capital + "</b> political capital.";
          } else if (cost <= g.capital) {
            costEl.className = "pol-cost ok";
            costEl.innerHTML = "This change would cost <b>" + cost + "</b> of your <b>" + g.capital + "</b> political capital.";
          } else {
            costEl.className = "pol-cost over";
            costEl.innerHTML = "Too big: would cost <b>" + cost + "</b> but you only have <b>" + g.capital + "</b>. Stay within the lit band.";
          }
        }
        if (impEl) {
          var preview = policyMovePreview(pol, oldVal, newVal);
          impEl.innerHTML = preview ? "📊 " + U.esc(preview) : "📊 Move the slider to preview the impact.";
        }
        if (confirmBtn) {
          var ok = newVal !== oldVal && cost <= g.capital;
          confirmBtn.disabled = !ok;
          confirmBtn.textContent = newVal === oldVal ? "Confirm change"
            : ok ? "Confirm · spend " + cost + " ⚡"
                 : "Not enough capital (need " + cost + ")";
        }
      }
      range.addEventListener("input", reflect);
    });
  }

  // ------------------------------------------------------------------ actions
  function action(act) {
    var g = S.govern;
    switch (act) {
      case "normalise":
        S.shares = normShares(pickShares()); render(); break;
      case "reset2024": {
        var b2 = E.sharesFromPreset("ge2024");
        SHARE_PARTIES.forEach(function (p) { S.shares[p] = b2[p] || 0; });
        S.lastPollSource = "2024 General Election result"; render(); break;
      }
      case "endturn": {
        if (g.pendingDilemma) { toast("Settle the decision on your desk first."); return; }
        if (g.role === "opposition") {
          var ro = E.simulateOppositionTurn(g);
          if (ro.electionDue) { startCampaign(); go("campaign"); return; }
          render(); flashKpis();
          toast("Month ended — " + dateLabel(g)); break;
        }
        var res = E.simulateTurn(g);
        if (g.gameOver) { render(); return; }
        if (res.electionDue) { startCampaign(); go("campaign"); return; }
        if (res.midterm) {
          if (res.midterm === "local") E.runLocalElections(g); else E.runByElection(g);
          go("midterm"); return;
        }
        var newMiles = E.checkMilestones(g);
        if (newMiles.length) setTimeout(function () { toast(newMiles[0] + " achieved!"); }, 250);
        render(); flashKpis();
        if (g.leadershipChallenge === "survived") toast("You survived a leadership challenge — for now.");
        else if (!g.pendingDilemma) toast("Month ended — " + dateLabel(g));
        break;
      }
      case "confirmpledges":
        if (S.pledgeSel.length === 3) { g.pledges = S.pledgeSel.slice(); g.choosePledges = false; go("govern"); }
        break;
      case "pollingday": {
        var adj = E.campaignAdj(g.party, S.campaign.alloc);
        if (g.role === "opposition") {
          g.lastElection = E.runOppositionElection(g, adj); S.campaign = null; go("election");
        } else runElection(adj);
        break;
      }
      case "takepower": {
        var pp = g.party;
        // carry the opposition campaign's most-promoted blocs into starting pledges
        var pc = g.promoteCount || {};
        var MAP = { pensioners: "nhs", workingclass: "equality", patriots: "migration",
                    capitalists: "growth", environment: "education", young: "housing" };
        var seeded = [];
        Object.keys(pc).sort(function (a, b) { return pc[b] - pc[a]; }).forEach(function (k) {
          var pid = MAP[k];
          if (pid && D.PLEDGES.some(function (p) { return p.id === pid; }) && seeded.indexOf(pid) < 0 && seeded.length < 3) seeded.push(pid);
        });
        S.govern = E.newGovernState(pp, { difficulty: S.difficulty });
        if (seeded.length) {
          var fill = S.govern.pledges.filter(function (id) { return seeded.indexOf(id) < 0; });
          S.govern.pledges = seeded.concat(fill).slice(0, 3);
        }
        S.governTab = "policies";
        S.pledgeSel = S.govern.pledges.slice();
        clearSave();
        go("pledges");
        if (seeded.length) toast("Your campaign promises seed your manifesto.");
        break;
      }
      case "fighton":
        g.turn = 0; g.momentum = 0; g.oppHistory = []; g.lastElection = null;
        g.year = g.year; go("opposition"); break;
      case "resetcamp": startCampaign(); render(); break;
      case "closepolicy": S.policyDetail = null; render(); break;
      case "closereshuffle": S.reshufflePost = null; render(); break;
      case "closestat": S.statDetail = null; render(); break;
      case "closegroup": S.groupDetail = null; render(); break;
      case "cancelpending": S.policyPending = {}; render(); break;
      case "confirmpending": {
        var pending = S.policyPending || {};
        var ids = Object.keys(pending); if (!ids.length) return;
        var totalCost = 0;
        ids.forEach(function (pid) {
          var pp = D.POLICIES.filter(function (x) { return x.id === pid; })[0]; if (!pp) return;
          totalCost += E.changeCost(pp, g.policies[pid], pending[pid]);
        });
        if (totalCost > g.capital) { toast("Not enough political capital."); return; }
        var hard = g.difficulty && g.difficulty.id === "hard";
        var resignedAny = null;
        ids.forEach(function (pid) {
          var pp = D.POLICIES.filter(function (x) { return x.id === pid; })[0]; if (!pp) return;
          var cost = E.changeCost(pp, g.policies[pid], pending[pid]);
          g.capital -= cost;
          g.policies[pid] = pending[pid];
          var r = E.maybeMinisterResign(g, pid, cost); if (r && !resignedAny) resignedAny = r;
        });
        S.policyPending = {};
        // refresh fiscal so deficit / receipts / spending KPIs update immediately
        E.computeFiscal(g);
        render(); flashKpis();
        if (!hard) toast("Confirmed " + ids.length + " change" + (ids.length === 1 ? "" : "s") + " · spent " + totalCost + " ⚡");
        if (resignedAny) setTimeout(function () { toast("💼 " + resignedAny.outgoing.name + " resigns in protest — " + resignedAny.incoming.name + " takes the brief.", 4200); }, 250);
        break;
      }
      case "closeshadowreshuffle": S.shadowReshufflePost = null; render(); break;
      case "continuesave": if (loadGame()) go(S.loadedRole === "opposition" ? "opposition" : "govern"); break;
      case "discardsave": clearSave(); render(); break;
      case "restart": clearSave(); S.govern = null; go("govern-setup"); break;
      case "fetchpolls": fetchLatestPolls(); break;
      case "share": {
        var enc = SHARE_PARTIES.map(function (p) { return (S.shares[p] || 0).toFixed(1); }).join("-");
        try { history.replaceState(null, "", "#g=" + enc); } catch (e) { location.hash = "g=" + enc; }
        var link = location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(function () { toast("Shareable link copied to clipboard"); }, function () { toast("Scenario saved to the URL — copy from the address bar"); });
        else toast("Scenario saved to the URL — copy from the address bar");
        break;
      }
      case "callelection": startCampaign(); go("campaign"); break;
      case "continueterm":
        if (g.choosePledges) { S.pledgeSel = []; go("pledges"); } else go("govern");
        break;
      case "continuemid": g.lastMidterm = null; g.pendingMidterm = null; go("govern"); break;
      case "closeseat": S.selectedSeat = null; render(); break;
      case "seegameover": go("govern"); break;
      case "quitgovern": if (confirm("Resign and leave Number 10? Your saved game will be deleted.")) { clearSave(); S.govern = null; go("home"); } break;
    }
  }

  // ----------------------------------------------------- live polling fetch
  // Best-effort: read Wikipedia's polling article (its tables aggregate the BPC
  // pollsters), parse the most recent poll row, and load it. Fully wrapped so
  // any failure (offline, CORS, format change) just keeps the saved data.
  function fetchLatestPolls() {
    var btn = $("#fetchbtn");
    if (typeof fetch !== "function") { toast("Live fetch not supported here."); return; }
    if (btn) { btn.textContent = "↻ Fetching…"; btn.disabled = true; }
    var page = (window.UKGAME.POLLS && window.UKGAME.POLLS.wikiPage) || "Opinion_polling_for_the_next_United_Kingdom_general_election";
    var api = "https://en.wikipedia.org/w/api.php?action=parse&page=" + page +
              "&prop=text&format=json&origin=*";
    fetch(api).then(function (r) { return r.json(); }).then(function (j) {
      var html = j && j.parse && j.parse.text && j.parse.text["*"];
      if (!html) throw new Error("no content");
      var poll = parseWikiPoll(html);
      if (!poll) throw new Error("no poll parsed");
      SHARE_PARTIES.forEach(function (p) { S.shares[p] = poll.shares[p] || 0; });
      S.lastPollSource = (poll.pollster || "Latest poll") + (poll.date ? ", " + poll.date : "") + " (via Wikipedia)";
      render();
      toast("Loaded latest: " + poll.label);
    }).catch(function () {
      if (btn) { btn.textContent = "↻ Load latest polls"; btn.disabled = false; }
      toast("Couldn’t reach live polls — keeping your current figures.");
    });
  }

  // Parse the first poll row out of Wikipedia's rendered polling tables.
  function parseWikiPoll(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var tables = doc.querySelectorAll("table.wikitable"), t, i;
    var want = { con: ["con"], lab: ["lab"], reform: ["reform", "ref", "ruk"],
                 ld: ["lib dem", "ld", "libdem"], green: ["green", "grn"], snp: ["snp"],
                 restore: ["restore", "rest", "rstr", "rst", "rb"] };
    for (t = 0; t < tables.length; t++) {
      var rows = tables[t].querySelectorAll("tr");
      if (rows.length < 2) continue;
      // map columns from the header row(s)
      var headerCells = rows[0].querySelectorAll("th,td");
      var colOf = {}, c;
      for (c = 0; c < headerCells.length; c++) {
        var txt = (headerCells[c].textContent || "").trim().toLowerCase();
        for (var party in want) {
          if (colOf[party] != null) continue;
          for (var w = 0; w < want[party].length; w++) {
            if (txt === want[party][w] || txt.indexOf(want[party][w]) === 0) { colOf[party] = c; break; }
          }
        }
      }
      if (colOf.con == null || colOf.lab == null || colOf.reform == null) continue;
      // find the first data row that yields real percentages
      for (i = 1; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll("td,th");
        if (cells.length <= colOf.lab) continue;
        var shares = {}, ok = true, total = 0;
        for (var pty in colOf) {
          var raw = (cells[colOf[pty]] ? cells[colOf[pty]].textContent : "").replace(/[^0-9.]/g, "");
          var num = parseFloat(raw);
          if (isNaN(num) || num < 0 || num > 80) { ok = false; break; }
          shares[pty] = num; total += num;
        }
        if (!ok || total < 60 || total > 130) continue;
        shares.pc = 0.7; shares.oth = Math.max(0, 100 - total - 0.7);
        var pollster = (cells[0] ? cells[0].textContent : "Poll").trim().replace(/\[.*?\]/g, "").slice(0, 28);
        var date = cells.length > 1 ? (cells[1].textContent || "").trim().replace(/\[.*?\]/g, "").slice(0, 18) : "";
        return { id: "live-" + Date.now(), label: "LIVE · " + (pollster || "Latest"),
                 date: date || "latest", pollster: pollster, shares: shares };
      }
    }
    return null;
  }

  function runElection(regionAdj) {
    var result = E.runGeneralElection(S.govern, regionAdj);
    E.applyElectionResult(S.govern, result);
    S.campaign = null;
    go("election");
  }

  // ----------------------------------------------------------------- bootstrap
  // load a shared scenario from the URL hash (#g=lab-con-reform-ld-green-snp-pc-oth)
  function parseHash() {
    var m = (location.hash || "").match(/g=([-0-9.]+)/);
    if (!m) return false;
    var vals = m[1].split("-").map(parseFloat);
    if (vals.length !== SHARE_PARTIES.length || vals.some(isNaN)) return false;
    SHARE_PARTIES.forEach(function (p, i) { S.shares[p] = vals[i]; });
    S.screen = "simulator";
    return true;
  }

  function init() {
    app = $("#app");
    parseHash();
    // Esc closes whichever modal is open (standard browser-friendly UX).
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (S.groupDetail) { S.groupDetail = null; render(); e.preventDefault(); return; }
      if (S.statDetail) { S.statDetail = null; render(); e.preventDefault(); return; }
      if (S.policyDetail) { S.policyDetail = null; render(); e.preventDefault(); return; }
      if (S.reshufflePost) { S.reshufflePost = null; render(); e.preventDefault(); return; }
      if (S.shadowReshufflePost) { S.shadowReshufflePost = null; render(); e.preventDefault(); return; }
      if (S.selectedSeat) { S.selectedSeat = null; render(); e.preventDefault(); return; }
    });
    // delegated handlers (work even inside injected panels / the dilemma modal)
    app.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      var m = e.target.closest("[data-map]");
      if (m) { S.mapType = m.getAttribute("data-map"); render(); return; }
      var d = e.target.closest("[data-dilemma]");
      if (d && S.govern && S.govern.pendingDilemma) {
        var idx = parseInt(d.getAttribute("data-dilemma"), 10);
        var dil = S.govern.pendingDilemma, chosen = dil.options[idx];
        var g = S.govern, hard = g.difficulty && g.difficulty.id === "hard";
        E.resolveDilemma(g, idx);
        if (!hard) {
          var summary = decisionSummary(chosen);
          if (summary) toast(summary);
        }
        render();
        return;
      }
      if (e.target.classList && e.target.classList.contains("pol-overlay")) {
        S.policyDetail = null; render(); return;
      }
      if (e.target.hasAttribute && e.target.hasAttribute("data-closeseat")) {
        S.selectedSeat = null; render(); return;
      }
      if (e.target.hasAttribute && e.target.hasAttribute("data-closestat")) {
        S.statDetail = null; render(); return;
      }
      if (e.target.hasAttribute && e.target.hasAttribute("data-closegroup")) {
        S.groupDetail = null; render(); return;
      }
      var seat = e.target.closest("[data-seat]");
      if (seat) {
        S.selectedSeat = seat.getAttribute("data-seat");
        if (S.screen === "simulator") $("#sim-results").innerHTML = simResults();
        else if (S.screen === "election" || S.screen === "midterm") render();
      }
    });
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var nav = b.getAttribute("data-nav");
        if (nav === "govern" && !S.govern) { go("govern-setup"); return; }
        go(nav);
      });
    });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.UKGAME.APP = { go: go, state: S };
})();
