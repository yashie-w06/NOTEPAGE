(() => {
  const editor = document.querySelector('#editor');
  const title = document.querySelector('#noteTitle');
  const toc = document.querySelector('#toc');
  const toast = document.querySelector('#toast');
  const imageTools = document.querySelector('#imageTools');
  const imageWidth = document.querySelector('#imageWidth');
  const imageAlt = document.querySelector('#imageAlt');
  const STORAGE_KEY = 'dos-note-autosave-v1';
  let savedRange = null, selectedImage = null, saveTimer;

  const flash = message => { toast.textContent = message; toast.style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => toast.style.display = 'none', 1800); };
  const safeName = value => (value.trim() || 'dos-note').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const rememberCaret = () => { const s = getSelection(); if (s.rangeCount && editor.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); };
  const restoreCaret = () => { if (!savedRange) { editor.focus(); return; } const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); };
  const command = (cmd, value = null) => { restoreCaret(); document.execCommand(cmd, false, value); editor.focus(); changed(); };

  function updateStats(){ const text = editor.innerText.trim(); const words = text ? text.split(/\s+/).length : 0; document.querySelector('#stats').textContent = `${words} WORDS · ${text.length} CHARS`; }
  function makeId(text, used){ let base=(text.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section'), id=base, n=2; while(used.has(id)) id=`${base}-${n++}`; used.add(id); return id; }
  function updateToc(){ const heads=[...editor.querySelectorAll('h1,h2,h3')], used=new Set(); toc.innerHTML=''; if(!heads.length){toc.innerHTML='<div class="toc-empty">NO HEADINGS FOUND</div>';return;} heads.forEach(h=>{h.id=makeId(h.textContent,used);const a=document.createElement('a');a.className=`toc-item level-${h.tagName[1]}`;a.href=`#${h.id}`;a.textContent=h.textContent||'(UNTITLED)';a.onclick=e=>{e.preventDefault();h.scrollIntoView({behavior:'smooth',block:'center'});};toc.append(a);}); }
  function autosave(){ localStorage.setItem(STORAGE_KEY,JSON.stringify({title:title.value,html:editor.innerHTML,updated:Date.now()})); document.querySelector('#saveState').textContent='SAVED LOCALLY'; }
  function changed(){ document.querySelector('#saveState').textContent='EDITING...'; updateStats(); updateToc(); clearTimeout(saveTimer); saveTimer=setTimeout(autosave,500); }
  function insertNode(node){ restoreCaret(); const s=getSelection(); if(!s.rangeCount){editor.append(node);return;} const r=s.getRangeAt(0); r.deleteContents(); r.insertNode(node); r.setStartAfter(node); r.collapse(true); s.removeAllRanges(); s.addRange(r); savedRange=r.cloneRange(); }
  function selectImage(img){ editor.querySelectorAll('img.selected-image').forEach(i=>i.classList.remove('selected-image')); selectedImage=img; if(img){img.classList.add('selected-image');imageTools.hidden=false;imageWidth.value=Math.round(img.getBoundingClientRect().width)||img.naturalWidth;imageAlt.value=img.alt||'';}else imageTools.hidden=true; }
  function addImages(files){ [...files].filter(f=>f.type.startsWith('image/')).forEach(file=>{const reader=new FileReader();reader.onload=()=>{const img=document.createElement('img');img.src=reader.result;img.alt=file.name.replace(/\.[^.]+$/,'');img.style.width='min(100%, 480px)';insertNode(img);insertNode(document.createElement('br'));selectImage(img);changed();};reader.readAsDataURL(file);}); }
  function exportHtml(){ const cloned=editor.cloneNode(true);cloned.querySelectorAll('.selected-image').forEach(x=>x.classList.remove('selected-image'));const page=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title.value.replace(/[<&]/g,'')}</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;background:#050505;color:#ccc;font:16px/1.5 "Courier New",monospace}h1,h2,h3{color:#fff}a{color:#5ff}img{max-width:100%;height:auto}pre,blockquote{background:#111;padding:12px;border-left:5px solid #aaa}@media print{body{background:#fff;color:#000}h1,h2,h3{color:#000}}</style></head><body><h1>${title.value.replace(/[<>&]/g,'')}</h1>${cloned.innerHTML}</body></html>`;const blob=new Blob([page],{type:'text/html'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safeName(title.value)}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);flash('HTML FILE SAVED'); }
  function openHtml(file){const r=new FileReader();r.onload=()=>{const doc=new DOMParser().parseFromString(r.result,'text/html');title.value=(doc.title||file.name.replace(/\.html?$/i,''));const first=doc.body.querySelector('h1');if(first&&first.textContent===title.value)first.remove();editor.innerHTML=doc.body.innerHTML;changed();flash('FILE OPENED');};r.readAsText(file);}

  document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>command(b.dataset.cmd));
  document.querySelector('#blockStyle').onchange=e=>command('formatBlock',e.target.value);
  document.querySelector('#fontName').onchange=e=>command('fontName',e.target.value);
  document.querySelector('#fontSize').onchange=e=>command('fontSize',e.target.value);
  document.querySelector('#foreColor').oninput=e=>command('foreColor',e.target.value);
  document.querySelector('#hiliteColor').oninput=e=>command('hiliteColor',e.target.value);
  document.querySelector('#linkBtn').onclick=()=>{const url=prompt('Enter URL (https://...)');if(url)command('createLink',url);};
  document.querySelector('#hrBtn').onclick=()=>command('insertHorizontalRule');
  document.querySelector('#dateBtn').onclick=()=>command('insertText',new Date().toLocaleString());
  document.querySelector('#imageBtn').onclick=()=>{rememberCaret();document.querySelector('#imageInput').click();};
  document.querySelector('#imageInput').onchange=e=>{addImages(e.target.files);e.target.value='';};
  document.querySelector('#fileInput').onchange=e=>{if(e.target.files[0])openHtml(e.target.files[0]);e.target.value='';};
  document.querySelector('[data-action="open"]').onclick=()=>document.querySelector('#fileInput').click();
  document.querySelector('[data-action="save"]').onclick=exportHtml;
  document.querySelector('[data-action="print"]').onclick=()=>print();
  document.querySelector('[data-action="help"]').onclick=()=>document.querySelector('#helpDialog').showModal();
  document.querySelector('#closeHelp').onclick=()=>document.querySelector('#helpDialog').close();
  document.querySelector('[data-action="new"]').onclick=()=>{if(confirm('Start a new note? Your current note is autosaved locally.')){title.value='UNTITLED NOTE';editor.innerHTML='<h1>New note</h1><p>Start typing...</p>';changed();}};
  document.querySelector('#tocToggle').onclick=()=>{const p=document.querySelector('#tocPanel');p.classList.toggle('collapsed');document.querySelector('#tocToggle').textContent=p.classList.contains('collapsed')?'▶':'◀';};
  imageWidth.oninput=()=>{if(selectedImage){selectedImage.style.width=`min(100%, ${Math.max(10,imageWidth.value)}px)`;changed();}};
  imageAlt.oninput=()=>{if(selectedImage){selectedImage.alt=imageAlt.value;changed();}};
  document.querySelectorAll('[data-img-align]').forEach(b=>b.onclick=()=>{if(!selectedImage)return;const a=b.dataset.imgAlign;selectedImage.style.display=a==='center'?'block':'inline-block';selectedImage.style.marginLeft=a==='center'?'auto':'0';selectedImage.style.marginRight=a==='center'?'auto':'0';selectedImage.style.float=a==='center'?'none':a;changed();});
  document.querySelector('#imageReset').onclick=()=>{if(selectedImage){selectedImage.style.width='auto';selectedImage.style.float='none';selectedImage.style.margin='10px 0';changed();}};
  document.querySelector('#imageDelete').onclick=()=>{if(selectedImage){selectedImage.remove();selectImage(null);changed();}};
  editor.addEventListener('click',e=>selectImage(e.target.tagName==='IMG'?e.target:null));
  editor.addEventListener('keyup',rememberCaret);editor.addEventListener('mouseup',rememberCaret);editor.addEventListener('input',changed);title.addEventListener('input',changed);
  editor.addEventListener('paste',e=>{const imgs=[...e.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile());if(imgs.length){e.preventDefault();addImages(imgs);}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();exportHtml();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();document.querySelector('#fileInput').click();}});
  setInterval(()=>document.querySelector('#clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),1000);
  const prior=localStorage.getItem(STORAGE_KEY);if(prior){try{const n=JSON.parse(prior);title.value=n.title;editor.innerHTML=n.html;document.querySelector('#saveState').textContent='RESTORED';}catch{}}
  updateStats();updateToc();changed();
})();
