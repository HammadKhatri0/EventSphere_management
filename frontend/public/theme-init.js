// Apply the saved/system theme and colour palette before first paint (no flash).
// External file so a strict CSP can forbid inline scripts.
try {
  var root = document.documentElement;
  var t = localStorage.getItem('es-theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) root.classList.add('dark');
  var p = localStorage.getItem('es-palette');
  if (p && /^[a-z]+$/.test(p)) root.dataset.palette = p;
} catch (e) { /* storage unavailable */ }
