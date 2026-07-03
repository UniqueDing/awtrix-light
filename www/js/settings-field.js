function addSettingsField(card,f,source) {
  let data=source==='legacy'?legacySettings:settings;
  if(data[f[0]]===undefined&&source==='api')return;
  let wrap=document.createElement('div');
  wrap.className='field';
  let val=data[f[0]],
  input;
  if(val===undefined||val===null)val='';
  if(f[2]==='checkbox') {
    input=document.createElement('input');
    input.type='hidden';
    input.value=val?'on':'off';
    let group=document.createElement('div');
    group.className='segmented';
    boolOptions().forEach(o=> {
      let b=document.createElement('button');
      b.type='button';
      b.textContent=o[1];
      b.dataset.value=o[0];
      b.className=o[0]===input.value?'active':'';
      b.onclick=()=> {
        input.value=o[0];
        group.querySelectorAll('button').forEach(x=>x.classList.toggle('active',
        x===b))
      };
      group.appendChild(b)
    });
    input._segment=group
  }else if(f[2]==='select') {
    input=document.createElement('select');
    (f[3]||[]).forEach(o=> {
      let opt=document.createElement('option');
      opt.value=o[0];
      opt.textContent=o[1];
      input.appendChild(opt)
    });
    input.value=val
  }else {
    input=document.createElement('input');
    input.type=f[2]==='password'?'password':f[2];
    if(f[2]==='number')input.step=Number.isInteger(Number(val))?'1':'0.1';
    input.value=f[2]==='color'||f[2]==='colorString'?hex(val):val
  }input.dataset.key=f[0];
  input.dataset.type=f[2];
  input.dataset.source=source;
  let label=document.createElement('label');
  label.textContent=f[1];
  wrap.appendChild(label);
  if(f[2]==='checkbox') {
    wrap.appendChild(input);
    wrap.appendChild(input._segment)
  }else wrap.appendChild(input);
  card.appendChild(wrap)
}
