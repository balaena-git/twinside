(() => {
  const API_ROOT =
    window.ADMIN_API ||
    `${window.location.protocol}//${window.location.host}/api/admin`;

  const navEl = document.getElementById("nav");
  const logoutBtn = document.getElementById("logout");

  const toggleHidden = (el, hidden) => {
    if (!el) return;
    el.classList.toggle("is-hidden", hidden);
  };

  const markActiveLink = (href) => {
    if (!navEl) return;
    const links = navEl.querySelectorAll("a");
    links.forEach((link) => {
      const linkHref = link.getAttribute("href");
      const isActive =
        href === linkHref ||
        (href && linkHref && href.endsWith("/") && linkHref === href.slice(0, -1));
      if (isActive) link.classList.add("active");
      else link.classList.remove("active");
    });
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_ROOT}/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.warn("[admin] logout failed:", e);
    } finally {
      window.location.href = "/admin/admin.html";
    }
  };

  const bindLogout = () => {
    if (!logoutBtn) return;
    logoutBtn.addEventListener("click", handleLogout, { once: true });
  };

  const parseJson = async (res) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return await res.json();
      } catch (error) {
        return { ok: false, error: "invalid_json" };
      }
    }
    const fallback = res.statusText || `HTTP ${res.status}`;
    return { ok: false, error: fallback };
  };

  const checkSession = async () => {
    try {
      const res = await fetch(`${API_ROOT}/check-session`, {
        credentials: "include",
      });
      const data = await parseJson(res);
      if (data.ok) {
        toggleHidden(navEl, false);
        toggleHidden(logoutBtn, false);
      } else {
        toggleHidden(navEl, true);
        toggleHidden(logoutBtn, true);
      }
      return data;
    } catch (e) {
      console.warn("[admin] session check failed:", e);
      return { ok: false, error: e.message };
    }
  };

  const ensureSession = async ({ redirectTo, onReady } = {}) => {
    const session = await checkSession();
    if (session.ok) {
      if (typeof onReady === "function") onReady(session);
      return true;
    }
    if (redirectTo) {
      window.location.href = redirectTo;
    }
    return false;
  };

  const login = async ({ email, password }) => {
    try {
      const res = await fetch(`${API_ROOT}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      return await parseJson(res);
    } catch (e) {
      console.warn("[admin] login failed:", e);
      return { ok: false, error: e.message };
    }
  };

  const request = async (path, { method = "GET", body, headers } = {}) => {
    const init = {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    if (body !== undefined) {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    const res = await fetch(`${API_ROOT}${path}`, init);
    return parseJson(res);
  };

  const AdminApp = {
    API: API_ROOT,
    toggleHidden,
    markActiveLink,
    checkSession,
    ensureSession,
    login,
    request,
    handleLogout,
  };

  bindLogout();

  window.AdminApp = AdminApp;
})();
