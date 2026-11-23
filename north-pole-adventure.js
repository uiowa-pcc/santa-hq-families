/* Santa HQ Families — North Pole Adventure v4 Magic Window (2026-11-23, Santa HQ Families compatible)
 * Additive Kid View enhancement. Load after kid-view-recording-fix.js.
 * Does not touch gifts, budgets, shopping, family sync or other adult pages.
 */
(function () {
  'use strict';
  if (typeof renderKidPortal !== 'function' || typeof enterKid !== 'function' ||
      typeof exitKid !== 'function' || typeof showKidSent !== 'function' ||
      typeof appState === 'undefined') {
    console.warn('Santa HQ North Pole Adventure: Kid View was not found.');
    return;
  }
  if (window.__santaNorthPoleAdventureLoaded) return;
  window.__santaNorthPoleAdventureLoaded = true;
  console.info("Santa HQ North Pole Adventure v4 Magic Window loaded successfully (Families-compatible).");

  const originalRender = renderKidPortal;
  const originalEnter = enterKid;
  const originalSent = showKidSent;
  const YEAR = new Date().getFullYear();
  const STAMPS_KEY = `santa_hq_north_pole_passport_${YEAR}`;
  const state = { view: 'arrival', found: [], santaChoice: 'hello', storyStage: 0, storyBranch: 0, gameMode: 'explorer', gameRound: 0, wrong: 0, hinted: -1, voiceIndex: 0, boardingToken: 0, deskItem: 'globe', deskTaps: 0, deskFinished: {}, magicStars: [], magicAwake: false, magicMission: 'gifts', magicDone: [], magicReveals: [], magicReaction: 'ready', magicSecret: '', magicVisits: 0, deliveryRide: 'reindeer', letterSeal: 'star' };
  let sessionStamps = {};

  const stars = [
    { left: 12, top: 28 }, { left: 76, top: 18 }, { left: 31, top: 63 },
    { left: 58, top: 42 }, { left: 85, top: 71 }, { left: 43, top: 19 },
    { left: 69, top: 82 }, { left: 18, top: 77 }, { left: 90, top: 37 },
    { left: 51, top: 85 }, { left: 27, top: 39 }, { left: 70, top: 57 }
  ];
  const decoys = [
    { left: 19, top: 45 }, { left: 55, top: 23 }, { left: 82, top: 51 },
    { left: 38, top: 81 }, { left: 71, top: 33 }, { left: 9, top: 68 },
    { left: 47, top: 54 }, { left: 90, top: 83 }, { left: 30, top: 18 },
    { left: 62, top: 68 }, { left: 11, top: 13 }, { left: 80, top: 12 }
  ];
  const modes = {
    little: { label: 'Little Elf', instruction: 'Find five bright stars. A perfect first mission.', count: 5, decoys: 0 },
    explorer: { label: 'Star Explorer', instruction: 'Find seven hidden gold stars. Some snowflakes are just there to fool you!', count: 7, decoys: 7 },
    master: { label: 'Master Elf', instruction: 'Find nine tiny stars among the snowflakes and ornaments.', count: 9, decoys: 11 }
  };
  const adventures = {
    hello: {
      opener: 'Oh, hello, {name}! I was just about to open a mysterious little box. It made a jingling sound! What should we do?',
      choices: [ ['Peek inside the box', 'We lift the lid and... oh! A tiny silver bell rolls into my mitten. A reindeer must have lost it!'], ['Shake it gently', 'Jingle, jingle! An elf pops around the corner. That bell belongs to a very important reindeer, he says.'] ],
      ending: 'We put the little bell back where it belongs. The workshop fills with happy jingles. Thank you for helping me, {name}!'
    },
    reindeer: {
      opener: 'Something strange happened at the reindeer barn. I found sparkly hoofprints in the snow, but no reindeer! How shall we look?',
      choices: [ ['Follow the footprints', 'The sparkly tracks lead us straight to a sleepy reindeer tucked under a blanket. He has been having a lovely nap!'], ['Listen for bells', 'We close our eyes. Jingle, jingle! There is a reindeer playing hide-and-seek behind the tallest Christmas tree.'] ],
      ending: 'We give our reindeer a gentle scratch behind the ears and a carrot for the journey home. What a wonderful little rescue!'
    },
    elves: {
      opener: 'An elf rushed into my room with a ribbon twice as long as the table! The wrapping station needs help. What should we try?',
      choices: [ ['Make a giant bow', 'You loop the ribbon into the fluffiest bow I have ever seen. Even the elves stop to clap!'], ['Ask an elf to help', 'Two elves hold the ends while you make the knot. Together, you finish the wrapping in no time.'] ],
      ending: 'We hang a little paper star over the workbench to celebrate. Helping hands make the North Pole shine, {name}!'
    },
    secret: {
      opener: 'I have a snowy secret to share. There is a tiny door beside the fireplace, and this morning it was open. Shall we investigate?',
      choices: [ ['Look through the door', 'Beyond it is a warm room where the elves keep their collection of thank-you letters. Every letter is treasured.'], ['Knock three times', 'Tap, tap, tap. A little elf opens the door and hands us a handmade card covered in glittery snowflakes!'] ],
      ending: 'You know the best part of Christmas magic? It grows every time we make someone else smile. That is a secret worth keeping!'
    }
  };

  function htmlEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Work with newer Santa HQ Families (up to six children), and earlier two-child releases.
  function familyChildren() {
    if (typeof configuredChildren === 'function') return configuredChildren();
    return [{ id: '1', name: settings.child1 || 'Child 1', icon: 'star' },
            { id: '2', name: settings.child2 || 'Child 2', icon: 'heart' }];
  }
  function child() {
    const kids = familyChildren();
    const selected = String(appState.kidSelected || '');
    return kids.find(c => String(c.id) === selected)?.id || kids[0]?.id || '1';
  }
  function childName() {
    return htmlEscape(familyChildren().find(c => String(c.id) === String(child()))?.name || 'Little elf');
  }
  function getAllStamps() {
    try {
      const saved = JSON.parse(localStorage.getItem(STAMPS_KEY) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? { ...saved, ...sessionStamps } : sessionStamps;
    } catch { return sessionStamps; }
  }
  function stamps() {
    const item = getAllStamps()[child()];
    return item && typeof item === 'object' ? item : {};
  }
  function earnStamp(kind) {
    if (!['workshop', 'santa', 'post'].includes(kind)) return;
    const all = getAllStamps();
    all[child()] = { ...(all[child()] || {}), [kind]: true };
    sessionStamps = all;
    try { localStorage.setItem(STAMPS_KEY, JSON.stringify(all)); }
    catch (error) { console.warn('North Pole passport could not be stored on this device.', error); }
  }
  function stopNarration() {
    try { window.speechSynthesis?.cancel(); } catch (_) { }
    isSpeaking = false;
  }
  function starIcon(size = 18) {
    return `<svg class="np-star-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 1.8 2.8 6 6.6.8-4.8 4.6 1.2 6.5-5.8-3.1-5.8 3.1 1.2-6.5-4.8-4.6 6.6-.8Z"/></svg>`;
  }
  function chevron() { return '<svg viewBox="0 0 24 24" aria-hidden="true" class="np-chevron"><path d="m8 5 7 7-7 7"/></svg>'; }
  function snowflake() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" class="np-small-icon"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19M9 4l3 3 3-3M9 20l3-3 3 3"/></svg>';
  }
  function villageArt() {
    // Fully inline winter illustration: no external image request needed.
    return `<svg class="np-village-art" viewBox="0 0 800 355" role="img" aria-label="Snowy North Pole village with glowing windows, Christmas trees, and Santa's workshop" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="np-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#503a52"/><stop offset=".7" stop-color="#977384"/><stop offset="1" stop-color="#d9abb0"/></linearGradient>
        <linearGradient id="np-house" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e9c1a9"/><stop offset="1" stop-color="#ba806c"/></linearGradient>
        <linearGradient id="np-pine" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#315e58"/><stop offset="1" stop-color="#163e42"/></linearGradient>
        <radialGradient id="np-glow"><stop stop-color="#ffe5ac" stop-opacity=".85"/><stop offset="1" stop-color="#ffe5ac" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="800" height="355" fill="url(#np-sky)"/>
      <circle cx="634" cy="72" r="88" fill="url(#np-glow)"/>
      <circle cx="634" cy="72" r="34" fill="#fff3d2"/>
      <g fill="#fff0d2" opacity=".92"><circle cx="55" cy="52" r="2"/><circle cx="166" cy="24" r="1.5"/><circle cx="236" cy="90" r="1.5"/><circle cx="321" cy="30" r="2"/><circle cx="456" cy="55" r="1.4"/><circle cx="535" cy="30" r="2.5"/><circle cx="731" cy="126" r="1.6"/><circle cx="94" cy="115" r="1.8"/><circle cx="373" cy="105" r="1.5"/><circle cx="691" cy="20" r="1.5"/></g>
      <path d="M0 245Q115 190 209 230T400 221Q513 169 626 222T800 204V355H0Z" fill="#b8c9c3"/>
      <path d="M0 276Q150 232 293 273T590 248Q698 231 800 264V355H0Z" fill="#e8ede2"/>
      <g fill="url(#np-pine)" stroke="#bdcfbf" stroke-width="2">
        <path d="m70 146-33 91h67z"/><path d="m70 118-28 89h57z"/><path d="m124 174-31 84h64z"/><path d="m124 150-27 81h55z"/>
        <path d="m726 158-35 99h73z"/><path d="m726 130-29 96h61z"/><path d="m779 173-27 83h55z"/>
      </g>
      <g transform="translate(247 115)">
        <rect x="17" y="82" width="277" height="150" rx="10" fill="url(#np-house)"/>
        <rect x="55" y="25" width="198" height="70" rx="5" fill="#b85855"/>
        <path d="M0 103 155 0l156 103-15 16L155 29 15 119Z" fill="#f7e8d6"/>
        <path d="M18 110 155 19l139 91" fill="none" stroke="#ffffff" stroke-width="13" stroke-linecap="round"/>
        <path d="M105 232V135a50 50 0 0 1 100 0v97" fill="#345b51"/>
        <path d="M114 231v-95a41 41 0 0 1 82 0v95" fill="#784944"/>
        <circle cx="179" cy="182" r="4" fill="#f7ce81"/>
        <rect x="38" y="144" width="48" height="60" rx="7" fill="#fff0bd" stroke="#fff8dd" stroke-width="6"/>
        <path d="M62 145v58m-24-30h48" stroke="#be9271" stroke-width="5"/>
        <rect x="226" y="144" width="48" height="60" rx="7" fill="#fff0bd" stroke="#fff8dd" stroke-width="6"/>
        <path d="M250 145v58m-24-30h48" stroke="#be9271" stroke-width="5"/>
        <g fill="#f7d58c"><circle cx="46" cy="100" r="5"/><circle cx="80" cy="75" r="5"/><circle cx="115" cy="55" r="5"/><circle cx="155" cy="35" r="5"/><circle cx="195" cy="55" r="5"/><circle cx="231" cy="77" r="5"/><circle cx="269" cy="101" r="5"/></g>
        <rect x="91" y="80" width="128" height="38" rx="18" fill="#f9e9d4" stroke="#d8ac85" stroke-width="4"/>
        <text x="155" y="105" font-size="16" font-weight="800" text-anchor="middle" fill="#865b48" font-family="Georgia, serif">WORKSHOP</text>
      </g>
      <g transform="translate(105 218)"><rect x="0" y="37" width="111" height="67" rx="7" fill="#bc7d78"/><path d="m-10 42 65-51 68 51Z" fill="#f5e6d8"/><rect x="16" y="53" width="31" height="30" fill="#ffecaf"/><rect x="69" y="49" width="28" height="52" rx="14" fill="#4d6056"/></g>
      <g transform="translate(604 237)"><rect x="0" y="20" width="112" height="67" rx="7" fill="#ba8569"/><path d="m-8 25 65-49 65 49Z" fill="#fff0df"/><rect x="18" y="41" width="30" height="28" fill="#ffe8a6"/><rect x="68" y="38" width="29" height="47" rx="14" fill="#446558"/></g>
      <path d="M0 330Q201 287 365 314T800 306V355H0Z" fill="#fcf5e9"/>
      <path d="M0 353Q194 307 380 339T800 328" fill="none" stroke="#e0ebdf" stroke-width="8"/>
      <g fill="#fff8e7" opacity=".9"><circle cx="28" cy="195" r="3"/><circle cx="166" cy="169" r="2.5"/><circle cx="287" cy="56" r="2"/><circle cx="387" cy="71" r="3"/><circle cx="560" cy="138" r="2.5"/><circle cx="780" cy="74" r="3"/><circle cx="736" cy="289" r="2.5"/></g>
    </svg>`;
  }
  function topBar(crumb = 'NORTH POLE ADVENTURE') {
    return `<header class="np-topbar">
      <div class="np-brand"><span class="np-brandmark"><img src="./art/santa-peek.svg" alt=""></span><span><b>Santa HQ</b><small>${crumb}</small></span></div>
      <button type="button" class="np-grownups" data-np-action="grownups" aria-label="Return to grown-up Santa HQ with PIN">Grown-ups <span aria-hidden="true">↗</span></button>
    </header>`;
  }
  function backNav() {
    return `<button type="button" class="np-back" data-np-action="village">${chevron()} Back to the village</button>`;
  }
  function childPicker() {
    const kids = familyChildren();
    return `<div class="np-traveler-picker" role="group" aria-label="Who's visiting the North Pole?">
      <span>WHO'S VISITING?</span>
      <div class="np-traveler-options">
        ${kids.map((c, i) => `<button type="button" data-np-action="child" data-child="${htmlEscape(c.id)}" aria-pressed="${String(child()) === String(c.id)}" class="np-traveler ${String(child()) === String(c.id) ? 'selected' : ''}"><span class="np-traveler-symbol ${i === 0 ? 'np-purple' : i === 1 ? 'np-pink' : ''}">${i === 1 ? '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M12 21.3 3.1 12.4A5.7 5.7 0 0 1 11.2 4l.8.8.8-.8a5.7 5.7 0 0 1 8.1 8.4Z"/></svg>' : starIcon(17)}</span>${htmlEscape(c.name)}</button>`).join('')}
      </div>
    </div>`;
  }
  function passport() {
    const s = stamps();
    const items = [['workshop', 'Elf helper', './art/elf.svg'], ['santa', 'Santa visit', './art/santa-peek.svg'], ['post', 'Special delivery', './art/letter.svg']];
    return `<section class="np-passport" aria-label="Your North Pole passport">
      <div class="np-passport-heading"><div><span class="np-eyebrow np-eyebrow-dark">YOUR NORTH POLE PASSPORT</span><h2>Collect a little magic</h2></div><span class="np-stamp-count">${items.filter(([key]) => s[key]).length} of 3 stamps</span></div>
      <div class="np-passport-stamps">${items.map(([key, label, img]) => `<div class="np-stamp ${s[key] ? 'earned' : ''}"><span class="np-stamp-art"><img src="${img}" alt=""></span><strong>${label}</strong><small>${s[key] ? 'MAGIC COLLECTED' : 'READY TO DISCOVER'}</small>${s[key] ? `<span class="np-stamp-check" aria-label="Completed">${starIcon(12)}</span>` : ''}</div>`).join('')}</div>
      <p class="np-passport-note">Your stamps stay on this device so you can visit again.</p>
    </section>`;
  }
  function welcomePage() {
    return `<div class="np-shell">${topBar('WELCOME ABOARD')}
      <section class="np-welcome-hero">
        ${villageArt()}
        <div class="np-welcome-shade"></div>
        <div class="np-welcome-copy">
          <span class="np-eyebrow np-eyebrow-light">THE NORTH POLE EXPRESS</span>
          <h1>Your ticket to <em>Christmas magic.</em></h1>
          <p>Climb aboard, visit Santa through his magic window, and send something special through North Pole Post.</p>
          <button type="button" class="np-primary np-arrival-btn" data-np-action="board">Enter the North Pole ${chevron()}</button>
        </div>
        <span class="np-hero-trail" aria-hidden="true">${starIcon(15)} ${starIcon(22)} ${starIcon(12)}</span>
      </section>
      <section class="np-welcome-bottom">
        ${childPicker()}
        <div class="np-welcome-ticket"><span class="np-ticket-icon">${starIcon(27)}</span><div><strong>A ticket for ${childName()}</strong><small>Destination: Santa's Village • Admit one little explorer</small></div><span class="np-ticket-dots" aria-hidden="true">•••</span></div>
      </section>
      <p class="np-disclaimer">A make-believe North Pole adventure, made for little imaginations.</p>
    </div>`;
  }
  function boardingPage() {
    return `<div class="np-shell np-train-shell">${topBar('THE NORTH POLE EXPRESS')}
      <section class="np-boarding" role="status" aria-live="polite">
        <div class="np-boarding-stars" aria-hidden="true">${starIcon(17)}${starIcon(29)}${starIcon(12)}${starIcon(23)}${starIcon(16)}</div>
        <span class="np-eyebrow np-eyebrow-light">CHOO CHOO!</span><h1>Next stop:<br><em>the North Pole!</em></h1>
        <div class="np-train-art" aria-hidden="true"><span class="np-train-smoke np-smoke-one"></span><span class="np-train-smoke np-smoke-two"></span><span class="np-train-chimney"></span><span class="np-train-cab"></span><span class="np-train-engine"></span><span class="np-train-wheel left"></span><span class="np-train-wheel right"></span><span class="np-train-car"></span><span class="np-train-car-wheel"></span></div>
        <p>Follow the sparkling tracks through the snow…</p>
        <button type="button" class="np-text-button" data-np-action="village">Take me there ${chevron()}</button>
      </section>
    </div>`;
  }
  function destinationCard(mode, title, desc, image, kicker, c) {
    return `<button type="button" class="np-destination np-dest-${c}" data-np-action="${mode}" aria-label="Visit ${title}">
      <span class="np-destination-scene"><span class="np-destination-orbit"></span><img src="${image}" alt=""></span>
      <span class="np-destination-copy"><span class="np-dest-kicker">${kicker}</span><strong>${title}</strong><small>${desc}</small></span>
      <span class="np-dest-arrow">${chevron()}</span>
    </button>`;
  }
  function villagePage() {
    return `<div class="np-shell">${topBar('WELCOME TO THE NORTH POLE')}
      <section class="np-village-banner">
        ${villageArt()}
        <div class="np-village-title"><span class="np-eyebrow np-eyebrow-light">YOU MADE IT!</span><h1>Welcome to<br><em>Santa's Village, ${childName()}!</em></h1><p>Pick a magical place to visit.</p></div>
      </section>
      <div class="np-village-content">
        <div class="np-current-traveler">${childPicker()}</div>
        <div class="np-section-intro"><span class="np-eyebrow np-eyebrow-dark">THE VILLAGE MAP</span><h2>Where should we go first?</h2><p>Tap a place to explore.</p></div>
        <div class="np-destinations">
          ${destinationCard('santa', "Santa’s Magic Window", 'Wake the window and help Santa with a mission.', './art/santa-full.svg', 'A SPECIAL VISIT', 'santa')}
          ${destinationCard('workshop', "The Elf Workshop", 'Choose a mission. Search carefully. Earn your elf badge.', './art/elf.svg', 'A LITTLE MISSION', 'elf')}
          ${destinationCard('mail', 'North Pole Post Office', 'Talk, draw, or send a letter to Santa.', './art/mailbox.svg', 'A MESSAGE TO SANTA', 'post')}
        </div>
        ${passport()}
        <button type="button" class="np-train-return" data-np-action="arrival">${chevron()} Ride the North Pole Express again</button>
      </div>
    </div>`;
  }
  // Santa's Magic Window: offline, touch-first interactions with scripted responses.
  const magicMissions = {
    gifts: {title:'Load Santa’s sleigh',subtitle:'PACK THE PRESENTS',description:'The elves wrapped three gifts. Tap them to send them into Santa’s sleigh.',count:3},
    tree: {title:'Decorate the Christmas tree',subtitle:'ADD SOME SPARKLE',description:'Choose three ornaments to finish decorating Santa’s special tree.',count:3},
    bell: {title:'Find the missing reindeer bell',subtitle:'A CHRISTMAS MYSTERY',description:'A reindeer lost its bell. Look inside the four hiding places!',count:1}
  };
  const magicKeys = Object.keys(magicMissions);
  const magicGiftColors = ['cranberry','green','gold'];
  const magicOrnamentColors = ['rose','gold','violet','green'];
  function magicIcon(name) {
    if (name==='gifts' || name==='gift') return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="23" width="46" height="32" rx="5" fill="#ae5363" stroke="#8e3c4b" stroke-width="3"/><path d="M9 33h46M32 23v32" stroke="#f6d38c" stroke-width="7"/><path d="M32 23c-19 0-20-15-10-15 6 0 10 9 10 15Zm0 0c19 0 20-15 10-15-6 0-10 9-10 15Z" fill="#f9dea0" stroke="#bb8a4b" stroke-width="2"/></svg>`;
    if (name==='tree') return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 8 18 26h-7l12 16H9l12-16h-7Z" fill="#397b61" stroke="#285945" stroke-width="2"/><rect x="27" y="47" width="10" height="13" rx="2" fill="#b98464"/><path d="m32 1 3 7 7 1-5 5 2 7-7-4-7 4 2-7-5-5 7-1Z" fill="#f6c96a"/></svg>`;
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 12c-10 0-18 9-18 22v10L8 52h48l-6-8V34c0-13-8-22-18-22Z" fill="#e8bd66" stroke="#a87b47" stroke-width="3"/><path d="M22 26c1-6 5-10 11-10" fill="none" stroke="#fff2ba" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="55" r="6" fill="#ac6e57"/></svg>`;
  }
  function magicSaved() { return stamps().windowMissions || {}; }
  function magicRecordMission(key) {
    earnStamp('santa');
    const all=getAllStamps(), id=child();
    all[id]={...(all[id]||{}),windowMissions:{...(all[id]?.windowMissions||{}),[key]:true}};
    sessionStamps=all;
    try {localStorage.setItem(STAMPS_KEY,JSON.stringify(all));}catch (_){}
  }
  function magicSpeak() {
    const name=childName(), n=state.magicDone.length;
    if (!state.magicAwake) return `Psst, ${name}! Find the three glowing stars to wake Santa's magic window.`;
    if(state.magicSecret) return state.magicSecret;
    if(state.magicReaction==='complete') return ({gifts:`Ho, ho, ho! The sleigh is packed, ${name}! You saved the day!`,tree:`Look at our sparkling Christmas tree, ${name}! Beautiful work!`,bell:`You found my reindeer's bell, ${name}! What a wonderful helper!`})[state.magicMission];
    if(state.magicReaction==='miss') return `Not there! Keep searching. The elves are very clever at hiding things!`;
    if(state.magicMission==='gifts') return n?`Wonderful, ${name}! Only ${3-n} ${3-n===1?'present':'presents'} to go!`:`Oh, ${name}! Will you help me load these presents?`;
    if(state.magicMission==='tree') return n?`That ornament looks wonderful! Let's add ${3-n} more.`:`Which colors should we put on my Christmas tree, ${name}?`;
    return `Oh dear, ${name}! My reindeer lost a little golden bell. Where could it be?`;
  }
  function magicStarScene() {
    const ready=state.magicAwake, celebrated=state.magicReaction==='complete';
    return `<section class="npw-scene ${ready?'awake':''} ${celebrated?'celebrated':''}" aria-label="Interactive magical window to Santa's North Pole workshop">
      <div class="npw-sky"><span class="npw-moon"></span>${Array.from({length:18},(_,i)=>`<i style="--x:${(i*47+11)%97}%;--y:${(i*23+17)%86}%;--d:${i%5}s"></i>`).join('')}</div>
      <div class="npw-room"><div class="npw-fireplace"><span>✦</span></div><div class="npw-shelf">✦ &nbsp; ✧ &nbsp; ✦</div><div class="npw-floor"></div><img class="npw-santa" src="./kid-santa-new.webp" onerror="this.onerror=null;this.src='./art/santa-full.svg'" alt="Santa smiling and waving in his workshop"/></div>
      <div class="npw-frame" aria-hidden="true"><div class="npw-arch"></div><div class="npw-window-sign">✦ &nbsp; SANTA'S MAGIC WINDOW &nbsp; ✦</div></div>
      ${ready?`<button class="npw-easter" type="button" data-np-action="magic-secret" aria-label="Discover a hidden sparkle">✦</button>`:`<div class="npw-frost"><span class="npw-frost-label">TAP THREE MAGIC STARS</span>${[[18,30],[80,31],[48,71]].map(([x,y],i)=>`<button class="npw-star ${state.magicStars.includes(i)?'found':''}" data-np-action="magic-wake" data-star="${i}" type="button" style="left:${x}%;top:${y}%" aria-label="${state.magicStars.includes(i)?'Found':'Wake-up'} star ${i+1}" ${state.magicStars.includes(i)?'disabled':''}>${starIcon(i===1?48:40)}</button>`).join('')}</div>`}
    </section>`;
  }
  function magicChoice(key) {
    const labels={gifts:'Pack gifts',tree:'Decorate tree',bell:'Find bell'};
    return `<button class="npw-choice ${state.magicMission===key?'selected':''}" type="button" data-np-action="magic-mission" data-mission="${key}" aria-pressed="${state.magicMission===key}"><span>${magicIcon(key)}</span><strong>${labels[key]}</strong>${magicSaved()[key]?'<i aria-label="Completed mission">✓</i>':''}</button>`;
  }
  function magicActivity() {
    if(!state.magicAwake) return `<section class="npw-awaken"><span class="np-eyebrow np-eyebrow-dark">THE SECRET NORTH POLE SIGNAL</span><h2>Wake the magic!</h2><p>Tap each glowing star to open the frosted window.</p><div class="npw-wake-progress" aria-live="polite">${[0,1,2].map(i=>`<span class="${state.magicStars.includes(i)?'found':''}">${starIcon(25)}</span>`).join('')}<small>${state.magicStars.length} / 3 stars</small></div></section>`;
    const key=state.magicMission, config=magicMissions[key], complete=state.magicReaction==='complete';
    let contents='';
    if(key==='gifts') contents=`<div class="npw-sleigh"><span>${magicIcon('gifts')}</span><strong>Santa's sleigh</strong><div class="npw-packed">${state.magicDone.map(()=>'<b aria-hidden="true">✦</b>').join('')}</div></div><div class="npw-gifts">${magicGiftColors.map((c,i)=>{const done=state.magicDone.includes(String(i));return `<button type="button" class="npw-gift ${c} ${done?'packed':''}" data-np-action="magic-gift" data-id="${i}" ${done?'disabled':''} aria-label="${done?'Loaded':'Load'} ${c} gift">${magicIcon('gift')}<small>${done?'Packed!':c+' gift'}</small></button>`}).join('')}</div>`;
    if(key==='tree') contents=`<div class="npw-tree-scene"><div class="npw-tree-art">${magicIcon('tree')}${state.magicDone.map((i,k)=>`<span class="npw-tree-ball ${magicOrnamentColors[Number(i)]}" style="--i:${k}"></span>`).join('')}</div><div class="npw-colors">${magicOrnamentColors.map((c,i)=>{const done=state.magicDone.includes(String(i));return `<button type="button" class="npw-color ${c} ${done?'used':''}" data-np-action="magic-ornament" data-id="${i}" ${done?'disabled':''}><i></i><span>${c} ornament</span></button>`}).join('')}</div></div>`;
    if(key==='bell') {
      const places=[['stocking','Stocking'],['tree','Behind tree'],['gifts','Toy box'],['bell','Reindeer barn']];
      const answer=(new Date().getDate()+String(child()).length+state.magicVisits)%4;
      contents=`<div class="npw-hiding">${places.map(([icon,label],i)=>{const opened=state.magicReveals.includes(String(i));return `<button type="button" class="npw-hide ${opened?'checked':''}" data-np-action="magic-hide" data-id="${i}" data-answer="${answer}" ${opened?'disabled':''}><span>${magicIcon(icon)}</span><strong>${label}</strong><small>${opened?(i===answer?'Found it!':'Not here'):'Peek inside'}</small></button>`}).join('')}</div>`;
    }
    return `<section class="npw-activity"><div class="npw-mission-title"><span class="np-eyebrow np-eyebrow-dark">CHOOSE A NORTH POLE MISSION</span><h2>Help Santa make magic!</h2></div><div class="npw-choices">${magicKeys.map(magicChoice).join('')}</div><div class="npw-task ${complete?'finished':''}" aria-live="polite"><span class="np-eyebrow np-eyebrow-dark">${config.subtitle}</span><h3>${config.title}</h3><p>${config.description}</p>${contents}<div class="npw-task-progress">${complete?`${starIcon(22)} Mission complete!`:key==='bell'?`${state.magicReveals.length} hiding places checked`:`${state.magicDone.length} of ${config.count} done`}</div>${complete?`<div class="npw-task-actions"><button class="np-primary" data-np-action="mail" type="button">Send Santa a message ${chevron()}</button><button type="button" class="npw-next" data-np-action="magic-next">Another mission</button></div>`:''}</div></section>`;
  }
  function santaPage() {
    const done=Object.keys(magicSaved()).length;
    return `<div class="np-shell npw-shell">${topBar('SANTA’S MAGIC WINDOW')}<div class="np-inner npw-inner">${backNav()}<header class="npw-heading"><span class="np-eyebrow np-eyebrow-dark">A SPECIAL NORTH POLE VISIT</span><h1>Santa's <em>Magic Window</em></h1><p>Can you wake the window and help Santa with his Christmas missions?</p></header><div class="npw-stage-area">${magicStarScene()}<div class="npw-dialog" role="status" aria-live="polite"><span class="npw-face"><img src="./art/santa-peek.svg" alt="" /></span><div><small>SANTA SAYS</small><p>${magicSpeak()}</p></div></div></div>${magicActivity()}<section class="npw-post"><img src="./art/letter.svg" alt=""/><div><span class="np-eyebrow np-eyebrow-dark">SANTA WOULD LOVE TO HEAR FROM YOU</span><h2>Send something special</h2><p>Record a voice message, draw a picture, or write a note. Then choose a magic seal before sending it to North Pole Post.</p><button class="np-primary" type="button" data-np-action="mail">Visit the Post Office ${chevron()}</button></div></section><p class="npw-caption">${done} of 3 magic missions completed. Santa's messages in this scene are part of a pretend interactive adventure.</p></div></div>`;
  }
  function getMode() { return modes[state.gameMode] || modes.explorer; }
  function targetStars() {
    const count = getMode().count;
    return [...stars].map((_, i) => (i + state.gameRound * 3) % stars.length).slice(0, count);
  }
  function workshopPage() {
    const mode = getMode();
    const targets = targetStars();
    const found = state.found.length;
    const complete = found === mode.count;
    const levels = stamps().workshopLevels || {};
    return `<div class="np-shell">${topBar('THE ELF WORKSHOP')}
      <div class="np-inner">${backNav()}
        <section class="np-workshop-intro"><span class="np-eyebrow np-eyebrow-dark">HELP THE NORTH POLE SHINE</span><h1>Become a <em>star-finding elf!</em></h1><p>Choose a mission, then search the snowy village. There are trick decorations in the harder missions!</p></section>
        <div class="np-mission-switch" role="group" aria-label="Choose your workshop mission">
          ${Object.entries(modes).map(([key,m])=>`<button type="button" class="np-mode ${state.gameMode===key?'selected':''}" data-np-action="mode" data-mode="${key}" aria-pressed="${state.gameMode===key}"><strong>${htmlEscape(m.label)}</strong><small>${key==='little'?'Easy':key==='explorer'?'Tricky':'Extra tricky'}${levels[key]?' · Completed':''}</small></button>`).join('')}
        </div>
        <p class="np-mission-instructions" id="npInstructions">${htmlEscape(mode.instruction)}</p>
        <div class="np-progress-track"><div class="np-progress-copy"><b>${found} of ${mode.count} stars found</b><span>${complete ? 'Mission complete!' : state.hinted >= 0 ? 'A star is sparkling a little brighter…' : state.wrong >= 3 ? 'Good searching! Try a hint if you need it.' : 'Look closely—the stars are smaller in harder missions'}</span></div><div class="np-progress-bar" role="progressbar" aria-valuenow="${found}" aria-valuemax="${mode.count}" aria-valuemin="0" aria-label="Stars found"><span style="width:${found/mode.count*100}%"></span></div></div>
        <div class="np-workshop-scene np-game-${state.gameMode}" aria-label="Interactive snowy workshop: tap the golden stars" aria-describedby="npInstructions">
          ${villageArt()}
          ${targets.map((index, i) => { const position = stars[index], done = state.found.includes(index); return `<button type="button" class="np-find-star ${done?'found':''} ${state.hinted===index?'hinted':''}" data-np-action="find-star" data-star="${index}" aria-label="Golden star ${i+1}${done?', already found':''}" ${done?'disabled':''} style="left:${position.left}%;top:${position.top}%">${starIcon(31)}</button>` }).join('')}
          ${decoys.slice(0, mode.decoys).map((d,i)=>`<button type="button" class="np-decoy" data-np-action="decoy" aria-label="${i%2?'An ornament, not a star':'A snowflake, not a star'}" style="left:${d.left}%;top:${d.top}%">${i%2?'<span class="np-tiny-ornament" aria-hidden="true"></span>':snowflake()}</button>`).join('')}
        </div>
        ${complete ? `<div class="np-mission-complete" role="status">${starIcon(27)}<h2>You did it, ${childName()}!</h2><p>You completed the ${htmlEscape(mode.label)} mission. Your passport remembers your hard work!</p><div class="np-complete-actions"><button type="button" class="np-primary" data-np-action="village">See my passport ${chevron()}</button><button type="button" class="np-text-button np-replay" data-np-action="replay">Try a new round</button></div></div>` : `<div class="np-game-tools"><div class="np-elf-help"><img src="./art/elf.svg" alt="A friendly elf"><p><strong>The elves are cheering for you!</strong><span>${state.wrong>0?'That one was a decoration. Keep looking for gold stars!':'Try the roof, the trees, and the night sky.'}</span></p></div><button type="button" class="np-hint-button" data-np-action="hint">${snowflake()} Give me a hint</button></div>`}
      </div>
    </div>`;
  }

  function renderAdventure() {
    const portal = document.getElementById('kidPortal');
    if (!portal || !appState.kidActive) return originalRender();
    document.body.classList.add('kid-open');
    portal.hidden = false;
    portal.classList.add('np-adventure-portal');
    const views = { arrival: welcomePage, boarding: boardingPage, village: villagePage, santa: santaPage, workshop: workshopPage };
    const page = (views[state.view] || welcomePage)();
    portal.innerHTML = `<main class="np-app">${page}</main>`;
  }

  const seals = {
    star: { symbol: '✦', label: 'Golden star', description: 'A little Christmas sparkle' },
    snow: { symbol: '❄', label: 'Snowflake', description: 'Snowy North Pole magic' },
    heart: { symbol: '♥', label: 'Kind heart', description: 'Sent with extra love' },
    bell: { symbol: '♫', label: 'Jingle bell', description: 'A joyful little jingle' }
  };
  function sealChooser() {
    return `<section class="np-seal-section" aria-label="Choose a magical seal for the letter"><div class="np-seal-head"><span>THE FINAL TOUCH</span><h3>Pick a magical seal</h3><p>Give your message a special North Pole stamp before it goes.</p></div><div class="np-seal-options">${Object.entries(seals).map(([key,val])=>`<button type="button" class="np-seal ${state.letterSeal===key?'selected':''}" data-np-action="seal" data-seal="${key}" aria-pressed="${state.letterSeal===key}"><span>${val.symbol}</span><strong>${htmlEscape(val.label)}</strong></button>`).join('')}</div><div class="np-envelope-preview"><div class="np-envelope-art"><div class="np-envelope-flap"></div><span class="np-wax np-wax-${state.letterSeal}">${seals[state.letterSeal].symbol}</span></div><div><strong>For Santa • North Pole</strong><small>${seals[state.letterSeal].description}</small><small class="np-envelope-hint">Your message will be saved when you tap Send.</small></div></div></section>`;
  }
  const deliveryRides={
    reindeer:{name:'Reindeer Express',line:'A magical reindeer delivery',symbol:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m20 25-10-8V5M44 25l10-8V5M20 18 8 13m36 5 12-5" fill="none" stroke="#ad7950" stroke-width="5" stroke-linecap="round"/><path d="M18 27q14-15 28 0v15q-14 19-28 0Z" fill="#bb8a6a"/><circle cx="25" cy="35" r="2" fill="#513c38"/><circle cx="40" cy="35" r="2" fill="#513c38"/><circle cx="32" cy="46" r="5" fill="#c65d63"/></svg>'},
    snow:{name:'Snowy Owl Mail',line:'A flutter through the snowfall',symbol:'<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 23 16 9l14 7 15-7 6 14v23q-19 23-39 0Z" fill="#fff7e5" stroke="#ad94a0" stroke-width="3"/><circle cx="23" cy="30" r="8" fill="#c4b0a8"/><circle cx="42" cy="30" r="8" fill="#c4b0a8"/><circle cx="23" cy="30" r="3" fill="#44364c"/><circle cx="42" cy="30" r="3" fill="#44364c"/><path d="m28 39 4 6 5-6" fill="#dba65b"/></svg>'},
    sparkle:{name:'Star Trail',line:'A trail of North Pole sparkle',symbol:starIcon(31)}
  };
  function rideChooser() {
    return `<section class="npw-delivery-choose" aria-label="Choose your magical delivery"><span>HOW SHOULD YOUR LETTER TRAVEL?</span><h3>Choose a magical delivery</h3><div class="npw-delivery-options">${Object.entries(deliveryRides).map(([key,ride])=>`<button type="button" class="npw-delivery-mode ${state.deliveryRide===key?'chosen':''}" data-np-action="ride" data-ride="${key}" aria-pressed="${state.deliveryRide===key}"><span>${ride.symbol}</span><strong>${htmlEscape(ride.name)}</strong></button>`).join('')}</div><small>The special delivery animation plays after your message is saved.</small></section>`;
  }
  function decorateMail() {
    const portal = document.getElementById('kidPortal');
    const header = portal?.querySelector('.kid-header');
    if (!header) return;
    if (!header.querySelector('[data-np-action="village"]')) {
      const back = document.createElement('button');
      back.type = 'button'; back.dataset.npAction = 'village'; back.className = 'np-mail-home';
      back.innerHTML = `${chevron()} <span>Village map</span>`;
      back.setAttribute('aria-label', 'Back to the North Pole village');
      header.insertBefore(back, header.querySelector('.kid-exit'));
    }
    const title = portal.querySelector('.kid-intro h1');
    if (title) title.innerHTML = `A special delivery <span>from ${childName()}.</span>`;
    const intro = portal.querySelector('.kid-intro p');
    if (intro) intro.textContent = state.magicReaction==='complete' ? 'Santa loved your help! Tell him about your mission, decorate your message, and choose a magical delivery.' : 'Choose how to say hello. Add a magic seal, then choose how your letter travels!';
    const studio = portal.querySelector('.kid-inner');
    if (studio && !studio.querySelector('.np-mail-journey')) {
      studio.insertAdjacentHTML('afterbegin', `<section class="np-mail-journey" aria-label="How to send a message"><div class="np-mail-step"><img src="./art/microphone.svg" alt=""><span><strong>1. Create</strong><small>Talk, draw, or write</small></span></div><span class="np-mail-connector" aria-hidden="true">✦ ✦ ✦</span><div class="np-mail-step"><img src="./art/letter.svg" alt=""><span><strong>2. Decorate</strong><small>Choose a magic seal</small></span></div><span class="np-mail-connector" aria-hidden="true">✦ ✦ ✦</span><div class="np-mail-step"><img src="./art/mailbox.svg" alt=""><span><strong>3. Deliver</strong><small>Send to Santa</small></span></div></section>`);
    }
    const form = portal.querySelector('#kidMessageForm');
    const submit = form?.querySelector('#kidSubmit');
    if (form && submit && !form.querySelector('.np-seal-section')) {
      submit.insertAdjacentHTML('beforebegin', sealChooser() + rideChooser());
    }
    if (submit) {
      submit.classList.add('np-ship-btn');
      submit.setAttribute('aria-label','Save your message to the North Pole mailbox');
    }
    const label = portal.querySelector('.kid-message-panel > .kid-section-title');
    if (label) label.textContent = '3. Make your special message';
  }

  renderKidPortal = function () {
    if (!appState.kidActive) {
      const portal = document.getElementById('kidPortal');
      portal?.classList.remove('np-adventure-portal');
      state.view = 'arrival';
      return originalRender.apply(this, arguments);
    }
    if (state.view === 'mail') {
      document.getElementById('kidPortal')?.classList.remove('np-adventure-portal');
      originalRender.apply(this, arguments);
      decorateMail();
      return;
    }
    renderAdventure();
  };

  enterKid = function () {
    state.boardingToken++;
    state.view = 'arrival';
    state.santaChoice = 'hello';
    state.storyStage = 0;
    state.storyBranch = 0;
    state.deskItem = 'globe'; state.deskTaps = 0; state.deskFinished = {}; state.magicStars=[]; state.magicAwake=false; state.magicMission='gifts'; state.magicDone=[]; state.magicReveals=[]; state.magicReaction='ready'; state.magicSecret=''; state.magicVisits=0; state.deliveryRide='reindeer'; state.letterSeal='star';
    state.found = [];
    state.wrong = 0;
    state.hinted = -1;
    stopNarration();
    return originalEnter.apply(this, arguments);
  };

  showKidSent = function () {
    // This hook is called by the existing app only after its save completes.
    // Never display successful delivery merely because a child pressed Send.
    earnStamp('post');
    originalSent.apply(this, arguments);
    const portal = document.getElementById('kidPortal');
    if (!portal) return;
    portal.classList.remove('np-adventure-portal');
    portal.innerHTML = `<section class="np-delivered np-delivery-${state.deliveryRide}" role="status" aria-live="polite">
      <div class="np-delivered-sky" aria-hidden="true"><span class="np-delivery-trail">✦ &nbsp; ✧ &nbsp; ✦ &nbsp; ✧</span><span class="npw-delivery-courier" aria-hidden="true">${deliveryRides[state.deliveryRide].symbol}</span><span class="np-flying-envelope"><img src="./art/letter.svg" alt=""></span><span class="np-delivery-mailbox"><img src="./art/mailbox.svg" alt=""></span></div>
      <div class="np-delivered-content"><span class="np-eyebrow np-eyebrow-dark">SPECIAL DELIVERY COMPLETE</span><h1>Your message made it to Santa's mailbox!</h1><p>Hooray, ${childName()}! Your message is saved in North Pole Post. Look for your special delivery stamp in your passport.</p><p class="npw-delivery-method">${htmlEscape(deliveryRides[state.deliveryRide].name)} is on the way!</p><div class="np-delivered-seal"><span>${seals[state.letterSeal].symbol}</span><strong>${htmlEscape(seals[state.letterSeal].label)} seal</strong></div><div class="np-delivered-actions"><button class="np-primary" data-action="kid-again" type="button">Send another message ${chevron()}</button><button class="np-secondary" data-np-action="village" type="button">Back to Santa's Village</button></div><p class="np-delivery-footnote">Only the adults in your family's Santa HQ account can view the saved message. Santa's replies are written by your grown-ups.</p></div>
    </section>`;
  };

  function go(view) {
    state.boardingToken++;
    stopNarration();
    if (state.view === 'mail' && view !== 'mail') {
      const hasDraft = Boolean(typeof kidAudio !== 'undefined' && kidAudio) ||
        Boolean(document.getElementById('kidMessage')?.value.trim()) ||
        /^(recording:|finishing your recording|opening microphone|saving to santa)/i.test(document.getElementById('kidRecordStatus')?.textContent || '') ||
        Boolean(typeof kidDrawTouched !== 'undefined' && kidDrawTouched) ||
        (typeof kidRecorder !== 'undefined' && kidRecorder?.state === 'recording');
      if (hasDraft && !window.confirm('Leave the post office? Your unsent message will be cleared.')) return;
      if (typeof resetKidDraft === 'function') resetKidDraft();
    }
    state.view = view;
    renderKidPortal();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Browsers expose different built-in voices. Favor higher-quality voices when present;
  // never suggest this is recorded/live Santa audio or require a paid API service.
  function availableVoices() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    const english = voices.filter(v => /^en([_-]|$)/i.test(v.lang || ''));
    function score(v) {
      const n = (v.name || '').toLowerCase();
      let s = v.localService === false ? 20 : 0;
      if (/natural|neural|premium|enhanced/.test(n)) s += 55;
      if (/aria|jenny|ava|samantha|karen|zoe|alex|moira|daniel|serena|allison/.test(n)) s += 30;
      if (/fred|compact|e-speak|espeak/.test(n)) s -= 60;
      if (v.lang === 'en-US') s += 10;
      return s;
    }
    return english.sort((a,b)=>score(b)-score(a));
  }
  function preferredVoice() {
    const voices = availableVoices();
    return voices[state.voiceIndex % voices.length] || null;
  }
  let isSpeaking = false;
  function narrate() {
    const label = document.querySelector('.np-read-aloud span');
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      if (label) label.textContent = 'Ask a grown-up to read with you';
      return;
    }
    if (isSpeaking) {
      stopNarration(); isSpeaking = false;
      if (label) label.textContent = 'Read this part to me';
      return;
    }
    const speech = new SpeechSynthesisUtterance(storyDetails());
    speech.lang = 'en-US';
    const voice = preferredVoice();
    if (voice) speech.voice = voice;
    speech.rate = 0.96;
    speech.pitch = 0.99;
    speech.volume = 1;
    speech.onend = speech.onerror = () => {
      isSpeaking = false;
      const live = document.querySelector('.np-read-aloud span');
      if (live) live.textContent = 'Read this part to me';
    };
    stopNarration();
    isSpeaking = true;
    if (label) label.textContent = 'Stop the narrator';
    window.speechSynthesis.speak(speech);
  }
  function resetStory(topic) {
    state.santaChoice = topic;
    state.storyStage = 0;
    state.storyBranch = 0;
    stopNarration(); isSpeaking = false;
    renderKidPortal();
  }
  function playSparkle() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const t = context.currentTime;
      [740, 990].forEach((hz, i) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine'; osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, t+i*.09);
        gain.gain.exponentialRampToValueAtTime(0.048, t+i*.09+.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t+i*.09+.24);
        osc.connect(gain); gain.connect(context.destination);
        osc.start(t+i*.09); osc.stop(t+i*.09+.25);
      });
      window.setTimeout(()=>context.close().catch(()=>{}), 550);
    } catch (_) { /* Sound is optional; gameplay does not depend on audio. */ }
  }
  function recordLevel(mode) {
    earnStamp('workshop');
    const all = getAllStamps();
    const id = child();
    all[id] = {...(all[id]||{}), workshopLevels: {...(all[id]?.workshopLevels||{}), [mode]: true}};
    sessionStamps = all;
    try { localStorage.setItem(STAMPS_KEY, JSON.stringify(all)); } catch (_) {}
  }

  document.addEventListener('click', event => {
    const node = event.target.closest('[data-np-action]');
    if (!node || !document.getElementById('kidPortal')?.contains(node) || !appState.kidActive) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const action = node.dataset.npAction;
    if (action === 'grownups') {
      stopNarration();
      exitKid();
    } else if (action === 'child') {
      const nextChild = node.dataset.child;
      if (!familyChildren().some(c => String(c.id) === nextChild)) return;
      if (nextChild !== appState.kidSelected) {
        if (typeof resetKidDraft === 'function') resetKidDraft();
        appState.kidSelected = nextChild;
        state.found = [];
        state.santaChoice = 'hello';
      }
      renderKidPortal();
    } else if (action === 'board') {
      state.view = 'boarding';
      renderKidPortal();
      const token = ++state.boardingToken;
      window.setTimeout(() => {
        if (token === state.boardingToken && appState.kidActive && state.view === 'boarding') go('village');
      }, window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 300 : 2200);
    } else if (['village', 'arrival', 'santa', 'workshop', 'mail'].includes(action)) {
      if (action === 'santa') { state.magicSecret=''; }
      if (action === 'workshop') { state.found = []; state.wrong = 0; state.hinted = -1; }
      if (action === 'mail' && typeof resetKidDraft === 'function') resetKidDraft();
      go(action);
    } else if (action === 'magic-wake') {
      const id=Number(node.dataset.star);
      if(state.magicAwake || !Number.isInteger(id) || id<0 || id>2 || state.magicStars.includes(id))return;
      state.magicStars.push(id);playSparkle();
      if(state.magicStars.length===3){state.magicAwake=true;state.magicReaction='ready';earnStamp('santa');state.magicMission=magicKeys[Object.keys(magicSaved()).length%3];}
      renderKidPortal();
    } else if (action === 'magic-mission') {
      if(!magicMissions[node.dataset.mission])return;
      state.magicMission=node.dataset.mission;state.magicDone=[];state.magicReveals=[];state.magicReaction='ready';state.magicSecret='';state.magicVisits++;
      renderKidPortal();
    } else if (action === 'magic-gift' || action === 'magic-ornament') {
      const key=action==='magic-gift'?'gifts':'tree';
      if(state.magicMission!==key || state.magicReaction==='complete')return;
      const id=String(node.dataset.id), choices=key==='gifts'?3:4;
      if(!Array.from({length:choices},(_,i)=>String(i)).includes(id)||state.magicDone.includes(id))return;
      state.magicDone.push(id);playSparkle();state.magicSecret='';
      if(state.magicDone.length===3){state.magicReaction='complete';magicRecordMission(key);}
      renderKidPortal();
    } else if (action === 'magic-hide') {
      if(state.magicMission!=='bell'||state.magicReaction==='complete')return;
      const id=String(node.dataset.id), answer=String(node.dataset.answer);
      if(!['0','1','2','3'].includes(id)||state.magicReveals.includes(id))return;
      state.magicReveals.push(id);state.magicSecret='';
      if(id===answer){state.magicDone=['bell'];state.magicReaction='complete';magicRecordMission('bell');playSparkle();}
      else state.magicReaction='miss';
      renderKidPortal();
    } else if (action === 'magic-next') {
      const n=(magicKeys.indexOf(state.magicMission)+1)%magicKeys.length;
      state.magicMission=magicKeys[n];state.magicDone=[];state.magicReveals=[];state.magicReaction='ready';state.magicSecret='';state.magicVisits++;
      renderKidPortal();
    } else if (action === 'magic-secret') {
      const notes=['Santa winked! That little star is a North Pole good-luck wish.','You found a secret Christmas sparkle! The elves never noticed it.','A magical wish for a wonderful day, from Santa to you!'];
      state.magicSecret=notes[(state.magicVisits+state.magicDone.length)%notes.length];playSparkle();renderKidPortal();
    } else if (action === 'ride') {
      if(!deliveryRides[node.dataset.ride])return;
      state.deliveryRide=node.dataset.ride;playSparkle();
      const section=document.querySelector('#kidPortal .npw-delivery-choose');
      if(section)section.outerHTML=rideChooser();
    } else if (action === 'seal') {
      if (!seals[node.dataset.seal]) return;
      state.letterSeal = node.dataset.seal;
      const region = document.querySelector('#kidPortal .np-seal-section');
      if (region) region.outerHTML = sealChooser();
      playSparkle();
    } else if (action === 'ask') {
      if (!adventures[node.dataset.ask]) return;
      resetStory(node.dataset.ask);
    } else if (action === 'story-branch') {
      const branch = Number(node.dataset.choice);
      if (state.storyStage !== 0 || ![0,1].includes(branch)) return;
      state.storyBranch = branch;
      state.storyStage = 1;
      stopNarration(); isSpeaking = false;
      renderKidPortal();
    } else if (action === 'story-next') {
      if (state.storyStage !== 1) return;
      state.storyStage = 2;
      stopNarration(); isSpeaking = false;
      renderKidPortal();
    } else if (action === 'story-restart') {
      resetStory('hello');
    } else if (action === 'narrate') {
      narrate();
    } else if (action === 'voice') {
      const voices = availableVoices();
      const feedback = document.getElementById('npVoiceFeedback');
      if (voices.length < 2) {
        if (feedback) feedback.textContent = 'This device only has one narrator available.';
        return;
      }
      state.voiceIndex = (state.voiceIndex + 1) % voices.length;
      stopNarration();
      if (feedback) feedback.textContent = 'Narrator: ' + voices[state.voiceIndex].name;
      narrate();
    } else if (action === 'mode') {
      if (!modes[node.dataset.mode]) return;
      state.gameMode = node.dataset.mode;
      state.found = []; state.wrong = 0; state.hinted = -1;
      renderKidPortal();
    } else if (action === 'hint') {
      const missing = targetStars().find(index => !state.found.includes(index));
      if (missing !== undefined) state.hinted = missing;
      renderKidPortal();
    } else if (action === 'decoy') {
      state.wrong++;
      node.classList.add('np-decoy-shake');
      const msg = document.querySelector('.np-elf-help span');
      if (msg) msg.textContent = 'That was a decoration! Look for a little five-pointed star.';
    } else if (action === 'find-star') {
      const index = Number(node.dataset.star);
      if (!Number.isInteger(index) || !targetStars().includes(index) || state.found.includes(index)) return;
      state.found.push(index);
      state.hinted = -1;
      playSparkle();
      if (state.found.length === getMode().count) recordLevel(state.gameMode);
      renderKidPortal();
    } else if (action === 'replay') {
      state.found = []; state.wrong = 0; state.hinted = -1; state.gameRound++;
      renderKidPortal();
    }
  }, true);

  const css = `
  #kidPortal.np-adventure-portal{max-width:none!important;margin:0!important;background:#fcfaf6!important;color:#273b3b!important;min-height:100dvh!important}
  #kidPortal.np-adventure-portal *{box-sizing:border-box}
  .np-app{min-height:100dvh;background:#fcfaf6;color:#293e3e;font-family:'DM Sans',Arial,sans-serif}
  .np-shell{max-width:1030px;margin:0 auto;min-height:100dvh;background:#fcfaf6;box-shadow:0 10px 60px #1839400c;overflow:hidden;padding-bottom:24px}
  .np-topbar{height:79px;display:flex;align-items:center;justify-content:space-between;padding:13px clamp(18px,4vw,40px);background:#fcfaf6;gap:10px}
  .np-brand{display:flex;align-items:center;gap:10px;color:#344e4b;line-height:1.15}.np-brand b{font:700 21px 'Fraunces',Georgia,serif;letter-spacing:-.04em}.np-brand small{display:block;letter-spacing:1.6px;font-size:8px;font-weight:900;color:#9b7471;margin-top:4px}
  .np-brandmark{width:42px;height:42px;display:grid;place-items:center;border:1px solid #dcd8cd;border-radius:14px;background:#f0e6d7;color:#a96060}.np-brandmark svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}
  .np-grownups{flex:none;border:1px solid #e9ddd6;border-radius:100px;background:#fff;color:#816863;padding:10px 15px;font-size:12px;font-weight:800;min-height:44px}
  .np-grownups span{padding-left:6px}
  .np-eyebrow{font-size:10px;font-weight:900;letter-spacing:2px;text-transform:uppercase}.np-eyebrow-light{color:#f5d6a1}.np-eyebrow-dark{color:#a0655c}
  .np-welcome-hero{margin:0 clamp(12px,2.5vw,28px);height:560px;max-height:68dvh;min-height:440px;position:relative;overflow:hidden;border-radius:30px;background:#284f5c;isolation:isolate}
  .np-village-art{display:block;width:100%;height:100%;position:absolute;inset:0;object-fit:cover}
  .np-welcome-shade{position:absolute;inset:0;background:linear-gradient(90deg,#092d40ec 0%,#14394bdc 34%,#14394b10 80%);z-index:1}
  .np-welcome-copy{position:absolute;z-index:2;left:6%;top:15%;max-width:480px;color:white}
  .np-welcome-copy h1,.np-boarding h1{font:700 clamp(42px,5.8vw,73px)/1.06 'Fraunces',Georgia,serif;letter-spacing:-2px;margin:18px 0}.np-welcome-copy h1 em,.np-village-title h1 em,.np-boarding h1 em,.np-workshop-intro em{color:#edc98e;font-style:italic;font-weight:550}
  .np-welcome-copy p{font-size:15px;line-height:1.65;color:#f4ece5;max-width:325px;margin-bottom:29px}
  .np-primary{display:inline-flex;gap:15px;align-items:center;justify-content:center;min-height:55px;padding:14px 24px;color:#422a21;border:0;background:#f4d69d;border-radius:100px;font-weight:900;font-size:15px;box-shadow:0 5px 15px #1b29272b}.np-primary .np-chevron{width:17px;height:17px}
  .np-chevron{width:17px;height:17px;stroke:currentColor;stroke-width:2.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
  .np-hero-trail{position:absolute;right:19%;top:15%;display:flex;gap:25px;color:#fef0cb;animation:np-glimmer 2.5s ease-in-out infinite alternate;z-index:2}
  @keyframes np-glimmer{to{opacity:.55;transform:translateY(9px)}}
  .np-welcome-bottom{max-width:860px;padding:30px 26px 5px;margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center}
  .np-traveler-picker>span{display:block;font-size:10px;font-weight:900;letter-spacing:1.5px;color:#8b726e;margin:0 0 10px}
  .np-traveler-options{display:flex;gap:8px;flex-wrap:wrap}.np-traveler{display:flex;align-items:center;gap:8px;padding:11px 15px;min-height:49px;background:#fff;border:1px solid #e3dbd3;border-radius:14px;font-weight:800;font-size:13px;color:#654f4f}.np-traveler.selected{border-color:#af7e71;background:#fbefe7;box-shadow:0 0 0 2px #ecd3c9}.np-traveler-symbol{display:grid;place-items:center}.np-purple{color:#8264b1}.np-pink{color:#cf7498}
  .np-welcome-ticket{display:flex;align-items:center;gap:13px;position:relative;border:1px dashed #cbb8a9;background:#fff8ec;padding:15px;border-radius:17px;color:#694f43}.np-ticket-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;color:#b88142;background:#f8e6c8}.np-welcome-ticket strong{display:block;font:700 16px 'Fraunces',Georgia,serif}.np-welcome-ticket small{display:block;font-size:10px;line-height:1.5;color:#998476;margin-top:4px}.np-ticket-dots{margin-left:auto;color:#bea993;transform:rotate(90deg)}
  .np-disclaimer{text-align:center;font-size:11px;color:#a29b95;padding:14px 18px;margin:0}
  .np-train-shell{background:linear-gradient(180deg,#173b4b,#608a90 70%,#f6f2eb)}
  .np-boarding{padding:65px 20px 30px;min-height:75dvh;text-align:center;color:#fff;position:relative;overflow:hidden}.np-boarding h1{margin:20px 0 35px}.np-boarding p{color:#f7f1e6;font-size:14px;margin:30px 0 10px}.np-boarding-stars{display:flex;justify-content:center;gap:35px;color:#f5dfb7;animation:np-glimmer 2s ease-in-out infinite alternate}.np-text-button{border:0;background:none;color:inherit;font-weight:900;font-size:13px;min-height:44px;display:inline-flex;align-items:center;gap:9px}.np-text-button .np-chevron{width:15px}
  .np-train-art{position:relative;margin:35px auto 0;width:260px;height:114px;animation:np-train-move 1.5s ease-in-out infinite alternate}.np-train-art>span{position:absolute}.np-train-engine{left:30px;bottom:20px;width:129px;height:59px;border-radius:40px 16px 14px 9px;background:#c05e55;border-bottom:13px solid #853b3e}.np-train-cab{left:117px;bottom:67px;width:52px;height:39px;background:#d98570;border:8px solid #f5e0be;border-bottom:0;border-radius:8px 8px 2px 2px}.np-train-chimney{left:57px;bottom:73px;width:26px;height:25px;background:#e3c9a9;border-radius:3px}.np-train-wheel{width:42px;height:42px;bottom:2px;background:#293f4a;border:8px solid #e4bf81;border-radius:50%}.np-train-wheel.left{left:53px}.np-train-wheel.right{left:115px}.np-train-car{bottom:22px;left:174px;width:78px;height:53px;background:#f4d298;border-radius:10px;border-bottom:11px solid #ad6b58}.np-train-car-wheel{bottom:1px;left:194px;width:34px;height:34px;border:7px solid #e0b473;background:#324d54;border-radius:50%}.np-train-smoke{width:19px;height:19px;border-radius:50%;background:#eff2eb99;left:55px;bottom:112px}.np-smoke-two{left:34px;bottom:146px;transform:scale(1.25)}@keyframes np-train-move{to{transform:translateX(18px)}}
  .np-village-banner{height:340px;position:relative;overflow:hidden;background:#24485b}.np-village-banner::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#153b4aef 0%,#153b4ac7 43%,#153b4a00 80%)}
  .np-village-title{position:absolute;left:6%;top:17%;z-index:2;max-width:460px;color:#fff}.np-village-title h1{font:700 clamp(30px,4.2vw,52px)/1.1 'Fraunces',Georgia,serif;margin:15px 0;letter-spacing:-1.4px}.np-village-title p{font-size:15px;color:#f6f0e6;margin:0}
  .np-village-content,.np-inner{padding:24px clamp(19px,4.5vw,52px) 35px;max-width:1000px;margin:auto}.np-current-traveler{padding-bottom:12px;display:flex;justify-content:end}.np-current-traveler .np-traveler-picker{display:flex;align-items:center;gap:14px}.np-current-traveler .np-traveler-picker>span{margin:0}
  .np-section-intro{margin:13px 0 17px}.np-section-intro h2,.np-passport h2{font:700 clamp(25px,3vw,33px) 'Fraunces',Georgia,serif;letter-spacing:-.8px;margin:7px 0}.np-section-intro p{font-size:13px;color:#867e78;margin:0}
  .np-destinations{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
  .np-destination{display:flex;flex-direction:column;min-width:0;text-align:left;background:#fff;border:1px solid #e9dfd6;border-radius:24px;overflow:hidden;padding:0 0 19px;position:relative;box-shadow:0 8px 25px #493e3220;color:#344543;transition:transform .2s,box-shadow .2s;cursor:pointer}.np-destination:hover{transform:translateY(-3px);box-shadow:0 12px 29px #493e3229}.np-destination:focus-visible,.np-question:focus-visible,.np-find-star:focus-visible,.np-traveler:focus-visible,.np-primary:focus-visible{outline:3px solid #be6e58;outline-offset:3px}
  .np-destination-scene{height:175px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:linear-gradient(145deg,#f7d9c7,#ecc3aa)}.np-dest-elf .np-destination-scene{background:linear-gradient(150deg,#d8e7d9,#b3d0c3)}.np-dest-post .np-destination-scene{background:linear-gradient(150deg,#eee4db,#d8d2e8)}
  .np-destination-orbit{width:147px;height:147px;border-radius:50%;position:absolute;background:#ffffff80;filter:blur(3px)}.np-destination-scene img{height:149px;max-width:75%;object-fit:contain;z-index:1;filter:drop-shadow(0 8px 7px #6b5b5b20)}.np-dest-elf img{height:140px}.np-dest-post img{height:132px}
  .np-destination-copy{display:block;padding:20px 17px 0;min-height:130px}.np-dest-kicker{font-size:9px;color:#b07867;letter-spacing:1.2px;font-weight:900}.np-destination-copy strong{display:block;font:700 23px/1.17 'Fraunces',Georgia,serif;margin:8px 0}.np-destination-copy small{display:block;font-size:12px;line-height:1.5;color:#867d77;max-width:230px}.np-dest-arrow{position:absolute;right:15px;bottom:16px;background:#f2eae1;border-radius:50%;width:29px;height:29px;display:grid;place-items:center;color:#8a695f}.np-dest-arrow svg{width:13px}
  .np-passport{margin-top:38px;padding:24px;border:1px solid #e7d9c5;border-radius:24px;background:#fff9ed;position:relative;overflow:hidden}.np-passport-heading{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap}.np-passport-heading h2{font-size:27px;margin:6px 0 17px}.np-stamp-count{font-size:11px;font-weight:900;color:#a06d5b;background:#f5e4ce;padding:9px 12px;border-radius:100px}.np-passport-stamps{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}.np-stamp{background:#fff;position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;border:1px dashed #dfd3c1;border-radius:17px;padding:12px 5px;min-height:126px;color:#9b9186;filter:saturate(.65)}.np-stamp.earned{filter:none;background:#fdf8ec;border:2px solid #c1a477;color:#5e5548}.np-stamp-art{height:48px;display:block;margin-bottom:8px}.np-stamp-art img{height:48px;width:55px;object-fit:contain;opacity:.5}.np-stamp.earned img{opacity:1}.np-stamp strong{font-weight:850;font-size:13px}.np-stamp small{font-size:8px;font-weight:900;letter-spacing:.7px;margin-top:5px}.np-stamp-check{position:absolute;top:6px;right:7px;color:#b98e4f}.np-passport-note{font-size:10px;color:#a39a8e;margin:15px 0 0}.np-train-return{border:0;background:none;color:#927d70;display:flex;align-items:center;gap:3px;font-weight:800;font-size:12px;min-height:48px;padding:10px 0;margin-top:15px}.np-train-return svg,.np-back svg{transform:rotate(180deg)}
  .np-back{border:0;background:none;display:flex;align-items:center;gap:8px;min-height:44px;margin:0 0 19px;padding:5px 0;color:#8b706a;font-weight:850;font-size:12px}
  .np-santa-room{background:linear-gradient(130deg,#fde5d6,#f9e7d7 50%,#f5efe3);border-radius:28px;padding:30px;display:grid;grid-template-columns:38% 1fr;align-items:center;gap:25px;min-height:370px;position:relative;overflow:hidden}.np-room-spark{position:absolute;color:#bc925b}.np-room-spark.one{top:24px;left:23px}.np-room-spark.two{right:45px;bottom:32px}.np-santa-portrait{min-height:320px;display:flex;align-items:flex-end;justify-content:center;position:relative}.np-portrait-light{width:260px;height:260px;background:#fff9eaa6;position:absolute;top:12px;left:calc(50% - 130px);border-radius:50%}.np-santa-portrait img{max-height:315px;max-width:95%;position:relative;z-index:1;object-fit:contain;filter:drop-shadow(0 9px 12px #7f5b4a33)}.np-santa-wave{animation:np-santa-greet .6s ease-in-out}.np-santa-words h1,.np-workshop-intro h1{font:700 clamp(30px,3.5vw,41px)/1.14 'Fraunces',Georgia,serif;letter-spacing:-1px;color:#4e4340;margin:9px 0}.np-santa-words>p{color:#877269;font-size:13px;line-height:1.5;margin:8px 0 17px}
  @keyframes np-santa-greet{30%{transform:rotate(-4deg) scale(1.02)}70%{transform:rotate(2deg)}}
  .np-story-card{border-radius:18px;padding:20px;background:#fffdf8;box-shadow:0 9px 26px #a57a691a;border:1px solid #e8d7c6}.np-story-label{color:#9b7563;font-size:9px;font-weight:900;letter-spacing:1.1px}.np-story-card p{font:600 17px/1.5 'Fraunces',Georgia,serif;color:#584741;margin:12px 0}.np-read-aloud{border:0;background:#f4e5d8;color:#835c51;border-radius:100px;padding:10px 14px;display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;min-height:41px}.np-read-aloud svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round}
  .np-choices{margin:26px 0}.np-question-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.np-question{border:1px solid #eadfd1;background:#fff;border-radius:19px;min-height:125px;display:flex;align-items:center;flex-direction:column;justify-content:center;gap:7px;color:#5b524d;padding:10px 4px;position:relative}.np-question.active{background:#fcf1de;border:2px solid #c79863}.np-question img{width:58px;height:58px;object-fit:contain}.np-question strong{font-size:12px;text-align:center}.np-question>span{color:#b48a57;position:absolute;right:8px;top:7px}.np-story-note{font-size:11px;color:#9a8c80;line-height:1.5;margin:15px 0}.np-secondary{min-height:49px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #decec0;padding:12px 16px;background:#fff;border-radius:100px;font-weight:900;font-size:12px;color:#886759}.np-secondary svg{width:15px}
  .np-workshop-intro{text-align:center;margin:3px 0 19px}.np-workshop-intro p{max-width:450px;margin:12px auto 0;color:#857a70;font-size:14px;line-height:1.6}.np-workshop-intro em{color:#b26e58}.np-progress-track{max-width:680px;margin:0 auto 20px}.np-progress-copy{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px;font-size:12px}.np-progress-copy b{color:#527166}.np-progress-copy span{color:#98897d;font-size:11px}.np-progress-bar{height:11px;border-radius:99px;background:#e8e5db;overflow:hidden}.np-progress-bar span{display:block;height:100%;background:linear-gradient(90deg,#95b79a,#cfad67);border-radius:inherit;transition:width .25s}
  .np-workshop-scene{height:min(53vw,430px);min-height:260px;position:relative;overflow:hidden;border-radius:24px;border:8px solid #fff;box-shadow:0 9px 29px #263c3c23;background:#315965;isolation:isolate}.np-find-star{position:absolute;width:57px;height:57px;transform:translate(-50%,-50%);border:0;border-radius:50%;background:#fffcdeef;display:grid;place-items:center;color:#e1a641;box-shadow:0 0 0 6px #ffedb849,0 0 29px 6px #fff9b7b0;cursor:pointer;z-index:2;animation:np-star-bounce 2s ease-in-out infinite alternate}.np-find-star:nth-of-type(even){animation-delay:.8s}.np-find-star.found{opacity:.17;transform:translate(-50%,-50%) scale(.4);animation:none}.np-find-star:disabled{cursor:default}@keyframes np-star-bounce{to{transform:translate(-50%,-58%) scale(1.08)}}
  .np-elf-help{display:flex;gap:14px;align-items:center;justify-content:center;margin:17px auto;max-width:500px}.np-elf-help img{height:60px;width:62px;object-fit:contain}.np-elf-help p{margin:0}.np-elf-help strong{display:block;font-size:14px;color:#4d7065}.np-elf-help span{display:block;font-size:12px;color:#928377;margin-top:5px}.np-mission-complete{text-align:center;background:#f1efe0;margin:23px auto;border-radius:23px;padding:24px;max-width:570px;color:#987b40}.np-mission-complete h2{font:700 28px 'Fraunces',Georgia,serif;margin:9px 0;color:#4f6655}.np-mission-complete p{font-size:13px;color:#756d5e}.np-complete-actions{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:13px}.np-replay{color:#746a60}
  .np-mail-home{border:1px solid #f0dadd;border-radius:999px;background:white;color:#995b69;font-weight:850;font-size:11px;min-height:43px;padding:9px 13px;display:flex;align-items:center;gap:4px;white-space:nowrap}.np-mail-home svg{transform:rotate(180deg);width:13px}.kid-header .np-mail-home{margin-left:auto;margin-right:9px}.kid-header .kid-brand{min-width:0}.kid-header .kid-brand small{font-size:8px}.np-after-send{margin-top:14px;min-width:280px}.np-success .kid-success-icon{animation:np-santa-greet 1.1s ease-in-out}
  @media(max-width:750px){.np-welcome-hero{height:540px;max-height:none}.np-welcome-copy{left:7%;top:10%;max-width:82%}.np-welcome-copy h1{font-size:clamp(39px,8.3vw,57px)}.np-welcome-shade{background:linear-gradient(180deg,#163949f0 0%,#14394bbf 40%,#14394b05 100%)}.np-welcome-bottom{grid-template-columns:1fr;gap:17px}.np-destinations{gap:10px}.np-destination-scene{height:135px}.np-destination-scene img{height:122px}.np-destination-copy{padding:14px 11px;min-height:137px}.np-destination-copy strong{font-size:17px}.np-destination-copy small{font-size:11px}.np-dest-kicker{font-size:8px}.np-santa-room{grid-template-columns:31% 1fr;gap:10px;padding:21px}.np-santa-portrait{min-height:260px}.np-santa-portrait img{max-height:265px}.np-portrait-light{width:175px;height:175px;top:26px;left:calc(50% - 87px)}}
  @media(max-width:520px){.np-topbar{height:70px;padding:10px 15px}.np-brandmark{width:37px;height:37px}.np-brand b{font-size:19px}.np-brand small{font-size:7px;letter-spacing:.7px}.np-grownups{padding:8px 12px;font-size:11px}.np-welcome-hero{margin:0 9px;height:500px;min-height:470px;border-radius:23px}.np-welcome-copy{top:9%}.np-welcome-copy h1{font-size:43px;letter-spacing:-1.4px;margin:13px 0}.np-welcome-copy p{max-width:270px;font-size:13px;margin-bottom:20px}.np-welcome-hero .np-village-art{object-position:center bottom}.np-welcome-bottom{padding:22px 20px 0}.np-village-banner{height:265px}.np-village-title{top:12%;left:7%}.np-village-title h1{font-size:33px}.np-village-title p{font-size:13px}.np-village-content,.np-inner{padding:17px 15px 25px}.np-current-traveler{justify-content:start}.np-current-traveler .np-traveler-picker{display:block;width:100%}.np-current-traveler .np-traveler-picker>span{margin-bottom:8px}.np-destinations{grid-template-columns:1fr;gap:11px}.np-destination{display:grid;grid-template-columns:35% 1fr;padding:0;min-height:130px;border-radius:18px;align-items:stretch}.np-destination-scene{height:auto;min-height:134px}.np-destination-scene img{max-width:92%;height:112px}.np-destination-orbit{height:115px;width:115px}.np-destination-copy{padding:15px 34px 13px 15px;min-height:unset}.np-destination-copy strong{font-size:21px;margin:6px 0}.np-destination-copy small{font-size:11px}.np-dest-arrow{bottom:12px;right:10px}.np-passport{padding:17px 12px}.np-passport h2{font-size:23px}.np-stamp-count{font-size:10px}.np-passport-stamps{gap:6px}.np-stamp{min-height:115px;padding:10px 2px}.np-stamp-art,.np-stamp-art img{height:40px}.np-stamp strong{font-size:10px}.np-stamp small{font-size:7px}.np-santa-room{display:flex;flex-direction:column;padding:15px 15px 19px;gap:3px}.np-santa-portrait{min-height:170px;height:170px;align-items:flex-end}.np-santa-portrait img{max-height:185px}.np-portrait-light{top:0;width:165px;height:165px;left:calc(50% - 82px)}.np-santa-words{width:100%}.np-santa-words h1{font-size:29px}.np-story-card{padding:16px}.np-story-card p{font-size:17px}.np-question-grid{grid-template-columns:repeat(2,1fr);gap:8px}.np-question{min-height:107px}.np-question img{width:45px;height:45px}.np-workshop-scene{height:320px;min-height:320px;border-width:5px}.np-find-star{width:49px;height:49px}.np-find-star svg{width:27px;height:27px}.np-progress-copy{font-size:11px}.np-progress-copy span{font-size:10px}.np-workshop-intro h1{font-size:32px}.np-workshop-intro p{font-size:13px}.np-elf-help img{height:47px;width:47px}.np-elf-help span{font-size:11px}.kid-header .np-mail-home{padding:7px 9px;min-height:39px}.kid-header .np-mail-home span{display:none}.kid-header .np-mail-home svg{width:17px;height:17px}.kid-header .kid-brand strong{font-size:17px!important}.kid-header .kid-exit{font-size:11px;padding:8px 12px}.kid-header .kid-brand-icon{height:35px;width:35px}.kid-header .kid-brand-icon img{height:36px;width:36px}.np-after-send{min-width:0;width:100%;max-width:300px}}
  @media(prefers-reduced-motion:reduce){.np-app *, .np-app *::before,.np-app *::after{animation:none!important;transition:none!important}.np-santa-wave{animation:none!important}}

  /* North Pole Studio v2 — inherit the editorial Santa HQ identity: warm blush, cranberry, cream, gold and evergreen. */
  #kidPortal.np-adventure-portal{background:#fff6f5!important;color:#3a3037!important}
  #kidPortal.np-adventure-portal .np-app,
  #kidPortal.np-adventure-portal .np-shell{background:#fff8f6;color:#3a3037}
  .np-shell{box-shadow:0 15px 65px #74404a12}
  .np-topbar{background:#fff9f7;border-bottom:1px solid #f1e6e3}
  .np-brand{color:#403039}.np-brand b{font-weight:750;font-size:22px}
  .np-brand small{color:#b05b65;letter-spacing:1.4px}
  .np-brandmark{background:#fff;border:1px solid #f2dfe0;border-radius:15px;box-shadow:0 6px 14px #a94e4f14}
  .np-brandmark img{height:37px;width:37px;object-fit:contain}
  .np-grownups{color:#95495a;background:#fff;border:1px solid #efdadd}
  .np-eyebrow-dark,.np-dest-kicker{color:#aa5365}
  .np-eyebrow-light{color:#ffe6b9}
  .np-welcome-hero{background:#724d61;box-shadow:0 16px 35px #673d4926}
  .np-welcome-shade{background:linear-gradient(92deg,#503343ee 1%,#6b4556b8 43%,#5c434133 90%)}
  .np-welcome-copy h1,.np-village-title h1,.np-boarding h1{letter-spacing:-1.8px;text-wrap:balance}
  .np-welcome-copy h1 em,.np-village-title h1 em,.np-boarding h1 em{color:#fbe1b6}
  .np-welcome-copy p{color:#fff1ee}
  .np-primary{background:#c72234;color:#fff;box-shadow:0 9px 20px #b7213445;border:1px solid #b82131}
  .np-primary:hover{background:#ae1c2e;transform:translateY(-1px)}
  .np-primary:focus-visible,.np-story-option:focus-visible,.np-question:focus-visible,.np-mode:focus-visible,.np-find-star:focus-visible,.np-decoy:focus-visible,.np-hint-button:focus-visible{outline:3px solid #ba6377;outline-offset:3px}
  .np-traveler.selected{border-color:#c96a78;background:#fff0f1;box-shadow:0 3px 0 #f5d7dc}
  .np-traveler,.np-welcome-ticket{border-color:#f0dfe0;background:#fff}
  .np-ticket-icon{color:#b65a6b;background:#fff0f2}
  .np-traveler-picker>span{color:#a35b69}
  .np-train-shell{background:linear-gradient(180deg,#563746,#906b77 67%,#fff1eb)}
  .np-village-banner{background:#643d50}
  .np-village-banner::after{background:linear-gradient(90deg,#563847ef 0%,#593b4ac9 43%,#593b4a12 100%)}
  .np-destination{border:1px solid #f0dedf;box-shadow:0 12px 28px #7f4c5712;transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
  .np-destination:hover{transform:translateY(-3px);box-shadow:0 17px 33px #81435420;border-color:#dfb6c0}
  .np-dest-santa .np-destination-scene{background:linear-gradient(140deg,#f8dcdf,#fff1eb)}
  .np-dest-elf .np-destination-scene{background:linear-gradient(140deg,#e6f0e9,#d7e5d6)}
  .np-dest-post .np-destination-scene{background:linear-gradient(140deg,#fff2da,#f5ddc9)}
  .np-destination-copy strong,.np-section-intro h2,.np-passport h2{color:#40323a}
  .np-destination-copy small,.np-section-intro p{color:#80737b}
  .np-passport{background:#fff4ed;border:1px solid #f0ded6}
  .np-stamp{background:#fff;border-color:#eddfe0}
  .np-stamp.earned{border-color:#d8a4af;background:#fff3f4}
  .np-stamp-check{background:#bb5e6d}
  .np-santa-room{background:linear-gradient(125deg,#f6d9dc 0%,#fae9e7 62%,#fff1e6);border:1px solid #efdbdd}
  .np-room-spark{color:#d5a86a}
  .np-portrait-light{background:radial-gradient(circle,#fff9ebbb,#ffffff07 71%)}
  .np-santa-portrait img{filter:drop-shadow(0 12px 15px #a4676924)}
  .np-santa-words h1,.np-workshop-intro h1{color:#49333b}
  .np-santa-words>p,.np-workshop-intro p{color:#826d77}
  .np-story-card{background:#fffdfb;border-color:#ecd9d8;box-shadow:0 12px 22px #a2666b15}
  .np-story-label{color:#a65666}
  .np-story-card p{color:#55424a;font-family:'DM Sans',sans-serif;font-size:16px;font-weight:650;line-height:1.67}
  .np-story-topline{display:flex;gap:10px;justify-content:space-between;align-items:center}
  .np-story-beat{font-size:10px;letter-spacing:.8px;color:#b96875;font-weight:900}
  .np-story-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 0 15px}
  .np-story-option,.np-story-next{min-height:54px;display:flex;align-items:center;gap:8px;padding:12px 14px;text-align:left;color:#843e4f;background:#fff2f1;border:1px solid #efd6d9;border-radius:15px;font-weight:850;font-size:12px;line-height:1.3;cursor:pointer}
  .np-story-option:hover,.np-story-next:hover{background:#ffe8ea;border-color:#daa9b3}
  .np-story-option>span{flex:1}.np-story-option>svg:first-child{flex:none;color:#d5a562}.np-story-option>svg:last-child{width:13px;flex:none}
  .np-story-next{margin:14px 0;width:100%;justify-content:space-between;background:#f1f5ef;border-color:#dfeadd;color:#4c715e}
  .np-read-aloud{background:#fff;border:1px solid #f1e1e3;color:#ae5868;min-height:44px;border-radius:999px;padding:10px 14px;font-size:12px}
  .np-read-aloud:hover{background:#fff3f2}
  .np-question{background:#fff;border:1px solid #efdfdf;box-shadow:0 5px 16px #8144530a;transition:transform .18s ease}
  .np-question:hover{transform:translateY(-2px)}
  .np-question.active{background:#fff1f1;border:2px solid #c86d80}
  .np-question>span{color:#ba596a}
  .np-story-note{color:#8f7f88}
  .np-secondary{color:#aa4b5d;border-color:#edced4;background:#fff}
  .np-workshop-intro em{color:#bd4d64}
  .np-mission-switch{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;max-width:710px;margin:20px auto 10px}
  .np-mode{display:grid;gap:5px;min-height:68px;justify-items:center;align-content:center;background:#fff;border:1.5px solid #ecdfe0;color:#7a6670;border-radius:17px;padding:9px 5px;cursor:pointer}
  .np-mode strong{font:750 15px 'Fraunces',Georgia,serif}.np-mode small{font-size:10px;font-weight:700;color:#978991}
  .np-mode.selected{background:#c72234;border-color:#b81f33;color:#fff;box-shadow:0 7px 18px #bd283b24}
  .np-mode.selected small{color:#ffdde1}
  .np-mission-instructions{text-align:center;margin:10px 0 18px;color:#806f79;font-size:13px;line-height:1.5}
  .np-progress-copy b{color:#a13f51}.np-progress-copy span{color:#927a85}
  .np-progress-bar{background:#f3e6e5}.np-progress-bar span{background:linear-gradient(90deg,#b54966,#d9ab76)}
  .np-workshop-scene{background:#664d5d;border:6px solid #fff;box-shadow:0 9px 28px #73545f24}
  .np-find-star{width:55px;height:55px;background:#fff4d699;border:1px solid #fff6dc77;box-shadow:0 0 22px #ffe3a481;color:#c79d42;animation:np-star-bounce 3s ease-in-out infinite alternate;transition:opacity .15s}
  .np-find-star svg{width:27px;height:27px}
  .np-game-explorer .np-find-star{width:45px;height:45px;background:#ffefb429;border:0;box-shadow:0 0 10px #fff1a946;color:#efc66e}
  .np-game-explorer .np-find-star svg{width:19px;height:19px;filter:drop-shadow(0 0 3px #fff8cf)}
  .np-game-master .np-find-star{width:43px;height:43px;background:transparent;border:0;box-shadow:none;color:#efcd8c;animation:none}
  .np-game-master .np-find-star svg{width:15px;height:15px;filter:drop-shadow(0 0 2px #fee9a4)}
  .np-find-star.hinted{background:#fff3cbbf!important;box-shadow:0 0 0 7px #f5cf7088,0 0 25px 10px #fffae3bb!important;animation:np-star-bounce .6s ease-in-out infinite alternate!important}
  .np-find-star.hinted svg{width:29px;height:29px}
  .np-find-star.found{opacity:.14;animation:none;box-shadow:none;background:transparent}
  .np-decoy{position:absolute;display:grid;place-items:center;transform:translate(-50%,-50%);width:42px;height:42px;background:transparent;border:0;color:#ffebd7c4;z-index:2;cursor:pointer}
  .np-decoy .np-small-icon{height:18px;width:18px;fill:none;stroke:currentColor;stroke-width:1.6}
  .np-tiny-ornament{display:block;position:relative;width:15px;height:16px;background:radial-gradient(circle at 35% 24%,#ffedbd,#ce7270 63%,#905a5b);border:1px solid #f5d7b6;border-radius:50%}
  .np-tiny-ornament::before{content:'';position:absolute;width:6px;height:4px;border:1px solid #ffe1a1;border-radius:2px;top:-5px;left:4px}
  .np-decoy-shake{animation:np-nope .28s ease-in-out}
  @keyframes np-nope{30%,70%{transform:translate(-55%,-50%)}50%{transform:translate(-45%,-50%)}}
  .np-game-tools{display:flex;justify-content:space-between;align-items:center;gap:12px;max-width:750px;margin:16px auto;flex-wrap:wrap}
  .np-game-tools .np-elf-help{margin:0;justify-content:flex-start}
  .np-elf-help strong{color:#547563}.np-elf-help span{color:#897982}
  .np-hint-button{display:inline-flex;align-items:center;gap:8px;min-height:45px;background:#fff;border:1px solid #e4c6cb;padding:9px 13px;border-radius:100px;color:#ab5265;font-weight:850;font-size:12px}
  .np-hint-button svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.7}
  .np-mission-complete{background:#fff1e9;color:#bb7680;border:1px solid #efdad9}
  .np-mission-complete h2{color:#b2495a}.np-mission-complete p{color:#886f78}
  .np-mail-home{background:#fff;color:#ad5866}
  #kidPortal:not(.np-adventure-portal) .kid-portal{background:#fff7f6}
  .np-narrator-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
  .np-voice-change{background:transparent;color:#a25b68;border:0;font-size:11px;font-weight:850;min-height:44px;padding:8px 9px;text-decoration:underline;text-underline-offset:3px}
  .np-voice-feedback{display:block;min-height:0;font-size:10px;color:#a18a93;margin-top:3px}
  @media(max-width:520px){
    .np-welcome-shade{background:linear-gradient(180deg,#533847f0 0%,#67434ad9 47%,#543a4108 100%)}
    .np-welcome-hero{box-shadow:0 11px 26px #75525c22}
    .np-story-actions{grid-template-columns:1fr}
    .np-story-card p{font-size:15px}
    .np-mode{min-height:65px;padding:8px 3px}.np-mode strong{font-size:13px}.np-mode small{font-size:9px}
    .np-mission-instructions{font-size:12px;margin:10px auto 17px}
    .np-game-tools{align-items:stretch}.np-game-tools .np-elf-help{flex:1;min-width:220px}
    .np-hint-button{width:100%;justify-content:center}
    .np-find-star{width:51px;height:51px}
    .np-game-explorer .np-find-star{width:46px;height:46px}
    .np-game-master .np-find-star{width:43px;height:43px}
  }
  @media(prefers-reduced-motion:reduce){.np-destination:hover,.np-question:hover,.np-primary:hover{transform:none!important}}

  /* V3: fixed, height-safe boarding CTA. The copy is in normal flow, never clipped. */
  .np-welcome-hero{height:auto!important;max-height:none!important;min-height:475px!important;display:flex!important;align-items:stretch;overflow:hidden}
  .np-welcome-copy{position:relative!important;top:auto!important;left:auto!important;max-width:580px!important;width:auto;min-width:0;padding:clamp(30px,5vw,58px);display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:12px}
  .np-welcome-copy h1{margin:6px 0!important;line-height:1.06}
  .np-welcome-copy p{margin:0 0 7px!important;max-width:355px}
  .np-arrival-btn{flex:none;position:relative;z-index:5;max-width:100%;white-space:normal;text-align:center;line-height:1.3;padding:14px 19px}
  .np-app button{touch-action:manipulation}
  /* Magical desk, tactile instead of robotic narration. */
  .np-desk-hero{display:grid;grid-template-columns:230px 1fr;gap:24px;align-items:center;background:linear-gradient(117deg,#f9e0e4,#fff4e9);border:1px solid #efdde0;border-radius:27px;overflow:hidden;padding:18px 30px}
  .np-desk-santa{height:237px;display:flex;align-items:flex-end;justify-content:center}.np-desk-santa img{height:100%;max-width:100%;object-fit:contain;filter:drop-shadow(0 12px 12px #95525c27)}
  .np-desk-hero-text h1{font:750 clamp(29px,4vw,44px)/1.09 'Fraunces',Georgia,serif;color:#4b3440;letter-spacing:-1.1px;margin:10px 0}.np-desk-hero-text p{font-size:14px;line-height:1.55;color:#836e79;max-width:410px}
  .np-desk-status{display:inline-flex;border-radius:100px;padding:8px 13px;background:#fff9f4;color:#a95667;font-weight:900;font-size:12px;border:1px solid #efdadd}
  .np-desk-play{padding-top:23px}.np-desk-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}
  .np-desk-choice{display:flex;flex-direction:column;align-items:center;gap:6px;min-height:115px;border:1px solid #eadce0;background:white;border-radius:18px;padding:15px 6px 11px;color:#694957;cursor:pointer}
  .np-desk-choice.selected{background:#fff1f0;border:2px solid #c86d7d;box-shadow:0 4px 0 #f5d7d9}.np-desk-choice strong{font:750 16px 'Fraunces',Georgia,serif}.np-desk-choice small{font-size:10px;color:#967e86;font-weight:800}.np-desk-choice-art{font-size:31px;color:#b65a67;line-height:1.1}
  .np-desk-stage{background:radial-gradient(circle at center,#fffbf3 0%,#fff4e9 74%,#fbe9e5 100%);border:1px solid #ecd9d4;border-radius:25px;margin-top:18px;padding:23px 17px 21px;display:flex;flex-direction:column;align-items:center;text-align:center;min-height:365px;overflow:hidden;position:relative}
  .np-desk-stage-light{position:absolute;left:0;right:0;top:8px;color:#dcac6b;opacity:.66;letter-spacing:45px;pointer-events:none}.np-desk-stage>.np-eyebrow{position:relative;z-index:2}
  .np-desk-touch{background:transparent;border:0;display:grid;place-items:center;width:240px;max-width:95%;height:207px;cursor:pointer;position:relative;z-index:2;overflow:visible}.np-desk-touch:focus-visible{outline:3px solid #c46c7f;outline-offset:1px;border-radius:24px}
  .np-object{position:relative;display:grid;place-items:center}.np-globe{height:182px;width:182px;filter:drop-shadow(0 10px 11px #ad728633)}
  .np-globe-glass{display:grid;place-items:center;border:5px solid #e3e8e8;width:174px;height:161px;border-radius:50% 50% 44% 44%;position:relative;background:radial-gradient(circle at 30% 23%,#fff 0%,#e8f7f2 28%,#b5d8cd 95%);overflow:hidden;box-shadow:inset -7px -10px 14px #6b9d9f46}
  .np-globe-glass>img{height:114px;max-width:88%;object-fit:contain;margin-top:22px}.np-globe-base{display:block;position:absolute;bottom:-8px;padding:7px 20px;border-radius:8px;background:#b95060;color:#fff;font-size:9px;font-weight:900;letter-spacing:1px;border-bottom:7px solid #893d50;z-index:3}
  .np-flake{position:absolute;color:#fff;font-size:20px;animation:np-flutter 3s ease-in-out infinite alternate}.np-flake.f1{top:18%;left:14%}.np-flake.f2{top:32%;right:12%}.np-flake.f3{bottom:20%;left:18%}.np-flake.f4{bottom:33%;right:29%}.np-globe.np-activated .np-flake{animation:np-snowfall .9s linear infinite alternate}
  @keyframes np-snowfall{to{transform:translate(10px,33px) rotate(75deg);opacity:.42}}@keyframes np-flutter{to{transform:translateY(9px);opacity:.56}}
  .np-bell{filter:drop-shadow(0 9px 9px #ae865d33)}.np-bell.np-activated{animation:np-ringing .42s ease-in-out}@keyframes np-ringing{25%{transform:rotate(-12deg)}75%{transform:rotate(11deg)}}
  .np-drawer{width:200px;height:150px;background:#e9b983;border:7px solid #a4674f;border-radius:12px;box-shadow:0 10px 14px #7f5e4b33;position:relative}.np-drawer-face{background:#b86463;border:5px solid #a65755;width:90%;height:73px;border-radius:8px;display:grid;place-items:center;position:absolute;bottom:15px;box-shadow:0 7px 0 #873f40}.np-drawer-knob{width:30px;height:30px;border-radius:50%;background:#f2cf8a;color:#965c42;display:grid;place-items:center}.np-drawer-envelope{position:absolute;top:-26px;transform:scale(.72);transition:transform .3s,top .3s}.np-drawer-envelope img{height:88px}.np-drawer.np-activated .np-drawer-envelope{top:-71px;transform:scale(1)}
  .np-desk-instruction{max-width:420px;font-weight:750;color:#694757;font-size:17px;line-height:1.4;margin:2px auto 12px;min-height:48px}.np-desk-done .np-desk-instruction{color:#386955}
  .np-desk-dots{display:flex;gap:11px;margin-top:3px}.np-desk-dots span{color:#d4c7b6;opacity:.75}.np-desk-dots span.lit{color:#da9e39;opacity:1;filter:drop-shadow(0 0 6px #e8bc64)}
  .np-desk-again{margin:13px auto 0}.np-desk-letter{display:grid;grid-template-columns:155px 1fr;gap:19px;align-items:center;background:#f4e2d7;border-radius:25px;padding:19px 23px;margin-top:23px}.np-desk-letter img{width:145px;max-width:100%;max-height:146px;object-fit:contain}.np-desk-letter h2{font:750 26px/1.18 'Fraunces',Georgia,serif;color:#553b47;margin:9px 0}.np-desk-letter p{font-size:13px;color:#846f74;line-height:1.5;margin:0 0 14px}.np-desk-letter .np-primary{font-size:13px;min-height:50px}
  /* Post office: a tiny magic journey using existing mail and recording actions. */
  #kidPortal:not(.np-adventure-portal){background:#fff9f7!important}.np-mail-journey{display:flex;align-items:center;justify-content:space-between;gap:5px;margin:4px auto 23px;padding:13px 14px;border-radius:19px;background:#fff5ed;border:1px solid #eadbd4}
  .np-mail-step{display:flex;align-items:center;gap:8px;min-width:0;flex:1}.np-mail-step>img{width:39px;height:43px;object-fit:contain}.np-mail-step span{display:grid;gap:3px}.np-mail-step strong{font:750 13px 'Fraunces',Georgia,serif;color:#884658}.np-mail-step small{font-size:10px;color:#8d7780}.np-mail-connector{font-size:10px;color:#d5a473;letter-spacing:3px}
  #kidPortal:not(.np-adventure-portal) .kid-intro{min-height:215px;padding-top:26px;padding-bottom:30px}
  #kidPortal:not(.np-adventure-portal) .kid-intro h1{font-size:clamp(28px,5vw,44px)!important;line-height:1.12;max-width:460px}
  #kidPortal:not(.np-adventure-portal) .kid-intro p{max-width:420px}
  .np-seal-section{border:1px solid #ecd8db;border-radius:21px;background:#fff9f7;padding:19px 18px;margin:25px 0 15px;text-align:left}
  .np-seal-head>span{font-size:10px;font-weight:900;color:#ae586a;letter-spacing:1.6px}.np-seal-head h3{font:750 24px 'Fraunces',Georgia,serif;color:#583743;margin:6px 0}.np-seal-head p{font-size:12px;line-height:1.5;color:#8b7580;margin:0 0 12px}
  .np-seal-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.np-seal{display:grid;place-items:center;gap:6px;min-height:82px;background:white;border:1px solid #ecd9db;border-radius:15px;padding:8px 3px;cursor:pointer;color:#a65767}.np-seal span{font-size:29px;line-height:1}.np-seal strong{font-size:10px;line-height:1.2}.np-seal.selected{border:2px solid #b55065;background:#fff0f1;box-shadow:0 3px 0 #f2d5d8}
  .np-envelope-preview{display:flex;align-items:center;gap:17px;justify-content:center;margin:17px auto 2px;padding:15px 12px;background:#fff;border:1px dashed #e4c9cc;border-radius:17px}.np-envelope-preview>div:last-child{display:grid;gap:3px}.np-envelope-preview strong{font:750 15px 'Fraunces',Georgia,serif;color:#6b4953}.np-envelope-preview small{font-size:11px;color:#8f7780}.np-envelope-preview .np-envelope-hint{font-size:10px;color:#a28f97}
  .np-envelope-art{width:95px;height:65px;background:#f4e6d6;border:2px solid #d6ae99;position:relative;display:grid;place-items:center;border-radius:5px;overflow:hidden;flex:none;box-shadow:0 6px 11px #b28c8933}.np-envelope-flap{position:absolute;inset:0;background:linear-gradient(148deg,transparent 49%,#d6ae99 49%,#f8ebde 52%);clip-path:polygon(0 0,100% 0,50% 66%)}.np-wax{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#bf465b;color:#fff;z-index:1;font-size:16px;border:2px solid #f1b7b2;box-shadow:0 3px 6px #9a536344}.np-wax-snow{background:#7aaaba}.np-wax-heart{background:#d47898}.np-wax-bell{background:#a7854a}
  .kid-send.np-ship-btn{position:relative;min-height:63px;font-size:18px!important;background:linear-gradient(115deg,#b91836,#d73b50)!important;box-shadow:0 6px 0 #85243b,0 9px 20px #c5435440!important;letter-spacing:.1px}.kid-send.np-ship-btn:not(:disabled):active{transform:translateY(3px);box-shadow:0 3px 0 #85243b!important}
  /* Confirmation shows only after the app has saved the message. */
  .np-delivered{max-width:780px;min-height:100dvh;margin:auto;background:linear-gradient(180deg,#fbebeb 0%,#fff7ed 72%);text-align:center;color:#5d414e;display:flex;flex-direction:column;align-items:center;padding:20px 18px 45px}
  .np-delivered-sky{margin:12px auto 17px;position:relative;height:260px;width:min(100%,480px);background:radial-gradient(ellipse at 50% 80%,#fffaf2 0%,#fbe7d9 70%,transparent 72%);overflow:hidden;border-radius:28px}.np-delivered-sky:before{content:'✦   ✧   ✦  ✧   ✦';position:absolute;top:18px;left:0;right:0;color:#d5a56a;letter-spacing:22px}.np-delivery-trail{position:absolute;top:45%;left:7%;right:7%;color:#cf8b78;letter-spacing:12px;opacity:.65}
  .np-flying-envelope{position:absolute;width:140px;height:140px;left:0;top:72px;z-index:2;animation:np-mail-flight 2s ease-in-out both}.np-flying-envelope img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 10px #b07f7d33)}.np-delivery-mailbox{position:absolute;width:143px;height:155px;right:0;bottom:11px}.np-delivery-mailbox img{width:100%;height:100%;object-fit:contain}
  @keyframes np-mail-flight{0%{transform:translate(-9%,44%) rotate(-14deg) scale(.92)}55%{transform:translate(80%,-30%) rotate(11deg) scale(.85)}100%{transform:translate(203%,3%) rotate(-15deg) scale(.4);opacity:0}}
  .np-delivered-content{max-width:520px}.np-delivered h1{font:750 clamp(32px,5vw,45px)/1.12 'Fraunces',Georgia,serif;color:#8b394f;letter-spacing:-1px;margin:10px 0 14px}.np-delivered p{font-size:15px;color:#846773;line-height:1.6;margin:0 0 15px}
  .np-delivered-seal{display:inline-flex;gap:9px;align-items:center;background:#fff;border:1px solid #e4c6cc;border-radius:40px;padding:9px 18px;color:#a45363;font-weight:900;font-size:12px;margin:6px auto 18px}.np-delivered-seal span{font-size:23px}
  .np-delivered-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center}.np-delivered-actions .np-secondary,.np-delivered-actions .np-primary{min-height:51px}.np-delivered .np-delivery-footnote{font-size:11px;margin:20px auto 0;max-width:410px;color:#a18990}
  @media(max-width:620px){.np-welcome-hero{min-height:0!important;height:auto!important;max-height:none!important}.np-welcome-copy{width:100%;max-width:100%!important;padding:31px 22px 34px!important;min-height:440px;justify-content:flex-start;gap:12px}.np-welcome-copy h1{font-size:clamp(33px,9vw,44px)!important;margin:13px 0 5px!important}.np-welcome-copy p{max-width:295px;font-size:13px;line-height:1.5!important}.np-arrival-btn{width:100%;max-width:315px;margin-top:8px}.np-desk-hero{grid-template-columns:120px 1fr;padding:14px;gap:13px}.np-desk-santa{height:180px}.np-desk-hero-text h1{font-size:26px}.np-desk-hero-text p{font-size:12px}.np-desk-choices{gap:7px}.np-desk-choice{min-height:97px;padding:11px 3px}.np-desk-choice strong{font-size:12px;text-align:center}.np-desk-choice small{font-size:9px}.np-desk-choice-art{font-size:25px}.np-desk-letter{grid-template-columns:85px 1fr;gap:8px;padding:13px}.np-desk-letter img{width:84px}.np-desk-letter h2{font-size:20px}.np-desk-letter .np-primary{font-size:11px;min-height:46px;padding:9px 12px}.np-mail-journey{padding:11px 7px;gap:4px}.np-mail-step{flex-direction:column;text-align:center;gap:2px}.np-mail-step>img{width:30px;height:35px}.np-mail-step strong{font-size:11px}.np-mail-step small{font-size:9px}.np-mail-connector{font-size:8px;letter-spacing:1px}.np-envelope-preview{gap:9px}.np-envelope-art{width:78px;height:55px}.np-seal-section{padding:15px 11px}.np-seal strong{font-size:9px}.np-seal span{font-size:24px}}
  @media(max-width:350px){.np-welcome-copy{padding:24px 16px 26px!important}.np-welcome-copy h1{font-size:32px!important}.np-welcome-copy p{font-size:12px}.np-desk-hero{display:flex;flex-direction:column}.np-desk-santa{height:128px}.np-desk-santa img{height:130px}.np-desk-hero-text h1{font-size:27px}.np-seal-options{grid-template-columns:repeat(2,1fr)}.np-mail-journey{gap:0}.np-mail-step small{display:none}}
  @media(prefers-reduced-motion:reduce){.np-flying-envelope,.np-globe .np-flake,.np-bell{animation:none!important}.np-desk-hero *{scroll-behavior:auto!important}}
  /* North Pole Magic Window: warm Santa HQ scene, touch-first missions. */
  .npw-shell{background:linear-gradient(180deg,#f9f1eb,#fff9f4 55%,#fff)}
  .npw-inner{max-width:880px;margin:auto;padding:9px 17px 28px}
  .npw-heading{text-align:center;margin:7px auto 20px;max-width:580px}
  .npw-heading h1{font:800 clamp(35px,5vw,51px)/1.08 'Fraunces',Georgia,serif;color:#683d4f;letter-spacing:-1px;margin:8px 0}
  .npw-heading h1 em{font-weight:600;color:#af5f65}
  .npw-heading p{font-size:14px;color:#846d75;margin:0;line-height:1.5}
  .npw-stage-area{max-width:740px;margin:auto}
  .npw-scene{position:relative;isolation:isolate;height:clamp(320px,52vw,425px);border:9px solid #f5d8a8;border-radius:33px;overflow:hidden;background:#253c53;box-shadow:0 6px 0 #bf916c,0 14px 32px #7562733b,inset 0 0 0 4px #e9c59a}
  .npw-sky{position:absolute;inset:0;background:linear-gradient(170deg,#1a324d,#465675 63%,#a87f90)}
  .npw-moon{position:absolute;left:12%;top:9%;width:80px;height:80px;border-radius:50%;background:#fff0c8;box-shadow:0 0 35px 14px #ffe7a47a}
  .npw-sky i{position:absolute;left:var(--x);top:var(--y);width:4px;height:4px;border-radius:50%;background:#fff7e6;opacity:.75;animation:npw-snow 6s linear infinite;animation-delay:var(--d)}
  @keyframes npw-snow{to{transform:translate(-9px,120px);opacity:.05}}
  .npw-room{position:absolute;inset:9% 9% 15%;border-radius:130px 130px 12px 12px;overflow:hidden;border:4px solid #b27d60;background:linear-gradient(120deg,#673d55,#ae7880 55%,#644a5d);filter:brightness(.45) blur(2px);transform:scale(.95);transition:filter 1s ease,transform .85s ease}
  .npw-scene.awake .npw-room{filter:brightness(1);transform:scale(1)}
  .npw-fireplace{position:absolute;right:7%;bottom:12%;width:26%;height:51%;border:10px solid #b87b65;border-bottom:0;border-radius:70px 70px 0 0;background:radial-gradient(ellipse at bottom,#fcb450,#d35e47 25%,#403147 75%);box-shadow:0 0 18px #f4aa6680}
  .npw-fireplace span{position:absolute;bottom:13%;left:30%;font-size:50px;color:#ffe4a0;text-shadow:0 0 12px #ffb663;animation:npw-fire 1s ease-in-out infinite alternate}
  @keyframes npw-fire{to{transform:rotate(11deg) scale(1.15);opacity:.7}}
  .npw-shelf{position:absolute;right:13%;top:22%;width:26%;font-size:20px;color:#ffe2a0;border-bottom:6px solid #b08363}
  .npw-floor{position:absolute;bottom:0;left:0;right:0;height:14%;background:repeating-linear-gradient(90deg,#885a4a 0 70px,#9b6654 70px 77px);border-top:5px solid #c99b7a}
  .npw-santa{position:absolute;height:100%;max-width:57%;left:25%;bottom:-7%;object-fit:contain;object-position:bottom;z-index:2;filter:drop-shadow(0 11px 10px #392b374f);animation:npw-breathe 3s ease-in-out infinite alternate}
  .npw-scene.awake .npw-santa{animation:npw-wave 1.7s ease-in-out 1,npw-breathe 3s ease-in-out 2s infinite alternate}
  .npw-scene.celebrated .npw-santa{animation:npw-jump .5s ease-in-out 2}
  @keyframes npw-breathe{to{transform:translateY(5px) rotate(1.3deg)}}
  @keyframes npw-wave{50%{transform:rotate(-7deg) scale(1.04)}}
  @keyframes npw-jump{50%{transform:translateY(-14px) rotate(-5deg)}}
  .npw-frame{position:absolute;inset:0;pointer-events:none;z-index:3}
  .npw-arch{position:absolute;top:7%;left:8%;right:8%;height:48%;border:10px solid #e6ba80;border-bottom:none;border-radius:190px 190px 0 0;box-shadow:0 -5px 0 #a87050,inset 0 5px #fff2cf}
  .npw-window-sign{position:absolute;bottom:6%;left:4%;right:4%;background:linear-gradient(180deg,#f9dbab,#d1a071);border:3px solid #fff0c7;border-radius:12px;box-shadow:0 5px #ad7853;font:800 clamp(10px,2vw,16px) 'Fraunces',Georgia,serif;letter-spacing:1px;text-align:center;color:#704943;padding:12px 4px}
  .npw-frost{position:absolute;inset:0;background:linear-gradient(135deg,#e0f6ff73,#aac6d559);backdrop-filter:blur(4px);z-index:5;pointer-events:none}
  .npw-frost-label{position:absolute;bottom:20%;left:0;right:0;padding:7px;background:#3d5066a8;color:#fff;text-align:center;letter-spacing:2px;font-weight:900;font-size:11px}
  .npw-star{position:absolute;transform:translate(-50%,-50%);width:78px;height:78px;border-radius:50%;border:2px solid #fff1b5;background:#fbd88966;color:#ffeca7;box-shadow:0 0 24px 8px #f8e0a68c;pointer-events:auto;display:grid;place-items:center;animation:npw-glow 1.3s ease-in-out infinite alternate;cursor:pointer}
  .npw-star.found{opacity:.18;animation:none;transform:translate(-50%,-50%) scale(.55)}
  @keyframes npw-glow{to{box-shadow:0 0 33px 13px #ffdfacb8}}
  .npw-easter{position:absolute;top:14%;right:14%;z-index:6;width:46px;height:46px;color:#ffe7a0;font-size:27px;border:0;background:transparent;text-shadow:0 0 10px #ffe8ae;animation:npw-glint 2s ease-in-out infinite alternate}
  @keyframes npw-glint{to{opacity:.55;transform:rotate(35deg)}}
  .npw-dialog{position:relative;z-index:7;max-width:690px;width:95%;min-height:88px;margin:-8px auto 0;padding:12px 17px;display:flex;align-items:center;gap:12px;border:2px solid #ead2ba;border-radius:22px;background:#fffdf9;box-shadow:0 7px 18px #7f6a5d24}
  .npw-face{flex:none;display:grid;place-items:center;width:60px;height:60px;border-radius:50%;border:2px solid #e6cda8;background:#f6e4ce;overflow:hidden}.npw-face img{width:90%;height:90%;object-fit:contain}
  .npw-dialog small{font-weight:900;letter-spacing:1.9px;font-size:9px;color:#b46b65}.npw-dialog p{margin:4px 0 0;font:750 clamp(14px,2.2vw,19px)/1.35 'Fraunces',Georgia,serif;color:#633c4b}
  .npw-awaken{margin:18px auto 0;max-width:740px;padding:19px;text-align:center;background:#fff7ec;border:1px solid #ebd5be;border-radius:25px}
  .npw-awaken h2,.npw-mission-title h2{font:800 27px 'Fraunces',Georgia,serif;color:#704550;margin:8px 0}.npw-awaken p{font-size:13px;color:#927477;margin:5px auto 14px}
  .npw-wake-progress{display:flex;align-items:center;justify-content:center;gap:9px;color:#d0c5b9}.npw-wake-progress span.found{color:#e5ac4b}.npw-wake-progress small{font-weight:900;font-size:12px;color:#96766a;margin-left:7px}
  .npw-activity{max-width:740px;margin:22px auto 0}.npw-mission-title{text-align:center}
  .npw-choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin:15px auto}.npw-choice{position:relative;min-height:120px;display:grid;justify-items:center;align-content:center;gap:5px;padding:10px;border-radius:19px;border:2px solid #ecd5cb;color:#6e4a53;background:white;cursor:pointer}
  .npw-choice.selected{background:#fff0ef;border-color:#b96a73;box-shadow:0 4px #f2d5d6}.npw-choice span svg{width:50px;height:50px}.npw-choice strong{font:800 13px 'Fraunces',Georgia,serif}.npw-choice i{position:absolute;right:8px;top:7px;font-style:normal;border-radius:50%;background:#4b8667;color:white;padding:3px 6px;font-size:10px}
  .npw-task{background:#fff;border:1px solid #ecd6ce;border-radius:26px;text-align:center;padding:21px clamp(13px,3vw,28px);box-shadow:0 8px 20px #b0808030}.npw-task.finished{background:linear-gradient(180deg,#fffefa,#fff5e6);border-color:#e3c18d}.npw-task h3{font:800 clamp(23px,4vw,31px) 'Fraunces',Georgia,serif;color:#754454;margin:7px 0}.npw-task>p{font-size:13px;line-height:1.5;color:#846e77;max-width:450px;margin:0 auto 14px}
  .npw-task-progress{margin:14px auto 0;font-size:13px;display:flex;align-items:center;justify-content:center;gap:7px;color:#57816b;font-weight:900}
  .npw-task-actions{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:10px;margin-top:15px}.npw-task-actions .np-primary{font-size:13px;min-height:50px}.npw-next{border:0;background:transparent;color:#a15e68;font-weight:900;min-height:45px}
  .npw-sleigh{display:flex;justify-content:center;align-items:center;gap:13px;background:linear-gradient(#fff7ea,#f6eadc);border:1px dashed #d6bca3;border-radius:19px;max-width:370px;margin:12px auto 15px;min-height:100px;position:relative}.npw-sleigh svg{width:75px;height:75px}.npw-sleigh strong{font:800 19px 'Fraunces',Georgia,serif;color:#825055}.npw-packed{position:absolute;left:30%;bottom:10px;display:flex;gap:5px;color:#c86671;animation:npw-packed .5s ease both}
  @keyframes npw-packed{from{transform:translateY(-30px);opacity:0}}
  .npw-gifts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.npw-gift{min-height:115px;display:grid;justify-items:center;align-content:center;gap:4px;background:#fff9f4;border:2px solid #efd7c8;border-radius:18px;cursor:pointer}.npw-gift svg{width:70px;height:70px}.npw-gift.green svg rect{fill:#4c9070}.npw-gift.gold svg rect{fill:#d8a44d}.npw-gift small{font-weight:850;font-size:11px;color:#7e5460;text-transform:capitalize}.npw-gift.packed{opacity:.4}
  .npw-tree-scene{max-width:520px;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center;margin:12px auto}.npw-tree-art{min-height:199px;display:grid;place-items:center;position:relative;border-radius:19px;background:radial-gradient(ellipse at bottom,#f0f1df,#fff 78%)}.npw-tree-art>svg{width:179px;height:179px}.npw-tree-ball{position:absolute;width:19px;height:19px;top:calc(37% + var(--i)*18%);left:calc(36% + var(--i)*8%);border-radius:50%;background:#b75572;border:3px solid #f8dab1;box-shadow:0 0 8px #e8c67a;animation:npw-packed .5s ease}.npw-tree-ball.gold{background:#dfb254}.npw-tree-ball.violet{background:#9a7abb}.npw-tree-ball.green{background:#518c6c}
  .npw-colors{display:grid;grid-template-columns:1fr 1fr;gap:7px}.npw-color{display:flex;align-items:center;gap:7px;min-height:55px;padding:8px;background:#fff8f1;border:1px solid #ead9ca;border-radius:12px;cursor:pointer}.npw-color i{width:22px;height:22px;flex:none;border-radius:50%;background:#b75572;border:3px solid #f9deb0}.npw-color.gold i{background:#dfb254}.npw-color.violet i{background:#9a7abb}.npw-color.green i{background:#518c6c}.npw-color span{font-size:10px;font-weight:800;color:#7a545b;text-align:left;text-transform:capitalize}.npw-color.used{opacity:.4}
  .npw-hiding{max-width:510px;display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:13px auto}.npw-hide{min-height:132px;background:#fff9f4;border:2px solid #ead3c7;border-radius:19px;display:grid;justify-items:center;align-content:center;gap:3px;padding:10px;cursor:pointer}.npw-hide span svg{width:55px;height:55px}.npw-hide strong{font:800 14px 'Fraunces',Georgia,serif;color:#754958}.npw-hide small{font-size:11px;color:#a7837e}.npw-hide.checked{opacity:.48}
  .npw-post{max-width:740px;margin:23px auto 0;background:#f5e7e1;border:1px solid #e7cfc5;border-radius:25px;display:grid;grid-template-columns:110px 1fr;align-items:center;gap:16px;padding:16px 21px}.npw-post>img{width:100%;max-height:130px;object-fit:contain}.npw-post h2{font:800 24px 'Fraunces',Georgia,serif;color:#784657;margin:7px 0}.npw-post p{font-size:12px;color:#806d73;line-height:1.5;margin:0 0 13px}.npw-post .np-primary{min-height:48px;font-size:12px;padding:10px 16px}.npw-caption{text-align:center;color:#ac9296;font-size:11px;line-height:1.55;margin:17px auto 0;max-width:600px}
  @media(max-width:620px){.npw-inner{padding:6px 12px 26px}.npw-heading h1{font-size:32px;margin:7px 0}.npw-heading{margin:2px 0 15px}.npw-scene{height:355px;border-width:6px;border-radius:24px}.npw-room{inset:9% 6% 15%}.npw-arch{left:5%;right:5%}.npw-santa{left:23%;max-width:62%}.npw-fireplace{border-width:7px}.npw-dialog{width:97%;padding:9px 11px;gap:9px}.npw-face{width:48px;height:48px}.npw-dialog p{font-size:14px}.npw-choices{gap:6px}.npw-choice{min-height:105px;padding:6px}.npw-choice span svg{width:43px;height:43px}.npw-choice strong{font-size:11px}.npw-gift{min-height:103px}.npw-gift svg{width:53px;height:53px}.npw-gift small{font-size:9px}.npw-tree-art{min-height:177px}.npw-tree-art>svg{width:155px;height:155px}.npw-post{grid-template-columns:76px 1fr;gap:9px;padding:13px}.npw-post h2{font-size:19px}.npw-post .np-primary{font-size:11px;min-height:46px}.npw-post>img{max-height:82px}}
  @media(max-width:350px){.npw-scene{height:320px}.npw-star{width:57px;height:57px}.npw-task{padding:16px 9px}.npw-hide{min-height:110px}.npw-gift{min-height:94px}.npw-gift svg{width:45px;height:45px}}
  @media(prefers-reduced-motion:reduce){.npw-scene *, .npw-scene *:before, .npw-scene *:after{animation:none!important;transition:none!important}}

  .npw-delivery-choose{background:linear-gradient(125deg,#fffaf1,#f5e7ed);border:1px solid #ead0c9;border-radius:21px;margin:17px 0 19px;padding:16px;text-align:center}
  .npw-delivery-choose>span{font-size:10px;font-weight:900;letter-spacing:1.5px;color:#ab6670}
  .npw-delivery-choose h3{font:800 24px 'Fraunces',Georgia,serif;color:#754354;margin:6px 0 12px}
  .npw-delivery-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .npw-delivery-mode{display:grid;place-items:center;gap:6px;min-height:92px;padding:9px 5px;border:2px solid #e5d5cc;border-radius:15px;background:white;color:#764e59;cursor:pointer}
  .npw-delivery-mode.chosen{border-color:#b25c6b;background:#fff0f2;box-shadow:0 3px 0 #ebccce}
  .npw-delivery-mode svg{width:37px;height:37px;stroke:#ac6783;fill:#e8bf76}.npw-delivery-mode strong{font:800 11px/1.2 'Fraunces',Georgia,serif;text-align:center}
  .npw-delivery-choose>small{display:block;color:#9a7f82;font-size:10px;margin-top:11px}
  .npw-delivery-method{font:800 17px 'Fraunces',Georgia,serif;color:#b45b70!important;margin-top:10px!important}
  @media(max-width:350px){.npw-delivery-mode{min-height:80px}.npw-delivery-mode strong{font-size:10px}}

  .npw-delivery-courier{position:absolute;left:8%;top:12%;width:68px;height:68px;display:grid;place-items:center;color:#b27564;z-index:3;animation:npw-courier-flight 2.6s ease-in-out both}
  .npw-delivery-courier svg{width:65px;height:65px;filter:drop-shadow(0 5px 9px #91676c55)}
  .np-delivery-snow .npw-delivery-courier{color:#88aec7}
  .np-delivery-sparkle .npw-delivery-courier{color:#d4ad57}
  .np-delivery-sparkle .np-delivery-trail{color:#d6a751;text-shadow:0 0 8px #e4c875}
  .np-delivery-snow .np-delivery-trail{color:#78aabd}
  @keyframes npw-courier-flight{0%{opacity:0;transform:translateX(-45px) rotate(-10deg) scale(.7)}25%{opacity:1}75%{opacity:1}100%{opacity:0;transform:translateX(245px) translateY(-14px) rotate(9deg) scale(.65)}}
  @media(prefers-reduced-motion:reduce){.npw-delivery-courier{animation:none!important;left:auto;right:5%;opacity:1}}
  `;
  if (!document.getElementById('northPoleAdventureStyles')) {
    const style = document.createElement('style');
    style.id = 'northPoleAdventureStyles';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
