document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  const body = document.getElementById("ads-body");
  const hrefInput = document.getElementById("a-href");
  const posInput = document.getElementById("a-pos");
  const activeInput = document.getElementById("a-active");
  const fileInput = document.getElementById("a-file");
  const createBtn = document.getElementById("a-create");

  const msg = (t) => (body.innerHTML = `<tr><td colspan="7" class="table-message">${t}</td></tr>`);

  const load = async () => {
    msg("Загрузка…");
    const data = await AdminApp.request("/ads");
    if (!data.ok || !Array.isArray(data.list) || data.list.length === 0) {
      msg("Нет баннеров");
      return;
    }
    body.innerHTML = "";
    data.list.forEach((ad) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ad.id}</td>
        <td><img src="${ad.image_path}" alt="ad" style="max-width:120px;max-height:60px;object-fit:contain"/></td>
        <td>${ad.href || "—"}</td>
        <td>${ad.position || "global"}</td>
        <td>${ad.active ? "✅" : "❌"}</td>
        <td>${ad.clicks ?? 0}</td>
        <td>
          <button class="btn" data-action="toggle" data-id="${ad.id}" data-active="${ad.active ? 1 : 0}">${ad.active ? "Откл." : "Вкл."}</button>
          <button class="btn" data-action="delete" data-id="${ad.id}">🗑</button>
        </td>
      `;
      body.appendChild(tr);
    });
  };

  body.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (btn.dataset.action === "toggle") {
      const active = btn.dataset.active === "1" ? 0 : 1;
      await AdminApp.request(`/ads/${id}`, { method: "PATCH", body: { active } });
      load();
    } else if (btn.dataset.action === "delete") {
      if (!confirm("Удалить баннер?")) return;
      await AdminApp.request(`/ads/${id}`, { method: "DELETE" });
      load();
    }
  });

  createBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Выберите изображение");
      return;
    }
    const formData = new FormData();
    formData.append("image", file);
    if (hrefInput.value) formData.append("href", hrefInput.value.trim());
    if (posInput.value) formData.append("position", posInput.value.trim());
    formData.append("active", activeInput.checked ? "1" : "0");

    const res = await fetch(`${AdminApp.API}/ads`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const data = await res.json();
    if (!data.ok) {
      alert(`Ошибка: ${data.error || "не удалось загрузить баннер"}`);
      return;
    }
    hrefInput.value = "";
    posInput.value = "";
    activeInput.checked = true;
    fileInput.value = "";
    load();
  });

  AdminApp.ensureSession({
    redirectTo: "/admin/admin.html",
    onReady: () => {
      AdminApp.markActiveLink("/admin/admin-ads.html");
      AdminApp.toggleHidden(main, false);
      load();
    },
  });
});

