document.addEventListener("DOMContentLoaded", () => {
  const ageModal = document.getElementById("ageModal");
  const authBox = document.getElementById("authBox");
  const yesBtn = document.getElementById("yesBtn");
  const noBtn = document.getElementById("noBtn");

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  const genderSelect = document.getElementById("gender");
  const ageInput = document.getElementById("age");
  const pairAges = document.getElementById("pair-ages");

  const cityInput = document.getElementById("city");
  const cityList = document.getElementById("city-list");

  const agree18 = document.getElementById("agree18");
  const agreeRules = document.getElementById("agreeRules");
  const registerBtn = document.getElementById("registerBtn");

  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");

  const cities = [
    "Киев",
    "Харьков",
    "Одесса",
    "Днепр",
    "Львов",
    "Запорожье",
    "Винница",
    "Полтава",
    "Черкассы",
    "Чернигов",
    "Житомир",
    "Сумы",
    "Херсон",
    "Николаев",
    "Ивано-Франковск",
  ];

  const showAuthContent = () => {
    ageModal.classList.add("is-hidden");
    authBox.classList.remove("is-hidden");
  };

  yesBtn.addEventListener("click", () => {
    localStorage.setItem("age_confirmed", "1");
    showAuthContent();
  });

  noBtn.addEventListener("click", () => {
    alert("Доступ запрещён несовершеннолетним.");
    window.close();
  });

  if (localStorage.getItem("age_confirmed") === "1") {
    showAuthContent();
  }

  const activateForm = (target) => {
    const isLogin = target === "login";
    loginForm.classList.toggle("active", isLogin);
    tabLogin.classList.toggle("active", isLogin);
    registerForm.classList.toggle("active", !isLogin);
    tabRegister.classList.toggle("active", !isLogin);
  };

  tabLogin.addEventListener("click", () => activateForm("login"));
  tabRegister.addEventListener("click", () => activateForm("register"));

  const togglePairFields = () => {
    const isPair = genderSelect.value === "pair";
    ageInput.classList.toggle("is-hidden", isPair);
    pairAges.classList.toggle("active", isPair);
  };
  genderSelect.addEventListener("change", togglePairFields);
  togglePairFields();

  cityInput.addEventListener("input", () => {
    const query = cityInput.value.trim().toLowerCase();
    cityList.innerHTML = "";
    cities
      .filter((city) => city.toLowerCase().includes(query))
      .forEach((city) => {
        const option = document.createElement("option");
        option.value = city;
        cityList.appendChild(option);
      });
  });

  const updateRegisterState = () => {
    registerBtn.disabled = !(agree18.checked && agreeRules.checked);
  };
  agree18.addEventListener("change", updateRegisterState);
  agreeRules.addEventListener("change", updateRegisterState);
  updateRegisterState();

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const data = await PublicApp.request("/auth/login", {
        method: "POST",
        body: {
          email: loginEmail.value,
          password: loginPassword.value,
        },
      });
      if (!data.ok) {
        alert(`Ошибка входа: ${data.error || "неизвестная"}`);
        return;
      }

      switch (data.status) {
        case "email_confirmed":
          window.location.href = "/public/profile-setup";
          break;
        case "profile_pending":
          window.location.href = "/public/pending";
          break;
        case "requires_payment":
          window.location.href = "/app/feed";
          break;
        case "approved":
          window.location.href = "/app/feed";
          break;
        default:
          alert(`Неизвестный статус: ${data.status}`);
      }
    } catch (error) {
      alert(`Ошибка входа: ${error.message}`);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      email: document.getElementById("reg-email").value,
      password: document.getElementById("reg-password").value,
      nick: document.getElementById("nick").value,
      gender: genderSelect.value,
      city: cityInput.value,
      age: ageInput.value,
    };

    if (genderSelect.value === "pair") {
      payload.male_age = document.getElementById("male_age").value;
      payload.female_age = document.getElementById("female_age").value;
    }

    try {
      const data = await PublicApp.request("/auth/register", {
        method: "POST",
        body: payload,
      });
      if (data.ok) {
        window.location.href = "/public/check-email";
      } else {
        alert(`Ошибка регистрации: ${data.error || JSON.stringify(data)}`);
      }
    } catch (error) {
      alert(`Ошибка регистрации: ${error.message}`);
    }
  });
});
