function renderGroupCards(groups, source)  {
   groups.forEach(g =>  {
     let card = document.createElement('section');
     card.className = 'settings-card';
     let h = document.createElement('h3');
     h.textContent = g.title;
     card.appendChild(h);
     g.fields.forEach(f => addSettingsField(card,
     f,
     source));
     if (card.querySelector('.field')) E.settingsGrid.appendChild(card)
  })
} function renderDeviceSettings() {
  let apiGroups=deviceSettingGroups(),
  legacyGroups=legacySettingGroups(),
  apiSection=apiGroups[settingsSection]||[],
  legacySection=legacyGroups[settingsSection]||[];
  if(apiSection&&!Array.isArray(apiSection))apiSection=Object.values(apiSection).flat();
  if(legacySection&&!Array.isArray(legacySection))legacySection=Object.values(legacySection).flat();
  E.settingsGrid.innerHTML='';
  renderSettingsTabs();
  E.settingsEmpty.style.display='none';
  if(settingsSection==='network')renderWifiSetupCard(E.settingsGrid,
  'settings');
  renderGroupCards(apiSection||[],
  'api');
  renderGroupCards(legacySection||[],
  'legacy');
  if(!E.settingsGrid.querySelector('.settings-card'))E.settingsEmpty.style.display='block'
}function wifiIds(prefix) {
  let p=prefix||'settings';
  return {
    ssid:p+'WifiSsid',
    list:p+'WifiSsidList',
    password:p+'WifiPassword',
    status:p+'WifiStatus',
    scan:p+'WifiScan',
    connect:p+'WifiConnect'
  }
}function renderWifiSetupCard(target,prefix) {
  let z=lang==='zh',
  box=target||E.settingsGrid,
  ids=wifiIds(prefix),
  card=document.createElement('section');
  card.className='settings-card wifi-card';
  card.innerHTML='<h3>'+(z?'WiFi 设置':'WiFi Setup')+'</h3><p class="hint">'+(z?'扫描附近 WiFi，也可以直接输入 SSID。连接成功后设备会重启。':'Scan nearby WiFi,
   or type an SSID directly. The device restarts after a successful connection.')+'</p><div class="field wifi-ssid-field"><label>SSID</label><div class="wifi-ssid-row"><div class="wifi-ssid-input"><input id="'+ids.ssid+'" type="text" list="'+ids.list+'" placeholder="SSID" autocomplete="off"><span class="wifi-dropdown" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></span></div><button id="'+ids.scan+'" class="icon-btn wifi-scan" type="button" aria-label="'+(z?'扫描 WiFi':'Scan WiFi')+'" title="'+(z?'扫描 WiFi':'Scan WiFi')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M18.5 9A7 7 0 0 0 6.3 6.8L4 11M20 13l-2.3 4.2A7 7 0 0 1 5.5 15"/></svg></button><datalist id="'+ids.list+'"></datalist></div><div class="field"><label>'+(z?'WiFi 密码':'WiFi Password')+'</label><input id="'+ids.password+'" type="password" autocomplete="new-password"></div><button id="'+ids.connect+'" class="primary wifi-connect" type="button">'+(z?'连接 WiFi':'Connect WiFi')+'</button><div id="'+ids.status+'" class="status"></div>';
  box.appendChild(card);
  $(ids.scan).onclick=()=>scanWifiNetworks(prefix);
  $(ids.connect).onclick=()=>connectWifiNetwork(prefix)
}function renderWifiSetupPage() {
  E.wifiGrid.innerHTML='';
  renderWifiSetupCard(E.wifiGrid,
  'wifi');
  E.wifiEmpty.style.display='none'
}async function scanWifiNetworks(prefix) {
  let ids=wifiIds(prefix),
  status=$(ids.status),
  listEl=$(ids.list),
  input=$(ids.ssid),
  z=lang==='zh';
  status.textContent=z?'正在扫描...':'Scanning...';
  status.className='status';
  try {
    let r=await fetch('/scan',
     {
      cache:'no-store'
    });
    if(!r.ok)throw Error('scan failed');
    let list=await r.json();
    listEl.innerHTML='';
    (Array.isArray(list)?list:[]).forEach(n=> {
      let opt=document.createElement('option');
      opt.value=n.ssid||'';
      opt.label=(n.selected?'✓ ':'')+(n.ssid||'')+' '+(n.strength?('('+n.strength+' dBm)'):'');
      if(n.selected&&!input.value)input.value=n.ssid||'';
      listEl.appendChild(opt)
    });
    status.textContent=(z?'找到 ':'Found ')+(Array.isArray(list)?list.length:0)+(z?' 个网络':' networks')
  }catch(e) {
    status.textContent=e.message;
    status.className='status error'
  }
}async function connectWifiNetwork(prefix) {
  let ids=wifiIds(prefix),
  status=$(ids.status),
  z=lang==='zh',
  ssid=($(ids.ssid).value||'').trim(),
  password=$(ids.password).value;
  if(!ssid) {
    status.textContent=z?'请先选择或输入 SSID':'Select or enter an SSID first';
    status.className='status error';
    return
  }status.textContent=z?'正在连接，成功后设备会重启...':'Connecting. The device will restart on success...';
  status.className='status';
  try {
    let body=new URLSearchParams( {
      ssid:ssid,
      password:password,
      persistent:'true'
    }),
    r=await fetch('/connect',
     {
      method:'POST',
      headers: {
        'Content-Type':'application/x-www-form-urlencoded'
      },
      body
    });
    let text=await r.text();
    if(!r.ok)throw Error(text||'wifi failed');
    status.textContent=text||t.saved
  }catch(e) {
    status.textContent=e.message;
    status.className='status error'
  }
}async function loadLegacySettings() {
  try {
    let r=await fetch('/DoNotTouch.json',
     {
      cache:'no-store'
    });
    legacySettings=r.ok?await r.json(): {

    }
  }catch(e) {
    legacySettings= {

    }
  }
}
