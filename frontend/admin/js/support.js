document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  const threadsBox = document.getElementById("threads");
  const searchBox = document.getElementById("searchBox");
  const statusFilter = document.getElementById("statusFilter");
  const searchBtn = document.getElementById("searchBtn");
  const messagesBox = document.getElementById("messages");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const filePicker = document.getElementById("filePicker");
  const quickReplies = document.getElementById("quickReplies");

  const chatNick = document.getElementById("chatNick");
  const chatMeta = document.getElementById("chatMeta");
  const chatAva = document.getElementById("chatAva");

  const u_id = document.getElementById("u_id");
  const u_nick = document.getElementById("u_nick");
  const u_email = document.getElementById("u_email");
  const u_status = document.getElementById("u_status");
  const u_balance = document.getElementById("u_balance");
  const u_city = document.getElementById("u_city");
  const u_premium = document.getElementById("u_premium");

  const pinBtn = document.getElementById("pinBtn");
  const resolveBtn = document.getElementById("resolveBtn");
  const openUserBtn = document.getElementById("openUserBtn");

  const imgModal = document.getElementById("imgModal");
  const imgModalPic = document.getElementById("imgModalPic");

  const backendBase = AdminApp.API.replace(/\/api\/admin$/, "");

  const state = {
    threads: [],
    selected: null,
    pollTimer: null,
  };

  const normalizePath = (path) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/uploads")) return `${backendBase}${path}`;
    if (path.startsWith("uploads")) return `${backendBase}/${path}`;
    return `${backendBase}/uploads/${path.replace(/^\/+/, "")}`;
  };

  const renderThreadRow = (thread) => {
    const row = document.createElement("div");
    row.className = "thread";
    row.dataset.userId = thread.user_id;

    if (state.selected?.user_id === thread.user_id) {
      row.classList.add("active");
    }

    const avatar = document.createElement("img");
    avatar.className = "ava";
    avatar.src = thread.avatar_path ? normalizePath(thread.avatar_path) : "/assets/icons/user.svg";
    avatar.alt = "avatar";
    avatar.onerror = () => {
      avatar.onerror = null;
      avatar.src = "/assets/icons/user.svg";
    };

    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("h4");
    name.textContent = thread.nick || `user#${thread.user_id}`;
    const last = document.createElement("p");
    last.textContent = thread.last_message || "Нет сообщений";
    meta.append(name, last);

    const badges = document.createElement("div");
    badges.className = "badges";
    if (thread.unread_count > 0) {
      const badge = document.createElement("span");
      badge.className = "badge gold";
      badge.textContent = thread.unread_count;
      badges.appendChild(badge);
    }
    if (thread.pinned) {
      const badge = document.createElement("span");
      badge.className = "badge pin";
      badge.textContent = "PIN";
      badges.appendChild(badge);
    }
    if (thread.status === "resolved") {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "РЕШЕНО";
      badges.appendChild(badge);
    }

    row.append(avatar, meta, badges);
    row.addEventListener("click", () => selectThread(thread));
    return row;
  };

  const applyFilters = () => {
    const query = searchBox.value.trim().toLowerCase();
    const filter = statusFilter.value;

    const filtered = state.threads.filter((thread) => {
      const matchesSearch =
        !query ||
        (thread.nick && thread.nick.toLowerCase().includes(query)) ||
        (thread.email && thread.email.toLowerCase().includes(query)) ||
        String(thread.user_id).includes(query);

      if (!matchesSearch) return false;

      if (filter === "all") return true;
      if (filter === "active") return thread.status !== "resolved";
      if (filter === "resolved") return thread.status === "resolved";
      if (filter === "unread") return thread.unread_count > 0;
      return true;
    });

    renderThreads(filtered);
  };

  const renderThreads = (threads) => {
    if (!threads.length) {
      threadsBox.innerHTML = `<div class="state-message">Диалогов не найдено</div>`;
      return;
    }

    threadsBox.innerHTML = "";
    threads.forEach((thread) => {
      threadsBox.appendChild(renderThreadRow(thread));
    });
  };

  const updateInfoPanel = (thread) => {
    chatNick.textContent = thread.nick || `user#${thread.user_id}`;
    chatMeta.textContent = `${thread.email || "—"} • ${thread.city || "—"} • ${thread.gender || "—"}`;
    chatAva.src = thread.avatar_path ? normalizePath(thread.avatar_path) : "/assets/icons/user.svg";
    chatAva.onerror = () => {
      chatAva.onerror = null;
      chatAva.src = "/assets/icons/user.svg";
    };

    u_id.textContent = thread.user_id ?? "—";
    u_nick.textContent = thread.nick ?? "—";
    u_email.textContent = thread.email ?? "—";
    u_status.textContent = thread.user_status ?? "—";
    u_balance.textContent =
      typeof thread.balance === "number" ? String(thread.balance) : "—";
    u_city.textContent = thread.city ?? "—";
    u_premium.textContent = thread.premium ? "Да" : "Нет";

    pinBtn.dataset.pinned = thread.pinned ? "1" : "0";
    pinBtn.textContent = thread.pinned ? "📌 Открепить" : "📌 Закрепить";

    const resolved = thread.status === "resolved";
    resolveBtn.dataset.resolved = resolved ? "1" : "0";
    resolveBtn.textContent = resolved ? "↩️ Снова открыть" : "✅ Решено";
  };

  const setMessagesPlaceholder = (text, variant = "") => {
    const classes = ["state-message", variant].filter(Boolean).join(" ");
    messagesBox.innerHTML = `<div class="${classes}">${text}</div>`;
  };

  const renderMessages = (messages) => {
    if (!messages.length) {
      setMessagesPlaceholder("Сообщений нет");
      return;
    }

    messagesBox.innerHTML = "";
    messages.forEach((msg) => {
      const row = document.createElement("div");
      row.className = "msg" + (msg.sender === "admin" ? " me" : "");

      const bubble = document.createElement("div");
      bubble.className = "bubble";

      if (msg.text) {
        const text = document.createElement("div");
        text.textContent = msg.text;
        bubble.appendChild(text);
      }

      if (msg.image_url) {
        const img = document.createElement("img");
        img.src = normalizePath(msg.image_url);
        img.alt = "attachment";
        img.addEventListener("click", () => openImage(img.src));
        bubble.appendChild(img);
      }

      const time = document.createElement("time");
      const createdAt = msg.created_at ? new Date(msg.created_at) : null;
      time.textContent = createdAt
        ? createdAt.toLocaleString("ru-RU")
        : "";

      row.append(bubble, time);
      messagesBox.appendChild(row);
    });

    messagesBox.scrollTop = messagesBox.scrollHeight;
  };

  const loadThreads = async () => {
    threadsBox.innerHTML = `<div class="state-message">Загрузка диалогов...</div>`;
    const response = await AdminApp.request("/support/threads");
    if (!response.ok || !Array.isArray(response.threads)) {
      threadsBox.innerHTML = `<div class="state-message error">Ошибка загрузки: ${
        response.error || "server_error"
      }</div>`;
      return;
    }

    const previousId = state.selected?.user_id;
    state.threads = response.threads;

    if (previousId) {
      const updatedThread = state.threads.find((t) => t.user_id === previousId);
      if (updatedThread) {
        state.selected = updatedThread;
        updateInfoPanel(updatedThread);
      } else {
        state.selected = null;
        stopPolling();
      }
    }

    applyFilters();
  };

  const loadMessages = async () => {
    if (!state.selected) {
      setMessagesPlaceholder("Выберите диалог слева, чтобы начать");
      return;
    }

    setMessagesPlaceholder("Загрузка…");
    const response = await AdminApp.request(
      `/support/thread/${state.selected.user_id}/messages`
    );
    if (!response.ok || !Array.isArray(response.messages)) {
      setMessagesPlaceholder(
        `Ошибка: ${response.error || "не удалось загрузить сообщения"}`,
        "error"
      );
      return;
    }
    renderMessages(response.messages);
  };

  const startPolling = () => {
    stopPolling();
    state.pollTimer = setInterval(loadMessages, 5000);
  };

  const stopPolling = () => {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  };

  const selectThread = async (thread) => {
    state.selected = thread;
    updateInfoPanel(thread);
    await loadMessages();
    startPolling();
    applyFilters();
  };

  const openImage = (src) => {
    imgModalPic.src = src;
    imgModal.classList.add("open");
  };

  const closeImage = () => {
    imgModalPic.src = "";
    imgModal.classList.remove("open");
  };

  const handleSend = async () => {
    if (!state.selected) return;

    const text = msgInput.value.trim();
    const file = filePicker.files[0];

    if (!text && !file) return;

    try {
      if (file) {
        const formData = new FormData();
        if (text) formData.append("text", text);
        formData.append("file", file);

        const res = await fetch(
          `${AdminApp.API}/support/thread/${state.selected.user_id}/upload`,
          { method: "POST", credentials: "include", body: formData }
        );
        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.error || "upload_failed");
        }
        filePicker.value = "";
      } else if (text) {
        const data = await AdminApp.request(
          `/support/thread/${state.selected.user_id}/message`,
          { method: "POST", body: { text } }
        );
        if (!data.ok) {
          throw new Error(data.error || "send_failed");
        }
      }

      msgInput.value = "";
      await loadMessages();
      loadThreads();
    } catch (error) {
      alert(`Ошибка отправки: ${error.message}`);
    }
  };

  const togglePin = async () => {
    if (!state.selected) return;
    const current = pinBtn.dataset.pinned === "1";
    const next = !current;

    const response = await AdminApp.request(
      `/support/thread/${state.selected.user_id}`,
      {
        method: "PATCH",
        body: { pinned: next },
      }
    );

    if (response.ok) {
      pinBtn.dataset.pinned = next ? "1" : "0";
      pinBtn.textContent = next ? "📌 Открепить" : "📌 Закрепить";
      loadThreads();
    }
  };

  const toggleResolved = async () => {
    if (!state.selected) return;
    const resolved = resolveBtn.dataset.resolved === "1";
    const nextStatus = resolved ? "active" : "resolved";

    const response = await AdminApp.request(
      `/support/thread/${state.selected.user_id}`,
      {
        method: "PATCH",
        body: { status: nextStatus },
      }
    );

    if (response.ok) {
      resolveBtn.dataset.resolved = nextStatus === "resolved" ? "1" : "0";
      resolveBtn.textContent =
        nextStatus === "resolved" ? "↩️ Снова открыть" : "✅ Решено";
      loadThreads();
    }
  };

  pinBtn.addEventListener("click", togglePin);
  resolveBtn.addEventListener("click", toggleResolved);
  openUserBtn.addEventListener("click", () => {
    if (!state.selected) return;
    const query = encodeURIComponent(
      state.selected.nick ||
        state.selected.email ||
        String(state.selected.user_id)
    );
    window.open(`/admin/admin-users.html?search=${query}`, "_blank");
  });

  sendBtn.addEventListener("click", handleSend);
  msgInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  });

  quickReplies.addEventListener("click", (event) => {
    if (event.target.tagName === "BUTTON") {
      msgInput.value = event.target.textContent;
      msgInput.focus();
    }
  });

  searchBtn.addEventListener("click", applyFilters);
  statusFilter.addEventListener("change", applyFilters);

  imgModal.addEventListener("click", (event) => {
    if (event.target === imgModal) closeImage();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && imgModal.classList.contains("open")) {
      closeImage();
    }
  });

  window.addEventListener("beforeunload", stopPolling);

  AdminApp.ensureSession({
    redirectTo: "/admin/admin.html",
    onReady: () => {
      AdminApp.markActiveLink("/admin/admin-support.html");
      AdminApp.toggleHidden(main, false);
      loadThreads();
    },
  });
});
