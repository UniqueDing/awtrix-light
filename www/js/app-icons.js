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

const MAX_ANIMATION_ASSET_BYTES = 128 * 1024;
const MAX_ANIMATION_SNAPSHOT_BYTES = 256 * 1024;

function animationAssetUrl(asset, manifestUrl, icon) {
  let value = String(asset || ""),
    id = String(icon || ""),
    manifestValue = String(manifestUrl || "");
  if (
    safeIconName(id) !== id ||
    value !== "./" + id + ".gif" ||
    /[\\?#]/.test(manifestValue) ||
    /%(?:2e|2f|5c)/i.test(manifestValue)
  )
    throw Error("invalid animation asset URL");
  let manifest = new URL(manifestValue, location.href),
    manifestPath =
      "/apps/animation/" + encodeURIComponent(id) + ".json",
    expected = new URL("./" + encodeURIComponent(id) + ".gif", manifest),
    resolved = new URL(value, manifest);
  if (
    !/^https?:$/.test(manifest.protocol) ||
    manifest.username ||
    manifest.password ||
    manifest.search ||
    manifest.hash ||
    !manifest.pathname.endsWith(manifestPath) ||
    resolved.origin !== manifest.origin ||
    resolved.username ||
    resolved.password ||
    resolved.search ||
    resolved.hash ||
    resolved.href !== expected.href
  )
    throw Error("invalid animation asset URL");
  return expected.href;
}

function validateAnimationResponseUrl(response, expectedUrl) {
  if (!response.url || new URL(response.url, location.href).href !== expectedUrl)
    throw Error("invalid animation asset redirect");
}

async function validateAnimationGif(response) {
  let length = response.headers && response.headers.get("content-length");
  if (length !== null && length !== undefined && length !== "") {
    if (!/^\d+$/.test(length) || Number(length) > MAX_ANIMATION_ASSET_BYTES)
      throw Error("animation GIF is too large");
  }
  let blob = await response.blob();
  if (blob.size > MAX_ANIMATION_ASSET_BYTES)
    throw Error("animation GIF is too large");
  let bytes = new Uint8Array(await blob.arrayBuffer()),
    signature = String.fromCharCode.apply(null, bytes.slice(0, 6)),
    width = bytes.length >= 10 ? bytes[6] | (bytes[7] << 8) : 0,
    height = bytes.length >= 10 ? bytes[8] | (bytes[9] << 8) : 0;
  if (
    (signature !== "GIF87a" && signature !== "GIF89a") ||
    !width ||
    !height ||
    width !== 32 ||
    height !== 8 ||
    bytes[bytes.length - 1] !== 0x3b
  )
    throw Error("invalid animation GIF");
  return blob;
}

function animationIconPath(icon) {
  return "/ICONS/" + encodeURIComponent(icon) + ".gif";
}

function animationJpgPath(icon) {
  return "/ICONS/" + encodeURIComponent(icon) + ".jpg";
}

function isGifBackedAnimation(payload, name) {
  return !!(
    payload &&
    payload.type === "animation" &&
    !payload.animation &&
    payload.icon === name &&
    payload.duration !== undefined
  );
}

async function deleteAnimationIcon(icon) {
  await deleteAnimationAsset(animationIconPath(icon));
}

async function deleteAnimationAsset(path) {
  let response = await fetch("/edit?path=" + encodeURIComponent(path), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404)
    throw Error("animation icon cleanup failed");
}

async function snapshotAnimationAsset(path, type, remainingBytes) {
  let response = await fetch(path, { cache: "no-store", redirect: "error" });
  if (response.status === 404) return { path, type, existed: false, blob: null };
  if (!response.ok) throw Error("animation icon snapshot failed");
  if (response.url) {
    let responseUrl = new URL(response.url, location.href),
      expectedUrl = new URL(path, location.href);
    if (
      responseUrl.origin !== location.origin ||
      responseUrl.href !== expectedUrl.href
    )
      throw Error("invalid animation icon snapshot response");
  }
  let length = response.headers && response.headers.get("content-length");
  if (length !== null && length !== undefined && length !== "") {
    if (!/^\d+$/.test(length) || Number(length) > remainingBytes)
      throw Error("animation icon snapshot is too large");
  }
  let blob = await response.blob();
  if (blob.size > remainingBytes)
    throw Error("animation icon snapshot is too large");
  return { path, type, existed: true, blob };
}

async function snapshotAnimationAssets(icon) {
  let snapshots = [],
    remaining = MAX_ANIMATION_SNAPSHOT_BYTES;
  for (let asset of [
    [animationIconPath(icon), "image/gif"],
    [animationJpgPath(icon), "image/jpeg"],
  ]) {
    let snapshot = await snapshotAnimationAsset(asset[0], asset[1], remaining);
    snapshots.push(snapshot);
    if (snapshot.existed) remaining -= snapshot.blob.size;
  }
  return { icon, snapshots };
}

async function restoreAnimationAssets(transaction) {
  for (let snapshot of transaction.snapshots) {
    try {
      if (snapshot.existed)
        await uploadIconBlob(transaction.icon, snapshot.blob, snapshot.type);
      else await deleteAnimationAsset(snapshot.path);
    } catch (rollbackError) {
      console.warn("Animation asset rollback failed", rollbackError);
    }
  }
}

async function installAnimationAsset(payload, item, manifestUrl, installName) {
  if (!payload || payload.type !== "animation" || !payload.animationAsset)
    return null;
  let icon = safeIconName((item && item.id) || installName);
  if (!icon) throw Error("invalid animation asset name");
  let url = animationAssetUrl(payload.animationAsset, manifestUrl, icon),
    response = await rawFetch(url, { cache: "no-store", redirect: "error" });
  if (!response.ok) throw Error("animation asset download failed");
  validateAnimationResponseUrl(response, url);
  let blob = await validateAnimationGif(response),
    transaction = await snapshotAnimationAssets(icon);
  try {
    await uploadIconBlob(icon, blob, "image/gif");
    let shadow = await fetch(
      "/edit?path=" + encodeURIComponent(animationJpgPath(icon)),
      { method: "DELETE" },
    );
    if (!shadow.ok && shadow.status !== 404)
      throw Error("animation icon cleanup failed");
  } catch (error) {
    await restoreAnimationAssets(transaction);
    throw error;
  }
  return transaction;
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
