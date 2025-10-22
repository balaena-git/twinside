document.addEventListener("DOMContentLoaded", () => {
  const resendButton = document.getElementById("resend-btn");
  if (!resendButton) return;

  resendButton.addEventListener("click", async () => {
    const email = prompt("Введите ваш email для повторной отправки:");
    if (!email) return;

    try {
      const data = await PublicApp.request("/auth/resend-confirmation", {
        method: "POST",
        credentials: "omit",
        body: { email },
      });

      if (data.ok) {
        alert("Письмо повторно отправлено. Проверьте почту!");
      } else {
        alert("Ошибка при повторной отправке.");
      }
    } catch (error) {
      alert("Ошибка при повторной отправке: " + error.message);
    }
  });
});
