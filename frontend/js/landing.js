window.addEventListener("load", () => {
  const preloader = document.getElementById("preloader");
  if (!preloader) return;

  setTimeout(() => preloader.classList.add("hidden"), 1200);
  setTimeout(() => {
    preloader.style.display = "none";
  }, 1800);
});
