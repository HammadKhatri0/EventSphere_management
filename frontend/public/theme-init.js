// Apply the saved/system theme before first paint (no flash). External file so a strict CSP can forbid inline scripts.
try {
  var t = localStorage.getItem('es-theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
} catch (e) { /* storage unavailable */ }
