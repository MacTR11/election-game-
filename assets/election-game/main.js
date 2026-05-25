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
    byseat: D.BYELECTION_SEATS[0].id,
    onShareChange: null
  };

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
      { s: "simulator", ico: "🗳", h: "General Election Simulator", tag: "Swingometer",
        p: "Dial in national vote shares and project all 650 seats with a regional first-past-the-post model calibrated to the July 2024 result." },
      { s: "byelection", ico: "📍", h: "By-Elections", tag: "Single seat",
        p: "Pick a real constituency and see how it falls under your national swing — holds, gains and majorities." },
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
    var presetOpts = Object.keys(D.PRESETS).map(function (k) {
      return '<option value="' + k + '">' + U.esc(D.PRESETS[k].name) + '</option>';
    }).join("");
    var sum = SHARE_PARTIES.reduce(function (a, p) { return a + (S.shares[p] || 0); }, 0);
    return '<div class="panel"><h3>National Vote Share (GB %)</h3>' +
      '<div class="row" style="margin-bottom:10px"><select class="sel" id="preset"><option value="">Load a scenario…</option>' + presetOpts + '</select>' +
      '<button class="btn sm" data-act="normalise">Normalise to 100%</button>' +
      '<span class="spacer"></span><span class="muted" id="sharesum">Total: ' + sum.toFixed(1) + '%</span></div>' +
      rows + '<p class="notice">Shares are normalised before projection. Swing is measured against the 2024 result.</p></div>';
  }

  // --------------------------------------------------------- simulator view
  function viewSimulator() {
    return '<h2 class="section-title">General Election Simulator</h2>' +
      '<p class="subtitle">Adjust the national vote and watch the Commons recompose, seat by seat.</p>' +
      '<div class="grid" style="grid-template-columns:380px 1fr" id="simgrid">' +
      shareControls() +
      '<div id="sim-results"></div></div>';
  }
  function simResults() {
    var shares = normShares(pickShares());
    var r = E.projectSeats(shares);
    return U.headline(r) +
      '<div class="panel"><h3>Projected House of Commons — 650 seats</h3>' +
      U.hemicycle(r.totals) + U.seatBar(r.totals) + U.legend(r.totals, { shares: shares }) +
      '</div>' + regionTable(r);
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
  function viewByElection() {
    var opts = D.BYELECTION_SEATS.map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === S.byseat ? " selected" : "") + '>' + U.esc(s.name) + '</option>';
    }).join("");
    return '<h2 class="section-title">By-Election</h2>' +
      '<p class="subtitle">A single seat, fought under your national swing versus 2024.</p>' +
      '<div class="grid" style="grid-template-columns:380px 1fr">' + shareControls() +
      '<div><div class="panel" style="margin-bottom:16px"><h3>Constituency</h3>' +
      '<select class="sel" id="byseat" style="width:100%">' + opts + '</select></div>' +
      '<div id="bye-results"></div></div></div>';
  }
  function byeResults() {
    var seat = D.BYELECTION_SEATS.filter(function (s) { return s.id === S.byseat; })[0];
    var r = E.byElection(seat, normShares(pickShares()));
    var bars = r.ranked.map(function (row) {
      return '<div class="stat-row"><div class="name" style="color:' + U.pcolor(row.party) + '">' + U.pname(row.party) +
        '</div><div class="statbar"><i style="width:' + Math.min(100, row.share) + '%;background:' + U.pcolor(row.party) + '"></i></div>' +
        '<div class="v">' + row.share.toFixed(1) + '%</div></div>';
    }).join("");
    var verdict = r.gain
      ? '<span class="pill" style="background:var(--good);color:#06210f">' + U.pshort(r.winner) + ' GAIN from ' + U.pshort(r.previousWinner) + '</span>'
      : '<span class="pill" style="background:var(--panel-2);color:var(--ink)">' + U.pshort(r.winner) + ' HOLD</span>';
    return '<div class="panel"><h3>Result — ' + U.esc(seat.name) + '</h3>' +
      '<div class="row" style="margin-bottom:12px;align-items:center"><div class="big" style="font-size:24px;font-weight:900;color:' + U.pcolor(r.winner) + '">' +
      U.pname(r.winner) + '</div>' + verdict + '<span class="spacer"></span><span class="muted">Majority ' + r.margin.toFixed(1) + ' pts</span></div>' +
      bars + '</div>';
  }

  // ------------------------------------------------------------- local view
  function viewLocal() {
    return '<h2 class="section-title">Local Elections</h2>' +
      '<p class="subtitle">The national mood, projected onto council chambers across the country.</p>' +
      '<div class="grid" style="grid-template-columns:380px 1fr">' + shareControls() +
      '<div id="local-results"></div></div>';
  }
  function localResults() {
    var r = E.localElection(normShares(pickShares()));
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
      '<tr><td class="muted">No Overall Control</td><td class="num muted">' + r.councils.noOverallControl + '</td></tr></tbody></table></div>';
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

    var kpis = '<div class="kpis">' +
      kpi("Deficit / yr", fmtMoney(g.deficit), g.deficit > 180 ? "var(--bad)" : g.deficit > 120 ? "var(--warn)" : "var(--good)") +
      kpi("National Debt", g.debt.toFixed(0) + "<small>% GDP</small>", g.debt > 130 ? "var(--bad)" : g.debt > 100 ? "var(--warn)" : "var(--good)") +
      kpi("Seats if voted today", live.playerSeats + "<small>/650</small>", live.won ? "var(--good)" : "var(--bad)") +
      kpi("Projected majority", (live.playerMajority > 0 ? "+" : "") + live.playerMajority, live.playerMajority > 0 ? "var(--good)" : "var(--warn)") +
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

    return head + kpis + '<div class="dash" style="margin-top:16px"><div>' + tabs + body + '</div>' + sidebar + '</div>';
  }
  function kpi(k, v, color) {
    return '<div class="kpi"><div class="k">' + k + '</div><div class="v" style="color:' + (color || "var(--ink)") + '">' + v + '</div></div>';
  }

  function tabPolicies() {
    var g = S.govern, cats = {}, order = [];
    D.POLICIES.forEach(function (p) { if (!cats[p.cat]) { cats[p.cat] = []; order.push(p.cat); } cats[p.cat].push(p); });
    var html = '<div class="grid" style="grid-template-columns:1fr 1fr">';
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
    var g = S.govern;
    var rows = D.STATS.map(function (st) {
      var v = g.stats[st.id];
      var disp = displayStat(st, v);
      return '<div class="stat-row"><div class="name">' + st.name + '</div>' +
        '<div class="statbar"><i style="width:' + (v * 100) + '%;background:' + U.statColor(st, v) + '"></i></div>' +
        '<div class="v">' + disp + '</div></div>';
    }).join("");
    return '<div class="panel"><h3>State of the Nation</h3>' + rows +
      '<p class="notice">Bars show relative performance. Policies feed these figures with a lag, and they feed back into each other — a weak economy widens the deficit, poor education drives crime, and so on.</p></div>';
  }
  function displayStat(st, v) {
    // light translation to human-readable scales
    if (st.id === "gdp") return ((v - 0.5) * 8).toFixed(1) + "%";
    if (st.id === "unemployment") return (3 + v * 9).toFixed(1) + "%";
    if (st.id === "inflation") return (v * 9).toFixed(1) + "%";
    return Math.round(v * 100);
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
    var fin = g.debt > 130 ? "The markets are alarmed by the debt pile." :
              g.deficit > 180 ? "The deficit is uncomfortably wide." :
              g.deficit < 60 ? "The public finances are in good order." :
              "The books are roughly where the markets expect.";
    return '<div class="panel" style="margin-bottom:16px"><h3>Cabinet Briefing</h3>' +
      '<p>' + mood + ' ' + fin + ' On today\'s numbers you would ' +
      (live.won ? "be returned as the largest party with " + live.playerSeats + " seats" : "lose office, falling to " + live.playerSeats + " seats") + '.</p></div>' +
      '<div class="panel"><h3>In the In-Tray</h3>' + events + '</div>';
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
      if (!preset.value) return;
      var src = E.sharesFromPreset(preset.value);
      SHARE_PARTIES.forEach(function (p) { S.shares[p] = src[p] || 0; });
      render(); // redraw sliders to new values
    });
  }

  function bindByElection() {
    var sel = $("#byseat");
    if (sel) sel.addEventListener("change", function () { S.byseat = sel.value; $("#bye-results").innerHTML = byeResults(); });
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
        var res = E.simulateTurn(g);
        if (res.electionDue) { runElection(); return; }
        render();
        toast("Quarter ended — " + g.year + " Q" + g.quarter);
        break;
      }
      case "callelection": runElection(); break;
      case "continueterm": go("govern"); break;
      case "seegameover": render(); break;
      case "quitgovern": if (confirm("Resign and leave Number 10?")) { S.govern = null; go("home"); } break;
    }
  }

  function runElection() {
    var result = E.runGeneralElection(S.govern);
    E.applyElectionResult(S.govern, result);
    go("election");
  }

  // ----------------------------------------------------------------- bootstrap
  function init() {
    app = $("#app");
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
