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
      case "byelection":  html = viewByElection(); break;
      case "local":       html = viewLocal(); break;
      case "govern-setup":html = viewGovernSetup(); break;
      case "govern":      html = viewGovern(); break;
      case "election":    html = viewElectionNight(); break;
      default:            html = viewHome();
    }
    app.innerHTML = html;
    afterRender();
  }

  // ----------------------------------------------------------------- home view
  function viewHome() {
    var modes = [
      { s: "govern-setup", ico: "🏛", h: "Govern the Country", tag: "Flagship mode",
        p: "Take charge as PM. Set 20+ real UK policies — tax, the NHS, the triple lock, immigration, Net Zero — balance the books, keep 22 voter groups onside and win re-election." },
      { s: "simulator", ico: "🗳", h: "General Election Simulator", tag: "Swingometer + map",
        p: "Dial in national vote shares and project all 650 real constituencies seat-by-seat, with a full UK hex map, swing chart and Commons hemicycle. Baseline reproduces the actual July 2024 result." },
      { s: "byelection", ico: "📍", h: "By-Elections", tag: "Any of 650 seats",
        p: "Pick any real constituency and see how it falls under your national swing — holds, gains and majorities, mapped." },
      { s: "local", ico: "🏘", h: "Local Elections", tag: "Council night",
        p: "Translate the national mood into thousands of council seats and the number of authorities each party controls." }
    ];
    return '<div class="hero"><div class="brand" style="justify-content:center"><div class="door">10</div></div>' +
      '<h1>Number <span class="n10">10</span></h1>' +
      '<p>The most comprehensive UK political simulator on the web — govern Britain, fight elections and model the next vote, all grounded in the real 2024 General Election result.</p></div>' +
      '<div class="modes">' + modes.map(function (m) {
        return '<div class="mode-card" data-go="' + m.s + '"><div class="ico">' + m.ico + '</div>' +
          '<h2>' + m.h + '</h2><p>' + m.p + '</p><div class="tag">' + m.tag + ' →</div></div>';
      }).join("") + '</div>' +
      '<p class="foot">Electoral baseline: UK General Election, 4 July 2024 (650 seats). Seat projections use a regional swing model and are estimates for entertainment, not forecasts.</p>';
  }

  // --------------------------------------------------- shared share controls
  function shareControls() {
    var rows = SHARE_PARTIES.map(function (p) {
      var v = S.shares[p] != null ? S.shares[p] : 0;
      return '<div class="slider-row"><div class="name" style="color:' + U.pcolor(p) + '">' + U.pname(p) +
        '</div><input type="range" min="0" max="55" step="0.1" value="' + v + '" data-share="' + p + '">' +
        '<input class="share-input" data-shareinput="' + p + '" value="' + v.toFixed(1) + '"></div>';
    }).join("");
    var pollOpts = allPolls().map(function (e) {
      return '<option value="poll:' + e.id + '">' + U.esc(e.label + (e.date ? " (" + e.date + ")" : "")) + '</option>';
    }).join("");
    var presetOpts = Object.keys(D.PRESETS).map(function (k) {
      return '<option value="preset:' + k + '">' + U.esc(D.PRESETS[k].name) + '</option>';
    }).join("");
    var sum = SHARE_PARTIES.reduce(function (a, p) { return a + (S.shares[p] || 0); }, 0);
    return '<div class="panel"><h3>National Vote Share (GB %)</h3>' +
      '<div class="row" style="margin-bottom:8px"><select class="sel" id="preset" style="flex:1">' +
        '<option value="">Load polls or a scenario…</option>' +
        '<optgroup label="Polls (real)">' + pollOpts + '</optgroup>' +
        '<optgroup label="Scenarios (illustrative)">' + presetOpts + '</optgroup></select></div>' +
      '<div class="row" style="margin-bottom:10px">' +
        '<button class="btn sm" data-act="fetchpolls" id="fetchbtn">↻ Latest polls</button>' +
        '<button class="btn sm" data-act="normalise">Normalise 100%</button>' +
        '<span class="spacer"></span><span class="muted" id="sharesum">Total: ' + sum.toFixed(1) + '%</span></div>' +
      rows +
      '<p class="notice">Loads the real 2024 result by default. <b>↻ Latest polls</b> pulls the current polling average live from Wikipedia’s aggregation of BPC pollsters (YouGov, Opinium, More in Common, Survation…); if that can’t be reached it keeps the saved data. Shares are normalised before projection; swing is measured vs 2024.</p></div>';
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
      regionTable(r);
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

  // -------------------------------------------------------- by-election view
  function seatByCode(code) {
    var C = window.UKGAME.CONSTITUENCIES;
    for (var i = 0; i < C.length; i++) if (C[i].c === code) return C[i];
    return C[0];
  }
  function viewByElection() {
    var C = window.UKGAME.CONSTITUENCIES;
    var cur = seatByCode(S.byseat);
    var opts = C.slice().sort(function (a, b) { return a.n < b.n ? -1 : 1; })
      .map(function (s) { return '<option value="' + U.esc(s.n) + '" data-code="' + s.c + '">'; }).join("");
    return '<h2 class="section-title">By-Election</h2>' +
      '<p class="subtitle">Any of the 650 seats, fought under your national swing versus the real 2024 result.</p>' +
      '<div class="split">' + shareControls() +
      '<div><div class="panel" style="margin-bottom:16px"><h3>Constituency</h3>' +
      '<input class="seat-search" id="byseat-input" list="seatlist" placeholder="Type a constituency…" value="' + U.esc(cur.n) + '">' +
      '<datalist id="seatlist">' + opts + '</datalist></div>' +
      '<div id="bye-results"></div></div></div>';
  }
  function byeResults() {
    var seat = seatByCode(S.byseat);
    var r = E.byElection(seat, normShares(pickShares()));
    var bars = r.ranked.map(function (row) {
      return '<div class="stat-row"><div class="name" style="color:' + U.pcolor(row.party) + '">' + U.pname(row.party) +
        '</div><div class="statbar"><i style="width:' + Math.min(100, row.share) + '%;background:' + U.pcolor(row.party) + '"></i></div>' +
        '<div class="v">' + row.share.toFixed(1) + '%</div></div>';
    }).join("");
    var verdict = r.gain
      ? '<span class="pill" style="background:var(--good);color:#06210f">' + U.pshort(r.winner) + ' GAIN from ' + U.pshort(r.previousWinner) + '</span>'
      : '<span class="pill" style="background:var(--panel-2);color:var(--ink)">' + U.pshort(r.winner) + ' HOLD</span>';
    return '<div class="panel" style="margin-bottom:16px"><h3>Result — ' + U.esc(seat.n) + '</h3>' +
      '<div class="row" style="margin-bottom:12px;align-items:center"><div class="big" style="font-size:24px;font-weight:900;color:' + U.pcolor(r.winner) + '">' +
      U.pname(r.winner) + '</div>' + verdict + '<span class="spacer"></span><span class="muted">' +
      '2024: ' + U.pshort(seat.w) + ' · maj ' + r.margin.toFixed(1) + ' pts</span></div>' + bars + '</div>' +
      '<div class="panel"><h3>Where it sits</h3>' + mapView(null, { highlight: seat.c }) + '</div>';
  }

  // ------------------------------------------------------------- local view
  function viewLocal() {
    return '<h2 class="section-title">Local Elections</h2>' +
      '<p class="subtitle">The national mood, projected onto council chambers across the country.</p>' +
      '<div class="split">' + shareControls() +
      '<div id="local-results"></div></div>';
  }
  function localResults() {
    var shares = normShares(pickShares());
    var r = E.localElection(shares);
    var ge = E.projectSeats(shares);
    var seatRows = U.orderedParties(r.seats).slice().sort(function (a, b) { return r.seats[b] - r.seats[a]; })
      .map(function (p) {
        return '<div class="stat-row"><div class="name" style="color:' + U.pcolor(p) + '">' + U.pname(p) +
          '</div><div class="statbar"><i style="width:' + Math.min(100, r.seats[p] / D.LOCAL.totalSeats * 100 * 3) + '%;background:' + U.pcolor(p) + '"></i></div>' +
          '<div class="v">' + r.seats[p].toLocaleString() + '</div></div>';
      }).join("");
    var councilRows = Object.keys(r.councils).filter(function (k) { return k !== "noOverallControl" && r.councils[k] > 0; })
      .sort(function (a, b) { return r.councils[b] - r.councils[a]; })
      .map(function (p) { return '<tr><td style="color:' + U.pcolor(p) + '">' + U.pname(p) + '</td><td class="num">' + r.councils[p] + '</td></tr>'; }).join("");
    return '<div class="panel" style="margin-bottom:16px"><h3>Council Seats (≈' + D.LOCAL.totalSeats.toLocaleString() + ' up)</h3>' + seatRows + '</div>' +
      '<div class="panel"><h3>Councils Controlled (of ' + D.LOCAL.councils + ')</h3>' +
      '<table class="tbl"><thead><tr><th>Party</th><th class="num">Councils</th></tr></thead><tbody>' + councilRows +
      '<tr><td class="muted">No Overall Control</td><td class="num muted">' + r.councils.noOverallControl + '</td></tr></tbody></table></div>' +
      '<div class="panel" style="margin-top:16px"><h3>Leading Party by Area (national mood)</h3>' +
      mapView(ge.seatWinners) +
      '<p class="notice">Illustrative: the constituency map shaded by which party leads under the same national vote. Local results vary with turnout, candidates and local factors.</p></div>';
  }

  // --------------------------------------------------------- govern: setup
  function viewGovernSetup() {
    var cards = D.MAIN_PARTIES.filter(function (p) { return D.PARTIES[p].playable; }).map(function (p) {
      var party = D.PARTIES[p];
      var econ = party.econ < -0.2 ? "Left" : party.econ > 0.2 ? "Right" : "Centre";
      var soc = party.soc < -0.2 ? "Liberal" : party.soc > 0.2 ? "Authoritarian" : "Centrist";
      return '<div class="mode-card" data-party="' + p + '" style="border-top:4px solid ' + party.color + '">' +
        '<div class="ico" style="color:' + party.color + '">●</div><h2>' + party.name + '</h2>' +
        '<p>' + econ + ' on economics · ' + soc + ' on social issues.<br>2024 vote: ' + (D.BASELINE[p] || "<1") + '%</p>' +
        '<div class="tag">Govern as ' + party.short + ' →</div></div>';
    }).join("");
    return '<h2 class="section-title">Form a Government</h2>' +
      '<p class="subtitle">Choose the party you will lead into Number 10. Your starting coalition of voters depends on who you are.</p>' +
      '<div class="modes">' + cards + '</div>';
  }

  // --------------------------------------------------------- govern: main
  function viewGovern() {
    var g = S.govern;
    if (g.gameOver) return viewGameOver();
    var party = D.PARTIES[g.party];
    var live = E.runGeneralElection(g);
    var approvalPct = (g.approval * 100).toFixed(1);
    var termPct = Math.min(100, g.turn / E.TERM_QUARTERS * 100);

    var head = '<div class="headline">' +
      '<span class="sw" style="width:34px;height:34px;border-radius:8px;background:' + party.color + '"></span>' +
      '<div><div class="lab2">' + party.name + ' Government · Term ' + (g.termsWon + 1) + '</div>' +
      '<div class="big">' + g.year + ' · Q' + g.quarter + '</div></div>' +
      '<div class="spacer"></div>' +
      '<div style="text-align:right"><div class="lab2">Approval</div><div class="big ' +
      (g.approval > 0.5 ? "outcome-maj" : g.approval < 0.4 ? "outcome-hung" : "") + '">' + approvalPct + '%</div></div></div>';

    var m = g.macro;
    var kpis = '<div class="kpis">' +
      kpi("GDP growth", m.realGrowth.toFixed(1) + "<small>%/yr</small>", m.realGrowth > 1.5 ? "var(--good)" : m.realGrowth > 0 ? "var(--warn)" : "var(--bad)") +
      kpi("Inflation", m.inflation.toFixed(1) + "<small>% CPI</small>", m.inflation < 3 ? "var(--good)" : m.inflation < 5 ? "var(--warn)" : "var(--bad)") +
      kpi("Unemployment", m.unemployment.toFixed(1) + "<small>%</small>", m.unemployment < 4.5 ? "var(--good)" : m.unemployment < 6 ? "var(--warn)" : "var(--bad)") +
      kpi("Deficit / yr", fmtMoney(m.deficit), m.deficit > 180 ? "var(--bad)" : m.deficit > 120 ? "var(--warn)" : "var(--good)") +
      kpi("National debt", m.debtPct + "<small>% GDP</small>", m.debtPct > 105 ? "var(--bad)" : m.debtPct > 97 ? "var(--warn)" : "var(--good)") +
      kpi("Seats today", live.playerSeats + "<small>/650</small>", live.won ? "var(--good)" : "var(--bad)") +
      '</div>';

    var tabs = '<div class="tabs">' + [["policies", "Policies"], ["country", "The Country"], ["voters", "Voters"], ["briefing", "Briefing"]]
      .map(function (t) { return '<div class="tab' + (S.governTab === t[0] ? " active" : "") + '" data-tab="' + t[0] + '">' + t[1] + '</div>'; }).join("") + '</div>';

    var body;
    if (S.governTab === "policies") body = tabPolicies();
    else if (S.governTab === "country") body = tabCountry();
    else if (S.governTab === "voters") body = tabVoters();
    else body = tabBriefing(live);

    var dots = "";
    for (var i = 0; i < g.maxCapital; i++) dots += '<i class="' + (i < g.capital ? "on" : "") + '"></i>';
    var sidebar = '<div class="panel"><h3>The Term</h3>' +
      '<div class="statbar" style="margin-bottom:6px"><i style="width:' + termPct + '%;background:var(--commons-l)"></i></div>' +
      '<div class="muted" style="font-size:12px">Quarter ' + g.turn + ' of ' + E.TERM_QUARTERS + ' before the next scheduled election.</div>' +
      '<div style="margin:16px 0 6px"><div class="lab2">Political capital</div><div class="capital-dots">' + dots + '</div></div>' +
      '<div class="muted" style="font-size:12px;margin-bottom:14px">Spent when you change policy. Regenerates each quarter.</div>' +
      '<button class="btn primary" data-act="endturn" style="width:100%;justify-content:center;margin-bottom:8px">End Quarter ▶</button>' +
      '<button class="btn" data-act="callelection" style="width:100%;justify-content:center;margin-bottom:8px">Call General Election</button>' +
      '<button class="btn sm" data-act="quitgovern" style="width:100%;justify-content:center">Resign</button>' +
      '<div class="panel" style="margin-top:14px;padding:12px"><div class="lab2" style="margin-bottom:6px">If an election were held today</div>' +
      U.seatBar(live.totals) + U.legend(live.totals) + '</div></div>';

    return head + kpis + '<div class="dash" style="margin-top:16px"><div>' + tabs + body + '</div>' + sidebar + '</div>' + dilemmaModal();
  }
  function dilemmaModal() {
    var g = S.govern, d = g.pendingDilemma;
    if (!d) return "";
    var opts = d.options.map(function (o, i) {
      return '<button class="dilemma-opt" data-dilemma="' + i + '"><b>' + U.esc(o.label) + '</b>' +
        '<span>' + U.esc(o.result) + '</span></button>';
    }).join("");
    return '<div class="modal-overlay"><div class="modal">' +
      '<div class="modal-tag">Decision on your desk · ' + g.year + ' Q' + g.quarter + '</div>' +
      '<h2>' + U.esc(d.title) + '</h2><p class="muted">' + U.esc(d.desc) + '</p>' +
      '<div class="dilemma-opts">' + opts + '</div></div></div>';
  }
  function kpi(k, v, color) {
    return '<div class="kpi"><div class="k">' + k + '</div><div class="v" style="color:' + (color || "var(--ink)") + '">' + v + '</div></div>';
  }

  function tabPolicies() {
    var g = S.govern, cats = {}, order = [];
    D.POLICIES.forEach(function (p) { if (!cats[p.cat]) { cats[p.cat] = []; order.push(p.cat); } cats[p.cat].push(p); });
    var html = '<div class="two">';
    order.forEach(function (cat) {
      html += '<div class="panel"><div class="policy-cat">' + cat + '</div>';
      cats[cat].forEach(function (pol) {
        var v = g.policies[pol.id];
        var net = pol.budget(v) - pol.budget(pol.def);
        var netTxt = Math.abs(net) < 1 ? "" : '<small style="color:' + (net > 0 ? "var(--bad)" : "var(--good)") + '"> ' + (net > 0 ? "+" : "−") + "£" + Math.abs(Math.round(net)) + "bn</small>";
        html += '<div class="slider-row"><div class="name">' + pol.icon + " " + pol.name +
          '<small>' + pol.low + " ↔ " + pol.high + '</small></div>' +
          '<input type="range" min="0" max="1" step="0.05" value="' + v + '" data-policy="' + pol.id + '">' +
          '<div class="val">' + Math.round(v * 100) + netTxt + '</div></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function tabCountry() {
    var g = S.govern, m = g.macro;
    var rows = D.STATS.map(function (st) {
      var v = g.stats[st.id];
      return '<div class="stat-row"><div class="name">' + st.name + '</div>' +
        '<div class="statbar"><i style="width:' + (v * 100) + '%;background:' + U.statColor(st, v) + '"></i></div>' +
        '<div class="v">' + Math.round(v * 100) + '</div></div>';
    }).join("");
    // real budget breakdown
    function fLines(obj) {
      var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
      return keys.map(function (k) {
        return '<tr><td>' + U.esc(k) + '</td><td class="num">£' + Math.round(obj[k]) + 'bn</td></tr>';
      }).join("");
    }
    var budget = '<div class="panel" style="margin-bottom:16px"><h3>The Economy — real figures</h3>' +
      '<div class="kpis" style="margin-bottom:8px">' +
        kpi("GDP", "£" + (m.gdp / 1000).toFixed(2) + "<small>tn</small>") +
        kpi("Real growth", m.realGrowth.toFixed(1) + "<small>%</small>") +
        kpi("Inflation (CPI)", m.inflation.toFixed(1) + "<small>%</small>") +
        kpi("Unemployment", m.unemployment.toFixed(1) + "<small>%</small>") +
      '</div>' +
      '<div class="viz2"><div><table class="tbl"><thead><tr><th>Receipts</th><th class="num">£bn</th></tr></thead><tbody>' +
        fLines(g.fiscalLines.r) + '<tr style="font-weight:800"><td>Total receipts</td><td class="num">£' + m.receipts + 'bn</td></tr></tbody></table></div>' +
      '<div><table class="tbl"><thead><tr><th>Spending</th><th class="num">£bn</th></tr></thead><tbody>' +
        fLines(g.fiscalLines.s) + '<tr style="font-weight:800"><td>Total spending</td><td class="num">£' + m.spending + 'bn</td></tr></tbody></table></div></div>' +
      '<div class="kpis" style="margin-top:10px">' +
        kpi("Deficit / yr", fmtMoney(m.deficit), m.deficit > 150 ? "var(--bad)" : "var(--warn)") +
        kpi("Net debt", "£" + (m.debt / 1000).toFixed(2) + "tn <small>" + m.debtPct + "% GDP</small>") +
        kpi("Debt interest", fmtMoney(m.debtInterest)) +
      '</div><p class="notice">Starting figures are the real UK 2024–25 position (OBR / ONS). Each policy slider moves its own budget line; receipts grow with the economy and debt interest with the debt stock.</p></div>';
    return budget + '<div class="panel"><h3>State of the Nation (quality of services)</h3>' + rows +
      '<p class="notice">These qualitative indicators move with a lag and feed into each other — poor education drives crime, a strained NHS hits pensioners, and so on.</p></div>';
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
    return '<div class="panel" style="margin-bottom:16px"><h3>Cabinet Briefing</h3>' +
      '<p>' + mood + ' ' + fin + ' On today\'s numbers you would ' +
      (live.won ? "be returned as the largest party with " + live.playerSeats + " seats" : "lose office, falling to " + live.playerSeats + " seats") + '.</p></div>' +
      '<div class="panel" style="margin-bottom:16px"><h3>In the In-Tray</h3>' + events + '</div>' +
      '<div class="panel"><h3>Electoral Map — if an election were held today</h3>' +
      mapView(live.seatWinners) + '</div>';
  }

  function viewGameOver() {
    var g = S.govern, el = g.lastElection;
    return '<div class="hero"><h1>Out of Office</h1>' +
      '<p>After ' + g.termsWon + ' term' + (g.termsWon === 1 ? "" : "s") + ' in power, ' + D.PARTIES[g.party].name +
      ' has lost the general election. ' + U.pname(el.winner) + ' won with ' + el.winnerSeats + ' seats; you were left with ' + el.playerSeats + '.</p>' +
      '<div class="row" style="justify-content:center;margin-top:18px"><button class="btn primary" data-go="govern-setup">Try Again</button>' +
      '<button class="btn" data-go="home">Main Menu</button></div></div>';
  }

  // --------------------------------------------------------- election night
  function viewElectionNight() {
    var r = S.govern.lastElection;
    var won = r.won;
    return '<h2 class="section-title">Election Night</h2>' +
      '<p class="subtitle">' + D.PARTIES[r.playerParty].name + ' won ' + r.shares[r.playerParty].toFixed(1) + '% of the national vote.</p>' +
      U.headline(r) +
      '<div class="panel"><h3>The New House of Commons</h3>' + U.hemicycle(r.totals) + U.seatBar(r.totals) + U.legend(r.totals, { shares: r.shares }) + '</div>' +
      '<div class="panel" style="margin-top:16px"><h3>Constituency Map</h3>' + mapView(r.seatWinners) + '</div>' +
      '<div class="row" style="margin-top:16px;justify-content:center">' +
      (won ? '<button class="btn primary" data-act="continueterm">Continue Governing — ' + (r.playerMajority > 0 ? "Majority of " + r.playerMajority : "lead a minority government") + ' ▶</button>'
           : '<button class="btn danger" data-act="seegameover">See the damage</button>') +
      '</div>';
  }

  // -------------------------------------------------------------- listeners
  function afterRender() {
    // mode-card / data-go navigation
    app.querySelectorAll("[data-go]").forEach(function (el) {
      el.addEventListener("click", function () { go(el.getAttribute("data-go")); });
    });
    // party selection
    app.querySelectorAll("[data-party]").forEach(function (el) {
      el.addEventListener("click", function () {
        S.govern = E.newGovernState(el.getAttribute("data-party"));
        S.governTab = "policies"; go("govern");
      });
    });
    // tabs
    app.querySelectorAll("[data-tab]").forEach(function (el) {
      el.addEventListener("click", function () { S.governTab = el.getAttribute("data-tab"); render(); });
    });
    // generic actions
    app.querySelectorAll("[data-act]").forEach(function (el) {
      el.addEventListener("click", function () { action(el.getAttribute("data-act")); });
    });

    bindShareControls();
    bindPolicySliders();
    bindByElection();

    // first paint of live results panels
    if (S.screen === "simulator") { var sr = $("#sim-results"); if (sr) sr.innerHTML = simResults(); }
    if (S.screen === "byelection") { var br = $("#bye-results"); if (br) br.innerHTML = byeResults(); }
    if (S.screen === "local") { var lr = $("#local-results"); if (lr) lr.innerHTML = localResults(); }
  }

  function refreshShareResults() {
    if (S.screen === "simulator") $("#sim-results").innerHTML = simResults();
    else if (S.screen === "byelection") $("#bye-results").innerHTML = byeResults();
    else if (S.screen === "local") $("#local-results").innerHTML = localResults();
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
    var preset = $("#preset");
    if (preset) preset.addEventListener("change", function () {
      var v = preset.value; if (!v) return;
      var src = null;
      if (v.indexOf("poll:") === 0) { var e = pollById(v.slice(5)); src = e && e.shares; }
      else if (v.indexOf("preset:") === 0) src = E.sharesFromPreset(v.slice(7));
      if (!src) return;
      SHARE_PARTIES.forEach(function (p) { S.shares[p] = src[p] || 0; });
      render(); // redraw sliders to new values
    });
  }

  function bindByElection() {
    var inp = $("#byseat-input");
    if (!inp) return;
    inp.addEventListener("change", function () {
      var name = inp.value.trim().toLowerCase(), C = window.UKGAME.CONSTITUENCIES;
      for (var i = 0; i < C.length; i++) if (C[i].n.toLowerCase() === name) { S.byseat = C[i].c; break; }
      $("#bye-results").innerHTML = byeResults();
    });
  }

  function bindPolicySliders() {
    app.querySelectorAll("[data-policy]").forEach(function (range) {
      var id = range.getAttribute("data-policy");
      range.addEventListener("change", function () {
        var g = S.govern, newVal = parseFloat(range.value), oldVal = g.policies[id];
        var cost = E.changeCost(newVal - oldVal);
        if (cost > g.capital) {
          range.value = oldVal;
          toast("Not enough political capital (need " + cost + ").");
          return;
        }
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
      case "endturn": {
        if (g.pendingDilemma) { toast("Settle the decision on your desk first."); return; }
        var res = E.simulateTurn(g);
        if (res.electionDue) { runElection(); return; }
        render();
        if (!g.pendingDilemma) toast("Quarter ended — " + g.year + " Q" + g.quarter);
        break;
      }
      case "dilemma": break;
      case "fetchpolls": fetchLatestPolls(); break;
      case "callelection": runElection(); break;
      case "continueterm": go("govern"); break;
      case "seegameover": render(); break;
      case "quitgovern": if (confirm("Resign and leave Number 10?")) { S.govern = null; go("home"); } break;
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
      // de-dupe and add to the session list, then load it
      S.livePolls = S.livePolls.filter(function (e) { return e.id !== poll.id; });
      S.livePolls.unshift(poll);
      SHARE_PARTIES.forEach(function (p) { S.shares[p] = poll.shares[p] || 0; });
      render();
      toast("Loaded: " + poll.label);
    }).catch(function () {
      if (btn) { btn.textContent = "↻ Latest polls"; btn.disabled = false; }
      toast("Couldn’t reach live polls — using saved data.");
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

  function runElection() {
    var result = E.runGeneralElection(S.govern);
    E.applyElectionResult(S.govern, result);
    go("election");
  }

  // ----------------------------------------------------------------- bootstrap
  function init() {
    app = $("#app");
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
      var seat = e.target.closest("[data-seat]");
      if (seat) {
        var code = seat.getAttribute("data-seat");
        if (S.screen === "byelection") { S.byseat = code; $("#bye-results").innerHTML = byeResults(); }
        else { S.selectedSeat = code; if (S.screen === "simulator") $("#sim-results").innerHTML = simResults(); }
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
