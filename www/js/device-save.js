async function saveDeviceSettings() {
  let apiBody=collectSettingsBody('api'),
  legacyBody=collectSettingsBody('legacy'),
  hasApi=Object.keys(apiBody).length>0,
  hasLegacy=Object.keys(legacyBody).length>0;
  setStatus(E.settingsStatus,
  t.saving,
  false);
  try {
    if(hasApi) {
      let r=await fetch('/api/settings',
       {
        method:'POST',
        headers: {
          'Content-Type':'application/json'
        },
        body:JSON.stringify(apiBody)
      });
      if(!r.ok)throw Error('save failed');
      settings=Object.assign(settings,
      apiBody)
    }if(hasLegacy)await saveLegacySettings(legacyBody);
    setStatus(E.settingsStatus,
    hasLegacy?(lang==='zh'?'已保存，网络或账号改动可能需要重启生效':'Saved. Network or auth changes may require reboot.'):t.saved,
    false)
  }catch(e) {
    setStatus(E.settingsStatus,
    e.message,
    true)
  }
}
