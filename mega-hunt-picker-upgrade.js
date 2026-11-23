/* Santa HQ · Mega Hunt chooser refinement · 2026-11-23
   Optional add-on for santa-hq-families. Does not modify gifts, hunt scores,
   saved selections or the original character selection handler.
*/
(function () {
  'use strict';
  if (window.__santaMegaPickerUpgrade) return;
  window.__santaMegaPickerUpgrade = true;

  const css = `
  /* Make character images read as clean illustrations on white. */
  .cp-hunt-builder .cp-character-photos button {
    background:#fff !important;
    border-color:#e4dae3;
    transition:border-color .15s ease,box-shadow .15s ease;
  }
  .cp-hunt-builder .cp-character-photos button[aria-pressed="true"] {
    background:#fff !important;
    border-color:#bb5770 !important;
    box-shadow:0 0 0 2px rgba(187,87,112,.11);
  }
  .cp-hunt-builder .cp-character-photos button img {
    background:#fff !important;
    object-fit:contain !important;
    padding:5px;
    box-sizing:border-box;
  }
  /* Selected choices move ahead of other choices in BOTH collections. */
  .cp-hunt-builder .cp-character-photos > button[aria-pressed="true"],
  .cp-hunt-builder .cp-character-list > button[aria-pressed="true"] {order:-1;}
  .cp-hunt-builder .cp-character-list > button[aria-pressed="true"] {
    background:#fff !important;
    color:#88435d !important;
    border:2px solid #bb5770 !important;
    padding:7px 10px;
  }
  .santa-mega-selected {
    background:#fffdfb;
    border:1px solid #e8d7d9;
    border-radius:16px;
    padding:12px;
    display:grid;
    gap:9px;
  }
  .santa-mega-selected-head {display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;}
  .santa-mega-selected-head strong {font-size:13px;color:#73384d;}
  .santa-mega-selected-head span {font-size:11px;font-weight:750;color:#9c576d;}
  .santa-mega-selected-chips {display:flex;flex-wrap:wrap;gap:7px;}
  .santa-mega-selected-chips button {
    border:1px solid #ddbdc5;background:#fff;color:#75384c;
    padding:5px 8px 5px 5px;border-radius:12px;
    display:inline-flex;align-items:center;gap:6px;
    font:700 12px/1.25 inherit;cursor:pointer;
    max-width:100%;
  }
  .santa-mega-selected-chips button:focus-visible {outline:3px solid #c38aab;outline-offset:2px;}
  .santa-mega-selected-chips img {width:32px;height:32px;object-fit:contain;background:white;border-radius:7px;}
  .santa-mega-selected-chips .santa-mega-remove {font-size:16px;font-weight:800;color:#a36175;padding:0 2px;}
  .santa-mega-selected-empty {color:#7d7581;font-size:12px;line-height:1.4;}
  @media (max-width:560px) {
    .santa-mega-selected {padding:10px;}
    .santa-mega-selected-chips button {font-size:11px;}
  }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // Small in-browser matte for character art supplied with near-black backgrounds.
  // Removes only very dark pixels *connected to the image edge*; interior dark
  // clothes, eyes and outlines are retained. Transparent PNGs need no processing.
  const matteCache = new Map();
  function removeBlackBackdrop(image) {
    const w0 = image.naturalWidth, h0 = image.naturalHeight;
    if (!w0 || !h0) return null;
    const scale = Math.min(1, 280 / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, w, h);
    const bitmap = ctx.getImageData(0, 0, w, h);
    const p = bitmap.data;
    const dark = i => {
      const o=i*4, r=p[o], g=p[o+1], b=p[o+2], a=p[o+3];
      return a>180 && Math.max(r,g,b)<132 && r*0.2126+g*0.7152+b*0.0722<94;
    };
    const corners=[0,w-1,(h-1)*w,h*w-1];
    if (corners.filter(dark).length<3) return null;
    const seen = new Uint8Array(w*h), queue = new Int32Array(w*h);
    let start=0,end=0,removed=0;
    function push(i) {if(!seen[i]&&dark(i)){seen[i]=1;queue[end++]=i;}}
    for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
    for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
    while(start<end){
      const i=queue[start++],x=i%w,y=Math.floor(i/w);
      p[i*4+3]=0;removed++;
      if(x>0)push(i-1);if(x<w-1)push(i+1);
      if(y>0)push(i-w);if(y<h-1)push(i+w);
    }
    // Avoid a tiny, accidental cutout of a dark border in ordinary photographs.
    if(removed < w*h*.035) return null;
    ctx.putImageData(bitmap,0,0);
    return canvas.toDataURL('image/png');
  }
  function cleanImage(img) {
    if(!img || img.dataset.santaMatteStarted) return;
    const src=img.getAttribute('src')||'';
    if(!src || src.startsWith('data:') || src.startsWith('blob:')) return;
    img.dataset.santaMatteStarted='1';
    const apply=()=>{
      if(!img.naturalWidth) return;
      try {
        if(!matteCache.has(src)) matteCache.set(src,removeBlackBackdrop(img));
        const result=matteCache.get(src);
        if(result) img.src=result;
      } catch (_) { /* Original art remains visible; white card background still applies. */ }
    };
    if(img.complete) apply();
    else img.addEventListener('load',apply,{once:true});
  }

  function getPickOrder(buttons) {
    let order=[];
    try {
      // The app's existing function preserves the order characters were chosen.
      if(typeof huntSelectedCharacters==='function') order=huntSelectedCharacters();
    } catch (_) { /* Use visual order if app internals change. */ }
    const byName=new Map(buttons.map(b=>[b.dataset.character,b]));
    return [...order.filter(n=>byName.has(n)).map(n=>byName.get(n)),
      ...buttons.filter(b=>!order.includes(b.dataset.character))];
  }
  function updateChooser() {
    const builder=[...document.querySelectorAll('.cp-hunt-builder')]
      .find(el=>el.querySelector('.cp-character-list'));
    if(!builder) return;
    const buttons=[...builder.querySelectorAll('.cp-character-photos > button[data-action="holiday-hunt-character"], .cp-character-list > button[data-action="holiday-hunt-character"]')];
    const selected=getPickOrder(buttons.filter(b=>b.getAttribute('aria-pressed')==='true'));
    const signature=selected.map(b=>b.dataset.character).join('\u001f');
    let shelf=builder.querySelector('.santa-mega-selected');
    if(!shelf) {
      shelf=document.createElement('section');
      shelf.className='santa-mega-selected';
      shelf.setAttribute('aria-label','Your selected Mega Hunt characters');
      const top=builder.querySelector('.cp-top');
      if(top) top.insertAdjacentElement('afterend',shelf);
      else builder.prepend(shelf);
    }
    if(shelf.dataset.selectionSignature!==signature) {
      shelf.dataset.selectionSignature=signature;
      shelf.replaceChildren();
      const head=document.createElement('div');head.className='santa-mega-selected-head';
      const title=document.createElement('strong');title.textContent='Your characters';
      const count=document.createElement('span');count.textContent=selected.length+'/5 selected · Tap to remove';
      head.append(title,count);shelf.appendChild(head);
      const chips=document.createElement('div');chips.className='santa-mega-selected-chips';
      if(!selected.length) {
        const msg=document.createElement('span');msg.className='santa-mega-selected-empty';
        msg.textContent='Tap characters below to add them to your hunt.';
        chips.appendChild(msg);
      }
      for(const b of selected){
        const chip=document.createElement('button');chip.type='button';
        chip.dataset.action='holiday-hunt-character';
        chip.dataset.character=b.dataset.character;
        chip.setAttribute('aria-label','Remove '+b.dataset.character+' from Mega Hunt');
        const original=b.querySelector('img');
        if(original){const pic=document.createElement('img');pic.src=original.getAttribute('src')||'';pic.alt='';chip.appendChild(pic);}
        const name=document.createElement('span');name.textContent=b.dataset.character;
        const remove=document.createElement('span');remove.className='santa-mega-remove';
        remove.textContent='×';remove.setAttribute('aria-hidden','true');
        chip.append(name,remove);chips.appendChild(chip);
      }
      shelf.appendChild(chips);
    }
    // Process original thumbnails and selected preview thumbnails; no image files modified.
    builder.querySelectorAll('.cp-character-photos button img, .santa-mega-selected-chips img').forEach(cleanImage);
  }
  let scheduled=false;
  function schedule() {
    if(scheduled) return;
    scheduled=true;
    // Existing app renders synchronously after a choice; then update once.
    Promise.resolve().then(()=>{scheduled=false;updateChooser();});
  }
  function init() {
    schedule();
    const root=document.querySelector('#content')||document.body;
    new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
