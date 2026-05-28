/* ============================================================================
 * NUMBER 10 — ui.js
 * Pure rendering helpers: returns HTML strings / SVG. No app state lives here.
 * Exposes window.UKGAME.UI.
 * ==========================================================================*/
(function () {
  "use strict";
  var D = window.UKGAME.DATA;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pname(id) { return D.PARTIES[id] ? D.PARTIES[id].name : id; }
  function pcolor(id) { return D.PARTIES[id] ? D.PARTIES[id].color : "#9aa0a6"; }
  function pshort(id) { return D.PARTIES[id] ? D.PARTIES[id].short : id.toUpperCase(); }

  // Left-to-right Commons seating order (progressive -> right-wing).
  var SEAT_ORDER = ["sf", "sdlp", "green", "pc", "snp", "lab", "ld", "alliance", "oth", "uup", "con", "dup", "reform"];

  function orderedParties(totals) {
    var ids = SEAT_ORDER.filter(function (p) { return (totals[p] || 0) > 0; });
    // include any party present but not in SEAT_ORDER, appended at the end
    for (var p in totals) if (totals[p] > 0 && ids.indexOf(p) < 0) ids.push(p);
    return ids;
  }

  // --- Commons hemicycle as SVG ---------------------------------------------
  function hemicycle(totals) {
    var order = orderedParties(totals);
    var seatList = [];
    order.forEach(function (p) {
      var n = totals[p] || 0;
      for (var i = 0; i < n; i++) seatList.push(p);
    });
    var n = seatList.length || 1;

    // Pick a row count so seats pack roughly evenly (arc spacing ≈ row spacing),
    // with inner radius ~45% of the outer radius (a natural-looking arch).
    var i, f = 0.45, outerR = 100, innerR = f * outerR;
    var K = 2 * n * (1 - f) / (Math.PI * (1 + f));
    var rows = Math.max(8, Math.round((1 + Math.sqrt(1 + 4 * K)) / 2));
    var rowStep = rows > 1 ? (outerR - innerR) / (rows - 1) : 0;
    var radii = [], sumR = 0;
    for (i = 0; i < rows; i++) { radii.push(innerR + i * rowStep); sumR += radii[i]; }

    // seats per row proportional to radius, fixed to exactly n
    var perRow = [], assigned = 0;
    for (i = 0; i < rows; i++) { perRow.push(Math.max(1, Math.round(n * radii[i] / sumR))); assigned += perRow[i]; }
    var gi = rows - 1;
    while (assigned > n) { if (perRow[gi] > 1) { perRow[gi]--; assigned--; } gi = gi > 0 ? gi - 1 : rows - 1; }
    gi = rows - 1;
    while (assigned < n) { perRow[gi]++; assigned++; gi = gi > 0 ? gi - 1 : rows - 1; }

    // place seats; track the tightest spacing so dots never overlap
    var slots = [], minSpace = rowStep || 6;
    for (i = 0; i < rows; i++) {
      var k = perRow[i], R = radii[i];
      if (k > 1) minSpace = Math.min(minSpace, R * Math.PI / (k - 1));
      for (var j = 0; j < k; j++) {
        var t = k === 1 ? 0.5 : j / (k - 1);
        var ang = Math.PI * (1 - t); // pi (left) -> 0 (right)
        slots.push({ x: R * Math.cos(ang), y: -R * Math.sin(ang) });
      }
    }
    slots.sort(function (a, b) { return a.x - b.x || a.y - b.y; });

    var dot = Math.max(1, 0.42 * Math.min(rowStep || minSpace, minSpace));
    var pad = dot + 2;
    var svg = ['<svg class="hemicycle" viewBox="' + (-outerR - pad) + ' ' + (-outerR - pad) + ' ' +
      (2 * (outerR + pad)) + ' ' + (outerR + pad + pad) + '" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Seat hemicycle">'];
    for (i = 0; i < slots.length; i++) {
      var party = seatList[i] || "oth";
      svg.push('<circle cx="' + slots[i].x.toFixed(2) + '" cy="' + slots[i].y.toFixed(2) +
        '" r="' + dot.toFixed(2) + '" fill="' + pcolor(party) + '"><title>' + esc(pshort(party)) + '</title></circle>');
    }
    svg.push('</svg>');
    return svg.join("");
  }

  // --- UK constituency hex cartogram (650 seats) ----------------------------
  // Layout is odd-r offset, pointy-topped. seatWinners maps ONS code -> party.
  function hexmap(seatWinners, opts) {
    opts = opts || {};
    var C = window.UKGAME.CONSTITUENCIES;
    if (!C) return "";
    var size = 10, w = Math.sqrt(3) * size, vy = 1.5 * size;
    var rMax = -Infinity, i;
    for (i = 0; i < C.length; i++) if (C[i].r > rMax) rMax = C[i].r;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, pos = [];
    for (i = 0; i < C.length; i++) {
      var s = C[i], par = ((s.r % 2) + 2) % 2;
      var cx = w * (s.q + 0.5 * par), cy = vy * (rMax - s.r);
      pos.push({ s: s, cx: cx, cy: cy });
      if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    }
    // pointy-top vertex offsets (precompute)
    var vx = [], vyy = [];
    for (i = 0; i < 6; i++) { var a = Math.PI / 180 * (30 + 60 * i); vx.push(size * Math.cos(a)); vyy.push(size * Math.sin(a)); }
    var parts = [];
    for (i = 0; i < pos.length; i++) {
      var p = pos[i], party = seatWinners ? (seatWinners[p.s.c] || p.s.w) : p.s.w;
      var pts = [];
      for (var j = 0; j < 6; j++) pts.push((p.cx + vx[j]).toFixed(1) + "," + (p.cy + vyy[j]).toFixed(1));
      var hl = opts.highlight === p.s.c;
      parts.push('<polygon data-seat="' + p.s.c + '" points="' + pts.join(" ") + '" fill="' + pcolor(party) +
        '"' + (hl ? ' stroke="#fff" stroke-width="2.4"' : ' stroke="#0d1117" stroke-width="0.5"') +
        '><title>' + esc(p.s.n) + " — " + esc(pname(party)) + '</title></polygon>');
    }
    var pad = size + 2;
    var W = (maxX - minX) + pad * 2, H = (maxY - minY) + pad * 2;
    return '<svg class="hexmap" viewBox="' + (minX - pad) + " " + (minY - pad) + " " + W + " " + H +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="UK constituency hex map">' +
      parts.join("") + '</svg>';
  }

  // --- geographic constituency map (real boundaries) ------------------------
  var _codeInfo = null;
  function codeInfo() {
    if (_codeInfo) return _codeInfo;
    _codeInfo = {}; var C = window.UKGAME.CONSTITUENCIES || [];
    for (var i = 0; i < C.length; i++) _codeInfo[C[i].c] = C[i];
    return _codeInfo;
  }
  function geomap(seatWinners, opts) {
    opts = opts || {};
    var B = window.UKGAME.BOUNDARIES;
    if (!B) return '<p class="muted">Geographic boundaries unavailable.</p>';
    var info = codeInfo(), parts = [], i;
    for (i = 0; i < B.seats.length; i++) {
      var s = B.seats[i], ci = info[s.c] || {}, base = ci.w || "oth";
      var party = seatWinners ? (seatWinners[s.c] || base) : base;
      var hl = opts.highlight === s.c;
      parts.push('<path data-seat="' + s.c + '" d="' + s.d + '" fill="' + pcolor(party) + '" fill-rule="evenodd" ' +
        (hl ? 'stroke="#fff" stroke-width="3"' : 'stroke="#0d1117" stroke-width="0.4"') +
        '><title>' + esc(ci.n || s.c) + " — " + esc(pname(party)) + '</title></path>');
    }
    return '<svg class="geomap" viewBox="0 0 ' + B.w + " " + B.h +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="UK constituency map">' +
      parts.join("") + '</svg>';
  }

  // --- horizontal stacked seat bar with 326 line ----------------------------
  function seatBar(totals) {
    var order = orderedParties(totals), total = 0, p;
    for (p in totals) total += totals[p];
    total = total || 650;
    var spans = order.map(function (p) {
      var pct = (totals[p] / total) * 100;
      return '<span style="width:' + pct + '%;background:' + pcolor(p) + '" title="' +
        esc(pname(p)) + ': ' + totals[p] + '"></span>';
    }).join("");
    return '<div class="seatbar-wrap"><div class="seatbar">' + spans +
      '</div><div class="majline" style="left:' + (326 / 650 * 100) + '%"></div></div>';
  }

  // --- legend with seat numbers ---------------------------------------------
  function legend(totals, opts) {
    opts = opts || {};
    var order = orderedParties(totals).slice().sort(function (a, b) { return (totals[b] || 0) - (totals[a] || 0); });
    // also surface any party with a material vote share (e.g. Restore at 6%
    // and 0 seats) so the player can see the right vote being split.
    if (opts.shares) {
      for (var sp in opts.shares) if ((opts.shares[sp] || 0) > 1 && order.indexOf(sp) < 0) order.push(sp);
    }
    return '<div class="legend">' + order.map(function (p) {
      var extra = opts.shares && opts.shares[p] != null ? ' <span class="faint">' + opts.shares[p].toFixed(1) + '%</span>' : "";
      // when a per-party range is supplied, render "lo–hi" instead of a deterministic number
      var label;
      if (opts.byParty && opts.byParty[p] && opts.byParty[p].low !== opts.byParty[p].high) {
        label = '<b>' + opts.byParty[p].low + '–' + opts.byParty[p].high + '</b>';
      } else {
        label = '<b>' + (totals[p] || 0) + '</b>';
      }
      return '<span class="item"><span class="sw" style="background:' + pcolor(p) + '"></span>' +
        esc(pshort(p)) + ' ' + label + extra + '</span>';
    }).join("") + '</div>';
  }

  // --- compact line chart for a metric over time (Democracy-style trend) ----
  // series: array of numbers. opts: { color, min, max, good ('high'|'low'),
  //   fmt(v), band:[lo,hi] optional shaded healthy band }.
  function lineChart(series, opts) {
    opts = opts || {};
    var W = 240, H = 70, padL = 4, padR = 4, padT = 8, padB = 8;
    var n = series.length;
    var lo = opts.min, hi = opts.max;
    if (lo == null || hi == null) {
      lo = Math.min.apply(null, series); hi = Math.max.apply(null, series);
      var m = (hi - lo) * 0.2 || 1; lo -= m; hi += m;
    }
    if (hi === lo) hi = lo + 1;
    var color = opts.color || "var(--commons-l)";
    function X(i) { return padL + (n <= 1 ? 0 : i / (n - 1) * (W - padL - padR)); }
    function Y(v) { return padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB); }
    var pts = series.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
    var area = "M" + X(0).toFixed(1) + "," + (H - padB) + " L" + pts.join(" L") + " L" + X(n - 1).toFixed(1) + "," + (H - padB) + " Z";
    var band = "";
    if (opts.band) {
      var y1 = Y(Math.min(opts.band[1], hi)), y2 = Y(Math.max(opts.band[0], lo));
      band = '<rect x="' + padL + '" y="' + y1.toFixed(1) + '" width="' + (W - padL - padR) + '" height="' + Math.max(0, y2 - y1).toFixed(1) + '" fill="#ffffff" opacity="0.05"/>';
    }
    var last = series[n - 1], lastX = X(n - 1), lastY = Y(last);
    return '<svg class="linechart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img">' +
      band +
      '<path d="' + area + '" fill="' + color + '" opacity="0.13"/>' +
      '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="2.4" fill="' + color + '"/>' +
      '</svg>';
  }

  // --- national vote-share bars with swing vs 2024 (polling viz) ------------
  function voteSwing(shares) {
    var D = window.UKGAME.DATA, base = D.BASELINE;
    var ids = D.MAIN_PARTIES.slice().sort(function (a, b) { return (shares[b] || 0) - (shares[a] || 0); });
    var max = 0; ids.forEach(function (p) { if ((shares[p] || 0) > max) max = shares[p] || 0; });
    max = Math.max(max, 1);
    var rows = ids.map(function (p) {
      var v = shares[p] || 0, sw = v - (base[p] || 0);
      var swTxt = (Math.abs(sw) < 0.05) ? '<span class="faint">±0.0</span>'
        : '<span class="' + (sw > 0 ? "delta-up" : "delta-down") + '">' + (sw > 0 ? "▲" : "▼") + " " + Math.abs(sw).toFixed(1) + '</span>';
      return '<div class="vote-row"><div class="vn" style="color:' + pcolor(p) + '">' + pshort(p) + '</div>' +
        '<div class="vbar"><i style="width:' + (v / max * 100) + '%;background:' + pcolor(p) + '"></i></div>' +
        '<div class="vv">' + v.toFixed(1) + '%</div><div class="vsw">' + swTxt + '</div></div>';
    }).join("");
    return '<div class="vote-chart">' + rows + '</div>';
  }

  // --- single-seat detail card (for a clicked constituency) -----------------
  function seatCard(d) {
    var bars = d.ranked.slice(0, 4).map(function (row) {
      return '<div class="stat-row"><div class="name" style="color:' + pcolor(row.party) + '">' + pname(row.party) +
        '</div><div class="statbar"><i style="width:' + Math.min(100, row.share) + '%;background:' + pcolor(row.party) + '"></i></div>' +
        '<div class="v">' + row.share.toFixed(1) + '%</div></div>';
    }).join("");
    var badge = d.flip
      ? '<span class="pill" style="background:var(--good);color:#06210f">' + pshort(d.winner) + ' GAIN from ' + pshort(d.previousWinner) + '</span>'
      : '<span class="pill" style="background:var(--panel-2);color:var(--ink)">' + pshort(d.winner) + ' HOLD</span>';
    return '<div class="row" style="align-items:center;margin-bottom:6px"><div style="font-size:19px;font-weight:900;color:' +
      pcolor(d.winner) + '">' + esc(d.name) + '</div><span class="spacer"></span>' + badge + '</div>' +
      '<div class="muted" style="font-size:12px;margin-bottom:8px">2024 winner: ' + pname(d.previousWinner) +
      ' · projected majority ' + d.margin.toFixed(1) + ' pts</div>' + bars;
  }

  // --- result headline -------------------------------------------------------
  function headline(result) {
    var w = result.winner;
    var hung = result.outcome === "hung";
    var majTxt = hung ? "Hung Parliament" : "Majority of " + result.majority;
    return '<div class="headline">' +
      '<span class="sw" style="width:34px;height:34px;border-radius:8px;background:' + pcolor(w) + '"></span>' +
      '<div><div class="lab2">Largest party</div><div class="big">' + esc(pname(w)) + '</div></div>' +
      '<div class="spacer"></div>' +
      '<div style="text-align:right"><div class="lab2">' + result.winnerSeats + ' seats</div>' +
      '<div class="big ' + (hung ? "outcome-hung" : "outcome-maj") + '">' + esc(majTxt) + '</div></div></div>';
  }

  // --- stat bar (colour reflects good/bad direction) ------------------------
  function statColor(stat, value) {
    var good = stat.higherIsBetter ? value : 1 - value;
    if (good > 0.6) return "var(--good)";
    if (good > 0.4) return "var(--warn)";
    return "var(--bad)";
  }

  function num(x) { return (Math.round(x * 10) / 10).toLocaleString(); }

  window.UKGAME.UI = {
    esc: esc, pname: pname, pcolor: pcolor, pshort: pshort,
    hemicycle: hemicycle, hexmap: hexmap, geomap: geomap, seatBar: seatBar, legend: legend, headline: headline,
    voteSwing: voteSwing, seatCard: seatCard, lineChart: lineChart,
    statColor: statColor, orderedParties: orderedParties, num: num,
    SEAT_ORDER: SEAT_ORDER
  };
})();
