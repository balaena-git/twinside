document.addEventListener("DOMContentLoaded", () => {
  const loginBox = document.getElementById("login-box");
  const dashboard = document.getElementById("dashboard");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout");
  const nav = document.getElementById("nav");
  const errorEl = document.getElementById("login-error");

  const setVisible = (element, visible) => {
    AdminApp.toggleHidden(element, !visible);
  };

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "—";
  };

  const showDashboard = () => {
    setVisible(loginBox, false);
    setVisible(dashboard, true);
    setVisible(logoutBtn, true);
    setVisible(nav, true);
    loadDashboard();
  };

  const loadDashboard = async () => {
    const data = await AdminApp.request("/dashboard");
    if (!data.ok) {
      console.error("Ошибка загрузки дашборда:", data.error);
      return;
    }
    const { users = {}, economy = {}, promos = "—", complaints = "—" } = data;

    setText("totalUsers", users.total ?? "—");
    setText("onlineUsers", users.online ?? "—");
    setText("newToday", users.newToday ?? "—");
    setText("activeUsers", users.active ?? "—");
    setText("pendingProfiles", users.pending ?? "—");
    setText("rejectedProfiles", users.rejected ?? "—");
    const balance = economy.totalBalance;
    setText(
      "totalBalance",
      typeof balance === "number" ? `${balance} секскоинов` : balance ?? "—"
    );
    const income = economy.income24h;
    setText(
      "income",
      typeof income === "number" ? `${income} секскоинов` : income ?? "—"
    );
    setText("complaints", complaints ?? "—");
    setText("promos", promos ?? "—");
  };

  const handleLogin = async () => {
    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-pass").value.trim();
    errorEl.textContent = "";
    const response = await AdminApp.login({ email, password });
    if (response.ok) {
      showDashboard();
    } else {
      errorEl.textContent = response.error || "Ошибка входа";
    }
  };

  loginBtn?.addEventListener("click", handleLogin);

  AdminApp.markActiveLink("/admin/admin.html");
  AdminApp.checkSession().then((session) => {
    if (session.ok) showDashboard();
  });
});
