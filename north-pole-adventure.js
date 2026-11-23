/* Santa HQ Families — North Pole Adventure v2 (2026-11-23, Santa HQ Families compatible)
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
  console.info("Santa HQ North Pole Adventure v2 loaded successfully (Families-compatible).");

  const originalRender = renderKidPortal;
  const originalEnter = enterKid;
  const originalSent = showKidSent;
  const YEAR = new Date().getFullYear();
  const STAMPS_KEY = `santa_hq_north_pole_passport_${YEAR}`;
  const state = { view: 'arrival', found: [], santaChoice: 'hello', storyStage: 0, storyBranch: 0, gameMode: 'explorer', gameRound: 0, wrong: 0, hinted: -1, voiceIndex: 0, boardingToken: 0 };
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
    return `<div class="np-shell">${topBar('A LITTLE CHRISTMAS MAGIC')}
      <section class="np-welcome-hero">
        ${villageArt()}
        <div class="np-welcome-shade"></div>
        <div class="np-welcome-copy">
          <span class="np-eyebrow np-eyebrow-light">THE NORTH POLE EXPRESS</span>
          <h1>There's magic<br>waiting <em>up north.</em></h1>
          <p>One special ticket. A whole village of wonder. Santa is waiting for a visitor.</p>
          <button type="button" class="np-primary np-arrival-btn" data-np-action="board">All aboard! <span>${chevron()}</span></button>
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
          ${destinationCard('santa', "Santa's Cozy Corner", 'Say hello and discover a Santa surprise.', './art/santa-full.svg', 'A SPECIAL VISIT', 'santa')}
          ${destinationCard('workshop', "The Elf Workshop", 'Choose a mission. Search carefully. Earn your elf badge.', './art/elf.svg', 'A LITTLE MISSION', 'elf')}
          ${destinationCard('mail', 'North Pole Post Office', 'Talk, draw, or send a letter to Santa.', './art/mailbox.svg', 'A MESSAGE TO SANTA', 'post')}
        </div>
        ${passport()}
        <button type="button" class="np-train-return" data-np-action="arrival">${chevron()} Ride the North Pole Express again</button>
      </div>
    </div>`;
  }
  function storyDetails() {
    const story = adventures[state.santaChoice] || adventures.hello;
    const raw = state.storyStage === 0 ? story.opener : state.storyStage === 1 ? story.choices[state.storyBranch][1] : story.ending;
    return raw.replaceAll('{name}', familyChildren().find(c => String(c.id) === String(child()))?.name || 'little helper');
  }
  function storyActions() {
    const item = adventures[state.santaChoice] || adventures.hello;
    if (state.storyStage === 0) return `<div class="np-story-actions" aria-label="Choose what Santa and you do next">${item.choices.map(([label],i)=>`<button type="button" class="np-story-option" data-np-action="story-branch" data-choice="${i}">${starIcon(14)}<span>${htmlEscape(label)}</span>${chevron()}</button>`).join('')}</div>`;
    if (state.storyStage === 1) return '<button type="button" class="np-story-next" data-np-action="story-next">What happens next? ' + chevron() + '</button>';
    return '<button type="button" class="np-story-next" data-np-action="story-restart">Tell me another story ' + chevron() + '</button>';
  }
  function santaPage() {
    return `<div class="np-shell">${topBar('A VISIT WITH SANTA')}
      <div class="np-inner">${backNav()}
        <section class="np-santa-room">
          <span class="np-room-spark one" aria-hidden="true">${starIcon(30)}</span><span class="np-room-spark two" aria-hidden="true">${starIcon(16)}</span>
          <div class="np-santa-portrait"><div class="np-portrait-light"></div><img src="./kid-santa-new.webp" onerror="this.onerror=null;this.src='./art/santa-full.svg'" alt="A friendly illustrated Santa" class="np-santa-wave"></div>
          <div class="np-santa-words"><span class="np-eyebrow np-eyebrow-dark">SANTA'S STORY CORNER</span><h1>A story just for ${childName()}</h1><p>Pick a story, then choose what happens next.</p>
            <div class="np-story-card"><div class="np-story-topline"><span class="np-story-label">${state.storyStage === 2 ? 'THE HAPPY ENDING' : state.storyStage === 1 ? 'WHAT A SURPRISE!' : 'ONCE UPON A CHRISTMAS...'}</span><span class="np-story-beat">${state.storyStage + 1} / 3</span></div>
              <p id="npSantaReply" aria-live="polite">${htmlEscape(storyDetails())}</p>
              ${storyActions()}
              <div class="np-narrator-controls"><button type="button" class="np-read-aloud" data-np-action="narrate" aria-label="Play or stop the story narrator"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Zm12-1a6 6 0 0 1 0 8M18.5 5a10 10 0 0 1 0 14"/></svg><span>${state.storyStage === 0 ? 'Read this part to me' : 'Hear this part again'}</span></button><button type="button" class="np-voice-change" data-np-action="voice">Try a different voice</button></div><small class="np-voice-feedback" id="npVoiceFeedback" aria-live="polite"></small>
            </div>
          </div>
        </section>
        <section class="np-choices"><div class="np-section-intro"><span class="np-eyebrow np-eyebrow-dark">CHOOSE YOUR ADVENTURE</span><h2>What should we explore?</h2><p>Every visit has a new little decision to make.</p></div>
          <div class="np-question-grid">
            ${[['hello', 'The mystery box', './art/ornament.svg'], ['reindeer', 'Reindeer rescue', './art/tree.svg'], ['elves', 'The wrapping workshop', './art/elf.svg'], ['secret', 'Santa’s secret door', './art/letter.svg']].map(([key, label, img]) => `<button type="button" class="np-question ${state.santaChoice === key ? 'active' : ''}" data-np-action="ask" data-ask="${key}" aria-pressed="${state.santaChoice === key}"><img src="${img}" alt=""><strong>${label}</strong><span>${starIcon(14)}</span></button>`).join('')}
          </div>
          <p class="np-story-note">These are make-believe, choose-your-path stories, not a live conversation with Santa. The narrator uses the voice available on your device.</p>
          <button type="button" class="np-secondary" data-np-action="mail">Send your own message to Santa ${chevron()}</button>
        </section>
      </div>
    </div>`;
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
    const intro = portal.querySelector('.kid-intro p');
    if (intro) intro.textContent = 'Record, draw, or write your message—then send it to the North Pole mailbox.';
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
    state.found = [];
    state.wrong = 0;
    state.hinted = -1;
    stopNarration();
    return originalEnter.apply(this, arguments);
  };

  showKidSent = function () {
    earnStamp('post');
    originalSent.apply(this, arguments);
    const success = document.querySelector('#kidPortal .kid-success');
    if (!success) return;
    success.classList.add('np-success');
    const message = success.querySelector('p');
    if (message) message.textContent = 'Your letter is safely saved in Santa’s mailbox. Your passport has a new stamp!';
    const again = success.querySelector('[data-action="kid-again"]');
    if (again) {
      again.textContent = 'Send another letter';
      const go = document.createElement('button');
      go.type = 'button'; go.className = 'np-secondary np-after-send';
      go.dataset.npAction = 'village';
      go.textContent = 'Return to Santa’s Village';
      again.insertAdjacentElement('afterend', go);
    }
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
      if (action === 'santa') { state.santaChoice = 'hello'; state.storyStage = 0; earnStamp('santa'); }
      if (action === 'workshop') { state.found = []; state.wrong = 0; state.hinted = -1; }
      if (action === 'mail' && typeof resetKidDraft === 'function') resetKidDraft();
      go(action);
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
  `;
  if (!document.getElementById('northPoleAdventureStyles')) {
    const style = document.createElement('style');
    style.id = 'northPoleAdventureStyles';
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
