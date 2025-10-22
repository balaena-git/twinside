document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  const tabs = document.querySelectorAll(".tabs button");
  const sections = document.querySelectorAll(".tab-content");
  const withdrawBody = document.querySelector("#withdraw-table tbody");
  const txBody = document.querySelector("#tx-table tbody");
  const txEmail = document.getElementById("tx-email");
  const txType = document.getElementById("tx-type");
  const txRefresh = document.getElementById("tx-refresh");
  const txExport = document.getElementById("tx-export");
  const txPagination = document.getElementById("tx-pagination");
  const manualForm = document.getElementById("manual-form");
  const premiumForm = document.getElementById("premium-form");

  const statFields = {
    balance: document.getElementById("stat-balance"),
    withdrawn: document.getElementById("stat-withdrawn"),
    pending: document.getElementById("stat-pending"),
    premium: document.getElementById("stat-premium"),
    tx: document.getElementById("stat-tx"),
    income: document.getElementById("stat-income"),
  };

  const setTableMessage = (tbody, message, colspan) => {
    tbody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="table-message">${message}</td>
      </tr>
    `;
  };

  const setStats = (stats = {}) => {
    statFields.balance.textContent =
      stats.balance !== undefined ? `${stats.balance} секскоинов` : "—";
    statFields.withdrawn.textContent = stats.withdrawn ?? "—";
    statFields.pending.textContent = stats.pending_withdraws ?? "—";
    statFields.premium.textContent = stats.premium_users ?? "—";
    statFields.tx.textContent = stats.tx_count ?? "—";
    statFields.income.textContent =
      stats.income_24h !== undefined ? `${stats.income_24h} секскоинов` : "—";
  };

  const loadStats = async () => {
    const response = await AdminApp.request("/stats/finance");
    if (!response.ok) {
      console.warn("Не удалось загрузить статистику:", response.error);
      return;
    }
    setStats(response.stats);
  };

  const loadWithdraws = async () => {
    setTableMessage(withdrawBody, "Загрузка…", 6);
    const data = await AdminApp.request("/withdraws");
    if (!data.ok || !Array.isArray(data.withdraws) || data.withdraws.length === 0) {
      setTableMessage(withdrawBody, "Нет заявок", 6);
      return;
    }

    withdrawBody.innerHTML = "";
    data.withdraws.forEach((item) => {
      const tr = document.createElement("tr");
      const userLabel = item.nick || item.email || `ID ${item.user_id}`;
      const actions =
        item.status === "pending"
          ? `
              <button class="btn gold" data-action="approve" data-id="${item.id}">✅</button>
              <button class="btn" data-action="reject" data-id="${item.id}">❌</button>
            `
          : "—";

      tr.innerHTML = `
        <td>${item.id}</td>
        <td>${userLabel}</td>
        <td>${item.amount}</td>
        <td>${item.status}</td>
        <td>${item.tx_hash || "—"}</td>
        <td>${actions}</td>
      `;
      withdrawBody.appendChild(tr);
    });
  };

  let txPage = 1;
  const buildTxQuery = () => {
    const params = new URLSearchParams();
    if (txEmail.value.trim()) params.set("email", txEmail.value.trim());
    if (txType.value) params.set("type", txType.value);
    params.set("page", String(txPage));
    params.set("limit", "50");
    return params.toString();
  };

  const renderTxPagination = (pg) => {
    txPagination.innerHTML = "";
    if (!pg || pg.totalPages <= 1) return;
    for (let p = 1; p <= pg.totalPages; p += 1) {
      const b = document.createElement("button");
      b.textContent = p;
      b.classList.toggle("active", p === pg.page);
      b.addEventListener("click", () => { txPage = p; loadTransactions(); });
      txPagination.appendChild(b);
    }
  };

  const loadTransactions = async () => {
    setTableMessage(txBody, "Загрузка…", 6);
    const query = buildTxQuery();
    const data = await AdminApp.request(`/transactions?${query}`);
    if (!data.ok || !Array.isArray(data.list) || data.list.length === 0) {
      setTableMessage(txBody, "Нет транзакций", 6);
      renderTxPagination({ totalPages: 1, page: 1 });
      return;
    }

    txBody.innerHTML = "";
    data.list.forEach((tx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${tx.id}</td>
        <td>${tx.email || "—"}</td>
        <td>${tx.type}</td>
        <td>${tx.amount}</td>
        <td>${tx.description || "—"}</td>
        <td>${tx.created_at}</td>
      `;
      txBody.appendChild(tr);
    });
    renderTxPagination(data.pagination);
  };

  txRefresh?.addEventListener("click", () => { txPage = 1; loadTransactions(); });
  txExport?.addEventListener("click", (e) => {
    e.preventDefault();
    const base = `${AdminApp.API}/transactions.csv`;
    txExport.href = `${base}?${buildTxQuery()}`;
    window.open(txExport.href, "_blank");
  });

  const handleWithdrawAction = async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = Number.parseInt(button.dataset.id, 10);
    if (!Number.isInteger(id)) return;

    if (button.dataset.action === "approve") {
      const txHash = prompt("Введите TX hash:");
      if (!txHash) return;

      await AdminApp.request(`/withdraw/${id}`, {
        method: "PATCH",
        body: { tx_hash: txHash },
      });
    } else if (button.dataset.action === "reject") {
      const reason = prompt("Причина отклонения:");
      if (!reason) return;

      await AdminApp.request(`/withdraw/${id}`, {
        method: "PATCH",
        body: { reject: true, reason },
      });
    }

    loadWithdraws();
    loadStats();
  };

  const switchTab = (name) => {
    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === name);
    });
    sections.forEach((section) => {
      section.classList.toggle("active", section.id === name);
    });

    if (name === "withdraws") loadWithdraws();
    if (name === "history") loadTransactions();
  };

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  withdrawBody.addEventListener("click", handleWithdrawAction);

  manualForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("manual-email").value.trim();
    const amountValue = Number.parseInt(
      document.getElementById("manual-amount").value,
      10
    );
    const description = document.getElementById("manual-desc").value.trim();

    if (!email || Number.isNaN(amountValue)) {
      alert("Введите корректные email и сумму");
      return;
    }

    const response = await AdminApp.request("/manual-credit", {
      method: "POST",
      body: { email, amount: amountValue, description },
    });

    if (response.ok) {
      alert("✅ Начисление выполнено");
      manualForm.reset();
      loadStats();
    } else {
      alert(`Ошибка: ${response.error || "не удалось начислить средства"}`);
    }
  });

  premiumForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const userId = Number.parseInt(
      document.getElementById("premium-id").value,
      10
    );
    const days = Number.parseInt(
      document.getElementById("premium-days").value,
      10
    );

    if (!Number.isInteger(userId) || !Number.isInteger(days) || days <= 0) {
      alert("Введите корректные ID и количество дней");
      return;
    }

    const response = await AdminApp.request("/premium", {
      method: "POST",
      body: { user_id: userId, days },
    });

    if (response.ok) {
      alert(`✅ Премиум продлён до ${response.until || "указанной даты"}`);
      premiumForm.reset();
      document.getElementById("premium-days").value = "30";
      loadStats();
    } else {
      alert(`Ошибка: ${response.error || "не удалось выдать премиум"}`);
    }
  });

  AdminApp.ensureSession({
    redirectTo: "/admin/admin.html",
    onReady: () => {
      AdminApp.markActiveLink("/admin/admin-finance.html");
      AdminApp.toggleHidden(main, false);
      loadStats();
      loadWithdraws();
    },
  });
});
