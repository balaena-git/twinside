document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('feed');
  const pager = document.getElementById('pager');
  const city = document.getElementById('city');
  const gender = document.getElementById('gender');
  const apply = document.getElementById('apply');
  const cta = document.getElementById('activation-cta');

  // show CTA for requires_payment
  try {
    const st = await PublicApp.request('/me/status');
    if (st.ok && st.status === 'requires_payment') cta.classList.remove('is-hidden');
  } catch {}

  let page = 1;

  const renderUsers = (users) => {
    grid.innerHTML = '';
    if (!users || users.length === 0) {
      grid.innerHTML = '<div class="table-message">Ничего не нашли</div>';
      return;
    }
    users.forEach(u => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <img src="${u.avatar || '/assets/icons/user.svg'}" alt="ava" onerror="this.src='/assets/icons/user.svg'"/>
        <h3>${u.nick || '—'} ${u.premium ? '👑' : ''}</h3>
        <div class="meta">${u.city || 'Город не указан'} · ${u.gender || '—'}</div>
        <div class="actions">
          <a class="btn" href="/app/profile?id=${u.id}">Профиль</a>
          <button class="btn" data-action="friend" data-id="${u.id}">В друзья</button>
        </div>
      `;
      grid.appendChild(el);
    });
  };

  const renderPager = (pg) => {
    pager.innerHTML = '';
    if (!pg || pg.totalPages <= 1) return;
    for (let p = 1; p <= pg.totalPages; p += 1) {
      const b = document.createElement('button');
      b.textContent = p;
      b.classList.toggle('active', p === pg.page);
      b.addEventListener('click', () => { page = p; load(); });
      pager.appendChild(b);
    }
  };

  const buildQuery = () => {
    const q = new URLSearchParams();
    if (city.value.trim()) q.set('city', city.value.trim());
    if (gender.value) q.set('gender', gender.value);
    q.set('page', String(page));
    q.set('limit', '20');
    return q.toString();
  };

  async function load() {
    try {
      grid.innerHTML = '<div class="table-message">Загрузка…</div>';
      const data = await (await fetch(`/feed?${buildQuery()}`)).json();
      if (!data.ok) throw new Error(data.error || 'server_error');
      renderUsers(data.users);
      renderPager(data.pagination);
    } catch (e) {
      grid.innerHTML = `<div class="table-message">Ошибка: ${e.message}</div>`;
    }
  }

  grid.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'friend'){
      try{
        const res = await fetch(`/friends/${btn.dataset.id}`, { method:'POST', credentials:'include' });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error||'server_error');
        alert(data.accepted ? 'Заявка принята' : 'Заявка отправлена');
      }catch(err){ alert('Ошибка: '+err.message); }
    }
  });

  apply.addEventListener('click', () => { page = 1; load(); });
  load();
});
