document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  const body = document.getElementById("promo-body");
  const inputs = {
    code: document.getElementById("p-code"),
    value: document.getElementById("p-value"),
    active: document.getElementById("p-active"),
    max: document.getElementById("p-max"),
    user: document.getElementById("p-user"),
    exp: document.getElementById("p-exp"),
  };
  const createBtn = document.getElementById("p-create");

  const setMessage = (msg) => {
    body.innerHTML = `<tr><td colspan="8" class="table-message">${msg}</td></tr>`;
  };

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("ru-RU") : "—");

  const load = async () => {
    setMessage("Загрузка…");
    const data = await AdminApp.request("/promos");
    if (!data.ok || !Array.isArray(data.list) || data.list.length === 0) {
      setMessage("Нет промокодов");
      return;
    }
    body.innerHTML = "";
    data.list.forEach((p) => {
      const tr = document.createElement("tr");
      const lim = [
        p.max_redemptions ? `max: ${p.max_redemptions}` : null,
        p.per_user_limit ? `per user: ${p.per_user_limit}` : null,
      ].filter(Boolean).join(", ") || "—";
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.code}</td>
        <td>${p.value}</td>
        <td>${p.active ? "✅" : "❌"}</td>
        <td>${p.redeemed || 0}</td>
        <td>${lim}</td>
        <td>${p.expires_at ? fmtDate(p.expires_at) : "—"}</td>
        <td>
          <button class="btn" data-action="toggle" data-id="${p.id}" data-active="${p.active ? 1 : 0}">${p.active ? "Откл." : "Вкл."}</button>
          <button class="btn" data-action="delete" data-id="${p.id}">🗑</button>
        </td>
      `;
      body.appendChild(tr);
    });
  };

  body.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (!Number.isInteger(id)) return;
    if (btn.dataset.action === "toggle") {
      const active = btn.dataset.active === "1" ? 0 : 1;
      await AdminApp.request(`/promos/${id}`, { method: "PATCH", body: { active } });
      load();
    } else if (btn.dataset.action === "delete") {
      if (!confirm("Удалить промокод?")) return;
      await AdminApp.request(`/promos/${id}`, { method: "DELETE" });
      load();
    }
  });

  createBtn.addEventListener("click", async () => {
    const payload = {
      code: inputs.code.value.trim(),
      value: parseInt(inputs.value.value, 10),
      active: inputs.active.checked ? 1 : 0,
      max_redemptions: inputs.max.value ? parseInt(inputs.max.value, 10) : null,
      per_user_limit: inputs.user.value ? parseInt(inputs.user.value, 10) : null,
      expires_at: inputs.exp.value || null,
    };
    if (!payload.code || !Number.isInteger(payload.value) || payload.value <= 0) {
      alert("Введите корректные код и сумму");
      return;
    }
    const res = await AdminApp.request("/promos", { method: "POST", body: payload });
    if (!res.ok) {
      alert(`Ошибка: ${res.error || "не удалось создать промокод"}`);
      return;
    }
    Object.values(inputs).forEach((el) => {
      if (el.type === "checkbox") el.checked = true; else el.value = "";
    });
    load();
  });

  AdminApp.ensureSession({
    redirectTo: "/admin/admin.html",
    onReady: () => {
      AdminApp.markActiveLink("/admin/admin-promos.html");
      AdminApp.toggleHidden(main, false);
      load();
    },
  });
});

