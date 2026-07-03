async function uninstallApp(name) {
  hideFooterExport();
  currentApp='__app_uninstall__';
  let item=(apps||[]).find(a=>appName(a,
  0)===name)|| {

  };
  E.sheetTitle.textContent=t.uninstallTitle||(lang==='zh'?'卸载应用':'Uninstall App');
  E.sheetStatus.textContent='';
  E.fields.innerHTML='<section class="settings-card"><h3>'+name+'</h3><p class="hint">'+(lang==='zh'?'确定要删除吗？可以之后从应用商店重新安装。':'Remove this app? You can reinstall it from the app store.')+'</p></section>';
  E.secondaryAction.style.display='';
  E.secondaryAction.textContent=lang==='zh'?'取消':'Cancel';
  E.secondaryAction.onclick=()=>E.sheet.classList.remove('show');
  E.saveSettings.style.display='';
  E.saveSettings.textContent=lang==='zh'?'卸载':'Uninstall';
  E.saveSettings.onclick=async()=> {
    try {
      setStatus(E.libraryStatus,
      '...',
      false);
      let r=await fetch('/api/apps/uninstall',
       {
        method:'POST',
        headers: {
          'Content-Type':'application/json'
        },
        body:JSON.stringify( {
          name
        })
      });
      let j=await r.json().catch(()=>( {

      }));
      if(!r.ok||!j.success)throw Error(j.error||'uninstall failed');
      E.saveSettings.onclick=saveAppSettings;
      E.sheet.classList.remove('show');
      libraryLoaded=false;
      await loadLibrary();
      storeLoaded=false;
      loadStore();
      setStatus(E.libraryStatus,
      t.uninstalled+name,
      false)
    }catch(e) {
      setStatus(E.sheetStatus,
      e.message,
      true)
    }
  };
  E.sheet.classList.add('show')
}
