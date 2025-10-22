document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  const tbody = document.getElementById("tbody");
  const statusSel = document.getElementById("status");
  const reloadBtn = document.getElementById("reload");

  const msg = (t) => (tbody.innerHTML = `<tr><td colspan="6" class="table-message">${t}</td></tr>`);

  const load = async () => {
    msg("Загрузка…");
    const s = statusSel.value;
    const data = await AdminApp.request(`/complaints?status=${encodeURIComponent(s)}`);
    if (!data.ok || !Array.isArray(data.list) || data.list.length === 0) {
      msg("Ничего нет");
      return;
    }
    tbody.innerHTML = "";
    data.list.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.id}</td>
        <td>${c.user_nick || c.user_email || c.user_id}</td>
        <td>${c.target_nick || c.target_email || c.target_id}</td>
        <td>${c.reason || "—"}</td>
        <td>${c.status || "new"}</td>
        <td>
          <button class="btn" data-action="ignore" data-id="${c.id}">Игнор</button>
          <button class="btn" data-action="warn" data-id="${c.id}">Предупреждение</button>
          <button class="btn" data-action="ban" data-id="${c.id}">Бан</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    const action = btn.dataset.action;
    let note = null;
    if (action !== "ignore") note = prompt("Комментарий (необязательно):") || null;
    const res = await AdminApp.request(`/complaints/${id}`, { method: "PATCH", body: { action, note } });
    if (!res.ok) {
      alert(`Ошибка: ${res.error || "server_error"}`);
      return;
    }
    load();
  });

  reloadBtn.addEventListener("click", load);
  statusSel.addEventListener("change", load);

  AdminApp.ensureSession({
    redirectTo: "/admin/admin.html",
    onReady: () => {
      AdminApp.markActiveLink("/admin/admin-complaints.html");
      AdminApp.toggleHidden(main, false);
      load();
    },
  });
});

