export function initTheme() {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    updateIcon(dark);
}
export function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcon(!isDark);
}
function updateIcon(dark) {
    const btn = document.getElementById('theme-toggle');
    if (btn)
        btn.textContent = dark ? '☀️' : '🌙';
}
