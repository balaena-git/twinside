// Simple client-side include loader
// Usage: <div data-include="/components/header.html"></div>
document.addEventListener('DOMContentLoaded', () => {
  const includes = document.querySelectorAll('[data-include]');
  includes.forEach(async (el) => {
    const url = el.getAttribute('data-include');
    if (!url) return;
    try {
      const res = await fetch(url, {cache: 'no-store'});
      if (!res.ok) throw new Error('Fetch failed: ' + res.status);
      const html = await res.text();
      el.innerHTML = html;
      // ensure styles for common components are present
      try {
        const ensureCss = (componentUrl) => {
          const loadCss = (href) => {
            if (document.querySelector(`link[href="${href}"]`)) return;
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = href;
            document.head.appendChild(l);
          };
          if (componentUrl.includes('/components/header.html') || componentUrl.includes('/admin/components/header.html')) {
            loadCss('/assets/header.css');
          }
          if (componentUrl.includes('/components/footer.html') || componentUrl.includes('/admin/components/footer.html')) {
            loadCss('/assets/footer.css');
          }
        };
        ensureCss(url);
      } catch (e) {
        // non-fatal
        console.warn('include.js: failed to ensure css', e);
      }

  // Dispatch event so other scripts can initialize after include (bubble)
  el.dispatchEvent(new CustomEvent('include:loaded', {detail:{url}, bubbles: true}));
    } catch (err) {
      console.error('include.js error loading', url, err);
    }
  });
});
