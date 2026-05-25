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

    var rows = Math.max(7, Math.round(Math.sqrt(n) / 1.45));
    var rInner = rows * 1.7, rowGap = 1.0;
    var radii = [], sumR = 0, i;
    for (i = 0; i < rows; i++) { radii.push(rInner + i * (rInner / rows + rowGap)); sumR += radii[i]; }

    // seats per row proportional to radius, fixed to total n
    var perRow = [], assigned = 0;
    for (i = 0; i < rows; i++) { perRow.push(Math.max(1, Math.round(n * radii[i] / sumR))); assigned += perRow[i]; }
    while (assigned > n) { // trim from busiest rows
      var mi = 0; for (i = 1; i < rows; i++) if (perRow[i] > perRow[mi]) mi = i;
      perRow[mi]--; assigned--;
    }
    while (assigned < n) {
      var ma = rows - 1; perRow[ma]++; assigned++;
    }

    // build seat slots with angle + radius, then sort left->right by x
    var slots = [];
    for (i = 0; i < rows; i++) {
      var k = perRow[i], R = radii[i];
      for (var j = 0; j < k; j++) {
        var t = k === 1 ? 0.5 : j / (k - 1);
        var ang = Math.PI * (1 - t); // pi (left) -> 0 (right)
        slots.push({ x: R * Math.cos(ang), y: -R * Math.sin(ang), R: R, ang: ang });
      }
    }
    slots.sort(function (a, b) { return a.x - b.x || a.y - b.y; });

    var maxR = radii[rows - 1] + 2;
    var W = maxR * 2, H = maxR + 4;
    var dot = Math.max(1.6, maxR / 26);
    var svg = ['<svg class="hemicycle" viewBox="' + (-maxR) + ' ' + (-H) + ' ' + W + ' ' + (H + 4) + '" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Seat hemicycle">'];
    for (i = 0; i < slots.length; i++) {
      var party = seatList[i] || "oth";
      svg.push('<circle cx="' + slots[i].x.toFixed(2) + '" cy="' + slots[i].y.toFixed(2) +
        '" r="' + dot.toFixed(2) + '" fill="' + pcolor(party) + '"><title>' + esc(pshort(party)) + '</title></circle>');
    }
    svg.push('</svg>');
    return svg.join("");
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
    return '<div class="legend">' + order.map(function (p) {
      var extra = opts.shares && opts.shares[p] != null ? ' <span class="faint">' + opts.shares[p].toFixed(1) + '%</span>' : "";
      return '<span class="item"><span class="sw" style="background:' + pcolor(p) + '"></span>' +
        esc(pshort(p)) + ' <b>' + (totals[p] || 0) + '</b>' + extra + '</span>';
    }).join("") + '</div>';
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
    hemicycle: hemicycle, seatBar: seatBar, legend: legend, headline: headline,
    statColor: statColor, orderedParties: orderedParties, num: num,
    SEAT_ORDER: SEAT_ORDER
  };
})();
