document.addEventListener("DOMContentLoaded", () => {
  const avatarInput = document.getElementById("avatar");
  const verifyInput = document.getElementById("verify");
  const avatarPreview = document.getElementById("avatar-preview");
  const verifyPreview = document.getElementById("verify-preview");
  const hint = document.getElementById("verify-hint");
  const lookingGroup = document.getElementById("looking-group");
  const interestsGroup = document.getElementById("interests-group");
  const form = document.getElementById("profile-form");
  const formBox = document.getElementById("form-box");
  const successBox = document.getElementById("success-box");

  const preview = (input, previewBox) => {
    previewBox.innerHTML = "";
    const file = input.files?.[0];
    if (!file) return;
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    previewBox.appendChild(img);
  };

  avatarInput.addEventListener("change", () =>
    preview(avatarInput, avatarPreview)
  );
  verifyInput.addEventListener("change", () =>
    preview(verifyInput, verifyPreview)
  );

  const updateHint = () => {
    const now = new Date();
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const str = now.toLocaleString("ru-RU", options);
    hint.innerHTML = `🗓️ Напишите на листике: <b>TwinSide — ${str}</b>`;
  };
  updateHint();

  lookingGroup.addEventListener("click", (event) => {
    if (!event.target.classList.contains("choice-btn")) return;
    event.target.classList.toggle("active");
  });

  const interests = [
    "Путешествия",
    "Музыка",
    "Фильмы",
    "Йога",
    "BDSM",
    "Вечеринки",
    "Флирт",
    "Романтика",
    "Фитнес",
    "Игры",
    "Массаж",
    "Ролевые игры",
    "Фото",
    "Кальян",
    "Кино",
    "Коктейли",
    "Пляж",
    "Косплей",
  ];

  interests.forEach((item) => {
    const btn = document.createElement("div");
    btn.className = "choice-btn";
    btn.dataset.value = item;
    btn.textContent = item;
    interestsGroup.appendChild(btn);
  });

  interestsGroup.addEventListener("click", (event) => {
    if (!event.target.classList.contains("choice-btn")) return;
    event.target.classList.toggle("active");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedLooking = [
      ...lookingGroup.querySelectorAll(".choice-btn.active"),
    ].map((btn) => btn.dataset.value);

    const selectedInterests = [
      ...interestsGroup.querySelectorAll(".choice-btn.active"),
    ].map((btn) => btn.dataset.value);

    const formData = new FormData();
    formData.append("avatar", avatarInput.files[0]);
    formData.append("verify_photo", verifyInput.files[0]);
    formData.append("about", document.getElementById("about").value);
    formData.append("looking_for", selectedLooking.join(","));
    formData.append("interests", selectedInterests.join(","));

    try {
      const data = await PublicApp.request("/profile/setup", {
        method: "POST",
        body: formData,
      });

      if (data.ok) {
        formBox.classList.add("profile-hidden");
        successBox.classList.remove("profile-hidden");
      } else {
        alert("Ошибка: " + (data.error || "не удалось отправить анкету"));
      }
    } catch (error) {
      alert("Ошибка отправки: " + error.message);
    }
  });
});
