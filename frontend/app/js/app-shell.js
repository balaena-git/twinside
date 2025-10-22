(function(){
  async function insert(selector, url){
    const wrap = document.querySelector(selector);
    if (!wrap) return;
    const res = await fetch(url);
    if (!res.ok) return;
    wrap.insertAdjacentHTML('beforeend', await res.text());
  }

  async function initShell(){
    // header
    await insert('body', '/app/components/header.html');
    // main shell container
    if (!document.querySelector('.app-shell')){
      const shell = document.createElement('div');
      shell.className = 'app-shell';
      const left = document.createElement('div'); left.className='left';
      // use existing content if present
      let content = document.getElementById('app-content');
      if (!content){ content = document.createElement('div'); content.className='content'; content.id='app-content'; }
      shell.append(left, content);
      document.body.appendChild(shell);
    }
    await insert('.left', '/app/components/left.html');

    // mark active menu
    const path = window.location.pathname;
    document.querySelectorAll('#app-menu a').forEach(a=>{
      if (path === a.getAttribute('href')) a.classList.add('active');
    });

    // logout
    const logoutBtn = document.getElementById('app-logout');
    if (logoutBtn){
      logoutBtn.addEventListener('click', async ()=>{
        try{ await fetch('/auth/logout',{method:'POST', credentials:'include'});}catch{}
        window.location.href='/public/auth';
      });
    }

    // show CTA for requires_payment
    try{
      const res = await fetch('/me/status', { credentials:'include' });
      const data = await res.json();
      if (data && data.ok && data.status === 'requires_payment'){
        const cta = document.getElementById('app-cta');
        if (cta) cta.style.display = 'block';
      }
    }catch{}
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    // inject CSS with cache-busting
    const link = document.createElement('link');
    link.rel='stylesheet';
    link.href=`/assets/app.css?v=${Date.now()}`;
    document.head.appendChild(link);
    initShell();
  });
})();
