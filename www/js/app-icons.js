function iconText(icon) {
  let map = {
    time: "T",
    date: "D",
    temperature: "℃",
    humidity: "%",
    battery: "B",
    bilibili: "B",
  };
  return (
    map[icon] ||
    String(icon || "A")
      .slice(0, 1)
      .toUpperCase()
  );
}
function safeIconName(name) {
  name = String(name || "").trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(name) ? name : "";
}

function iconUrlCandidates(icon, base) {
  icon = String(icon || "").trim();
  if (!icon) return [];
  if (/^https?:\/\//.test(icon) || icon.includes("/"))
    return [resolveStoreUrl(icon, base)];
  let safe = safeIconName(icon);
  if (!safe) return [];
  return [
    "https://developer.lametric.com/content/apps/icon_thumbs/" + safe + ".png",
    "https://developer.lametric.com/content/apps/icon_thumbs/" + safe + ".gif",
  ];
}

async function uploadIconBlob(icon, blob, type) {
  let ext = type && type.includes("gif") ? "gif" : "jpg",
    form = new FormData();
  form.append("file", blob, "ICONS/" + icon + "." + ext);
  let r = await fetch("/edit", { method: "POST", body: form });
  if (!r.ok) throw Error("icon upload failed");
}

async function installIconForApp(payload, item, base) {
  let icon = safeIconName((payload && payload.icon) || item.icon);
  if (!icon) return;
  for (let url of iconUrlCandidates(
    (payload && payload.icon) || item.icon,
    base,
  )) {
    try {
      let r = await rawFetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      let type = (r.headers.get("content-type") || "").toLowerCase();
      let blob = await r.blob();
      if (type.includes("gif")) {
        await uploadIconBlob(icon, blob, type);
        return;
      }
      let img = await createImageBitmap(blob),
        canvas = document.createElement("canvas");
      canvas.width = 8;
      canvas.height = 8;
      let ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 8, 8);
      let jpg = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.9),
      );
      if (jpg) {
        await uploadIconBlob(icon, jpg, "image/jpeg");
        return;
      }
    } catch (e) {
      console.warn("Icon install failed", e);
    }
  }
}
function setIcon(el, icon, base) {
  icon = String(icon || "");
  el.className = "app-icon";
  el.textContent = iconText(icon);
  if (!icon || nativeIconNames.has(icon)) return;
  let urls = [
    "/ICONS/" + encodeURIComponent(icon) + ".jpg",
    "/ICONS/" + encodeURIComponent(icon) + ".gif",
  ];
  if (base) urls = urls.concat(iconUrlCandidates(icon, base));
  urls = urls.filter((u) => !missingIconUrls.has(u));
  if (!urls.length) return;
  let img = new Image(),
    i = 0;
  img.onload = () => {
    el.textContent = "";
    el.appendChild(img);
  };
  img.onerror = () => {
    missingIconUrls.add(urls[i]);
    if (++i < urls.length) img.src = urls[i];
  };
  img.src = urls[i];
}
