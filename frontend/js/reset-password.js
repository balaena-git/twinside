document.addEventListener("DOMContentLoaded", () => {
  const forgotForm = document.getElementById("forgot-form");
  const resetForm = document.getElementById("reset-form");

  forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("forgot-email").value.trim();
    if (!email) return;

    try {
      await PublicApp.request("/auth/forgot", {
        method: "POST",
        credentials: "omit",
        body: { email },
      });
      alert("Если email существует — ссылка на сброс отправлена!");
    } catch (error) {
      alert("Ошибка отправки: " + error.message);
    }
  });

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = document.getElementById("reset-token").value.trim();
    const newPassword = document.getElementById("reset-password").value.trim();
    if (!token || !newPassword) return;

    try {
      const data = await PublicApp.request("/auth/reset", {
        method: "POST",
        credentials: "omit",
        body: { token, new_password: newPassword },
      });

      if (data.ok) {
        alert("Пароль успешно изменён! Теперь войдите с новым паролем.");
        window.location.href = "/public/auth";
      } else {
        alert("Ошибка: " + (data.error || "не удалось сбросить пароль"));
      }
    } catch (error) {
      alert("Ошибка: " + error.message);
    }
  });
});
