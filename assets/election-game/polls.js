/* ============================================================================
 * NUMBER 10 — polls.js
 * Bundled national voting-intention data used to seed the simulator. This is
 * the reliable, offline default; the "↻ Latest" button in the app tries to
 * pull current polls live from Wikipedia's aggregation in the user's browser
 * and falls back to this file if that fails.
 *
 * Seeded only with the REAL 4 July 2024 General Election result — no invented
 * pollster figures. Add rows here (same shape) to ship a newer snapshot, or
 * use the live refresh for the latest polling.  Shares are GB %.
 * ==========================================================================*/
(function () {
  window.UKGAME = window.UKGAME || {};
  window.UKGAME.POLLS = {
    updated: "2024-07-04",
    // Wikipedia article the live refresh reads from (its tables aggregate the
    // reputable BPC pollsters: YouGov, Opinium, More in Common, Survation, etc.)
    wikiPage: "Opinion_polling_for_the_next_United_Kingdom_general_election",
    entries: [
      { id: "ge2024", label: "2024 General Election — result", date: "4 Jul 2024",
        pollster: "Result", shares: { lab: 33.7, con: 23.7, reform: 14.3, ld: 12.2, green: 6.7, snp: 2.5, pc: 0.7, oth: 6.2 } }
    ]
  };
})();
