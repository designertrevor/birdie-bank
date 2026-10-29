// The status page (public/status.html, at /status). A plain script in the head, so the theme you
// picked in Settings is on before anything paints (the same check as index.html), then the checks
// from status-core.js run once the page is in. No inline script, so the content security policy
// needs no exception for this page.
(function () {
  var root = document.documentElement;
  function readTheme() {
    try {
      var saved = localStorage.getItem('birdie-bank-v1') || '';
      var m = saved.match(/"theme":"(light|dark)"/);
      if (m) root.dataset.theme = m[1];
      else delete root.dataset.theme;
    } catch { /* storage blocked: follow the system */ }
  }
  readTheme();

  // Safari's bars take the page colour: one token (--canvas) for the strips, the page and theme-color
  function paintBars() {
    var canvas = getComputedStyle(root).getPropertyValue('--canvas').trim();
    if (!canvas) return;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    // A picked theme wins over the phone's: both metas get it. Following the phone, each keeps its own
    metas.forEach(function (meta) {
      if (!meta.dataset.scheme) meta.dataset.scheme = meta.getAttribute('content');
      meta.setAttribute('content', root.dataset.theme ? canvas : meta.dataset.scheme);
    });
  }
  paintBars();

  function start() {
    import('/status-core.js').then(function (core) { run(core); }).catch(function () {
      var line = document.getElementById('summary-text');
      if (line) line.textContent = 'The status check couldn’t load. Reload the page to try again.';
    });
  }

  function run(core) {
    var list = document.getElementById('checks');
    var summaryEl = document.getElementById('summary');
    var summaryText = document.getElementById('summary-text');
    var summarySub = document.getElementById('summary-sub');
    var again = document.getElementById('again');
    var rows = core.CHECKS.map(function (check) {
      var li = document.createElement('li');
      li.className = 'row';
      li.innerHTML = '<span class="dot" aria-hidden="true"></span>'
        + '<div class="row-main"><div class="row-name"></div><div class="row-what"></div><div class="row-detail"></div></div>'
        + '<div class="row-side"><div class="row-ms"></div><div class="row-when"></div></div>';
      li.querySelector('.row-name').textContent = check.name;
      li.querySelector('.row-what').textContent = check.what;
      list.appendChild(li);
      return { check: check, el: li, state: null, at: 0, name: check.name };
    });

    function paintRow(r) {
      r.el.dataset.state = r.state || 'wait';
      // The dot says working, so a working row keeps only its version (if any); slow says so, and down
      // and off say so first
      var detail = !r.state ? 'Checking…'
        : r.state === 'up' ? r.detail.replace(/^Working( · )?/, '').replace(/^version/, 'Version')
          : r.label === 'Slow' ? r.detail : r.label + ': ' + r.detail;
      r.el.querySelector('.row-detail').textContent = detail;
      r.el.querySelector('.row-ms').textContent = r.state && r.ms != null ? r.ms + ' ms' : '–';
      r.el.querySelector('.row-when').textContent = r.state ? core.checkedAgo(r.at) : '';
    }

    function paintSummary() {
      var s = core.summary(rows, { online: navigator.onLine !== false });
      summaryEl.dataset.tone = s.tone;
      summaryText.textContent = s.text;
      summarySub.textContent = s.sub || '';
    }

    var busy = false;
    var lastRun = 0;
    function checkAll() {
      if (busy) return;
      busy = true;
      again.disabled = true;
      lastRun = Date.now();
      rows.forEach(function (r) { r.state = null; paintRow(r); });
      paintSummary();
      Promise.all(rows.map(function (r) {
        return core.runCheck(r.check).then(function (out) {
          r.state = out.state; r.label = out.label; r.detail = out.detail; r.ms = out.ms; r.at = Date.now();
          paintRow(r);
        });
      })).then(function () {
        busy = false;
        again.disabled = false;
        paintSummary();
      });
    }

    again.addEventListener('click', checkAll);
    // Keep "Checked 2 min ago" honest, and check again on coming back after a minute away
    setInterval(function () { rows.forEach(function (r) { if (r.state) r.el.querySelector('.row-when').textContent = core.checkedAgo(r.at); }); }, 15000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && Date.now() - lastRun > 60000) checkAll();
    });
    window.addEventListener('online', checkAll);
    checkAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  // Back from the bfcache: the colours may have changed while away
  window.addEventListener('pageshow', function () { readTheme(); paintBars(); });
})();
