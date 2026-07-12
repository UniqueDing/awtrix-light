function timeModeOptions() {
  return [
    [0, t.digital],
    [1, t.digitalSecondsBar],
    [2, t.bigDigits],
    [3, t.binary],
    [4, t.bigDigitsSecondsBar],
    [5, t.bigTimeBackground],
    [6, t.wordClock],
  ];
}
function triOptions() {
  return [
    ["default", t.global],
    ["on", t.on],
    ["off", t.off],
  ];
}

function boolOptions() {
  return [
    ["on", t.on],
    ["off", t.off],
  ];
}

function alignOptions() {
  return [
    ["default", t.global],
    ["left", t.left],
    ["center", t.center],
    ["right", t.right],
  ];
}

function contentFields() {
  return [
    ["text", t.displayText, "text"],
    ["icon", t.iconName, "text"],
    ["color", t.textColor, "color"],
    ["background", t.background, "color"],
    ["progress", t.progress, "number"],
    ["progressC", t.progressColor, "color"],
    ["progressBC", t.progressBg, "color"],
  ];
}

function displayFields() {
  return [
    ["align", t.align, "segmented", alignOptions()],
    ["showIcon", t.showIcon, "segmented", triOptions()],
    ["underline", t.underline, "segmented", triOptions()],
    ["displayDuration", t.duration, "number"],
    ["noScroll", t.noScroll, "segmented", triOptions()],
    ["scrollSpeed", t.scrollSpeed, "number"],
    ["textOffset", t.textOffset, "number"],
    ["iconOffset", t.iconOffset, "number"],
    ["topText", t.topText, "segmented", triOptions()],
    ["rainbow", t.rainbow, "segmented", triOptions()],
    ["bounce", t.bounce, "segmented", triOptions()],
    ["pushIcon", t.pushIcon, "segmented", triOptions()],
    ["repeat", t.repeat, "number"],
    ["fadeText", t.fadeText, "number"],
    ["blinkText", t.blinkText, "number"],
  ];
}

const triBoolKeys = new Set([
  "scroll",
  "center",
  "rainbow",
  "repeat",
  "pushIcon",
  "lifetimeMode",
]);
const triNumberKeys = new Set(["duration", "lifetime", "progress", "bar"]);

function settingsDisplayFields() {
  return displayFields().concat([
    ["color", t.textColor, "color"],
    ["background", t.background, "color"],
  ]);
}

function globalDisplayFields() {
  return [
    ["ATRANS", t.autoTransition, "checkbox"],
    [
      "TEFF",
      t.transitionEffect,
      "select",
      [
        ["0", "Random"],
        ["1", "Slide"],
        ["2", "Dim"],
        ["3", "Zoom"],
        ["4", "Rotate"],
        ["5", "Pixelate"],
        ["6", "Curtain"],
        ["7", "Ripple"],
        ["8", "Blink"],
        ["9", "Reload"],
        ["10", "Fade"],
      ],
    ],
    ["TSPEED", t.transitionSpeed, "number"],
    ["ATIME", t.appTime, "number"],
    ["TCOL", t.textColor, "color"],
    ["UPPERCASE", t.uppercase, "checkbox"],
    ["SSPEED", t.globalScrollSpeed, "number"],
    [
      "APP_ALIGN",
      t.globalAlign,
      "segmented",
      [
        ["left", t.left],
        ["center", t.center],
        ["right", t.right],
      ],
    ],
    ["APP_ICON", t.globalIcon, "checkbox"],
    ["APP_UNDER", t.globalUnder, "checkbox"],
    ["APP_DUR", t.globalDur, "number"],
    ["TCOL", t.textColor, "color"],
    ["APP_NOSCROLL", t.noScroll, "checkbox"],
    ["APP_SSPEED", t.scrollSpeed, "number"],
    ["APP_TOFF", t.textOffset, "number"],
    ["APP_IOFF", t.iconOffset, "number"],
    ["APP_TOP", t.topText, "checkbox"],
    ["APP_RAINBOW", t.rainbow, "checkbox"],
    ["APP_BOUNCE", t.bounce, "checkbox"],
    ["APP_PUSHICON", t.pushIcon, "checkbox"],
    ["APP_REPEAT", t.repeat, "number"],
    ["APP_FADE", t.fadeText, "number"],
    ["APP_BLINK", t.blinkText, "number"],
  ];
}
const DISPLAY_COMPAT_KEYS = [
  "text",
  "icon",
  "color",
  "background",
  "progress",
  "progressC",
  "progressBC",
];

function withDisplayCompatibility(payload) {
  let next = Object.assign({}, payload || {}),
    display =
      next.display && typeof next.display === "object" ? next.display : null;
  if (!display) return next;
  DISPLAY_COMPAT_KEYS.forEach((key) => {
    if (display[key] !== undefined) next[key] = display[key];
  });
  return next;
}
