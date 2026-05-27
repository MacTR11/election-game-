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

  var SHARE_PARTIES = ["lab", "con", "reform", "ld", "green", "snp", "pc", "oth"];

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
  function toast(msg) {
    var t = $("#toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1900);
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
        dilemmaHistory: g.dilemmaHistory, termsWon: g.termsWon, approval: g.approval,
        difficulty: g.difficulty, scenarioId: g.scenarioId,
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
      g.dilemmaHistory = s.dilemmaHistory || [];
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
      '<div class="faint" style="font-size:11px">working majority needs ' + g.needed + ' (SF abstain)</div></div></div>' +
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
    var setupOpts = "";
    if (!opp) {
      var scenCards = D.SCENARIOS.map(function (sc) {
        return '<button class="opt-card' + (S.scenario === sc.id ? " on" : "") + '" data-scenario="' + sc.id + '">' +
          '<b>' + U.esc(sc.name) + '</b><span>' + U.esc(sc.blurb) + '</span></button>';
      }).join("");
      var diffCards = Object.keys(D.DIFFICULTY).map(function (k) {
        var d = D.DIFFICULTY[k];
        var desc = k === "easy" ? "Forgiving economy, generous capital, gentle voters."
          : k === "normal" ? "A fair challenge — the intended balance."
          : "Brutal decay, scarce capital and an unforgiving electorate.";
        return '<button class="opt-card' + (S.difficulty === k ? " on" : "") + '" data-difficulty="' + k + '">' +
          '<b>' + U.esc(d.name) + '</b><span>' + desc + '</span></button>';
      }).join("");
      setupOpts = '<div class="panel" style="margin-top:14px"><h3>Starting Scenario</h3>' +
        '<div class="opt-grid">' + scenCards + '</div>' +
        '<h3 style="margin-top:16px">Difficulty</h3><div class="opt-grid">' + diffCards + '</div></div>';
    }
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
    var live = E.runOppositionElection(g);
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
      kpi("Seats if voted today", live.playerSeats + "<small>/650</small>", live.won ? "var(--good)" : "var(--bad)") +
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
    var dots = ""; for (var i = 0; i < g.maxEnergy; i++) dots += '<i class="' + (i < g.energy ? "on" : "") + '"></i>';
    var sidebar = '<div class="panel"><h3>The Parliament</h3>' +
      '<div class="statbar" style="margin-bottom:6px"><i style="width:' + termPct + '%;background:' + party.color + '"></i></div>' +
      '<div class="muted" style="font-size:12px">Month ' + g.turn + ' of ' + E.TERM_TURNS + ' until the election you must win.</div>' +
      '<div style="margin:14px 0 4px"><div class="lab2">Campaign energy · <b style="color:var(--gold)">' + g.energy + ' / ' + g.maxEnergy + '</b></div><div class="capital-dots">' + dots + '</div></div>' +
      '<div class="muted" style="font-size:11.5px;margin-bottom:14px">Spent on attacks, positioning and the ground game. Regenerates each month.</div>' +
      '<button class="btn primary" data-act="endturn" style="width:100%;justify-content:center;margin-bottom:8px">End Month ▶</button>' +
      '<button class="btn" data-act="callelection" style="width:100%;justify-content:center;margin-bottom:8px">Force an Election</button>' +
      '<button class="btn sm" data-act="quitgovern" style="width:100%;justify-content:center">Stand down</button>' +
      '<div class="panel" style="margin-top:14px;padding:12px"><div class="lab2" style="margin-bottom:6px">If an election were held today</div>' +
      U.seatBar(live.totals) + U.legend(live.totals) + '</div></div>';
    return head + kpis + chart +
      '<div class="dash" style="margin-top:16px"><div>' + scorecard + '<div style="height:16px"></div>' + promote + '</div>' + sidebar + '</div>' +
      dilemmaModal();
  }

  // --------------------------------------------------------- govern: main
  function viewGovern() {
    var g = S.govern;
    if (g.gameOver) return viewGameOver();
    var party = D.PARTIES[g.party];
    var live = E.runGeneralElection(g);
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
      kpi("Seats today", live.playerSeats + "<small>/650</small>", live.won ? "var(--good)" : "var(--bad)") +
      '</div>';

    var tabs = '<div class="tabs">' + [["policies", "Policies"], ["economy", "Economy"], ["voters", "Voters"], ["briefing", "Briefing"]]
      .map(function (t) { return '<div class="tab' + (S.governTab === t[0] ? " active" : "") + '" data-tab="' + t[0] + '">' + t[1] + '</div>'; }).join("") + '</div>';

    var body;
    if (S.governTab === "policies") body = tabPolicies();
    else if (S.governTab === "economy") body = tabEconomy();
    else if (S.governTab === "voters") body = tabVoters();
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
      '<div class="muted" style="font-size:11.5px;margin-bottom:14px">Spent to change policy (further moves cost more). You regenerate <b>+' + regen + '/month</b> — more when you\'re popular and united; your election mandate sets the cap.</div>' +
      '<button class="btn primary" data-act="endturn" style="width:100%;justify-content:center;margin-bottom:8px">End Month ▶</button>' +
      '<button class="btn" data-act="callelection" style="width:100%;justify-content:center;margin-bottom:8px">Call General Election</button>' +
      '<button class="btn sm" data-act="quitgovern" style="width:100%;justify-content:center">Resign</button>' +
      '<div class="panel" style="margin-top:14px;padding:12px"><div class="lab2" style="margin-bottom:6px">If an election were held today</div>' +
      U.seatBar(live.totals) + U.legend(live.totals) +
      '<div class="muted" style="font-size:12px;margin-top:8px">' +
        (live.won
          ? 'You hold power with <b style="color:var(--good)">' + live.playerSeats + '</b> seats.'
          : 'You lose power — <b style="color:var(--bad)">' + (U.pname(live.winner) || "the opposition") + '</b> would form the next government.') +
        '<br><span class="faint">A long-serving government faces a growing "time for a change" mood — keep approval high to overcome it.</span>' +
      '</div></div></div>';

    return head + kpis + '<div class="dash" style="margin-top:16px"><div>' + tabs + body + '</div>' + sidebar + '</div>' + dilemmaModal() + policyDetailModal();
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
    var opts = d.options.map(function (o, i) {
      return '<button class="dilemma-opt" data-dilemma="' + i + '"><b>' + U.esc(o.label) + '</b>' +
        '<span>' + U.esc(o.result) + '</span></button>';
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
    var rows = D.POLICIES.filter(function (p) { return p.cat === S.policyCat; }).map(function (pol) {
      var v = g.policies[pol.id], imp = deficitImpact(pol, v);
      var impTxt = Math.abs(imp) < 0.5 ? '<span class="faint">±0</span>'
        : '<span style="color:' + (imp > 0 ? "var(--bad)" : "var(--good)") + '">' + (imp > 0 ? "+" : "−") + "£" + Math.abs(Math.round(imp)) + "bn</span>";
      var moved = Math.abs(v - pol.def) > 1e-9;
      return '<div class="pol-row" data-poldetail="' + pol.id + '">' +
        '<div class="pol-ic">' + pol.icon + '</div>' +
        '<div class="pol-name">' + pol.name + (moved ? ' <span class="moved">●</span>' : "") + '<small>' + pol.low + " ↔ " + pol.high + '</small></div>' +
        '<div class="pol-val">' + fmtPolicyVal(pol, v) + '</div>' +
        '<div class="pol-imp">' + impTxt + '</div><div class="pol-go">›</div></div>';
    }).join("");
    return '<div class="panel"><div class="tabs subtabs">' + pills + '</div>' +
      '<div class="pol-list">' + rows + '</div>' +
      '<p class="notice">Click a policy to set it in real terms and see exactly what it costs and which parts of the economy and which voters it helps or hurts.</p></div>';
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
      '<div class="pol-cost" data-pol-cost style="margin-top:4px;font-size:12px">Drag within the lit band — you have <b>' + g.capital + '</b> political capital to spend.</div>' +
      '<div style="margin-top:6px">Budget impact: ' + impLine + '</div></div>' +
      '<div class="viz2" style="margin-top:14px">' +
        '<div><div class="lab2" style="margin-bottom:6px">Raising this affects</div>' + econ + '</div>' +
        '<div><div class="lab2" style="margin-bottom:6px">Pleases</div>' + pills(gains, "#2ecc71") +
        '<div class="lab2" style="margin:10px 0 6px">Upsets</div>' + pills(loses, "#e74c3c") + '</div>' +
      '</div>' +
      '<div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn primary" data-act="closepolicy">Done</button></div>' +
      '</div></div>';
  }

  function tabEconomy() {
    var g = S.govern, m = g.macro, h = g.history;
    function ser(key) { return h.map(function (x) { return x[key]; }); }
    var charts = [
      { t: "Approval", v: (g.approval * 100).toFixed(1) + "%", s: ser("approval").map(function (x) { return x * 100; }), c: "#c9a227", band: [45, 60] },
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

    function fLines(obj) {
      return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).map(function (k) {
        return '<tr><td>' + U.esc(k) + '</td><td class="num">£' + Math.round(obj[k]) + 'bn</td></tr>';
      }).join("");
    }
    var budget = '<div class="panel" style="margin-bottom:16px"><h3>The Public Finances (£bn)</h3>' +
      '<div class="viz2"><div><table class="tbl"><thead><tr><th>Receipts</th><th class="num">£bn</th></tr></thead><tbody>' +
        fLines(g.fiscalLines.r) + '<tr style="font-weight:800"><td>Total receipts</td><td class="num">£' + m.receipts + 'bn</td></tr></tbody></table></div>' +
      '<div><table class="tbl"><thead><tr><th>Spending</th><th class="num">£bn</th></tr></thead><tbody>' +
        fLines(g.fiscalLines.s) + '<tr style="font-weight:800"><td>Total spending</td><td class="num">£' + m.spending + 'bn</td></tr></tbody></table></div></div>' +
      '<div class="kpis" style="margin-top:10px">' +
        kpi("Deficit / yr", fmtMoney(m.deficit), m.deficit > 150 ? "var(--bad)" : "var(--warn)") +
        kpi("Net debt", "£" + (m.debt / 1000).toFixed(2) + "tn <small>" + m.debtPct + "% GDP</small>") +
        kpi("Debt interest", fmtMoney(m.debtInterest)) +
      '</div><p class="notice">Starting figures are the real UK 2024–25 position (OBR / ONS). Receipts grow with the economy; spending rises with inflation; debt interest climbs with the debt.</p></div>';

    var rows = D.STATS.map(function (st) {
      var v = g.stats[st.id];
      return '<div class="stat-row"><div class="name">' + st.name + '</div>' +
        '<div class="statbar"><i style="width:' + (v * 100) + '%;background:' + U.statColor(st, v) + '"></i></div>' +
        '<div class="v">' + Math.round(v * 100) + '</div></div>';
    }).join("");
    var services = '<div class="panel"><h3>State of the Nation (quality of services)</h3>' + rows +
      '<p class="notice">These move with a lag and feed into each other — poor education drives crime, a strained NHS hits pensioners — and decay over time unless you invest.</p></div>';
    return chartPanel + budget + services;
  }

  function tabVoters() {
    var g = S.govern;
    var sorted = D.GROUPS.slice().sort(function (a, b) { return g.groups[b.id] - g.groups[a.id]; });
    var cells = sorted.map(function (gr) {
      var v = g.groups[gr.id];
      var col = v > 0.55 ? "var(--good)" : v > 0.42 ? "var(--warn)" : "var(--bad)";
      return '<div class="gcell"><div class="gn">' + gr.name + ' <span>' + gr.size + '%</span></div>' +
        '<div class="gbar"><i style="width:' + (v * 100) + '%;background:' + col + '"></i></div></div>';
    }).join("");
    return '<div class="panel"><h3>Voter Groups · contentment</h3><div class="group-grid">' + cells + '</div>' +
      '<p class="notice">Groups overlap (a renter can also be a young environmentalist), so sizes do not sum to 100%. Approval is the size-weighted average of every group.</p></div>';
  }

  function tabBriefing(live) {
    var g = S.govern;
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
      return '<div class="stat-row" style="grid-template-columns:24px 1fr"><div style="font-size:15px">' + (done ? "✅" : "⬜") + '</div>' +
        '<div class="name" style="color:' + (done ? "var(--good)" : "var(--ink-dim)") + '">' + U.esc(pl.text) + '</div></div>';
    }).join("");
    return '<div class="panel" style="margin-bottom:16px"><h3>Cabinet Briefing</h3>' +
      '<p>' + mood + ' ' + fin + ' On today\'s numbers you would ' +
      (live.won ? govType + " (" + live.playerSeats + " seats)" : "lose office, falling to " + live.playerSeats + " seats") + '.</p></div>' +
      '<div class="panel" style="margin-bottom:16px"><h3>Manifesto Pledges</h3>' + pledges +
      '<p class="notice">Keeping your pledges by the next election earns a trust dividend at the ballot box; breaking them costs you.</p></div>' +
      '<div class="panel" style="margin-bottom:16px"><h3>In the In-Tray</h3>' + events + '</div>' +
      '<div class="panel"><h3>Electoral Map — if an election were held today</h3>' +
      mapView(live.seatWinners) + '</div>';
  }

  function viewGameOver() {
    var g = S.govern, el = g.lastElection, body;
    if (g.oustedBy === "party") {
      body = '<h1>Removed by Your Own Party</h1>' +
        '<p>After ' + g.termsWon + ' term' + (g.termsWon === 1 ? "" : "s") + ' and a collapse in the polls, ' +
        D.PARTIES[g.party].name + ' MPs lost confidence and triggered a leadership challenge. You have been ousted from Number 10. ' +
        'Final approval: ' + (g.approval * 100).toFixed(1) + '%.</p>';
    } else if (el) {
      body = '<h1>Out of Office</h1>' +
        '<p>After ' + g.termsWon + ' term' + (g.termsWon === 1 ? "" : "s") + ' in power, ' + D.PARTIES[g.party].name +
        ' has lost power. ' + U.pname(el.government.formateur) + ' formed a ' + el.government.type + ' government; you were left with ' + el.playerSeats + ' seats.</p>';
    } else {
      body = '<h1>Out of Office</h1><p>Your government has fallen.</p>';
    }
    return '<div class="hero">' + body +
      '<div class="row" style="justify-content:center;margin-top:18px"><button class="btn primary" data-act="restart">Try Again</button>' +
      '<button class="btn" data-go="home">Main Menu</button></div></div>';
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
  function viewElectionNight() {
    var g = S.govern, r = g.lastElection, won = r.won, gv = r.government;
    var isOpp = g.role === "opposition";
    var contLabel = gv.type === "majority" ? "Continue — majority of " + r.playerMajority
      : gv.type === "coalition" ? "Continue — form your coalition ▶" : "Continue — lead a minority ▶";
    var btn;
    if (isOpp && won) btn = '<button class="btn primary" data-act="takepower">Enter Number 10 ▶</button>';
    else if (isOpp) btn = '<button class="btn" data-act="fighton">Carry on as Opposition ▶</button>';
    else if (won) btn = '<button class="btn primary" data-act="continueterm">' + contLabel + '</button>';
    else btn = '<button class="btn danger" data-act="seegameover">See the damage</button>';
    var sub = isOpp
      ? (won ? D.PARTIES[r.playerParty].name + " has WON POWER — " + r.playerSeats + " seats on " + r.shares[r.playerParty].toFixed(1) + "%!"
             : D.PARTIES[r.playerParty].name + " took " + r.playerSeats + " seats on " + r.shares[r.playerParty].toFixed(1) + "% — not enough this time.")
      : D.PARTIES[r.playerParty].name + " won " + r.shares[r.playerParty].toFixed(1) + "% of the national vote and " + r.playerSeats + " seats.";
    return '<h2 class="section-title">Election Night</h2>' +
      '<p class="subtitle">' + sub + '</p>' +
      U.headline(r) + governmentPanel(gv) +
      '<div class="panel" style="margin-top:16px"><h3>The New House of Commons</h3>' + U.hemicycle(r.totals) + U.seatBar(r.totals) + U.legend(r.totals, { shares: r.shares }) + '</div>' +
      '<div class="panel" style="margin-top:16px"><h3>Constituency Map</h3>' + mapView(r.seatWinners) + '</div>' +
      '<div class="row" style="margin-top:16px;justify-content:center">' + btn + '</div>';
  }

  // -------------------------------------------------------------- listeners
  function afterRender() {
    // mode-card / data-go navigation
    app.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { go(el.getAttribute("data-go")); });
    });
    // party selection
    app.querySelectorAll("[data-setuprole]").forEach(function (el) {
      el.addEventListener("click", function () { S.setupRole = el.getAttribute("data-setuprole"); render(); });
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
          S.govern = E.newOppositionState(party);
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
      var nowEl = range.parentNode.querySelector(".afford-now");
      // live label, cost and affordability feedback while dragging (no re-render)
      function reflect() {
        var g = S.govern, newVal = parseFloat(range.value);
        var cell = range.parentNode.querySelector(".pv");
        if (cell) cell.textContent = fmtPolicyVal(pol, newVal);
        if (nowEl) nowEl.style.left = (newVal - min) / span * 100 + "%";
        if (!costEl) return;
        var cost = E.changeCost(pol, oldVal, newVal);
        if (newVal === oldVal) {
          costEl.className = "pol-cost";
          costEl.innerHTML = "Drag within the lit band — you have <b>" + g.capital + "</b> political capital to spend.";
        } else if (cost <= g.capital) {
          costEl.className = "pol-cost ok";
          costEl.innerHTML = "This change costs <b>" + cost + "</b> of your <b>" + g.capital + "</b> political capital.";
        } else {
          costEl.className = "pol-cost over";
          costEl.innerHTML = "Too big a move: it would cost <b>" + cost + "</b> but you only have <b>" + g.capital + "</b>. Stay within the lit band.";
        }
      }
      range.addEventListener("input", reflect);
      range.addEventListener("change", function () {
        var g = S.govern, newVal = parseFloat(range.value);
        var cost = E.changeCost(pol, oldVal, newVal);
        if (cost > g.capital) { range.value = oldVal; reflect(); return; }
        if (newVal === oldVal) return;
        g.capital -= cost;
        g.policies[id] = newVal;
        render();
      });
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
          render(); toast("Month ended — " + dateLabel(g)); break;
        }
        var res = E.simulateTurn(g);
        if (g.gameOver) { render(); return; }
        if (res.electionDue) { startCampaign(); go("campaign"); return; }
        if (res.midterm) {
          if (res.midterm === "local") E.runLocalElections(g); else E.runByElection(g);
          go("midterm"); return;
        }
        render();
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
        var pp = g.party; S.govern = E.newGovernState(pp); S.governTab = "policies";
        S.pledgeSel = S.govern.pledges.slice(); clearSave(); go("pledges"); break;
      }
      case "fighton":
        g.turn = 0; g.momentum = 0; g.oppHistory = []; g.lastElection = null;
        g.year = g.year; go("opposition"); break;
      case "resetcamp": startCampaign(); render(); break;
      case "closepolicy": S.policyDetail = null; render(); break;
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
                 ld: ["lib dem", "ld", "libdem"], green: ["green", "grn"], snp: ["snp"] };
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
    // delegated handlers (work even inside injected panels / the dilemma modal)
    app.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      var m = e.target.closest("[data-map]");
      if (m) { S.mapType = m.getAttribute("data-map"); render(); return; }
      var d = e.target.closest("[data-dilemma]");
      if (d && S.govern && S.govern.pendingDilemma) {
        E.resolveDilemma(S.govern, parseInt(d.getAttribute("data-dilemma"), 10));
        render();
        return;
      }
      if (e.target.classList && e.target.classList.contains("pol-overlay")) {
        S.policyDetail = null; render(); return;
      }
      var seat = e.target.closest("[data-seat]");
      if (seat) {
        S.selectedSeat = seat.getAttribute("data-seat");
        if (S.screen === "simulator") $("#sim-results").innerHTML = simResults();
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
