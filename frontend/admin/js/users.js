document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  const usersBody = document.getElementById("users-body");
  const paginationEl = document.getElementById("pagination");
  const searchInput = document.getElementById("search");
  const typeFilter = document.getElementById("type-filter");
  const searchBtn = document.getElementById("search-btn");
  const createFakeBtn = document.getElementById("create-fake");
  const fakeModal = document.getElementById("fake-modal");
  const saveFakeBtn = document.getElementById("save-fake");
  const closeFakeBtn = document.getElementById("close-fake");

  const fakeFields = {
    nick: document.getElementById("fake-nick"),
    gender: document.getElementById("fake-gender"),
    city: document.getElementById("fake-city"),
    about: document.getElementById("fake-about"),
    interests: document.getElementById("fake-interests"),
  };

  const state = {
    page: 1,
    totalPages: 1,
  };

  const renderPlaceholder = (message) => {
    usersBody.innerHTML = `
      <tr>
        <td colspan="9" class="table-message">${message}</td>
      </tr>
    `;
  };

  const buildActionButton = (label, action, id, extra = {}) => {
    const button = document.createElement("button");
    button.className = "action-btn";
    button.dataset.action = action;
    button.dataset.id = id;
    Object.entries(extra).forEach(([key, value]) => {
      button.dataset[key] = value;
    });
    button.textContent = label;
    return button;
  };

  const renderUsers = (users) => {
    usersBody.innerHTML = "";
    users.forEach((user) => {
      const tr = document.createElement("tr");

      const typeLabel = user.is_fake ? "🪄 Фейк" : "🧍 Реальный";
      const actionsCell = document.createElement("td");

      const banBtn = buildActionButton(
        user.banned ? "Разбанить" : "Забанить",
        "toggle-ban",
        user.id,
        { value: user.banned ? 0 : 1 }
      );
      const balanceBtn = buildActionButton("💰 Баланс", "edit-balance", user.id, {
        balance: user.balance ?? 0,
      });
      const impersonateBtn = buildActionButton("👤 Войти", "impersonate", user.id);
      const premiumBtn = buildActionButton(
        user.premium ? "Снять⭐" : "Дать⭐",
        "toggle-premium",
        user.id,
        { value: user.premium ? 0 : 1 }
      );

      actionsCell.append(banBtn, balanceBtn, impersonateBtn, premiumBtn);

      if (user.is_fake) {
        const deleteBtn = buildActionButton("🗑 Удалить", "delete-fake", user.id);
        actionsCell.append(deleteBtn);
      }

      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.nick}</td>
        <td>${user.email || "—"}</td>
        <td>${user.gender || "—"}</td>
        <td>${typeLabel}</td>
        <td>${user.city || "—"}</td>
        <td>${user.balance ?? 0}</td>
        <td>${user.status}</td>
      `;

      tr.append(actionsCell);
      usersBody.appendChild(tr);
    });
  };

  const renderPagination = (pagination) => {
    paginationEl.innerHTML = "";
    if (!pagination || pagination.totalPages <= 1) return;

    state.totalPages = pagination.totalPages;
    for (let page = 1; page <= pagination.totalPages; page += 1) {
      const button = document.createElement("button");
      button.textContent = page;
      button.classList.toggle("active", page === pagination.page);
      button.addEventListener("click", () => {
        state.page = page;
        loadUsers();
      });
      paginationEl.appendChild(button);
    }
  };

  const buildQuery = () => {
    const params = new URLSearchParams();
    const searchValue = searchInput.value.trim();
    const typeValue = typeFilter.value;

    if (searchValue) params.set("search", searchValue);
    if (typeValue && typeValue !== "all") params.set("type", typeValue);
    params.set("page", state.page);

    return `?${params.toString()}`;
  };

  const loadUsers = async () => {
    renderPlaceholder("Загрузка…");
    const query = buildQuery();
    const data = await AdminApp.request(`/users${query}`);

    if (!data.ok || !Array.isArray(data.users) || data.users.length === 0) {
      renderPlaceholder("Пользователи не найдены");
      paginationEl.innerHTML = "";
      return;
    }

    renderUsers(data.users);
    renderPagination(data.pagination);
  };

  const openModal = () => {
    fakeModal.classList.add("open");
    fakeFields.nick.focus();
  };

  const closeModal = () => {
    fakeModal.classList.remove("open");
    Object.values(fakeFields).forEach((field) => {
      field.value = "";
    });
    fakeFields.gender.value = "woman";
  };

  const createFake = async () => {
    const payload = {
      nick: fakeFields.nick.value.trim(),
      gender: fakeFields.gender.value,
      city: fakeFields.city.value.trim() || "Киев",
      about:
        fakeFields.about.value.trim() || "Фейковый профиль для тестов",
      interests: fakeFields.interests.value.trim(),
    };

    if (!payload.nick) {
      alert("Введите ник фейка");
      return;
    }

    const response = await AdminApp.request("/fake", {
      method: "POST",
      body: payload,
    });

    if (!response.ok) {
      alert(`Ошибка: ${response.error || "не удалось создать пользователя"}`);
      return;
    }

    closeModal();
    loadUsers();
  };

  const handleRowAction = async (event) => {
    const target = event.target.closest("button[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const userId = Number.parseInt(target.dataset.id, 10);

    if (!Number.isInteger(userId)) return;

    switch (action) {
      case "toggle-ban": {
        const banned = Number.parseInt(target.dataset.value, 10) ? 1 : 0;
        await AdminApp.request(`/user/${userId}`, {
          method: "PATCH",
          body: { banned },
        });
        loadUsers();
        break;
      }
      case "toggle-premium": {
        const premium = Number.parseInt(target.dataset.value, 10) ? 1 : 0;
        await AdminApp.request(`/user/${userId}`, {
          method: "PATCH",
          body: { premium },
        });
        loadUsers();
        break;
      }
      case "edit-balance": {
        const current = Number(target.dataset.balance || 0);
        const nextValue = prompt("Введите новый баланс:", current);
        if (nextValue === null) return;
        const balance = Number.parseInt(nextValue, 10);
        if (Number.isNaN(balance)) {
          alert("Некорректное число");
          return;
        }
        await AdminApp.request(`/user/${userId}`, {
          method: "PATCH",
          body: { balance },
        });
        loadUsers();
        break;
      }
      case "impersonate": {
        const data = await AdminApp.request(`/impersonate/${userId}`, {
          method: "POST",
        });
        if (data.ok && data.token) {
          window.open(`/auth/impersonate?token=${data.token}&next=/app/feed`, "_blank");
        } else {
          alert(`Ошибка входа: ${data.error || "неизвестная"}`);
        }
        break;
      }
      case "delete-fake": {
        if (!confirm("Удалить фейк-пользователя?")) return;
        await AdminApp.request(`/user/${userId}`, { method: "DELETE" });
        loadUsers();
        break;
      }
      default:
        break;
    }
  };

  usersBody.addEventListener("click", handleRowAction);

  searchBtn.addEventListener("click", () => {
    state.page = 1;
    loadUsers();
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      state.page = 1;
      loadUsers();
    }
  });

  typeFilter.addEventListener("change", () => {
    state.page = 1;
    loadUsers();
  });

  createFakeBtn.addEventListener("click", openModal);
  saveFakeBtn.addEventListener("click", createFake);
  closeFakeBtn.addEventListener("click", closeModal);

  fakeModal.addEventListener("click", (event) => {
    if (event.target === fakeModal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && fakeModal.classList.contains("open")) {
      closeModal();
    }
  });

  AdminApp.ensureSession({
    redirectTo: "/admin/admin.html",
    onReady: () => {
      AdminApp.markActiveLink("/admin/admin-users.html");
      AdminApp.toggleHidden(main, false);
      loadUsers();
    },
  });
});
