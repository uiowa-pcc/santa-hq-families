/* Santa HQ | printer-friendly themed hunt companion, v1.
   Uses read-only DOM data and never touches family data, gifts, scores, or photos. */
(()=>{'use strict';
const themes=[['colors','Color Quest'],['disney','Disney Night'],['characters','Character Quest'],['classic','Christmas Classics'],['effects','Light Show Night'],['winter','Winter Wonderland'],['surprise','Holiday Mix']];
const labels=Object.fromEntries(themes);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isGuest=!!document.getElementById('huntBoard');
function printUrl(theme,clues,title){const url=new URL('./hunt-print.html',location.href);url.searchParams.set('theme',labels[theme]?theme:(theme==='random'?'surprise':'classic'));if(Array.isArray(clues)&&clues.length===8){url.searchParams.set('clues',JSON.stringify(clues.map(c=>({name:String(c.name).slice(0,65),hint:String(c.hint||'').slice(0,105)}))));if(title)url.searchParams.set('title',String(title).slice(0,70))}return url.href}
function openPrint(theme,clues,title,all=false){const url=printUrl(theme,clues,title)+(all?'&all=1':'');const w=window.open(url,'_blank');if(!w){location.assign(url)}}
function themeByName(n){const name=String(n||'').toLowerCase();return themes.find(([id,t])=>name.includes(t.toLowerCase()))?.[0]||''}
function inject(){if(isGuest)return;
 const area=document.querySelector('.hunt-yearly-themes');
 if(area&&!area.nextElementSibling?.classList.contains('santa-print-panel')){
  const div=document.createElement('div');div.className='santa-print-panel';div.innerHTML='<div class="santa-print-head"><div><strong>Printable lights hunts</strong><small>Seven matching, printer-friendly missions. No new hunt or sign-in required.</small></div><button type="button" class="santa-print-btn" data-santa-print-all>View all printables</button></div><div class="santa-print-chips">'+themes.map(([id,t])=>'<button type="button" data-santa-print-theme="'+id+'">'+esc(t)+' <span aria-hidden="true">↗</span></button>').join('')+'</div>';
  area.insertAdjacentElement('afterend',div);
 }
 const chooser=document.getElementById('huntStandaloneTheme');if(chooser&&!document.getElementById('santa-print-selected')){
  const btn=document.createElement('button');btn.type='button';btn.id='santa-print-selected';btn.className='secondary santa-print-selected';btn.textContent='Print this theme';chooser.closest('label')?.insertAdjacentElement('afterend',btn);
 }
 document.querySelectorAll('select[data-hq-theme]').forEach(select=>{const p=select.closest('.cp-hq-create');if(p&&!p.querySelector('[data-santa-print-mini]')){const btn=document.createElement('button');btn.type='button';btn.dataset.santaPrintMini='';btn.className='secondary';btn.textContent='Print selected theme';p.appendChild(btn)}});
}
// Style rules integrate with the app's existing rounded cards and theme colors.
const style=document.createElement('style');style.textContent=`.santa-print-panel{margin:13px 0 16px;padding:15px 16px;border:1px solid #e5d9d3;background:#fffdfa;border-radius:16px}.santa-print-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.santa-print-head strong{display:block;color:#73453d;font-size:15px}.santa-print-head small{display:block;color:#756e68;font-size:11px;margin-top:3px}.santa-print-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:11px}.santa-print-chips button,.santa-print-btn{border:1px solid #dfc9bc;background:#fff;color:#824b50;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:750;cursor:pointer}.santa-print-btn{border-radius:11px;background:#fff4ef}.santa-print-chips button:hover,.santa-print-btn:hover{background:#ffece8}.santa-print-selected{align-self:end;white-space:nowrap}.santa-print-panel button:focus-visible{outline:3px solid #bd8c43;outline-offset:2px}@media(max-width:580px){.santa-print-panel{padding:13px}.santa-print-chips button{padding:9px 11px}.santa-print-selected{width:100%}}`;
document.head.append(style);
// Capture on the document so an existing Print handler cannot trigger the old photographic page.
document.addEventListener('click',e=>{
 const btn=e.target.closest('button');if(!btn)return;
 if(isGuest&&btn.id==='printBtn'){
  const board=document.getElementById('huntBoard');const nodes=[...(board?.querySelectorAll('.find')||[])];
  if(nodes.length===8){
   const clues=nodes.map(n=>({name:n.querySelector('.find .content strong')?.textContent.trim()||'',hint:n.querySelector('.find .content small')?.textContent.trim()||''})).filter(c=>c.name);
   if(clues.length===8){const selectedTab=document.querySelector('.hunt-hq-tabs button[aria-pressed="true"]');const title=selectedTab?.querySelector('strong')?.textContent||document.getElementById('boardTitle')?.textContent||'';
    let theme=themeByName(title)||themeByName(document.getElementById('boardSubtitle')?.textContent)||'classic';
    if(!themeByName(title)){const subtitle=document.getElementById('boardSubtitle')?.textContent||'';const m=subtitle.match(/8 clues · ([\w-]+)/);if(m&&labels[m[1]])theme=m[1]}
    e.preventDefault();e.stopImmediatePropagation();openPrint(theme,clues,title);return;
   }
  }
  // 30-clue Mega Hunt uses the existing multi-page print rather than truncating it.
  return;
 }
 if(btn.hasAttribute('data-santa-print-theme')){e.preventDefault();e.stopImmediatePropagation();openPrint(btn.dataset.santaPrintTheme);return}
 if(btn.hasAttribute('data-santa-print-all')){e.preventDefault();e.stopImmediatePropagation();openPrint('classic',null,null,true);return}
 if(btn.id==='santa-print-selected'){e.preventDefault();e.stopImmediatePropagation();openPrint(document.getElementById('huntStandaloneTheme')?.value||'classic');return}
 if(btn.hasAttribute('data-santa-print-mini')){e.preventDefault();e.stopImmediatePropagation();const select=btn.closest('.cp-hq-create')?.querySelector('select[data-hq-theme]');openPrint(select?.value||'classic');return}
},true);
if(!isGuest){let queued=false;const update=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;inject()})};const root=document.getElementById('content')||document.body;new MutationObserver(update).observe(root,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject,{once:true});else inject()}
})();