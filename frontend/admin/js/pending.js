document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  const list = document.getElementById("pending-list");
  const pageInfo = document.getElementById("page-info");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const photoModal = document.getElementById("photoModal");
  const photoImg = document.getElementById("modalImg");
  const photoClose = document.getElementById("photo-close");

  const backendBase = AdminApp.API.replace(/\/api\/admin$/, "");

  const state = {
    page: 1,
    limit: 6,
    pages: 1,
  };

  const toFileUrl = (value, fallbackFolder = "uploads") => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/uploads")) return `${backendBase}${value}`;
    if (value.startsWith("uploads")) return `${backendBase}/${value}`;
    const sanitized = value.replace(/^\/+/, "");
    return `${backendBase}/${fallbackFolder}/${sanitized}`;
  };

  const setMessage = (text) => {
    list.innerHTML = `<p class="table-message">${text}</p>`;
  };

  const openPhoto = (src) => {
    if (!src) return;
    photoImg.src = src;
    photoModal.classList.add("open");
  };

  const closePhoto = () => {
    photoImg.src = "";
    photoModal.classList.remove("open");
  };

  const createMeta = (text, className = "meta") => {
    const el = document.createElement("p");
    el.className = className;
    el.textContent = text;
    return el;
  };

  const renderCard = (user) => {
    const card = document.createElement("article");
    card.className = "pending-card";

    const avatarUrl =
      user.avatar_url || toFileUrl(user.avatar_path, "uploads/avatars");
    const verifyUrl =
      user.verify_url || toFileUrl(user.verify_path, "uploads/verify");

    const img = document.createElement("img");
    img.alt = "avatar";
    img.src = avatarUrl || "/assets/icons/user.svg";
    img.dataset.photo = avatarUrl;
    img.classList.add("pending-avatar");
    img.addEventListener("error", () => {
      img.src = "/assets/icons/user.svg";
    });

    const info = document.createElement("div");
    info.className = "info";

    const name = document.createElement("h3");
    name.textContent = user.nick;
    info.appendChild(name);

    const location = createMeta(
      `${user.city || "Город не указан"} · ${user.gender || "—"}`
    );
    info.appendChild(location);

    if (user.email) {
      info.appendChild(createMeta(user.email));
    }

    const about = document.createElement("p");
    about.className = "about";
    about.textContent = user.about || "Без описания";
    info.appendChild(about);

    const createdAt = createMeta(
      `📅 Зарегистрирован: ${
        user.created_at
          ? new Date(user.created_at).toLocaleString("ru-RU")
          : "—"
      }`
    );
    info.appendChild(createdAt);

    if (verifyUrl) {
      const verifyButton = document.createElement("button");
      verifyButton.className = "btn gold";
      verifyButton.dataset.photo = verifyUrl;
      verifyButton.textContent = "📸 Фото с листиком";
      info.appendChild(verifyButton);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const approveBtn = document.createElement("button");
    approveBtn.className = "btn gold";
    approveBtn.dataset.action = "approve";
    approveBtn.dataset.id = user.id;
    approveBtn.textContent = "Одобрить";

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "btn";
    rejectBtn.dataset.action = "reject";
    rejectBtn.dataset.id = user.id;
    rejectBtn.textContent = "Отклонить";

    actions.append(approveBtn, rejectBtn);

    card.append(img, info, actions);
    return card;
  };

  const renderUsers = (users) => {
    list.innerHTML = "";
    users.forEach((user) => {
      list.appendChild(renderCard(user));
    });
  };

  const loadPending = async () => {
    setMessage("Загрузка…");
    const params = new URLSearchParams({
      page: state.page,
      limit: state.limit,
    });

    const data = await AdminApp.request(`/pending?${params.toString()}`);
    if (!data.ok || !Array.isArray(data.users) || data.users.length === 0) {
      setMessage("Нет анкет для модерации.");
      pageInfo.textContent = "Страница 1 из 1";
      state.pages = 1;
      return;
    }

    state.page = data.page || state.page;
    state.pages = data.pages || 1;
    pageInfo.textContent = `Страница ${state.page} из ${state.pages}`;
    renderUsers(data.users);
  };

  const handleListClick = async (event) => {
    const button = event.target.closest("button[data-action]");
    const photoTrigger = event.target.closest("[data-photo]");

    if (photoTrigger && photoTrigger.dataset.photo) {
      openPhoto(photoTrigger.dataset.photo);
      return;
    }

    if (!button) return;

    const userId = Number.parseInt(button.dataset.id, 10);
    if (!Number.isInteger(userId)) return;

    if (button.dataset.action === "approve") {
      if (!confirm("Одобрить анкету?")) return;
      const response = await AdminApp.request(`/approve/${userId}`, {
        method: "POST",
      });
      if (!response.ok) {
        alert(`Ошибка: ${response.error || "не удалось одобрить анкету"}`);
        return;
      }
      loadPending();
    } else if (button.dataset.action === "reject") {
      const reason = prompt("Введите причину отклонения:");
      if (!reason) return;
      const response = await AdminApp.request(`/reject/${userId}`, {
        method: "POST",
        body: { reason },
      });
      if (!response.ok) {
        alert(`Ошибка: ${response.error || "не удалось отклонить анкету"}`);
        return;
      }
      loadPending();
    }
  };

  prevBtn.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      loadPending();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (state.page < state.pages) {
      state.page += 1;
      loadPending();
    }
  });

  list.addEventListener("click", handleListClick);
  photoClose.addEventListener("click", closePhoto);
  photoModal.addEventListener("click", (event) => {
    if (event.target === photoModal) closePhoto();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && photoModal.classList.contains("open")) {
      closePhoto();
    }
  });

  AdminApp.ensureSession({
    redirectTo: "/admin/admin.html",
    onReady: () => {
      AdminApp.markActiveLink("/admin/admin-pending.html");
      AdminApp.toggleHidden(main, false);
      loadPending();
    },
  });
});
