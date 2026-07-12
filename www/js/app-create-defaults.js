function createDefaults() {
  return {
    description: "",
    appIcon: "app",
    author: "",
    tagsText: "",
    version: 1,
    inputs: [{ id: "uid", label: "Bilibili UID", type: "text" }],
    sources: [
      {
        id: "relation",
        type: "http",
        method: "GET",
        url: "https://api.bilibili.com/x/relation/stat?vmid={{uid}}&jsonp=jsonp",
        responseType: "json",
        interval: 300,
        timeout: 5000,
        headers: {},
      },
    ],
    displayText: "",
    displayIcon: "app",
    displayColor: 16777215,
    displayBackground: 0,
    displayProgress: -1,
    displayProgressC: 65280,
    displayProgressBC: 16777215,
  };
}

function appJsonSample() {
  return "{\n &quot;name&quot;:&quot;bilibili-followers&quot;,\n &quot;description&quot;:&quot;Bilibili 粉丝数&quot;,\n &quot;icon&quot;:&quot;bilibili&quot;,\n &quot;version&quot;:1,\n &quot;inputs&quot;:[\n{\n &quot;id&quot;:&quot;uid&quot;,\n &quot;label&quot;:&quot;Bilibili UID&quot;,\n &quot;type&quot;:&quot;text&quot;\n}\n ],\n &quot;sources&quot;:[\n{\n &quot;id&quot;:&quot;relation&quot;,\n &quot;type&quot;:&quot;http&quot;,\n &quot;method&quot;:&quot;GET&quot;,\n &quot;url&quot;:&quot;https://api.bilibili.com/x/relation/stat?vmid={{uid}}&amp;jsonp=jsonp&quot;,\n &quot;responseType&quot;:&quot;json&quot;,\n &quot;interval&quot;:300,\n &quot;timeout&quot;:5000,\n &quot;headers&quot;:{}\n}\n ],\n &quot;display&quot;:{\n &quot;text&quot;:&quot;粉丝{{relation.data.follower}}&quot;,\n &quot;icon&quot;:&quot;bilibili&quot;,\n &quot;color&quot;:&quot;#ffffff&quot;,\n &quot;background&quot;:&quot;#000000&quot;\n}\n}";
}
function normalizeImportedApp(raw) {
  let display =
    raw.display && typeof raw.display === "object" ? raw.display : {};
  return {
    name: raw.name || "",
    description: raw.description || "",
    appIcon: raw.icon || "",
    author: raw.author || "",
    tagsText: Array.isArray(raw.tags) ? raw.tags.join(",") : raw.tags || "",
    version: raw.version || 1,
    inputs: Array.isArray(raw.inputs) ? raw.inputs : [],
    sources:
      Array.isArray(raw.sources) && raw.sources.length
        ? raw.sources
        : createDefaults().sources,
    displayText: display.text || "",
    displayIcon: display.icon || "",
    displayColor: display.color === undefined ? "#ffffff" : display.color,
    displayBackground:
      display.background === undefined ? "#000000" : display.background,
    displayProgress: display.progress === undefined ? -1 : display.progress,
    displayProgressC:
      display.progressC === undefined ? "#00ff00" : display.progressC,
    displayProgressBC:
      display.progressBC === undefined ? "#ffffff" : display.progressBC,
  };
}
