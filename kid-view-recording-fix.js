/* Santa HQ • Kid View voice-note repair • 2026-11-22
   Add AFTER cloud-sync.js (or after the main inline application script).
   No database migrations or changes to gift planning are required.
   Uses the existing IndexedDB mailbox and Cloudflare sync adapter. */
(function () {
  'use strict';

  if (typeof appState === 'undefined' || typeof renderKidPortal !== 'function' ||
      typeof putMail !== 'function' || typeof safeKidMedia !== 'function') {
    console.warn('Santa HQ: load the Kid View recording fix after the main application.');
    return;
  }

  const MAX_SECONDS = 20;
  const MAX_AUDIO_BYTES = 480000; // Safely under the app's existing ~700KB encoded-media ceiling.
  const flow = { phase: 'idle', token: 0, error: '', seconds: 0, busy: false, interrupted: false };
  const previousRender = renderKidPortal;
  const previousReset = resetKidDraft;
  const previousShowSent = showKidSent;

  const styles = document.createElement('style');
  styles.id = 'santa-kid-recording-fix-style';
  styles.textContent = `
    .kid-record-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:18px 0 22px}
    .kid-record-step{border:1px solid #eadcde;border-radius:15px;padding:12px 6px;background:#fffaf9;text-align:center;min-width:0}
    .kid-record-step b{display:grid;place-items:center;width:26px;height:26px;margin:0 auto 7px;border-radius:50%;background:#f2e6e8;color:#85545f;font-size:13px}
    .kid-record-step strong{display:block;color:#6e5560;font-size:12px;line-height:1.25}
    .kid-record-step small{display:block;margin-top:4px;color:#9b818a;font-size:11px;line-height:1.25}
    .kid-record-step.active{border-color:#be7381;background:#fff0f1;box-shadow:0 3px 10px #b94d6120}
    .kid-record-step.active b{background:#ba455c;color:#fff}
    .kid-record-step.done b{background:#286753;color:#fff}
    .kid-record-btn{width:min(220px,100%);min-height:138px!important;transition:opacity .2s,transform .2s}
    .kid-record-btn.recording{animation:kid-pulse 1.3s ease-in-out infinite}
    .kid-record-btn:disabled{opacity:.55;animation:none;box-shadow:none!important}
    #kidAudioPreview:not(:empty){margin:14px auto;padding:15px;max-width:430px;background:#fff5f3;border:1px solid #eddbda;border-radius:16px;text-align:center}
    #kidAudioPreview audio{display:block;width:100%;height:48px;margin:8px auto 4px}
    #kidAudioPreview .kid-audio-ready{font-weight:800;font-size:15px;color:#75414c}
    #kidAudioPreview .kid-text-link{display:inline-block;margin:10px 0 0}
    #kidRecordStatus{font-size:14px!important;line-height:1.5;min-height:30px;color:#71545e!important;max-width:430px;margin:12px auto;text-align:center}
    #kidRecordStatus.kid-status-error{color:#af3146!important;font-weight:750}
    #kidSubmit:disabled{opacity:.55;box-shadow:none!important;cursor:not-allowed}
    .kid-save-error{max-width:440px;margin:12px auto 0;padding:12px 14px;background:#fff2ee;border:1px solid #e4a8a3;border-radius:13px;color:#9e3e48;font-size:13px;font-weight:750;text-align:center}
    .kid-save-tip{color:#8d7881;font-size:12px;line-height:1.45;text-align:center;margin:9px auto 0;max-width:420px}
    @media(max-width:390px){.kid-record-step{padding:10px 4px}.kid-record-step strong{font-size:11px}.kid-record-step small{font-size:10px}}
  `;
  if (!document.getElementById(styles.id)) document.head.appendChild(styles);

  // Cancel pending permission prompts, FileReader callbacks and recording timers
  // when changing child/mode, exiting Kid View, or starting over.
  resetKidDraft = function () {
    flow.token += 1;
    flow.phase = 'idle';
    flow.error = '';
    flow.seconds = 0;
    flow.busy = false;
    flow.interrupted = false;
    previousReset();
  };

  renderKidPortal = function () {
    previousRender.apply(this, arguments);
    decorateKidRecorder();
  };

  showKidSent = function () {
    previousShowSent.apply(this, arguments);
    const successText = document.querySelector('#kidPortal .kid-success p');
    if (successText) successText.textContent = 'Your message is saved in Santa’s mailbox! A grown-up can listen to it in North Pole Post.';
  };

  function textStatus(message, isError) {
    const node = document.getElementById('kidRecordStatus');
    if (node) {
      node.textContent = message;
      node.classList.toggle('kid-status-error', Boolean(isError));
    }
  }

  function phaseStep() {
    if (flow.phase === 'ready' || flow.phase === 'saving') return 2;
    if (flow.phase === 'processing') return 1;
    return 0;
  }

  function decorateKidRecorder() {
    if (!appState.kidActive || appState.kidMode !== 'talk') return;
    const studio = document.getElementById('kidTalk');
    if (!studio) return;
    const title = studio.querySelector('h2');
    const instruction = studio.querySelector('p');
    if (title) title.textContent = 'Leave Santa a voice message';
    if (instruction) instruction.textContent = 'Record your voice, listen to it, then send it to Santa.';
    if (!studio.querySelector('.kid-record-steps')) {
      const steps = document.createElement('div');
      steps.className = 'kid-record-steps';
      steps.setAttribute('aria-label', 'Three steps to send a voice message');
      steps.innerHTML = [
        ['Record', 'Say your message'],
        ['Listen', 'Check it sounds right'],
        ['Send', 'Save to the mailbox']
      ].map(([name, detail], i) => `<div class="kid-record-step" data-kid-step="${i}"><b>${i + 1}</b><strong>${name}</strong><small>${detail}</small></div>`).join('');
      const recordButton = document.getElementById('kidRecordBtn');
      if (recordButton) studio.insertBefore(steps, recordButton);
    }
    if (!document.getElementById('kidSaveTip')) {
      const tip = document.createElement('p');
      tip.id = 'kidSaveTip';
      tip.className = 'kid-save-tip';
      tip.textContent = 'Your recording is not sent until you tap Send to Santa.';
      document.getElementById('kidSubmit')?.insertAdjacentElement('afterend', tip);
    }
    refreshUI();
  }

  function refreshUI() {
    if (!appState.kidActive || appState.kidMode !== 'talk') return;
    const btn = document.getElementById('kidRecordBtn');
    const submit = document.getElementById('kidSubmit');
    const preview = document.getElementById('kidAudioPreview');
    const typedText = Boolean(document.getElementById('kidMessage')?.value.trim());
    const ready = flow.phase === 'ready' && Boolean(safeKidMedia(kidAudio, 'audio'));
    const busy = ['requesting', 'processing', 'saving'].includes(flow.phase);
    if (btn) {
      const label = {
        idle: 'Start recording', requesting: 'Opening microphone…', recording: 'Stop recording',
        processing: 'Getting it ready…', ready: 'Record again', saving: 'Saving…', error: 'Try recording again'
      }[flow.phase] || 'Start recording';
      btn.innerHTML = '<span class="kid-record-art"><img src="./art/microphone.svg" alt=""></span><strong>' + label + '</strong>';
      btn.classList.toggle('recording', flow.phase === 'recording');
      btn.disabled = busy;
      btn.setAttribute('aria-label', label);
    }
    const status = {
      idle: 'Tap Start recording to begin. You can talk for up to 20 seconds.',
      requesting: 'Please allow microphone access when your device asks.',
      recording: `Recording: ${flow.seconds} of ${MAX_SECONDS} seconds. Tap Stop recording when finished.`,
      processing: 'Finishing your recording. Your message is not lost—just a moment.',
      ready: 'Great! Press play to listen. Then tap Send to Santa below.',
      saving: 'Saving to Santa’s mailbox on this device…',
      error: flow.error || 'Recording did not work. Try again.'
    }[flow.phase];
    textStatus(status, flow.phase === 'error');
    if (submit) {
      submit.disabled = busy || flow.phase === 'recording' || (!ready && !typedText);
      submit.innerHTML = flow.phase === 'saving'
        ? 'Saving your message…'
        : ready ? 'Send voice message to Santa <span aria-hidden="true">➤</span>'
        : typedText ? 'Send written message to Santa <span aria-hidden="true">➤</span>'
        : 'Record a message to send';
    }
    document.querySelectorAll('.kid-record-step').forEach((item, i) => {
      item.classList.toggle('active', i === phaseStep());
      item.classList.toggle('done', i < phaseStep());
    });
    if (preview) {
      const media = ready ? safeKidMedia(kidAudio, 'audio') : '';
      if (media) {
        // Keep the audio player intact while children listen; don't reset its playhead.
        if (preview.dataset.recording !== media) {
          preview.dataset.recording = media;
          preview.innerHTML = `<div class="kid-audio-ready">Your recording is ready</div><audio controls preload="metadata" src="${media}" aria-label="Play your voice message"></audio><button class="kid-text-link" type="button" data-action="kid-redo-record">Record again</button>`;
        }
      } else if (preview.dataset.recording || preview.innerHTML.trim()) {
        preview.dataset.recording = '';
        preview.replaceChildren();
      }
    }
    const warning = document.getElementById('kidSaveError');
    if (warning && flow.phase !== 'error') warning.remove();
  }

  function errorState(message) {
    flow.phase = 'error';
    flow.error = message;
    flow.busy = false;
    refreshUI();
  }

  function stopTracks() {
    if (kidRecordTimer) { clearInterval(kidRecordTimer); kidRecordTimer = null; }
    if (kidStream) { kidStream.getTracks().forEach(track => track.stop()); kidStream = null; }
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read this recording.'));
      reader.readAsDataURL(blob);
    });
  }

  function recorderMime() {
    const options = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return options.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  async function beginRecording() {
    if (!['idle', 'error', 'ready'].includes(flow.phase)) return;
    // Use the existing reset method so Safari cannot keep the previous mic open.
    resetKidDraft();
    const token = flow.token;
    flow.phase = 'requesting';
    flow.seconds = 0;
    refreshUI();

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      errorState('Your browser cannot record here. Open Santa HQ in Safari or Chrome over HTTPS, or choose Write instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== flow.token || !appState.kidActive || appState.kidMode !== 'talk') {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      kidStream = stream;
      const mime = recorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      kidRecorder = recorder;
      kidRecordParts = [];
      recorder.ondataavailable = event => { if (event.data && event.data.size > 0) kidRecordParts.push(event.data); };
      recorder.onerror = () => {
        if (token !== flow.token) return;
        stopTracks();
        errorState('The microphone stopped unexpectedly. Tap Try recording again.');
      };
      recorder.onstop = async () => {
        stopTracks();
        if (token !== flow.token) return;
        flow.phase = 'processing';
        refreshUI();
        try {
          // Safari sometimes adds a codecs parameter or returns an empty MIME.
          // Normalize the Blob MIME so safeKidMedia and <audio> accept it.
          const rawMime = (recorder.mimeType || kidRecordParts[0]?.type || 'audio/mp4');
          const plainMime = rawMime.split(';')[0].trim().toLowerCase();
          const knownMime = /^(audio\/(mp4|x-m4a|webm|ogg|mpeg|wav|aac))$/.test(plainMime)
            ? plainMime : 'audio/mp4';
          const blob = new Blob(kidRecordParts, { type: knownMime });
          if (!blob.size) throw new Error('No sound was captured. Please try again.');
          if (blob.size > MAX_AUDIO_BYTES) throw new Error('This message is too large to save. Try a shorter recording.');
          const url = await blobToDataURL(blob);
          if (token !== flow.token) return;
          const media = safeKidMedia(url, 'audio');
          if (!media || media.length > 690000) throw new Error('This sound format could not be saved. Try again in Safari or Chrome.');
          kidAudio = media;
          flow.phase = 'ready';
          flow.error = '';
          refreshUI();
        } catch (err) {
          if (token !== flow.token) return;
          errorState(err.message || 'Could not finish the recording. Tap Try recording again.');
        }
      };
      recorder.start();
      flow.phase = 'recording';
      flow.seconds = 0;
      refreshUI();
      kidRecordTimer = setInterval(() => {
        if (token !== flow.token || flow.phase !== 'recording') return;
        flow.seconds = Math.min(MAX_SECONDS, flow.seconds + 1);
        refreshUI();
        if (flow.seconds >= MAX_SECONDS) finishRecording();
      }, 1000);
    } catch (err) {
      if (token !== flow.token) return;
      stopTracks();
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const busy = err?.name === 'NotReadableError';
      errorState(denied
        ? 'Microphone permission was blocked. Ask a grown-up to allow the microphone for this website, then try again.'
        : busy ? 'Another app may be using the microphone. Close it and try again.'
        : 'The microphone could not start. Try Safari or Chrome, or choose Write instead.');
    }
  }

  function finishRecording() {
    if (flow.phase !== 'recording' || !kidRecorder) return;
    flow.phase = 'processing';
    if (kidRecordTimer) { clearInterval(kidRecordTimer); kidRecordTimer = null; }
    refreshUI();
    try {
      if (kidRecorder.state === 'recording') kidRecorder.stop();
    } catch (err) {
      stopTracks();
      errorState('This recording did not finish. Please try again.');
    }
  }

  async function sendMessage() {
    if (flow.busy || !appState.kidActive || appState.kidMode !== 'talk') return;
    if (['recording', 'requesting', 'processing'].includes(flow.phase)) {
      textStatus('Stop the recording and wait until it is ready before sending.', true);
      return;
    }
    const text = (document.getElementById('kidMessage')?.value || '').trim();
    const audio = safeKidMedia(kidAudio, 'audio');
    if (!audio && !text) {
      textStatus('Tap Start recording first. Or write a message in the box.', true);
      return;
    }
    const media = audio || '';
    if (media.length > 690000) {
      textStatus('This audio is too large. Record a shorter message and try again.', true);
      return;
    }
    const msg = {
      id: makeId(), kid: appState.kidSelected, type: appState.kidChoice,
      text, format: audio ? 'audio' : 'text', media,
      createdAt: new Date().toISOString(), read: false, reply: ''
    };
    flow.busy = true;
    flow.phase = 'saving';
    flow.error = '';
    const before = appState.messages.slice();
    const token = flow.token;
    refreshUI();
    try {
      await putMail(msg);
      // The original success state did not verify the actual device mailbox.
      // IndexedDB has to contain the entire message before showing success.
      const stored = await readLocalMail();
      if (!stored.some(item => item.id === msg.id && item.format === msg.format &&
         (msg.format !== 'audio' || item.media === msg.media))) {
        throw new Error('The device could not confirm that your message was saved.');
      }
      if (token !== flow.token) return;
      showKidSent();
    } catch (err) {
      if (token !== flow.token) return;
      // Avoid an unsaved message appearing in the parent inbox in memory.
      appState.messages = before;
      flow.busy = false;
      flow.phase = audio ? 'ready' : 'idle';
      refreshUI();
      const button = document.getElementById('kidSubmit');
      const error = document.createElement('div');
      error.id = 'kidSaveError';
      error.className = 'kid-save-error';
      error.setAttribute('role', 'alert');
      error.textContent = 'Not saved yet. Your recording is still here. Please tap Send again, or ask a grown-up to check available storage.';
      button?.insertAdjacentElement('afterend', error);
      console.warn('Santa HQ Kid View could not save the voice message:', err);
    }
  }

  // Intercept only the voice-note flow, preserving the original Draw / Write,
  // child selection, topic selection and grown-up mailbox features.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || !document.getElementById('kidPortal')?.contains(button)) return;
    if (appState.kidMode !== 'talk') return;
    const action = button.dataset.action;
    if (action === 'kid-record') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (flow.phase === 'recording') finishRecording();
      else if (!flow.busy) beginRecording();
    } else if (action === 'kid-redo-record') {
      event.preventDefault(); event.stopImmediatePropagation();
      resetKidDraft();
      refreshUI();
    }
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.id !== 'kidMessageForm' || appState.kidMode !== 'talk') return;
    event.preventDefault(); event.stopImmediatePropagation();
    sendMessage();
  }, true);

  document.addEventListener('input', event => {
    if (event.target?.id === 'kidMessage' && appState.kidMode === 'talk') refreshUI();
  }, true);

  // When the tab goes into the background (including an interrupted iPhone
  // recording), finalize what has been recorded rather than losing the clip.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && flow.phase === 'recording') {
      flow.interrupted = true;
      finishRecording();
    }
  });

  // Compatibility for other code paths invoking these named functions.
  startKidRecording = beginRecording;
  finishKidRecording = finishRecording;
  decorateKidRecorder();
})();
