// === Универсальная вставка шапки и футера ===
async function insertComponent(file, css, place) {
  const res = await fetch(file);
  const html = await res.text();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = css;
  document.head.appendChild(link);

  // если нет page-wrapper — создать
  if (!document.querySelector(".page-wrapper")) {
    const wrapper = document.createElement("div");
    wrapper.className = "page-wrapper";
    const main = document.createElement("main");
    main.className = "main-content";
    while (document.body.firstChild) {
      main.appendChild(document.body.firstChild);
    }
    wrapper.appendChild(main);
    document.body.appendChild(wrapper);
  }

  const wrapper = document.querySelector(".page-wrapper");
  if (place === "top") wrapper.insertAdjacentHTML("afterbegin", html);
  else wrapper.insertAdjacentHTML("beforeend", html);
}

window.addEventListener("DOMContentLoaded", async () => {
  await insertComponent("components/header.html", "assets/header.css", "top");
  await insertComponent("components/footer.html", "assets/footer.css", "bottom");
});
