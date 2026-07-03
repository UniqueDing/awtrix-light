function createCastAppApi(app) {
  let api= {
    app,
    get lang() {
      return lang
    },
    label(v) {
      return localLabel(v)
    },
    t(v) {
      return localLabel(v)
    },
    renderDialog(desc) {
      this._desc=desc;
      hideFooterExport();
      currentApp='__cast_external__'+app.id;
      E.sheetTitle.textContent=this.label(desc.title)||castAppName(app)||'';
      E.sheetStatus.textContent='';
      E.secondaryAction.style.display='none';
      E.saveSettings.style.display='none';
      this.close=async()=> {
        if(this._btnTimer) {
          clearInterval(this._btnTimer);
          this._btnTimer=null
        }if(this.onClose)await this.onClose();
        await this.release();
        E.sheet.classList.remove('show')
      };
      window.currentCastAppApi=this;
      let html='<section class="settings-card">';
      if(desc.hint)html+='<p class="hint">'+this.label(desc.hint)+'</p>';
      if(desc.display&&desc.display.type==='text') {
        let init=desc.display.initial||'';
        let id='__cast_disp_'+((desc.display.id)||'v');
        html+='<h3 id="'+id+'" class="cast-display">'+init+'</h3>'
      }if(desc.controls&&desc.controls.length) {
        html+='<div class="live-actions">';
        desc.controls.forEach(c=> {
          let cls=c.style==='danger'?'danger':c.style==='tonal'?'tonal':'primary';
          html+='<button id="__cast_ctrl_'+c.id+'" class="'+cls+'" type="button">'+this.label(c.label)+'</button>'
        });
        html+='</div>'
      }html+='</section>';
      E.fields.innerHTML=html;
      this.rootEl=E.fields;
      desc.controls.forEach(c=> {
        if(c.action) {
          let btn=this.rootEl.querySelector('#__cast_ctrl_'+c.id);
          if(btn)btn.onclick=(e=>c.action(api,
          e))
        }
      });
      if(desc.config&&desc.config.length) {
        html+='<section class="settings-card"><h4>'+(lang==='zh'?'设置':'Settings')+'</h4>';
        desc.config.forEach(c=> {
          let v=c.value!==undefined?c.value:'';
          html+='<div class="field"><label>'+this.label(c.label)+'</label>';
          if(c.type==='checkbox'||c.type==='bool') {
            html+='<label class="switch"><input id="__cast_cfg_'+c.id+'" type="checkbox" '+(v?'checked':'')+'><span class="slider"></span></label>'
          }else {
            html+='<input id="__cast_cfg_'+c.id+'" type="'+(c.type||'text')+'" value="'+esc(v)+'">'
          }html+='</div>'
        });
        html+='</section>'
      }E.fields.innerHTML=html;
      this.rootEl=E.fields;
      desc.controls.forEach(c=> {
        if(c.action) {
          let btn=this.rootEl.querySelector('#__cast_ctrl_'+c.id);
          if(btn)btn.onclick=(e=>c.action(api,
          e))
        }
      });
      E.sheet.classList.add('show');
      return E.fields
    },
    getConfig() {
      let cfg= {

      };
      if(this._desc&&this._desc.config) {
        this._desc.config.forEach(c=> {
          let el=document.getElementById('__cast_cfg_'+c.id);
          if(!el)return;
          if(c.type==='checkbox'||c.type==='bool')cfg[c.id]=el.checked;
          else if(c.type==='number')cfg[c.id]=Number(el.value);
          else cfg[c.id]=el.value
        })
      }return cfg
    },
    updateDisplay(id,
    val) {
      let el=document.getElementById('__cast_disp_'+id);
      if(el)el.textContent=val
    },
    status(msg,
    err) {
      setStatus(E.sheetStatus,
      msg,
      err)
    },
    $(id) {
      return document.getElementById(id)
    },
    async claim() {
      return runtimePost('/api/runtime/claim',
       {
        owner:app.id
      })
    },
    async frame(body) {
      return runtimePost('/api/runtime/frame',
      body)
    },
    async release() {
      return runtimePost('/api/runtime/release',
       {

      })
    },
    commands: {
      clear() {
        return {
          df:[0,
          0,
          32,
          8,
          '#000000']
        }
      },
      text(x,
      y,
      text,
      color) {
        return {
          dt:[x,
          y,
          text,
          color||'#ffffff']
        }
      },
      fill(x,
      y,
      w,
      h,
      color) {
        return {
          df:[x,
          y,
          w,
          h,
          color||'#ffffff']
        }
      },
      pixel(x,
      y,
      color) {
        return {
          dp:[x,
          y,
          color||'#ffffff']
        }
      },
      line(x0,
      y0,
      x1,
      y1,
      color) {
        return {
          dl:[x0,
          y0,
          x1,
          y1,
          color||'#ffffff']
        }
      }
    },
    _desc:null,
    _btnTimer:null,
    enableButtons() {
      if(this._btnTimer)clearInterval(this._btnTimer);
      const self=this;
      const desc=this._desc;
      let keyMap= {

      };
      if(desc&&desc.controls)desc.controls.forEach(c=> {
        if(c.key)keyMap[c.key]='__cast_ctrl_'+c.id
      });
      this._btnTimer=setInterval(async()=> {
        try {
          let r=await fetch('/api/runtime/buttons');
          if(!r.ok)return;
          let j=await r.json();
          ['left',
          'middle',
          'right'].forEach(k=> {
            if(j[k]) {
              let id=keyMap[k];
              if(id&&self.rootEl) {
                let btn=self.rootEl.querySelector('#'+id);
                if(btn)btn.click()
              }
            }
          })
        }catch(e) {

        }
      },
      200)
    }
  };
  return api
}function wireKindTabs(box,active,onChange) {
  if(!box)return;
  box.querySelectorAll('button').forEach(b=> {
    b.classList.toggle('active',
    b.dataset.kind===active);
    b.onclick=()=> {
      onChange(b.dataset.kind);
      wireKindTabs(box,
      b.dataset.kind,
      onChange)
    }
  })
}function renderAppKindTabs() {
  wireKindTabs(E.storeKindTabs,
  activeStoreKind,
  k=> {
    activeStoreKind=k;
    let sf=$('storeFilter');
    if(sf)sf.classList.toggle('show',
    k!=='cast');
    E.storeGrid.innerHTML='';
    for(let i=0;
    i<6;
    i++) {
      let s=document.createElement('div');
      s.className='store-row';
      s.innerHTML='<div class="app-icon" style="background:var(--chip);
      animation:pulse 1.2s ease-in-out infinite"></div><div style="width:60%;
      height:14px;
      background:var(--chip);
      border-radius:7px;
      animation:pulse 1.2s ease-in-out infinite;
      animation-delay:'+(i*.1)+'s"></div><div style="width:80%;
      height:12px;
      background:var(--chip);
      border-radius:6px;
      animation:pulse 1.2s ease-in-out infinite;
      animation-delay:'+(i*.1)+'s"></div>';
      E.storeGrid.appendChild(s)
    };
    storeLoaded=false;
    loadStore()
  });
  wireKindTabs(E.libraryKindTabs,
  activeLibraryKind,
  k=> {
    activeLibraryKind=k;
    E.libraryList.innerHTML='';
    for(let i=0;
    i<5;
    i++) {
      let s=document.createElement('div');
      s.className='row';
      s.style.cssText='opacity:.5';
      s.innerHTML='<div style="width:38px;
      height:38px;
      border-radius:12px;
      background:var(--chip);
      animation:pulse 1.2s ease-in-out infinite;
      animation-delay:'+(i*.1)+'s"></div><div style="grid-column:3"><div style="width:60%;
      height:14px;
      background:var(--chip);
      border-radius:7px;
      animation:pulse 1.2s ease-in-out infinite;
      animation-delay:'+(i*.1)+'s;
      margin-bottom:4px"></div><div style="width:40%;
      height:12px;
      background:var(--chip);
      border-radius:6px;
      animation:pulse 1.2s ease-in-out infinite;
      animation-delay:'+(i*.1)+'s"></div></div>';
      E.libraryList.appendChild(s)
    };
    if(k==='cast')loadCastInstalledMap().then(()=> {
      dbg('castInstalled:loaded');
      renderLibrary()
    }).catch(e=> {
      dbg('castInstalled:err '+e.message);
      renderLibrary()
    });
    else renderLibrary()
  });
  if(E.libraryKindTabs) {
    let actionRow=E.libraryKindTabs.nextElementSibling;
    if(actionRow&&actionRow.classList.contains('library-actions')) {
      actionRow.innerHTML='';
      actionRow.appendChild(E.createApp);
      actionRow.appendChild(E.globalDisplay)
    }
  }
}function renderCastAppStore() {
  let sf=$('storeFilter');
  if(sf)sf.classList.add('show');
  E.storeGrid.innerHTML='';
  renderAppKindTabs();
  renderStoreSourceBar();
  E.storeGrid.className='store-table';
  let installedMap=castInstalledMap(),
  installed=new Set(Object.keys(installedMap));
  let renderCastGrid=()=> {
    let input=$('storeSearchInput'),
    filter=input?input.value.toLowerCase():'',
    active=$('storeTags')&&$('storeTags').querySelector('.active'),
    tag=active&&active.dataset?active.dataset.tag:'all';
    E.storeGrid.innerHTML='';
    let visible=castStoreCatalog.filter(app=> {
      let appTags=app.tags||[];
      if(tag!=='all'&&!appTags.includes(tag))return false;
      if(filter) {
        let name=castAppName(app).toLowerCase(),
        desc=castAppDescription(app).toLowerCase(),
        tags=appTags.join(' ').toLowerCase();
        if(!name.includes(filter)&&!desc.includes(filter)&&!tags.includes(filter))return false
      }return true
    });
    E.storeGrid.classList.toggle('store-grid-compact',
    (filter||tag!=='all')&&visible.length>0);
    visible.forEach(app=> {
      let installedApp=installedMap[app.id],
      isInstalled=installed.has(app.id),
      compatible=isCompatibleVersion(app),
      hasUpdate=isInstalled&&app.version&&installedApp&&installedApp.version&&compareVersions(app.version,
      installedApp.version)>0,
      row=document.createElement('article');
      row.className='store-row'+(isInstalled?' installed':'');
      row.innerHTML='<div class="app-icon"></div><div class="name"></div><div class="meta"></div><button class="tonal" type="button"></button>';
      setIcon(row.querySelector('.app-icon'),
      app.icon||'JS',
      storeBase(selectedStoreSource().url));
      row.querySelector('.name').textContent=castAppName(app);
      row.querySelector('.meta').textContent=compatible?castAppDescription(app):(castAppDescription(app)+' · '+t.requiresVersion+' '+minRequiredVersion(app));
      let btn=row.querySelector('button');
      btn.textContent=!compatible?t.incompatible:(hasUpdate?t.update:(isInstalled?(lang==='zh'?'已安装':'Installed'):(lang==='zh'?'安装':'Install')));
      btn.disabled=!compatible||(isInstalled&&!hasUpdate);
      btn.classList.toggle('incompatible',
      !compatible);
      btn.classList.toggle('primary',
      compatible&&(!isInstalled||hasUpdate));
      btn.classList.toggle('tonal',
      !compatible||(isInstalled&&!hasUpdate));
      if(compatible&&(!isInstalled||hasUpdate))btn.onclick=()=>installCastApp(app.id,
      btn);
      else btn.onclick=null;
      E.storeGrid.appendChild(row)
    })
  };
  let makeTag=(box,
  l,
  v)=> {
    let b=document.createElement('button');
    b.type='button';
    b.className='tonal store-tag'+(v==='all'?' active':'');
    b.textContent=l;
    b.dataset.tag=v;
    b.onclick=()=> {
      box.querySelectorAll('.store-tag').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      renderCastGrid();
      renderCastTags()
    };
    return b
  };
  let inp=$('storeSearchInput');
  if(inp)inp.oninput=renderCastGrid;
  let tags=$('storeTags'),
  castTagsExpanded=false,
  renderCastTags=()=> {
    if(!tags)return;
    let limit=8,
    counts= {

    };
    castStoreCatalog.forEach(app=>(app.tags||[]).forEach(t=>counts[t]=(counts[t]||0)+1));
    let sorted=Object.keys(counts).sort((a,
    b)=>counts[b]-counts[a]||a.localeCompare(b)),
    active=tags.querySelector('.store-tag.active'),
    activeTag=active&&active.dataset?active.dataset.tag:'all',
    shown=castTagsExpanded?sorted:sorted.slice(0,
    limit);
    if(!castTagsExpanded&&activeTag!=='all'&&sorted.includes(activeTag)&&!shown.includes(activeTag))shown=shown.concat(activeTag);
    tags.innerHTML='';
    tags.appendChild(makeTag(tags,
    lang==='zh'?'全部':'All',
    'all'));
    shown.forEach(t=>tags.appendChild(makeTag(tags,
    t,
    t)));
    let next=[...tags.querySelectorAll('.store-tag')].find(x=>x.dataset&&x.dataset.tag===activeTag);
    if(next) {
      tags.querySelectorAll('.store-tag').forEach(x=>x.classList.remove('active'));
      next.classList.add('active')
    }if(sorted.length>limit) {
      let more=document.createElement('button');
      more.type='button';
      more.className='tonal store-tag store-tag-more';
      more.textContent=castTagsExpanded?(lang==='zh'?'收起':'Less'):(lang==='zh'?'展开':'More');
      more.onclick=()=> {
        castTagsExpanded=!castTagsExpanded;
        renderCastTags()
      };
      tags.appendChild(more)
    }
  };
  renderCastTags();
  renderCastGrid();
  setStatus(E.storeStatus,
  castUi('castHint'),
  false)
}let stopwatch= {
  running:false,
  start:0,
  elapsed:0,
  timer:null,
  lap:0
};
function fmtStopwatch(ms) {
  let total=Math.floor(ms/10),
  cs=total%100,
  s=Math.floor(total/100)%60,
  m=Math.floor(total/6000);
  return String(m).padStart(2,
  '0')+':'+String(s).padStart(2,
  '0')+'.'+String(cs).padStart(2,
  '0')
}function stopwatchElapsed() {
  return stopwatch.elapsed+(stopwatch.running?Date.now()-stopwatch.start:0)
}function stopwatchCommands() {
  let txt=fmtStopwatch(stopwatchElapsed()),
  accent=stopwatch.running?'#00e5ff':'#ffcc00';
  return [ {
    df:[0,
    0,
    32,
    8,
    '#000000']
  },
   {
    dt:[0,
    0,
    txt,
    accent]
  },
   {
    df:[0,
    7,
    Math.min(32,
    Math.floor((stopwatchElapsed()%60000)/1875)),
    1,
    accent]
  }]
}async function drawStopwatch() {
  try {
    await runtimePost('/api/runtime/frame',
     {
      clear:true,
      commands:stopwatchCommands()
    });
    if(stopwatch.running)stopwatch.timer=setTimeout(drawStopwatch,
    80)
  }catch(e) {
    setStatus(E.sheetStatus,
    e.message,
    true)
  }
}async function stopwatchClaim() {
  await runtimePost('/api/runtime/claim',
   {
    owner:'stopwatch'
  });
  drawStopwatch()
}async function stopwatchStart() {
  if(!stopwatch.running) {
    stopwatch.running=true;
    stopwatch.start=Date.now();
    await stopwatchClaim()
  }
}async function stopwatchPause() {
  if(stopwatch.running) {
    stopwatch.elapsed=stopwatchElapsed();
    stopwatch.running=false;
    if(stopwatch.timer)clearTimeout(stopwatch.timer);
    await drawStopwatch()
  }
}async function stopwatchReset() {
  stopwatch.running=false;
  stopwatch.elapsed=0;
  stopwatch.lap=0;
  if(stopwatch.timer)clearTimeout(stopwatch.timer);
  await stopwatchClaim();
  setStatus(E.sheetStatus,
  '已重置',
  false)
}async function stopwatchStop() {
  stopwatch.running=false;
  if(stopwatch.timer)clearTimeout(stopwatch.timer);
  await runtimePost('/api/runtime/release',
   {

  });
  E.sheet.classList.remove('show')
}function openStopwatchDialog() {
  hideFooterExport();
  currentApp='__stopwatch__';
  E.sheetTitle.textContent='秒表 Cast';
  E.sheetStatus.textContent='';
  E.secondaryAction.style.display='';
  E.secondaryAction.textContent='关闭';
  E.secondaryAction.onclick=stopwatchStop;
  E.saveSettings.style.display='none';
  E.fields.innerHTML='<section class="settings-card stopwatch-dialog"><h3 id="stopwatchValue">00:00.00</h3><p class="hint">此 App 由浏览器 JS 控制屏幕，关闭页面会自动释放。</p><div class="live-actions"><button id="stopwatchStart" class="primary" type="button">开始</button><button id="stopwatchPause" class="tonal" type="button">暂停</button><button id="stopwatchReset" class="tonal" type="button">重置</button></div></section>';
  E.sheet.classList.add('show');
  let update=()=> {
    let v=$('stopwatchValue');
    if(v)v.textContent=fmtStopwatch(stopwatchElapsed());
    if(E.sheet.classList.contains('show')&&currentApp==='__stopwatch__')requestAnimationFrame(update)
  };
  $('stopwatchStart').onclick=()=>stopwatchStart().catch(e=>setStatus(E.sheetStatus,
  e.message,
  true));
  $('stopwatchPause').onclick=()=>stopwatchPause().catch(e=>setStatus(E.sheetStatus,
  e.message,
  true));
  $('stopwatchReset').onclick=()=>stopwatchReset().catch(e=>setStatus(E.sheetStatus,
  e.message,
  true));
  update()
}let countdown= {
  running:false,
  total:300000,
  remaining:300000,
  end:0,
  timer:null
};
function fmtCountdown(ms) {
  ms=Math.max(0,
  ms);
  let total=Math.ceil(ms/1000),
  s=total%60,
  m=Math.floor(total/60)%60,
  h=Math.floor(total/3600);
  return h>0?String(h)+':'+String(m).padStart(2,
  '0')+':'+String(s).padStart(2,
  '0'):String(m).padStart(2,
  '0')+':'+String(s).padStart(2,
  '0')
}function countdownRemaining() {
  return countdown.running?Math.max(0,
  countdown.end-Date.now()):countdown.remaining
}function countdownCommands() {
  let rem=countdownRemaining(),
  done=rem<=0,
  txt=done?'DONE':fmtCountdown(rem),
  color=done?'#ff4444':'#00ff99',
  width=countdown.total>0?Math.max(0,
  Math.min(32,
  Math.ceil(rem/countdown.total*32))):0;
  return [ {
    df:[0,
    0,
    32,
    8,
    '#000000']
  },
   {
    dt:[done?3:0,
    0,
    txt,
    color]
  },
   {
    df:[0,
    7,
    width,
    1,
    color]
  }]
}async function drawCountdown() {
  try {
    await runtimePost('/api/runtime/frame',
     {
      clear:true,
      commands:countdownCommands()
    });
    if(countdown.running&&countdownRemaining()>0)countdown.timer=setTimeout(drawCountdown,
    120);
    else if(countdown.running) {
      countdown.running=false;
      countdown.remaining=0;
      setStatus(E.sheetStatus,
      '倒计时结束',
      false)
    }
  }catch(e) {
    setStatus(E.sheetStatus,
    e.message,
    true)
  }
}function readCountdownInput() {
  let min=Number(($('countdownMinutes')&&$('countdownMinutes').value)||0),
  sec=Number(($('countdownSeconds')&&$('countdownSeconds').value)||0);
  let total=Math.max(1,
  Math.floor(min*60+sec))*1000;
  countdown.total=total;
  countdown.remaining=total
}async function countdownClaim() {
  await runtimePost('/api/runtime/claim',
   {
    owner:'countdown'
  });
  drawCountdown()
}async function countdownStart() {
  readCountdownInput();
  countdown.running=true;
  countdown.end=Date.now()+countdown.remaining;
  await countdownClaim()
}async function countdownPause() {
  if(countdown.running) {
    countdown.remaining=countdownRemaining();
    countdown.running=false;
    if(countdown.timer)clearTimeout(countdown.timer);
    await drawCountdown()
  }
}async function countdownReset() {
  countdown.running=false;
  if(countdown.timer)clearTimeout(countdown.timer);
  readCountdownInput();
  await countdownClaim();
  setStatus(E.sheetStatus,
  '已重置',
  false)
}async function countdownStop() {
  countdown.running=false;
  if(countdown.timer)clearTimeout(countdown.timer);
  await runtimePost('/api/runtime/release',
   {

  });
  E.sheet.classList.remove('show')
}function openCountdownDialog() {
  hideFooterExport();
  currentApp='__countdown__';
  E.sheetTitle.textContent='倒计时 Cast';
  E.sheetStatus.textContent='';
  E.secondaryAction.style.display='';
  E.secondaryAction.textContent='关闭';
  E.secondaryAction.onclick=countdownStop;
  E.saveSettings.style.display='none';
  let minutes=Math.floor(countdown.total/60000),
  seconds=Math.floor(countdown.total/1000)%60;
  E.fields.innerHTML='<section class="settings-card stopwatch-dialog"><h3 id="countdownValue">'+fmtCountdown(countdownRemaining())+'</h3><p class="hint">设置时间后点击开始，浏览器 JS 会控制屏幕显示倒计时。</p><div class="field"><label>分钟</label><input id="countdownMinutes" type="number" min="0" max="999" value="'+minutes+'"></div><div class="field"><label>秒</label><input id="countdownSeconds" type="number" min="0" max="59" value="'+seconds+'"></div><div class="live-actions"><button id="countdownStart" class="primary" type="button">开始</button><button id="countdownPause" class="tonal" type="button">暂停</button><button id="countdownReset" class="tonal" type="button">重置</button></div></section>';
  E.sheet.classList.add('show');
  let update=()=> {
    let v=$('countdownValue');
    if(v)v.textContent=fmtCountdown(countdownRemaining());
    if(E.sheet.classList.contains('show')&&currentApp==='__countdown__')requestAnimationFrame(update)
  };
  $('countdownStart').onclick=()=>countdownStart().catch(e=>setStatus(E.sheetStatus,
  e.message,
  true));
  $('countdownPause').onclick=()=>countdownPause().catch(e=>setStatus(E.sheetStatus,
  e.message,
  true));
  $('countdownReset').onclick=()=>countdownReset().catch(e=>setStatus(E.sheetStatus,
  e.message,
  true));
  update()
}let interactiveTimer=null,interactiveFrame=0,interactiveRunning=false;
function setInteractiveStatus(msg,err) {
  if(!E.interactiveStatus)return;
  E.interactiveStatus.textContent=msg||'';
  E.interactiveStatus.className='status'+(err?' error':'')
}async function runtimePost(path,body) {
  let r=await fetch(path,
   {
    method:'POST',
    headers: {
      'Content-Type':'application/json'
    },
    body:JSON.stringify(body|| {

    })
  });
  let j=await r.json().catch(()=>( {

  }));
  if(!r.ok||j.ok===false)throw Error(j.error||('runtime '+r.status));
  return j
}function interactiveCommands(frame) {
  let x=frame%29,
  tail=Math.max(0,
  x-4),
  color=frame%2?'#00e5ff':'#ffcc00';
  return [ {
    df:[0,
    0,
    32,
    8,
    '#000000']
  },
   {
    df:[tail,
    3,
    5,
    2,
    '#14344a']
  },
   {
    df:[x,
    2,
    4,
    4,
    color]
  },
   {
    dt:[1,
    0,
    'WEB',
    '#ffffff']
  }]
}async function drawInteractiveFrame() {
  if(!interactiveRunning)return;
  try {
    await runtimePost('/api/runtime/frame',
     {
      clear:true,
      commands:interactiveCommands(interactiveFrame++)
    });
    interactiveTimer=setTimeout(drawInteractiveFrame,
    120)
  }catch(e) {
    interactiveRunning=false;
    setInteractiveStatus(e.message,
    true)
  }
}async function startInteractiveDemo() {
  if(interactiveRunning)return;
  setInteractiveStatus('正在占用屏幕...',
  false);
  try {
    await runtimePost('/api/runtime/claim',
     {
      owner:'web-demo'
    });
    interactiveRunning=true;
    interactiveFrame=0;
    setInteractiveStatus('App 运行中：保持此页面打开',
    false);
    drawInteractiveFrame()
  }catch(e) {
    setInteractiveStatus(e.message,
    true)
  }
}async function stopInteractiveDemo() {
  interactiveRunning=false;
  if(interactiveTimer) {
    clearTimeout(interactiveTimer);
    interactiveTimer=null
  }try {
    await runtimePost('/api/runtime/release',
     {

    });
    setInteractiveStatus('已停止，恢复 Flow 轮播',
    false)
  }catch(e) {
    setInteractiveStatus(e.message,
    true)
  }
}window.addEventListener('beforeunload',()=> {
  if(interactiveRunning||countdown.running||stopwatch.running)navigator.sendBeacon&&navigator.sendBeacon('/api/runtime/release',
  new Blob([' {

  }'],
   {
    type:'application/json'
  }))
});
function gifWord(a,v) {
  a.push(v&255,
  (v>>8)&255)
}function gifText(a,s) {
  for(let i=0;
  i<s.length;
  i++)a.push(s.charCodeAt(i)&255)
}function gifPalette() {
  let p=[];
  for(let r=0;
  r<8;
  r++)for(let g=0;
  g<8;
  g++)for(let b=0;
  b<4;
  b++) {
    p.push(Math.round(r*255/7),
    Math.round(g*255/7),
    Math.round(b*255/3))
  }return p
}function gifIndex(v) {
  return (((v>>16)&255)>>5)<<5|(((v>>8)&255)>>5)<<2|((v&255)>>6)
}function gifLzw(pixels) {
  let min=8,
  clear=256,
  end=257,
  size=9,
  dict=258,
  bits=0,
  cur=0,
  out=[];
  let put=c=> {
    cur|=c<<bits;
    bits+=size;
    while(bits>=8) {
      out.push(cur&255);
      cur>>=8;
      bits-=8
    }if(c===clear) {
      size=9;
      dict=258
    }else {
      dict++;
      if(dict===(1<<size)&&size<12)size++
    }
  };
  put(clear);
  for(let i=0;
  i<pixels.length;
  i++) {
    put(pixels[i]);
    if(dict>=4094&&i<pixels.length-1)put(clear)
  }put(end);
  if(bits>0)out.push(cur&255);
  let blocks=[];
  for(let i=0;
  i<out.length;
  i+=255)blocks.push(out.slice(i,
  i+255));
  return  {
    min,
    blocks
  }
}function buildPreviewGif(frames,w,h) {
  let bytes=[];
  gifText(bytes,
  'GIF89a');
  gifWord(bytes,
  w);
  gifWord(bytes,
  h);
  bytes.push(247,
  0,
  0);
  bytes.push(...gifPalette());
  for(let f of frames) {
    let delay=Math.max(2,
    Math.min(65535,
    Math.round((f.delay||120)/10)));
    bytes.push(33,
    249,
    4,
    4);
    gifWord(bytes,
    delay);
    bytes.push(0,
    0);
    bytes.push(44);
    gifWord(bytes,
    0);
    gifWord(bytes,
    0);
    gifWord(bytes,
    w);
    gifWord(bytes,
    h);
    bytes.push(0);
    let pix=f.frame.map(gifIndex),
    lzw=gifLzw(pix);
    bytes.push(lzw.min);
    lzw.blocks.forEach(b=>bytes.push(b.length,
    ...b));
    bytes.push(0)
  }bytes.push(59);
  return new Blob([new Uint8Array(bytes)],
   {
    type:'image/gif'
  })
}let previewTimer=null,previewStarted=false;
function initPreviewView() {
  if(previewStarted)return;
  let c=$('liveCanvas');
  if(!c)return;
  previewStarted=true;
  let ctx=c.getContext('2d'),
  last='',
  busy=false,
  baseDelay=200,
  delay=baseDelay,
  pw=32,
  ph=8,
  paintPending=false,
  nextFrame=null,
  gifRecording=false,
  gifFrames=[],
  gifLast=0;
  let paint=a=> {
    nextFrame=a;
    if(paintPending)return;
    paintPending=true;
    requestAnimationFrame(()=> {
      paintPending=false;
      let frame=nextFrame;
      nextFrame=null;
      if(!frame)return;
      if(gifRecording) {
        let now=Date.now();
        gifFrames.push( {
          frame:frame.slice(0,
          pw*ph),
          delay:gifLast?now-gifLast:baseDelay
        });
        gifLast=now;
        if(gifFrames.length>=120) {
          let b=$('liveGif');
          if(b)b.click()
        }
      }ctx.fillStyle='#000';
      ctx.fillRect(0,
      0,
      c.width,
      c.height);
      for(let y=0;
      y<ph;
      y++)for(let x=0;
      x<pw;
      x++) {
        let v=frame[y*pw+x]||0;
        ctx.fillStyle='rgb('+((v>>16)&255)+',
        '+((v>>8)&255)+',
        '+(v&255)+')';
        ctx.fillRect(x*Math.floor(c.width/pw)+1,
        y*Math.floor(c.height/ph)+1,
        Math.max(1,
        Math.floor(c.width/pw)-2),
        Math.max(1,
        Math.floor(c.height/ph)-2))
      }
    })
  };
  let schedule=ms=> {
    if(previewTimer)clearTimeout(previewTimer);
    previewTimer=setTimeout(draw,
    ms)
  };
  let draw=async()=> {
    if(!document.body.contains(c)) {
      previewStarted=false;
      if(previewTimer) {
        clearTimeout(previewTimer);
        previewTimer=null
      }return
    }if(document.hidden||!E.libraryPanel.classList.contains('active')) {
      schedule(1000);
      return
    }if(busy) {
      schedule(delay);
      return
    }busy=true;
    try {
      let r=await fetch('/api/screen',
       {
        cache:'no-store'
      });
      if(r.status===401) {
        authHeader='';
        sessionStorage.removeItem('awtrixAuth');
        previewStarted=false;
        busy=false;
        if(previewTimer) {
          clearTimeout(previewTimer);
          previewTimer=null
        }initAuth();
        return
      }if(!r.ok)throw Error('screen '+r.status);
      let text=await r.text();
      if(text!==last) {
        last=text;
        paint(JSON.parse(text))
      }delay=baseDelay
    }catch(e) {
      delay=Math.min(Math.max(delay*2,
      1000),
      2000)
    }busy=false;
    schedule(delay)
  };
  $('livePrev').onclick=()=>fetch('/api/previousapp',
   {
    method:'POST'
  });
  $('liveNext').onclick=()=>fetch('/api/nextapp',
   {
    method:'POST'
  });
  $('liveDownload').onclick=()=> {
    let a=document.createElement('a');
    a.href=c.toDataURL();
    a.download='awtrix.png';
    a.click()
  };
  let gifBtn=$('liveGif');
  if(gifBtn)gifBtn.onclick=()=> {
    if(!gifRecording) {
      gifFrames=[];
      gifLast=0;
      gifRecording=true;
      gifBtn.textContent=lang==='zh'?'停止':'Stop';
      gifBtn.classList.add('primary');
      return
    }gifRecording=false;
    gifBtn.textContent='GIF';
    gifBtn.classList.remove('primary');
    if(!gifFrames.length)return;
    let a=document.createElement('a');
    a.href=URL.createObjectURL(buildPreviewGif(gifFrames,
    pw,
    ph));
    a.download='awtrix.gif';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),
    1000)
  };
  if(E.interactiveRun)E.interactiveRun.onclick=startInteractiveDemo;
  if(E.interactiveStop)E.interactiveStop.onclick=stopInteractiveDemo;
  if(E.stopwatchOpen)E.stopwatchOpen.onclick=openStopwatchDialog;
  if(E.countdownOpen)E.countdownOpen.onclick=openCountdownDialog;
  renderAppKindTabs();
  draw();
  if(location.pathname==='/wifi')activate('settings',
  true)
}E.createApp.onclick=()=>openCreateApp(null,'create');
E.globalDisplay.onclick=openGlobalDisplaySettings;
E.themeBtn.onclick=()=> {
  localStorage.awtrixTheme=document.body.classList.contains('dark')?'light':'dark';
  applyTheme()
};
E.langBtn.onclick=()=> {
  lang=lang==='zh'?'en':'zh';
  localStorage.awtrixLang=lang;
  applyLang();
  storeLoaded=false;
  loadStore()
};
E.closeSheet.onclick=()=> {
  if(String(currentApp||'').startsWith('__cast_external__')&&window.currentCastAppApi) {
    window.currentCastAppApi.close().catch(e=>setStatus(E.sheetStatus,
    e.message,
    true));
    window.currentCastAppApi=null;
    return
  }if(currentApp==='__stopwatch__')stopwatchStop().catch(()=> {

  });
  if(currentApp==='__countdown__')countdownStop().catch(()=> {

  });
  E.saveSettings.onclick=saveAppSettings;
  E.sheet.classList.remove('show')
};
E.saveSettings.onclick=saveAppSettings;
E.fileRefreshBtn.onclick=()=>loadFiles(currentFileDir);
E.fileBackBtn.onclick=()=>loadFiles(parentFileDir(currentFileDir));
E.fileUploadBtn.onclick=()=>E.fileUploadInput.click();
E.fileUploadInput.onchange=e=> {
  let file=e.target.files&&e.target.files[0];
  if(file)uploadFileToCurrentDir(file).catch(err=>setStatus($('filesStatus'),
  err.message,
  true));
  e.target.value=''
};
E.fileNewBtn.onclick=()=>openCreateFileDialog(false);
E.fileNewFolderBtn.onclick=()=>openCreateFileDialog(true);
E.fileSaveBtn.onclick=()=>saveSelectedFile().catch(err=>setStatus($('filesStatus'),err.message,true));
E.fileDeleteBtn.onclick=()=>deleteSelectedFile().catch(err=>setStatus($('filesStatus'),err.message,true));
E.fileEditor.oninput=()=> {
  fileDirty=true;
  E.fileSaveBtn.disabled=selectedFileBinary||!selectedFilePath
};
resetFileEditor();
E.settingsTab.onclick=()=>activate('settings',false);
if(E.wifiTab)E.wifiTab.style.display='none';
E.storeTab.onclick=()=>activate('store',false);
E.libraryTab.onclick=()=>activate('library',false);
if(E.filesTab)E.filesTab.onclick=()=>activate('files',false);
E.saveDeviceSettings.onclick=saveDeviceSettings;
window.onpopstate = () => activate(location.pathname === '/settings' || location.pathname === '/wifi' ? 'settings' : location.pathname === '/my-apps' ? 'library' : location.pathname === '/files' ? 'files' : 'store', true);
initAuth();

