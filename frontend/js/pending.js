document.addEventListener("DOMContentLoaded", () => {
  const nickEl = document.getElementById("userNick");
  const avatarEl = document.getElementById("avatar");
  const logoutBtn = document.getElementById("logoutBtn");

  const showAvatar = (path) => {
    if (!path) return;
    avatarEl.src = PublicApp.buildUrl(path);
    avatarEl.style.display = "block";
  };

  const fetchStatus = async () => {
    try {
      const data = await PublicApp.request("/me/status");
      if (!data.ok) {
        window.location.href = "/public/auth";
        return;
      }

      nickEl.textContent = data.nick || "TwinSide";
      if (data.avatar_path) showAvatar(data.avatar_path);

      if (data.status === "approved") {
        window.location.href = "/public";
      } else if (data.status === "rejected") {
        window.location.href = "/public/rejected";
      }
    } catch (error) {
      console.error(error);
      alert("Ошибка загрузки статуса.");
    }
  };

  logoutBtn.addEventListener("click", async () => {
    await PublicApp.request("/auth/logout", {
      method: "POST",
    });
    window.location.href = "/public/auth";
  });

  fetchStatus();
});
