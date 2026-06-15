const scrollButton = document.querySelector(".scroll-top");

function syncScrollButton() {
  if (!scrollButton) return;
  scrollButton.classList.toggle("visible", window.scrollY > 480);
}

if (scrollButton) {
  scrollButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

window.addEventListener("scroll", syncScrollButton, { passive: true });
syncScrollButton();
