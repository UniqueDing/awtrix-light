function collectSettingsBody(source) {
  let body = {};
  E.settingsGrid.querySelectorAll("input, select").forEach((input) => {
    if (input.dataset.source !== source) return;
    body[input.dataset.key] =
      input.dataset.type === "checkbox"
        ? input.value === "on"
        : input.dataset.type === "color"
          ? numberFromHex(input.value)
          : input.dataset.type === "colorString"
            ? input.value
            : input.dataset.type === "number" || input.dataset.key === "TMODE"
              ? Number(input.value)
              : input.value;
  });

  return body;
}
