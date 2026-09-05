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
  const escapeHtml = value => value.replace(/[&<>]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[char]));
  const rememberCaret = () => { const s = getSelection(); if (s.rangeCount && editor.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); };
  const restoreCaret = () => {
    const s=getSelection();
    if(!savedRange||!editor.contains(savedRange.commonAncestorContainer)){
      const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);
      s.removeAllRanges();s.addRange(range);savedRange=range.cloneRange();editor.focus();return;
    }
    s.removeAllRanges();s.addRange(savedRange);
  };
  const command = (cmd, value = null) => { restoreCaret(); document.execCommand(cmd, false, value); editor.focus(); changed(); };

  function updateStats(){ const text = editor.innerText.trim(); const words = text ? text.split(/\s+/).length : 0; document.querySelector('#stats').textContent = `${words} WORDS · ${text.length} CHARS`; }
  function makeId(text, used){ let base=(text.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section'), id=base, n=2; while(used.has(id)) id=`${base}-${n++}`; used.add(id); return id; }
  function updateToc(){ const heads=[...editor.querySelectorAll('h1,h2,h3')], used=new Set(); toc.innerHTML=''; if(!heads.length){toc.innerHTML='<div class="toc-empty">NO HEADINGS FOUND</div>';return;} heads.forEach(h=>{h.id=makeId(h.textContent,used);const a=document.createElement('a');a.className=`toc-item level-${h.tagName[1]}`;a.href=`#${h.id}`;a.textContent=h.textContent||'(UNTITLED)';a.onclick=e=>{e.preventDefault();h.scrollIntoView({behavior:'smooth',block:'center'});};toc.append(a);}); }
  function autosave(){ localStorage.setItem(STORAGE_KEY,JSON.stringify({title:title.value,html:editor.innerHTML,updated:Date.now()})); document.querySelector('#saveState').textContent='SAVED LOCALLY'; }
  function changed(){ document.querySelector('#saveState').textContent='EDITING...'; updateStats(); updateToc(); clearTimeout(saveTimer); saveTimer=setTimeout(autosave,500); }
  function insertNode(node){ restoreCaret(); const s=getSelection(); if(!s.rangeCount){editor.append(node);return;} const r=s.getRangeAt(0); r.deleteContents(); r.insertNode(node); r.setStartAfter(node); r.collapse(true); s.removeAllRanges(); s.addRange(r); savedRange=r.cloneRange(); }
  function selectImage(img){ editor.querySelectorAll('img.selected-image').forEach(i=>i.classList.remove('selected-image')); selectedImage=img; if(img){img.classList.add('selected-image');imageTools.hidden=false;imageWidth.value=Math.round(img.getBoundingClientRect().width)||img.naturalWidth;imageAlt.value=img.alt||'';}else imageTools.hidden=true; }
  function addImages(files){ [...files].filter(f=>f.type.startsWith('image/')).forEach(file=>{const reader=new FileReader();reader.onload=()=>{const img=document.createElement('img');img.src=reader.result;img.alt=file.name.replace(/\.[^.]+$/,'');img.style.width='min(100%, 480px)';insertNode(img);insertNode(document.createElement('br'));selectImage(img);changed();};reader.readAsDataURL(file);}); }
  function formatBlock(tag){
    restoreCaret();
    document.execCommand('formatBlock', false, tag);
    const selection=getSelection();
    const node=selection.rangeCount ? (selection.anchorNode.nodeType===Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement) : null;
    const block=node?.closest?.('p,h1,h2,h3,pre,blockquote');
    if(block && editor.contains(block) && block.tagName.toLowerCase()!==tag){
      const replacement=document.createElement(tag);
      replacement.append(...block.childNodes);
      block.replaceWith(replacement);
      const range=document.createRange();range.selectNodeContents(replacement);range.collapse(false);
      selection.removeAllRanges();selection.addRange(range);savedRange=range.cloneRange();
    }
    editor.focus();changed();
  }
  function leaveStyledBlock(block, anchorNode){
    const anchorElement=anchorNode.nodeType===Node.ELEMENT_NODE?anchorNode:anchorNode.parentElement;
    const emptyLine=anchorElement?.closest?.('div,p');
    if(emptyLine&&emptyLine!==block&&block.contains(emptyLine)&&!emptyLine.innerText.trim()) emptyLine.remove();
    while(block.lastChild?.nodeName==='BR') block.lastChild.remove();
    if(/\n[\t ]*$/.test(block.textContent)) block.textContent=block.textContent.replace(/\n[\t ]*$/,'');
    const removeEmptyBlock=!block.innerText.trim();
    const paragraph=document.createElement('p');paragraph.append(document.createElement('br'));block.after(paragraph);
    if(removeEmptyBlock) block.remove();
    const range=document.createRange();range.setStart(paragraph,0);range.collapse(true);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);savedRange=range.cloneRange();
    editor.focus();changed();
  }
  function exportHtml(){
    updateToc();
    const cloned=editor.cloneNode(true);cloned.removeAttribute('id');cloned.setAttribute('data-dos-note-content','');
    cloned.querySelectorAll('.selected-image').forEach(x=>x.classList.remove('selected-image'));
    const exportedToc=document.createElement('nav');exportedToc.className='export-toc';exportedToc.setAttribute('aria-label','Table of contents');
    cloned.querySelectorAll('h1,h2,h3').forEach(h=>{const a=document.createElement('a');a.href=`#${h.id}`;a.className=`level-${h.tagName[1]}`;a.textContent=h.textContent||'(UNTITLED)';exportedToc.append(a);});
    if(!exportedToc.children.length){const empty=document.createElement('span');empty.textContent='NO HEADINGS FOUND';exportedToc.append(empty);}
    const escapedTitle=escapeHtml(title.value);
    const page=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapedTitle}</title><style>:root{color-scheme:dark}*{box-sizing:border-box}html{scroll-behavior:smooth}body{max-width:1200px;margin:40px auto;padding:0 24px;background:#050505;color:#ccc;font:16px/1.5 "Courier New",monospace}.note-title{color:#fff;text-align:center}.export-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:32px;align-items:start}[data-dos-note-content]{min-width:0;grid-column:1;grid-row:1}.toc-panel{position:sticky;top:24px;grid-column:2;grid-row:1;display:flex;flex-direction:column;max-height:calc(100vh - 48px);overflow:hidden;border:1px solid #777;background:#090909}.toc-panel h2{flex:none;margin:0;padding:10px;background:#00aaaa;color:#000;font-size:1rem}.export-toc{min-height:0;padding:10px;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}.export-toc a{display:block;padding:5px;color:#5ff;text-decoration:none}.export-toc .level-2{padding-left:22px}.export-toc .level-3{padding-left:40px;color:#ff5}.export-toc span{color:#777}h1,h2,h3{color:#fff;scroll-margin-top:24px}a{color:#5ff}img{max-width:100%;height:auto}pre,blockquote{white-space:pre-wrap;overflow-wrap:anywhere;background:#111;padding:12px;border-left:5px solid #aaa}@media(max-width:760px){.export-layout{display:flex;flex-direction:column}.toc-panel{position:relative;top:0;width:100%;max-height:260px;order:-1}}@media print{body{max-width:none;margin:0;background:#fff;color:#000}.export-layout{display:block}.toc-panel{position:relative;display:block;max-height:none;overflow:visible;margin-bottom:24px;background:#fff;break-after:page}.toc-panel h2{background:#ddd}.export-toc{overflow:visible}h1,h2,h3{color:#000}.export-toc a{color:#000}}</style></head><body><header><h1 class="note-title">${escapedTitle}</h1></header><div class="export-layout">${cloned.outerHTML}<aside class="toc-panel"><h2>TABLE OF CONTENTS</h2>${exportedToc.outerHTML}</aside></div></body></html>`;
    const blob=new Blob([page],{type:'text/html'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${safeName(title.value)}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);flash('HTML FILE SAVED');
  }
  function openHtml(file){const r=new FileReader();r.onload=()=>{const doc=new DOMParser().parseFromString(r.result,'text/html');title.value=(doc.title||file.name.replace(/\.html?$/i,''));const exportedContent=doc.querySelector('[data-dos-note-content]');if(exportedContent){editor.innerHTML=exportedContent.innerHTML;}else{const first=doc.body.querySelector('h1');if(first&&first.textContent===title.value)first.remove();editor.innerHTML=doc.body.innerHTML;}changed();flash('FILE OPENED');};r.readAsText(file);}

  document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>command(b.dataset.cmd));
  document.querySelector('#blockStyle').onchange=e=>formatBlock(e.target.value);
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
  editor.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.metaKey)return;const selection=getSelection();if(!selection.rangeCount||!selection.isCollapsed)return;const node=selection.anchorNode.nodeType===Node.ELEMENT_NODE?selection.anchorNode:selection.anchorNode.parentElement;const block=node?.closest?.('pre,blockquote');if(!block||!editor.contains(block))return;const after=document.createRange();after.selectNodeContents(block);after.setStart(selection.anchorNode,selection.anchorOffset);if(after.toString().trim()||(!block.innerText.endsWith('\n')&&block.innerText.trim()))return;e.preventDefault();leaveStyledBlock(block,selection.anchorNode);});
  editor.addEventListener('keyup',rememberCaret);editor.addEventListener('mouseup',rememberCaret);editor.addEventListener('input',changed);title.addEventListener('input',changed);
  editor.addEventListener('paste',e=>{const imgs=[...e.clipboardData.items].filter(i=>i.type.startsWith('image/')).map(i=>i.getAsFile());if(imgs.length){e.preventDefault();addImages(imgs);}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();exportHtml();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='o'){e.preventDefault();document.querySelector('#fileInput').click();}});
  setInterval(()=>document.querySelector('#clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),1000);
  const prior=localStorage.getItem(STORAGE_KEY);if(prior){try{const n=JSON.parse(prior);title.value=n.title;editor.innerHTML=n.html;document.querySelector('#saveState').textContent='RESTORED';}catch{}}
  updateStats();updateToc();changed();
})();
