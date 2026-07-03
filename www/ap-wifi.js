(function(){
  var scanBtn=document.getElementById('scanBtn');
  var connectBtn=document.getElementById('connectBtn');
  var langBtn=document.getElementById('langBtn');
  var networkList=document.getElementById('networkList');
  var scanHint=document.getElementById('scanHint');
  var form=document.getElementById('wifiForm');
  var ssidInput=document.getElementById('ssidInput');
  var passwordInput=document.getElementById('passwordInput');
  var statusEl=document.getElementById('status');
  var networksCache=[];
  var statusKey='ready';
  var statusType='';
  var statusArgs=[];
  lang = localStorage.awtrixApWifiLang || lang;

  var I={
    zh:{
      title:'连接 WiFi',
      copy:'为 awtrix-light 选择家庭网络。连接成功后设备会保存 WiFi 并自动重启。',
      nearby:'附近网络',
      scan:'扫描 SSID',
      networkList:'扫描到的 WiFi 网络',
      scanHint:'如果扫描失败或没有看到你的网络，请直接在下方手动输入 SSID。',
      ssidLabel:'WiFi 名称 SSID',
      ssidPlaceholder:'输入或从上方选择 SSID',
      passwordLabel:'WiFi 密码',
      passwordPlaceholder:'留空可连接开放网络',
      connect:'连接并保存',
      ready:'准备就绪，请选择或输入 WiFi。',
      unknownSignal:'信号未知',
      secured:'需要密码',
      open:'开放网络',
      selected:'已选择 {ssid}，请输入密码后连接。',
      scanningHint:'正在扫描附近 WiFi...',
      scanning:'正在扫描 SSID，请稍候。',
      scanDone:'扫描完成，请选择网络或手动输入 SSID。',
      scanFailHint:'扫描失败也可以继续配网，请手动输入 SSID。',
      scanFail:'扫描失败：请手动输入 SSID 后连接。',
      ssidRequired:'请先输入 WiFi 名称 SSID。',
      connecting:'正在连接 {ssid}，设备可能会在成功后重启...',
      connectSent:'连接请求已发送。若连接成功，设备会保存设置并重启。',
      connectFail:'连接失败，请检查 SSID 和密码。'
    },
    en:{
      title:'Connect WiFi',
      copy:'Choose a home network for awtrix-light. After a successful connection, the device saves WiFi and restarts automatically.',
      nearby:'Nearby Networks',
      scan:'Scan SSID',
      networkList:'Scanned WiFi networks',
      scanHint:'If scanning fails or your network is hidden, enter the SSID below manually.',
      ssidLabel:'WiFi Name SSID',
      ssidPlaceholder:'Enter or select an SSID above',
      passwordLabel:'WiFi Password',
      passwordPlaceholder:'Leave empty for open networks',
      connect:'Connect and Save',
      ready:'Ready. Select or enter a WiFi network.',
      unknownSignal:'unknown signal',
      secured:'password required',
      open:'open network',
      selected:'Selected {ssid}. Enter the password, then connect.',
      scanningHint:'Scanning nearby WiFi...',
      scanning:'Scanning SSIDs. Please wait.',
      scanDone:'Scan complete. Select a network or enter an SSID manually.',
      scanFailHint:'Scanning failed. You can still enter an SSID manually.',
      scanFail:'Scan failed. Enter an SSID manually, then connect.',
      ssidRequired:'Enter the WiFi SSID first.',
      connecting:'Connecting to {ssid}. The device may restart after success...',
      connectSent:'Connection request sent. If successful, the device saves settings and restarts.',
      connectFail:'Connection failed. Check the SSID and password.'
    }
  };

  function text(key,args){
    var value=(I[lang]&&I[lang][key])||I.zh[key]||key;
    Object.keys(args||{}).forEach(function(name){
      value=value.replace('{'+name+'}',args[name]);
    });
    return value;
  }

  function setStatus(key,type,args){
    statusKey=key;
    statusType=type||'';
    statusArgs=args||[];
    statusEl.textContent=text(key,args);
    statusEl.className='status'+(statusType?' '+statusType:'');
  }

    var strength=Number(item.strength);
    var signal=Number.isFinite(strength)?strength+' dBm':text('unknownSignal');
    return signal+' | '+(item.security?text('secured'):text('open'));
  }

  function renderNetworks(networks){
    networksCache=Array.isArray(networks)?networks:[];
    networkList.innerHTML='';
    if(!networksCache.length){
      return;
    }
    networksCache.forEach(function(item){
      if(!item||!item.ssid)return;
      var row=document.createElement('button');
      row.type='button';
      row.className='network-row'+(item.selected?' selected':'');
      row.setAttribute('role','option');
      row.setAttribute('aria-selected',item.selected?'true':'false');
      row.innerHTML='<strong></strong><span></span>';
      row.querySelector('strong').textContent=item.ssid;
      row.querySelector('span').textContent=networkLabel(item);
      row.onclick=function(){
        ssidInput.value=item.ssid;
        networkList.querySelectorAll('.network-row').forEach(function(el){
          el.classList.toggle('selected',el===row);
          el.setAttribute('aria-selected',el===row?'true':'false');
        });
        passwordInput.focus();
        setStatus('selected','',{ssid:item.ssid});
      };
      networkList.appendChild(row);
    });
  }

  async function scanNetworks(){
    scanBtn.disabled=true;
    scanHint.textContent=text('scanningHint');
    setStatus('scanning');
    try{
      var response=await fetch('/scan',{cache:'no-store'});
      if(!response.ok)throw new Error('scan failed');
      var networks=await response.json();
      renderNetworks(Array.isArray(networks)?networks:[]);
      scanHint.textContent='';
      setStatus('scanDone','ok');
    }catch(error){
      renderNetworks([]);
      scanHint.textContent=text('scanFailHint');
      setStatus('scanFail','error');
    }finally{
      scanBtn.disabled=false;
    }
  }

  async function connectWifi(event){
    event.preventDefault();
    var ssid=ssidInput.value.trim();
    if(!ssid){
      ssidInput.focus();
      setStatus('ssidRequired','error');
      return;
    }
    connectBtn.disabled=true;
    setStatus('connecting','',{ssid:ssid});
    try{
      var body=new URLSearchParams();
      body.set('ssid',ssid);
      body.set('password',passwordInput.value);
      body.set('persistent','true');
      var response=await fetch('/connect',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
      var responseText=await response.text();
      if(!response.ok)throw new Error(responseText||text('connectFail'));
      setStatus('connectSent','ok');
    }catch(error){
      statusEl.textContent=error.message||text('connectFail');
      statusEl.className='status error';
      statusKey='connectFail';
      statusType='error';
      statusArgs=[];
      connectBtn.disabled=false;
    }
  }

  langBtn.addEventListener('click',function(){
    lang=lang==='zh'?'en':'zh';
    localStorage.awtrixApWifiLang=lang;
    localStorage.awtrixLang=lang;
    applyLang();
  });
  scanBtn.addEventListener('click',scanNetworks);
  form.addEventListener('submit',connectWifi);
  applyLang();
  scanNetworks();
})();
