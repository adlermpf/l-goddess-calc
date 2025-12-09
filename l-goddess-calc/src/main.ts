import { mountApp } from "./ui/App";
import "./styles.css";

mountApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/src/sw.js").catch(() => {});
  });
}

// optional: refit on resize
window.addEventListener("resize", () => {
  const root = document.getElementById("app");
  if (root) {
    const contentHeight = root.scrollHeight;
    const scale = Math.min(1, window.innerHeight / contentHeight);
    root.style.setProperty("--fit-scale", String(scale));
  }
});
