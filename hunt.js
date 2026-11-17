/* Standalone, account-free Christmas lights scavenger hunt.
   Only a random board seed travels in the share link. No private family data or network API calls. */
(()=>{
 'use strict';
 const EASY=[
  ['A Christmas tree','A tree all dressed in lights'],['A glowing star','Shining on a tree or roof'],['Red lights','Look for a bright red glow'],
  ['Green lights','Can you spot a green glow?'],['Blue lights','Find something glowing blue'],['White lights','A whole patch of white twinkles'],
  ['A candy cane','A tall striped candy decoration'],['Santa Claus','An outdoor Santa decoration'],['A snowman','A smiling frosty friend'],
  ['A reindeer','Antlers in the yard or lights'],['A wreath','A circle of Christmas cheer'],['A big present','An outdoor gift decoration'],
  ['An inflatable','A giant puffy decoration'],['A light-up window','A glowing window display'],['A glowing roof','Lights outlining a rooftop'],
  ['An elf','A little helper decoration'],['Pink or purple lights','Find a surprise color'],['A lighted doorway','A front door ready for Christmas'],
  ['An ornament','A giant bauble decoration'],['A snowflake','A twinkly winter shape'],['A sleigh','A little sleigh or Santa ride'],
  ['A glowing bush','Lights wrapped in leaves or branches'],['A yard full of lights','Lots of twinkles in one place'],['Two colors together','A display mixing bright colors']
 ];
 const HARD=[...EASY,
  ['Blinking lights','Lights that flash on and off'],['A penguin','A chilly bird decoration'],['An icicle shape','Dangling light-up icicles'],
  ['A light tunnel','A walkway or arch of lights'],['A gingerbread person','A sweet light-up figure'],['A glowing mailbox','Christmas lights near a mailbox'],
  ['Lights in a spiral','A swirl or wrap of twinkles'],['A dancing display','Lights that move to music'],['A nativity scene','A glowing stable display'],
  ['A decorated porch','A whole porch dressed up'],['A giant bow','An extra-large holiday ribbon'],['A tree in a window','A lit tree seen from outside']
 ];
 const $=id=>document.getElementById(id);
 const cleanId=s=>/^[ef]_[a-f0-9]{24}$/.test(s)?s:'';
 const randomId=()=>{const b=crypto.getRandomValues(new Uint8Array(12));return 'e_'+Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');};
 let id=cleanId((location.hash.match(/^#h=([^&]+)$/)||[])[1]||'');
 if(!id){id=randomId();history.replaceState(null,'',location.pathname+'#h='+id)}
 const easy=id.startsWith('e_'),count=easy?9:16,pool=easy?EASY:HARD;
 // Seeded shuffle makes every copied hunt link produce the identical set and order.
 function seedNumber(s){let n=2166136261;for(let i=0;i<s.length;i++){n=Math.imul(n^s.charCodeAt(i),16777619)}return n>>>0}
 function rand(seed){let n=seed;return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
 const rnd=rand(seedNumber(id)), shuffled=pool.map((v,i)=>({...{name:v[0],hint:v[1]},key:i}));
 for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]}
 const picks=shuffled.slice(0,count);
 const baseKey='santa_hq_guest_lights_v1_'+id;
 let player='';
 try{player=localStorage.getItem(baseKey+':name')||''}catch{}
 $('playerName').value=player;
 const selectedKey=()=>baseKey+':checks:'+(player.trim().toLowerCase()||'guest');
 let checks=new Set();
 function loadChecks(){try{const raw=JSON.parse(localStorage.getItem(selectedKey())||'[]');checks=new Set(Array.isArray(raw)?raw.filter(x=>Number.isInteger(x)&&x>=0&&x<count):[])}catch{checks=new Set()}}
 function persist(){try{localStorage.setItem(selectedKey(),JSON.stringify([...checks]));localStorage.setItem(baseKey+':name',player)}catch{}}
 function update(){const complete=checks.size;
  $('progressCount').textContent=complete+'/'+count;
  $('progressLabel').textContent=complete===count?'All clues found!':`${complete} found · ${count-complete} to go`;
  $('progressBar').style.width=(100*complete/count)+'%';
  $('winBanner').classList.toggle('visible',complete===count);
  $('boardTitle').textContent=player?`${player}'s hunt`:'Your hunt board';
  const board=$('huntBoard');board.classList.toggle('challenge',!easy);
  board.innerHTML=picks.map((p,i)=>`<button class="find ${checks.has(i)?'found':''}" type="button" data-tile="${i}" aria-pressed="${checks.has(i)}"><span class="findnum">${String(i+1).padStart(2,'0')}</span><span class="findname">${p.name}</span><span class="findhint">${p.hint}</span><span class="foundcheck">${checks.has(i)?'✓ Found!':'Tap when found'}</span></button>`).join('');
 }
 $('startBtn').addEventListener('click',()=>{player=$('playerName').value.trim().slice(0,35);loadChecks();persist();update();$('huntBoard').scrollIntoView({behavior:'smooth',block:'start'});});
 $('huntBoard').addEventListener('click',e=>{const b=e.target.closest('[data-tile]');if(!b)return;const i=Number(b.dataset.tile);if(!Number.isInteger(i)||i<0||i>=count)return;if(checks.has(i))checks.delete(i);else checks.add(i);persist();update();});
 $('resetBtn').addEventListener('click',()=>{if(!confirm('Clear your own checkmarks for this hunt? Everyone else keeps theirs.'))return;checks.clear();persist();update();});
 $('printBtn').addEventListener('click',()=>window.print());
 $('shareBtn').addEventListener('click',async()=>{const url=location.href;try{if(navigator.share){await navigator.share({title:'Christmas lights hunt',text:'Play our Christmas lights scavenger hunt!',url});return}if(navigator.clipboard){await navigator.clipboard.writeText(url);$('shareBtn').textContent='Link copied!';setTimeout(()=>$('shareBtn').textContent='Share hunt',2200);return}}catch(e){if(e?.name==='AbortError')return}prompt('Copy and share this link:',url)});
 $('boardSubtitle').textContent=easy?'9 little things to find · great for young explorers':'16 festive things to find · the family challenge';
 loadChecks();update();
})();
