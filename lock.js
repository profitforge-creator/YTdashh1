// =============================================================
// Lightweight passcode gate for the dashboard.
//
// NOT real security — this is plain client-side JS with no backend,
// so anyone with browser devtools can read localStorage or just
// delete this script tag to bypass it. Treat it as a glance-proofing
// deterrent (e.g. someone picking up your phone), not encryption or
// real access control.
//
// First run on any page that includes this script: choose a
// passcode. It's stored (lightly obscured, not cryptographically
// hashed) in localStorage, shared across every page on this origin.
// After that, unlocking persists for the current browser tab session
// (sessionStorage) — closing the tab/browser re-locks.
//
// Usage: <script src="lock.js"></script> as the FIRST line in <head>,
// not deferred, so it can hide the page before it paints.
// =============================================================
(function () {
  'use strict';

  // Hide content immediately — this runs synchronously before the
  // rest of <head>/<body> is parsed, so there's no flash of the
  // unlocked page before the gate appears.
  document.documentElement.style.visibility = 'hidden';

  var STORE_KEY = 'dash:pinObscured';
  var SESSION_KEY = 'dashLockUnlocked';

  // Not a cryptographic hash — just enough that the passcode isn't
  // sitting in localStorage as plain text for a casual glance.
  function obscure(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return String(h);
  }

  function reveal() { document.documentElement.style.visibility = 'visible'; }
  function alreadyUnlocked() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }

  function buildOverlay(mode) {
    var overlay = document.createElement('div');
    overlay.id = 'lockOverlay';
    overlay.innerHTML =
      '<style>' +
      '#lockOverlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;' +
      'background:#050506;font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",Roboto,sans-serif;}' +
      '#lockOverlay .lock-card{width:min(320px,88vw);padding:28px 24px;border-radius:18px;box-sizing:border-box;' +
      'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);' +
      'backdrop-filter:blur(24px) saturate(1.2);-webkit-backdrop-filter:blur(24px) saturate(1.2);text-align:center;}' +
      '#lockOverlay .lock-icon{font-size:26px;margin-bottom:10px;}' +
      '#lockOverlay h2{margin:0 0 6px;font-size:16px;font-weight:700;color:#FAFAFA;}' +
      '#lockOverlay p{margin:0 0 18px;font-size:11.5px;color:#76746E;line-height:1.5;}' +
      '#lockOverlay input{width:100%;box-sizing:border-box;padding:13px 14px;font-size:20px;letter-spacing:0.3em;' +
      'text-align:center;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.30);' +
      'color:#FAFAFA;outline:none;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;}' +
      '#lockOverlay input:focus{border-color:rgba(255,255,255,0.28);}' +
      '#lockOverlay .lock-err{min-height:16px;margin-top:10px;font-size:11px;color:#FF6B6B;}' +
      '#lockOverlay button{margin-top:14px;width:100%;padding:12px;border:0;border-radius:12px;' +
      'background:linear-gradient(180deg,#FFFFFF 0%,#E8E5DD 100%);color:#0A0A0B;font-weight:700;font-size:13px;' +
      'font-family:inherit;cursor:pointer;}' +
      '</style>' +
      '<div class="lock-card">' +
        '<div class="lock-icon">🔒</div>' +
        '<h2 id="lockTitle"></h2>' +
        '<p id="lockSub"></p>' +
        '<input id="lockInput" type="password" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="••••" maxlength="24">' +
        '<div class="lock-err" id="lockErr"></div>' +
        '<button id="lockBtn" type="button"></button>' +
      '</div>';
    document.body.appendChild(overlay);
    reveal(); // the opaque overlay itself covers the underlying page

    var titleEl = overlay.querySelector('#lockTitle');
    var subEl = overlay.querySelector('#lockSub');
    var input = overlay.querySelector('#lockInput');
    var err = overlay.querySelector('#lockErr');
    var btn = overlay.querySelector('#lockBtn');

    if (mode === 'setup') {
      titleEl.textContent = 'Set a passcode';
      subEl.textContent = 'Light deterrent only — not real security. Anyone with devtools can bypass it.';
      btn.textContent = 'Set Passcode';
    } else {
      titleEl.textContent = 'Enter passcode';
      subEl.textContent = 'Unlocks for this browser tab session.';
      btn.textContent = 'Unlock';
    }

    function submit() {
      var val = input.value.trim();
      if (!val) return;
      if (mode === 'setup') {
        try { localStorage.setItem(STORE_KEY, obscure(val)); } catch (e) {}
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
        overlay.remove();
      } else {
        var stored = null;
        try { stored = localStorage.getItem(STORE_KEY); } catch (e) {}
        if (obscure(val) === stored) {
          try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
          overlay.remove();
        } else {
          err.textContent = 'Wrong passcode.';
          input.value = '';
          input.focus();
        }
      }
    }
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    setTimeout(function () { input.focus(); }, 50);
  }

  function boot() {
    if (alreadyUnlocked()) { reveal(); return; }
    var stored = null;
    try { stored = localStorage.getItem(STORE_KEY); } catch (e) {}
    buildOverlay(stored ? 'unlock' : 'setup');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
