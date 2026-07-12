function appName(i, n) {
  return typeof i === "string" ? i : (i && i.name) || "App " + (n + 1);
}

function setStatus(el, msg, err) {
  el.textContent = msg || "";
  el.className = err ? "status error" : "status";
}
function esc(v) {
  return String(v === undefined || v === null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
