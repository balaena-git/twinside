document.addEventListener("DOMContentLoaded", () => {
  const reasonEl = document.getElementById("reason");
  const editBtn = document.getElementById("editBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const loadStatus = async () => {
    try {
      const data = await PublicApp.request("/me/status");
      if (!data.ok) {
        window.location.href = "/public/auth";
        return;
      }

      if (data.status === "profile_pending") {
        window.location.href = "/public/pending";
        return;
      }
      if (data.status === "approved") {
        window.location.href = "/public";
        return;
      }

      reasonEl.textContent = data.reject_reason || "Без указания причины.";
    } catch (error) {
      console.error(error);
      reasonEl.textContent = "Ошибка загрузки причины.";
    }
  };

  editBtn.addEventListener("click", () => {
    window.location.href = "/public/profile-setup";
  });

  logoutBtn.addEventListener("click", async () => {
    await PublicApp.request("/auth/logout", { method: "POST" });
    window.location.href = "/public/auth";
  });

  loadStatus();
});
