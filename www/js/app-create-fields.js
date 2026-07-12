function sel(id, opts, val) {
  return (
    '<select id="' +
    id +
    '">' +
    opts
      .map(
        (o) =>
          '<option value="' +
          o[0] +
          '" ' +
          (o[0] === val ? "selected" : "") +
          ">" +
          o[1] +
          "</option>",
      )
      .join("") +
    "</select>"
  );
}

function cf(id, label, type, val) {
  return (
    '<div class="field"><label>' +
    label +
    '</label><input id="' +
    id +
    '" type="' +
    type +
    '" value="' +
    esc(val || "") +
    '"></div>'
  );
}

function createFieldHtml(f, item) {
  let val = item && item[f[0]] !== undefined ? item[f[0]] : "";
  if (f[2] === "checkbox")
    return (
      '<div class="field switch-field"><label>' +
      f[1] +
      '</label><label class="switch"><input data-create="1" data-key="' +
      f[0] +
      '" data-type="checkbox" type="checkbox" ' +
      (val ? "checked" : "") +
      '><span class="slider"></span></label></div>'
    );
  if (f[2] === "select")
    return (
      '<div class="field"><label>' +
      f[1] +
      "</label>" +
      sel("c_" + f[0], f[3], val) +
      "</div>"
    );
  let v = f[2] === "color" ? hex(val || 0) : val;
  return (
    '<div class="field"><label>' +
    f[1] +
    '</label><input id="c_' +
    f[0] +
    '" data-create="1" data-key="' +
    f[0] +
    '" data-type="' +
    f[2] +
    '" type="' +
    f[2] +
    '" value="' +
    esc(v || "") +
    '"></div>'
  );
}
