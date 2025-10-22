// === Универсальная вставка шапки и футера ===
const ensureStylesheet = (href) => {
  if (!href) return;
  const exists = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
  if (exists) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
};

const shouldSkipChrome = () => {
  const body = document.body;
  if (!body) return true;
  return body.dataset.noChrome === "true";
};

async function insertComponent(file, css, place) {
  if (shouldSkipChrome()) return;

  try {
    const res = await fetch(file);
    if (!res.ok) return;
    const html = await res.text();
    ensureStylesheet(css);

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
    if (!wrapper) return;

    const fragment = document.createElement("div");
    fragment.innerHTML = html;
    const element = fragment.firstElementChild;
    if (!element) return;

    if (element.id && wrapper.querySelector(`#${element.id}`)) return;

    if (place === "top") {
      wrapper.insertAdjacentElement("afterbegin", element);
    } else {
      wrapper.insertAdjacentElement("beforeend", element);
    }
  } catch (error) {
    console.warn("[layout] component load failed:", file, error);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await insertComponent("/components/header.html", "/assets/header.css", "top");
  await insertComponent("/components/footer.html", "/assets/footer.css", "bottom");
});
