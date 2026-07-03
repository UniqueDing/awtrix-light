function dbg(label) {

}const $=id=>document.getElementById(id),E= {
  startupGate:$('startupGate'),
  startupStatus:$('startupStatus'),
  startupSpinner:$('startupSpinner'),
  startupHint:$('startupHint'),
  startupLoginForm:$('startupLoginForm'),
  settingsTab:$('settingsTab'),
  storeTab:$('storeTab'),
  libraryTab:$('libraryTab'),
  wifiTab:$('wifiTab'),
  filesTab:$('filesTab'),
  settingsPanel:$('settingsPanel'),
  storePanel:$('storePanel'),
  libraryPanel:$('libraryPanel'),
  wifiPanel:$('wifiPanel'),
  filesPanel:$('filesPanel'),
  filesSettingsTabs:$('filesSettingsTabs'),
  fileUploadBtn:$('fileUploadBtn'),
  fileUploadInput:$('fileUploadInput'),
  fileNewFolderBtn:$('fileNewFolderBtn'),
  fileNewBtn:$('fileNewBtn'),
  fileBackBtn:$('fileBackBtn'),
  fileRefreshBtn:$('fileRefreshBtn'),
  fileDeleteBtn:$('fileDeleteBtn'),
  fileSaveBtn:$('fileSaveBtn'),
  fileSelected:$('fileSelected'),
  fileUsage:$('fileUsage'),
  fileEditor:$('fileEditor'),
  settingsGrid:$('settingsGrid'),
  settingsEmpty:$('settingsEmpty'),
  settingsStatus:$('settingsStatus'),
  wifiGrid:$('wifiGrid'),
  wifiEmpty:$('wifiEmpty'),
  saveDeviceSettings:$('saveDeviceSettings'),
  storeGrid:$('storeGrid'),
  storeStatus:$('storeStatus'),
  libraryList:$('libraryList'),
  libraryStatus:$('libraryStatus'),
  sheet:$('sheetBackdrop'),
  fields:$('fields'),
  sheetTitle:$('sheetTitle'),
  sheetStatus:$('sheetStatus'),
  globalDisplay:$('globalDisplay'),
  createApp:$('createApp'),
  themeBtn:$('themeBtn'),
  langBtn:$('langBtn'),
  closeSheet:$('closeSheet'),
  secondaryAction:$('secondaryAction'),
  saveSettings:$('saveSettings'),
  interactiveRun:$('interactiveRun'),
  interactiveStop:$('interactiveStop'),
  interactiveStatus:$('interactiveStatus'),
  storeKindTabs:$('storeKindTabs'),
  storeSourceSlot:$('storeSourceSlot'),
  libraryKindTabs:$('libraryKindTabs'),
  liveAppsPanel:$('liveAppsPanel'),
  stopwatchOpen:$('stopwatchOpen'),
  countdownOpen:$('countdownOpen')
};


let storeLoaded = false, libraryLoaded = false, filesLoaded = false, apps = [], settings = {};
let currentApp = null, formMode = 'create';
let authHeader = sessionStorage.awtrixAuth || '', frameVersion = '0';
const rawFetch = window.fetch.bind(window);
window.fetch = function(input, init) {
  let url = typeof input === 'string' ? input : (input && input.url) || '';
  let next = Object.assign({}, init || {});
  let headers = new Headers(next.headers || {});
  if (authHeader && !url.includes('/api/auth/status')) {
    headers.set('Authorization', 'Basic ' + authHeader);
  }
  next.headers = headers;
  return rawFetch(input, next).then(function(r) {
    if (r.status === 401 && authHeader) {
      authHeader = '';
      sessionStorage.removeItem('awtrixAuth');
      setTimeout(function() { if (typeof initAuth === 'function') initAuth(); }, 0);
    }
    return r;
  });
};
