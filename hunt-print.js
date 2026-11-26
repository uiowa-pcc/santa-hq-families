/* Original Santa HQ illustrated examples for clue names without a picture in the classic sprite.
   Characters supplied by the family through hunt-images/manifest.json take precedence. */
const SantaHQIllustrations = (() => {
  'use strict';
  const escape = s => String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const L = s => String(s||'').trim().toLowerCase();
  const svg = (inner, night=false) => `<svg xmlns="http://www.w3.org/2000/svg" class="santa-clue-svg" viewBox="0 0 240 164" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><radialGradient id="goldglow"><stop stop-color="#fff4bd"/><stop offset=".45" stop-color="#f7d558" stop-opacity=".9"/><stop offset="1" stop-color="#e7b521" stop-opacity="0"/></radialGradient><filter id="bulbglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="240" height="164" rx="18" fill="${night?'#213b55':'#fffaf2'}"/><path d="M0 143q38-18 77 0t84-2t79-1v24H0" fill="${night?'#e8f4fa':'#f2f5ea'}"/><path d="M6 135l18-28 17 28M185 139l15-33 25 33" fill="none" stroke="${night?'#6b8a88':'#c3d7c3'}" stroke-width="3"/>${inner}</svg>`;
  const bulb = (x,y,color,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="7" ry="21" rx="18" fill="${color}" opacity=".42" filter="url(#bulbglow)"/><path d="M-8-6q-2 13 8 28q11-13 8-28q-8-7-16 0Z" fill="${color}" stroke="#fef7ed" stroke-width="2"/><path d="M-7-7h14" stroke="#264334" stroke-width="5" stroke-linecap="round"/><path d="M-3-2q-4 6-1 13" fill="none" stroke="#fff" stroke-width="2.2" opacity=".75"/></g>`;
  const strand = colors => {
    const xs=[32,75,118,161,204], ys=[50,67,73,66,50];
    const wire=`<path d="M0 31Q120 117 240 31" fill="none" stroke="#1d4533" stroke-width="4"/>`;
    return svg(`${wire}${xs.map((x,i)=>bulb(x,ys[i],colors[i%colors.length])).join('')}<g fill="#e9b760"><circle cx="16" cy="127" r="2"/><circle cx="225" cy="122" r="3"/></g>`,true);
  };
  const lightWord = () => {
    const letters={J:['01111','00010','00010','00010','10010','10010','01100'],O:['01110','10001','10001','10001','10001','10001','01110'],Y:['10001','10001','01010','00100','00100','00100','00100']};
    const dots=[];Object.entries(letters).forEach(([char,rows],index)=>rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')dots.push(`<circle cx="${24+index*72+x*10}" cy="${37+y*13}" r="4.6" fill="#ffe16c" stroke="#fffae4" stroke-width="1.3"/><circle cx="${24+index*72+x*10}" cy="${37+y*13}" r="8" fill="#f0bb35" opacity=".20"/>`)})));
    return svg(`<path d="M16 27h208v116H16z" fill="#223b55" stroke="#d7b365" stroke-width="2" rx="12"/>${dots.join('')}`,true);
  };
  const music = () => svg(`<g transform="translate(4 0)"><path d="M73 112V39l89-17v73" fill="none" stroke="#f4c04f" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="52" cy="114" rx="25" ry="17" fill="#f4c04f" stroke="#fff0bd" stroke-width="3" transform="rotate(-20 52 114)"/><ellipse cx="142" cy="98" rx="25" ry="17" fill="#f4c04f" stroke="#fff0bd" stroke-width="3" transform="rotate(-20 142 98)"/><path d="M167 48l13-19 7 25 23 5-19 13 2 23-23-13-15 12 3-22-18-13z" fill="#fff0a4"/><path d="M22 40q26-14 50 0M162 135q26-14 50 0" stroke="#f4d47e" stroke-width="4" fill="none"/></g>`,true);
  const arch = () => svg(`<g fill="none" stroke-linecap="round"><path d="M27 138V96a93 93 0 0 1 186 0v42" stroke="#2e7b59" stroke-width="13"/><path d="M43 138V97a77 77 0 0 1 154 0v41" stroke="#ecd191" stroke-width="6"/>${Array.from({length:9},(_,i)=>{const a=Math.PI+(i*Math.PI/8),x=120+88*Math.cos(a),y=97+74*Math.sin(a);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${['#d93148','#eeb838','#4ab66d','#56a0f8'][i%4]}" stroke="#fff6e6" stroke-width="2"/>`}).join('')}</g>`,true);
  const projection = () => svg(`<rect x="53" y="78" width="93" height="49" rx="12" fill="#5b6f8c" stroke="#e9eaf4" stroke-width="4"/><circle cx="99" cy="99" r="22" fill="#fff5cf" stroke="#d7b752" stroke-width="5"/><circle cx="99" cy="99" r="10" fill="#8bc8ff"/><path d="M78 127l-15 20M122 127l17 20" stroke="#455775" stroke-width="6"/><path d="M145 78l65-39v95Z" fill="#fceba2" opacity=".45"/><path d="M186 61l7 12 13 2-9 9 2 15-13-8-13 7 3-15-10-9 13-1Z" fill="#ffdb60"/>`,true);
  const pattern = () => svg(`<path d="M13 110q36-76 74 0t74 0t68-9" stroke="#2d7652" stroke-width="5" fill="none"/>${[25,48,74,98,122,145,170,196,219].map((x,i)=>bulb(x,95-(Math.sin(i/1.25)*28),['#f3c74a','#ed4050','#4fa3ff'][i%3],.7)).join('')}<path d="M71 29l17 9-17 9M159 31l17 9-17 9" fill="none" stroke="#ffe3a0" stroke-width="4"/>`,true);
  const mailbox = () => svg(`<rect x="44" y="59" width="154" height="63" rx="18" fill="#bf2d3c" stroke="#802634" stroke-width="4"/><path d="M45 85h153M104 120v37" stroke="#d7af6c" stroke-width="6"/><path d="M188 58v-26h20v21" fill="#d9363f" stroke="#fff0dd" stroke-width="3"/><rect x="72" y="78" width="78" height="18" rx="4" fill="#fcf4da"/><path d="M80 79l32 13 31-13" stroke="#a85a51" stroke-width="2" fill="none"/><path d="M41 56q58-22 120 0" fill="none" stroke="#fefefe" stroke-width="8"/>${[45,74,109,144,180].map((x,i)=>bulb(x,48,['#ed4449','#f0c04d','#58ae75'][i%3],.42)).join('')}`);
  const nativity = () => svg(`<path d="M35 81L120 18l85 63" fill="none" stroke="#c68f48" stroke-width="13" stroke-linecap="round"/><rect x="57" y="85" width="125" height="65" fill="#c29558"/><path d="M62 144q28-63 59-21 28-42 57 21" fill="#663f37"/><circle cx="103" cy="105" r="13" fill="#e7b591"/><circle cx="137" cy="105" r="13" fill="#e7b591"/><circle cx="121" cy="123" r="10" fill="#f6d0a8"/><path d="M110 82l10-25 9 25" stroke="#f2d96b" stroke-width="4"/><path d="M120 21l7 15 16 3-12 9 3 15-14-7-14 7 3-15-12-9 17-3Z" fill="#ffdf70"/>`);
  const crown = () => svg(`<circle cx="120" cy="83" r="51" fill="#ba233c" stroke="#d5a344" stroke-width="9"/><path d="M93 89l11-30 16 18 18-18 12 30Z" fill="#f8d774"/><path d="M84 112h72" stroke="#e7c76b" stroke-width="5"/><path d="M38 130l12-25 18 10M202 130l-12-25-18 10" stroke="#3d8153" stroke-width="5" fill="none"/>`);
  const bow = () => svg(`<path d="M117 63C79 13 30 20 39 63c6 31 52 19 80 12 23 20 72 20 82-9 11-48-52-56-79-3Z" fill="#bb2f42" stroke="#fff0e0" stroke-width="4"/><path d="M116 78l-34 62 40-15 40 15-37-61" fill="#d63248" stroke="#fff0e0" stroke-width="3"/><ellipse cx="121" cy="74" rx="17" ry="16" fill="#f0b760"/>`);
  const stocking = () => svg(`<path d="M97 32h68v57q8 34-23 50q-38 19-72-12q-14-22 14-34l16-12Z" fill="#c3303f" stroke="#fff" stroke-width="6"/><rect x="85" y="23" width="91" height="26" rx="12" fill="#fff" stroke="#e0d0bd" stroke-width="3"/><path d="M127 67l4 12 13 1-10 8 4 13-11-7-11 7 3-13-10-8 13-1Z" fill="#f0c75a"/>`);
  const snowflake = () => svg(`<g stroke="#96c5ed" stroke-width="8" stroke-linecap="round" transform="translate(120 81)">${[0,60,120].map(a=>`<g transform="rotate(${a})"><path d="M-56 0h112M-38-13l13 13-13 13M38-13L25 0l13 13" fill="none"/></g>`).join('')}</g><circle cx="120" cy="81" r="13" fill="#fff" stroke="#d7bf75" stroke-width="4"/>`,true);
  const roof = () => svg(`<path d="M26 99l92-66 97 66" fill="none" stroke="#7e4d37" stroke-width="11" stroke-linejoin="round"/><path d="M35 100l84-59 86 59v44H35Z" fill="#e9b17a"/><rect x="89" y="95" width="62" height="49" fill="#ffefbe" stroke="#ab6b46" stroke-width="4"/><path d="M29 92q43-29 89-58t92 58" fill="none" stroke="#f3f5f7" stroke-width="10"/>${[39,65,96,125,156,185,206].map((x,i)=>bulb(x,[87,69,49,47,64,83,94][i],['#ee4453','#f3cb55','#55b66b','#58a7f0'][i%4],.42)).join('')}`);
  function forName(name){
    const n=L(name);
    const primaryColors={'red lights':['#f0444c'],'green lights':['#45ca6a'],'blue lights':['#45aaff'],'white lights':['#ffffff'],'pink lights':['#ff88d6'],'purple lights':['#bc79fc'],'pink or purple lights':['#dc78ed'],'rainbow lights':['#f24b53','#ffb84c','#5acc73','#48a5f4','#bd70f3'],'two colors together':['#ec4350','#53c86f'],'multicolor lights':['#f24b53','#ffb84c','#5acc73','#48a5f4','#bd70f3']};
    if(primaryColors[n])return strand(primaryColors[n]);
    if(n==='a whole house in one color'||n==='a multicolored tree'||n==='a color you did not expect')return strand(['#ba78e8']);
    if(n==='music-synced lights'||n==='music'||n.includes('dancing display')||n.includes('music'))return music();
    if(n.includes('spelling a word')||n.includes('word made from lights')||n.includes('lights spelling')||n==='words')return lightWord();
    if(n.includes('tunnel')||n.includes('arch'))return arch();
    if(n.includes('projector'))return projection();
    if(n.includes('chasing')||n.includes('blinking')||n.includes('spiral'))return pattern();
    if(n.includes('mailbox'))return mailbox();
    if(n.includes('nativity'))return nativity();
    if(n.includes('red bow')||n.includes('giant bow'))return bow();
    if(n.includes('stocking'))return stocking();
    if(n.includes('front door'))return roof();
    if(n.includes('colorful roof')||n.includes('glowing roof'))return roof();
    if(n.includes('snowflake'))return snowflake();
    if(n.includes('giant ornament'))return svg(`<circle cx="120" cy="93" r="55" fill="#bc3150" stroke="#f6d26a" stroke-width="7"/><path d="M104 40v-10h32v12" fill="none" stroke="#d6b25e" stroke-width="7"/><path d="M101 24q19-23 38 0" fill="none" stroke="#d6b25e" stroke-width="5"/><circle cx="96" cy="74" r="15" fill="#ffffff" opacity=".16"/>`);
    if(n.includes('giant inflatable'))return svg(`<circle cx="120" cy="89" r="52" fill="#ffefda" stroke="#a24651" stroke-width="4"/><circle cx="103" cy="75" r="5" fill="#6c433f"/><circle cx="140" cy="75" r="5" fill="#6c433f"/><path d="M99 101q21 26 42 0" fill="none" stroke="#8b4450" stroke-width="5"/><path d="M74 54q40-73 87 0" stroke="#c93246" stroke-width="25" fill="none"/><circle cx="158" cy="46" r="13" fill="#fff"/>`);
    if(n.includes('character')||['mickey mouse','minnie mouse','donald duck','goofy','pluto','winnie-the-pooh','the grinch','snoopy','olaf','stitch','lightning mcqueen','woody','buzz lightyear'].includes(n))return crown();
    return '';
  }
  return { forName };
})();

/* Santa HQ — illustrated printable scavenger hunts v3.
   This optional add-on NEVER modifies hunt progress, stored gifts, logins, or the Worker API.
   Guest-room Print collects the clue cards from the CURRENT visible hunt or themed night.
   Printable library uses worker-matched default theme clue definitions in hunt-print.html. */
(()=>{'use strict';
if(window.__santaPrintV3)return;window.__santaPrintV3=true;
const THEMES=[["disney","Disney Night"],["christmas-friends","Christmas Friends"],["stories","Storybook & TV Favorites"],["animals","Merry Menagerie"],["classic","Christmas Classics"],["candy","Candyland"],["colors","Color Quest"],["home","Neighborhood Glow"],["scenes","North Pole Adventure"],["words","Merry Messages"],["effects","Light Show Night"]];
const NAMES=Object.fromEntries(THEMES);
const guest=!!document.getElementById('huntBoard');
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function prettyTheme(name){const text=String(name||'').toLowerCase();return THEMES.find(([k,t])=>text===k||text.includes(t.toLowerCase()))?.[0]||''}
function printLink(theme='classic'){const u=new URL('./hunt-print.html',document.baseURI);u.searchParams.set('theme',NAMES[theme]?theme:'classic');return u;}
function showSheet(url){const w=window.open(url.href,'_blank');if(w){try{w.opener=null}catch{}}else{window.location.assign(url.href)} }
function openTheme(theme){if(theme==='random'){alert('Create the Surprise Me hunt first, then use Print matching hunt inside it so every clue matches.');return}showSheet(printLink(theme))}
function readActiveClues(){const board=document.getElementById('huntBoard');if(!board)return null;
 const cards=[...board.querySelectorAll('.find')];if(cards.length<1||cards.length>125)return null;
 const clues=cards.map(card=>{
  const content=card.querySelector('.content');
  const name=content?.querySelector('strong')?.textContent?.trim()||'';
  const hint=content?.querySelector('small')?.textContent?.trim()||'';
  const img=card.querySelector('img.custom-hunt-photo')?.getAttribute('src')||'';
  return {name,hint,img:img.startsWith('./hunt-images/')?img:''};
 });if(clues.some(x=>!x.name)||clues.length!==cards.length)return null;
 const title=board.dataset.printTitle||document.getElementById('boardTitle')?.textContent?.trim()||'Christmas Lights Hunt';
 const sub=document.getElementById('boardSubtitle')?.textContent||'';
 const activeTab=[...document.querySelectorAll('.hunt-hq-tabs button[aria-pressed="true"]')][0];
 const tabName=activeTab?.querySelector('strong')?.textContent||'';
 const theme=board.dataset.printTheme||prettyTheme(tabName)||prettyTheme(sub)||prettyTheme(title)||'classic';
 return {title,theme,clues,created:Date.now()};
}
function openLiveSheet(){const job=readActiveClues();if(!job){alert('The hunt clues have not loaded yet. Open the hunt board, then try Print again.');return}
 const url=printLink(job.theme);
 // Store a short-lived anonymous print job on this device. The guest's room link,
 // tokens, names, scores, and private family data are intentionally NOT copied.
 const id='p'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
 try{localStorage.setItem('santaHQPrintJob:'+id,JSON.stringify(job));url.searchParams.set('job',id)}
 catch{url.searchParams.set('clues',JSON.stringify(job.clues.map(c=>({name:c.name,hint:c.hint}))));url.searchParams.set('title',job.title)}
 // Return to the exact guest hunt in the same tab, without an account login.
 // The room/night fragment is already part of the shareable guest link; no player token is copied.
 if(/^#(?:room=[a-f0-9]{32}(?:&night=[a-f0-9]{32})?|h=[ef]_[a-f0-9]{24})$/.test(location.hash))url.hash=location.hash;
 window.location.assign(url.href);
}
function library(){if(guest)return;
 const area=document.querySelector('.hunt-yearly-themes');
 if(area&&!document.querySelector('#santaPrintableLibrary')){
  const panel=document.createElement('section');panel.id='santaPrintableLibrary';panel.className='santa-print-library';
  panel.innerHTML=`<div class="santa-print-title"><div><strong>Printable Lights Hunts</strong><small>Illustrated sample missions from the same Mega Hunt categories</small></div><button type="button" data-print-all>Print all 11</button></div><div class="santa-print-themes">${THEMES.map(([id,label])=>`<button type="button" data-print-theme="${id}"><span aria-hidden="true">✦</span> ${escapeHTML(label)}</button>`).join('')}</div><p class="santa-print-explain">For any actual themed, Surprise Me, or Mega hunt, open that hunt and select <b>Print matching hunt</b> to get its exact clues.</p>`;
  area.insertAdjacentElement('afterend',panel);
 }
 const selected=document.getElementById('huntStandaloneTheme');
 if(selected&&!document.getElementById('santaPrintSelectedTheme')){
  const btn=document.createElement('button');btn.type='button';btn.id='santaPrintSelectedTheme';btn.className='secondary';btn.textContent='Print this theme';
  selected.closest('label')?.insertAdjacentElement('afterend',btn);
 }
 document.querySelectorAll('.cp-hq-create select[data-hq-theme]').forEach(sel=>{
  const parent=sel.closest('.cp-hq-create');if(!parent||parent.querySelector('[data-print-mini]'))return;
  const btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.textContent='Print selected theme';btn.setAttribute('data-print-mini','');parent.append(btn);
 });
}
const style=document.createElement('style');style.textContent=`.santa-print-library{margin:14px 0 18px;padding:17px 19px;border:1px solid #e3bdbb;border-radius:18px;background:#fffcf8;box-shadow:0 2px 10px #7d33320a}.santa-print-title{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}.santa-print-title strong{font:800 18px Georgia,serif;color:#931c35}.santa-print-title small{display:block;margin-top:4px;color:#685c57;font-size:12px}.santa-print-title button,.santa-print-themes button{background:#fff;border:1px solid #e6c2bd;border-radius:12px;padding:9px 12px;font-weight:750;color:#8c2937;cursor:pointer}.santa-print-title button{background:#9f263c;color:white}.santa-print-themes{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.santa-print-themes button span{color:#c99226}.santa-print-explain{font-size:11px;color:#6d645f;margin:10px 0 0;line-height:1.4}#santaPrintSelectedTheme{align-self:end}@media(max-width:600px){.santa-print-library{padding:13px}.santa-print-themes button{padding:10px}.santa-print-title button{width:100%}}`;
document.head.append(style);
if(guest){const printBtn=document.getElementById('printBtn');if(printBtn){printBtn.textContent='Print matching hunt';printBtn.title='Print this hunt with the same clues shown on screen'}}
// Capture before the original guest listener invokes window.print(); no modification
// to the game's own source file or data flows.
document.addEventListener('click',event=>{
 const btn=event.target.closest('button');if(!btn)return;
 if(guest&&btn.id==='printBtn'){
  event.preventDefault();event.stopImmediatePropagation();openLiveSheet();return;
 }
 if(btn.hasAttribute('data-print-theme')){event.preventDefault();event.stopImmediatePropagation();openTheme(btn.dataset.printTheme);return;}
 if(btn.hasAttribute('data-print-all')){event.preventDefault();event.stopImmediatePropagation();const u=printLink();u.searchParams.set('all','1');showSheet(u);return;}
 if(btn.id==='santaPrintSelectedTheme'){event.preventDefault();event.stopImmediatePropagation();openTheme(document.getElementById('huntStandaloneTheme')?.value||'classic');return;}
 if(btn.hasAttribute('data-print-mini')){event.preventDefault();event.stopImmediatePropagation();openTheme(btn.closest('.cp-hq-create')?.querySelector('select[data-hq-theme]')?.value||'classic');return;}
},true);
if(!guest){let queued=false;function onChange(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;library()})}
 const root=document.getElementById('content')||document.body;
 new MutationObserver(onChange).observe(root,{childList:true,subtree:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',library,{once:true});else library();
}
})();

/* Santa HQ cartoon art v5. Purely visual enhancement for existing hunt cards.
   The underlying hunt.js progress, scoring, photo uploads, and game links are unchanged. */
(() => {
 'use strict';
 const board = document.getElementById('huntBoard');
 if (!board || !window.MutationObserver) return;
 const style=document.createElement('style');
 style.textContent = `
 .photo:not(.graphic):not(.custom-photo-wrap){background-image:url('./hunt-photos.webp?v=20261123-cartoons')!important;background-color:#fffaf2!important;}
 .photo.graphic.santa-illustrated{background:#fdf9f0!important;padding:0!important;display:grid;place-items:center;}
 .photo.graphic.santa-illustrated>.santa-clue-svg{display:block;width:100%;height:100%;object-fit:contain;}
 .photo.graphic.santa-illustrated .graphic-icon{display:none!important;}
 .find .photo.santa-illustrated{border-bottom:1px solid #f1e6d6;}
 `;document.head.appendChild(style);
 let pending=false;
 function update(){
   pending=false;
   board.querySelectorAll('.find').forEach(card=>{
     const photo=card.querySelector('.photo');if(!photo)return;
     const clue=card.querySelector('.content strong')?.textContent?.trim()||'';
     if(!clue)return;
     if(photo.matches('.custom-photo-wrap'))return; // A child's captured photo or chosen image stays intact.
     const markup=SantaHQIllustrations.forName(clue);
     if(markup){
       if(photo.dataset.santaArt===clue)return;
       photo.dataset.santaArt=clue;
       photo.classList.add('graphic','santa-illustrated');
       photo.style.backgroundImage='none';
       photo.innerHTML=markup;
       photo.setAttribute('aria-label','Cartoon illustration for '+clue);
     }else if(!photo.matches('.graphic')){
       photo.setAttribute('aria-label','Cartoon illustration for '+clue);
     }
   });
 }
 function queue(){if(pending)return;pending=true;queueMicrotask(update)}
 new MutationObserver(queue).observe(board,{childList:true,subtree:true});
 queue();
})();
