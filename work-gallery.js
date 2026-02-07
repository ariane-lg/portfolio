(() => {
  document.addEventListener("click", (event) => {
    const link =
      event.target instanceof Element ? event.target.closest("a.tile") : null;
    if (!link) {
      return;
    }
    if (link.getAttribute("href") === "#") {
      event.preventDefault();
    }
  });
})();
