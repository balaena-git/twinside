(() => {
  async function loadAds(slotId, position = '') {
    try {
      const params = position ? `?position=${encodeURIComponent(position)}` : '';
      const res = await fetch(`/ads${params}`);
      const data = await res.json();
      const slot = document.getElementById(slotId);
      if (!slot) return;
      slot.innerHTML = '';
      if (!data.ok || !Array.isArray(data.list) || data.list.length === 0) {
        slot.classList.add('empty');
        return;
      }
      data.list.forEach(ad => {
        const a = document.createElement('a');
        a.href = ad.href || '#';
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'ad-item';
        const img = document.createElement('img');
        img.src = ad.image_path;
        img.alt = 'Ad';
        a.appendChild(img);
        a.addEventListener('click', () => {
          fetch(`/ads/click/${ad.id}`, { method: 'POST' }).catch(() => {});
        });
        slot.appendChild(a);
      });
    } catch (e) {
      // noop
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    let isPremium = false;
    try {
      const res = await fetch('/me/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.premium) isPremium = true;
      }
    } catch {}
    if (isPremium) return; // hide ads for premium users

    if (document.getElementById('ad-slot-global')) loadAds('ad-slot-global');
    if (document.getElementById('ad-slot-feed')) loadAds('ad-slot-feed', 'feed');
  });
})();
