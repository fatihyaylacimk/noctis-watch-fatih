(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const t = (message, values) => window.NoctisI18n?.t(message, values) ?? message;
  const video = $('#film');
  const cinema = $('#cinema');
  const journey = $('#film-journey');
  const range = $('#film-progress');
  const gate = $('#center-gate');
  const loading = $('#film-loading');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ambient = $('#ambient-canvas');
  const context = ambient.getContext('2d', {alpha:false});
  const scenes = [{time:0,name:'EŞİK'}, {time:2.85,name:'ÇAN'}, {time:3.85,name:'METAL'}, {time:6.1,name:'KUZGUN'}];
  let scrollMode = false;
  let scrubbing = false;
  let wasPlaying = false;
  let visibilityResume = false;
  let targetTime = null;
  let idleTimer;
  let toastTimer;
  let lastAmbient = 0;
  let scrollDirty = false;
  let activeScene = -1;
  let firstReady = false;
  let hasPlayed = false;

  const duration = () => Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 11.7;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  function clock(seconds) {return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
  function notify(message) {
    clearTimeout(toastTimer);
    $('#film-toast').textContent = message;
    $('#film-toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#film-toast').classList.remove('visible'), 3200);
  }
  function wakeControls() {
    clearTimeout(idleTimer);
    document.body.classList.remove('ui-resting');
    idleTimer = setTimeout(() => {if (!video.paused && !scrollMode) document.body.classList.add('ui-resting');}, 3500);
  }
  ['pointermove','pointerdown','keydown'].forEach(name => document.addEventListener(name,wakeControls,{passive:true}));

  function updatePlayback() {
    const paused = video.paused || scrollMode;
    $('#play-toggle').setAttribute('aria-label', t(scrollMode ? 'Otomatik oynatmaya geç' : paused ? 'Filmi oynat' : 'Filmi duraklat'));
    $('#play-toggle use').setAttribute('href', paused ? '#play' : '#pause');
    gate.hidden = hasPlayed || !paused || scrollMode || !firstReady || video.error !== null;
    if (paused) wakeControls();
  }
  function updateSound() {
    const audible = !video.muted && video.volume>0;
    const button = $('#sound-toggle');
    button.disabled = scrollMode;
    button.setAttribute('aria-pressed',String(audible));
    button.setAttribute('aria-label',t(scrollMode ? 'Kaydırma modunda ses kapalı' : audible ? 'Filmin sesini kapat' : 'Filmin sesini aç'));
    $('#sound-toggle use').setAttribute('href',audible ? '#sound' : '#muted');
    $('#sound-toggle span').textContent = t(audible ? 'SES AÇIK' : 'SES KAPALI');
  }
  function updateTimeline() {
    const time = video.currentTime || 0;
    const ratio = clamp(time/duration(),0,1);
    if (!scrubbing) range.value = String(Math.round(ratio*1000));
    range.setAttribute('aria-valuetext',`${time.toFixed(1)} / ${duration().toFixed(1)} ${t('saniye')}`);
    $('#timeline-fill').style.width = `${ratio*100}%`;
    $('#current-time').textContent = clock(time);
    $('#total-time').textContent = clock(duration());
    let next = 0;
    scenes.forEach((scene,index) => {if (time>=scene.time-.08) next=index;});
    if (next!==activeScene) {
      activeScene=next;
      $('#chapter-number').textContent=String(next+1).padStart(2,'0');
      $('#chapter-name').textContent=t(scenes[next].name);
      document.querySelectorAll('[data-seek]').forEach((button,index) => {
        if (index===next) button.setAttribute('aria-current','step');
        else button.removeAttribute('aria-current');
      });
    }
  }
  async function playFilm() {
    if (scrollMode) setMode(false,false);
    try {await video.play();gate.hidden=true;}
    catch {gate.hidden=false;}
    updatePlayback();
  }
  function scrollRatio() {
    const length = Math.max(1,journey.offsetHeight-cinema.offsetHeight);
    return clamp(scrollY/length,0,1);
  }
  function seek(seconds,syncScroll=true) {
    const value=clamp(seconds,0,Math.max(0,duration()-.045));
    targetTime=value;
    if (scrollMode && syncScroll) {
      const length=Math.max(1,journey.offsetHeight-cinema.offsetHeight);
      window.scrollTo({top:value/duration()*length,behavior:'instant'});
    }
    if (video.readyState>=1 && !video.seeking) {video.currentTime=value;targetTime=null;}
    wakeControls();
  }
  function setMode(enabled,shouldPlay=true) {
    const time=video.currentTime || 0;
    scrollMode=enabled;
    document.body.classList.toggle('scroll-mode',enabled);
    $('#mode-toggle').setAttribute('aria-pressed',String(enabled));
    $('#mode-toggle span').textContent=t(enabled ? 'Otomatik oynat' : 'Kaydırarak yönet');
    $('#scroll-message').hidden=!enabled;
    if (enabled) {
      video.pause();video.muted=true;
      const length=Math.max(1,journey.offsetHeight-cinema.offsetHeight);
      window.scrollTo({top:time/duration()*length,behavior:'instant'});
      scrollDirty=true;
    } else {
      scrollDirty=false;
      window.scrollTo({top:0,behavior:'instant'});
      if (shouldPlay) playFilm();
    }
    updatePlayback();updateSound();wakeControls();
  }

  $('#mode-toggle').addEventListener('click',() => setMode(!scrollMode));
  $('#play-toggle').addEventListener('click',() => {
    if (video.paused || scrollMode) playFilm();
    else video.pause();
  });
  $('#start-film').addEventListener('click',playFilm);
  $('#replay-film').addEventListener('click',() => {
    seek(0);
    if (!scrollMode) playFilm();
  });
  $('#sound-toggle').addEventListener('click',() => {
    video.muted=!video.muted;
    video.volume=.7;
    updateSound();
    if (!video.muted && video.paused) playFilm();
  });
  document.querySelectorAll('[data-seek]').forEach(button => button.addEventListener('click',() => seek(Number(button.dataset.seek))));

  range.addEventListener('pointerdown',() => {
    scrubbing=true;wasPlaying=!video.paused;
    if (!scrollMode) video.pause();
  });
  range.addEventListener('input',() => seek(Number(range.value)/1000*duration()));
  function finishScrub() {
    if (!scrubbing) return;
    scrubbing=false;
    if (wasPlaying && !scrollMode) playFilm();
    updateTimeline();
  }
  range.addEventListener('change',finishScrub);
  window.addEventListener('pointerup',finishScrub);
  window.addEventListener('pointercancel',finishScrub);
  window.addEventListener('scroll',() => {if (scrollMode) {scrollDirty=true;wakeControls();}}, {passive:true});
  window.addEventListener('resize',() => {if (scrollMode) scrollDirty=true;}, {passive:true});

  const fullButton=$('#fullscreen-toggle');
  function setTheatre(enabled) {
    document.body.classList.toggle('theatre-mode',enabled);
    $('#exit-theatre').hidden=!enabled;
    if (enabled) $('#exit-theatre').focus({preventScroll:true});
    else fullButton.focus({preventScroll:true});
  }
  $('#exit-theatre').addEventListener('click',() => setTheatre(false));
  fullButton.addEventListener('click',async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (cinema.requestFullscreen) await cinema.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else setTheatre(true);
    } catch {setTheatre(true);}
  });
  document.addEventListener('fullscreenchange',() => fullButton.setAttribute('aria-label',t(document.fullscreenElement ? 'Tam ekrandan çık' : 'Tam ekranı aç')));
  $('#retry-film').addEventListener('click',() => {
    $('#film-error').hidden=true;loading.hidden=false;video.load();firstReady=false;
  });
  function ready() {
    loading.hidden=true;
    $('#film-error').hidden=true;
    updateTimeline();
    if (!firstReady) {
      firstReady=true;
      if (reduced.matches) {video.pause();updatePlayback();}
      else if (!scrollMode) playFilm();
    }
    updatePlayback();
  }
  video.addEventListener('canplay',ready);
  video.addEventListener('loadedmetadata',updateTimeline);
  video.addEventListener('timeupdate',updateTimeline);
  video.addEventListener('seeked',updateTimeline);
  video.addEventListener('volumechange',updateSound);
  video.addEventListener('playing',() => {hasPlayed=true;loading.hidden=true;updatePlayback();wakeControls();});
  video.addEventListener('pause',updatePlayback);
  video.addEventListener('error',() => {loading.hidden=true;gate.hidden=true;$('#film-error').hidden=false;});
  reduced.addEventListener('change',event => {if (event.matches) video.pause();});
  if (reduced.matches) {video.autoplay=false;video.pause();}
  document.addEventListener('visibilitychange',() => {
    if (document.hidden) {visibilityResume=!video.paused;video.pause();}
    else if (visibilityResume && !scrollMode) {visibilityResume=false;playFilm();}
  });
  document.addEventListener('keydown',event => {
    if (event.key==='Escape' && document.body.classList.contains('theatre-mode')) setTheatre(false);
    if (/INPUT|BUTTON|A|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'') || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code==='Space' || event.key.toLowerCase()==='k') {event.preventDefault();$('#play-toggle').click();}
    if (event.key.toLowerCase()==='m' && !scrollMode) $('#sound-toggle').click();
    if (event.key.toLowerCase()==='f') fullButton.click();
    if (event.key==='ArrowRight') {event.preventDefault();seek(video.currentTime+1);}
    if (event.key==='ArrowLeft') {event.preventDefault();seek(video.currentTime-1);}
  });
  function frame(now) {
    if (scrollMode && scrollDirty) {seek(scrollRatio()*duration(),false);scrollDirty=false;}
    if (targetTime!==null && video.readyState>=1 && !video.seeking) {video.currentTime=targetTime;targetTime=null;}
    if (!document.hidden && video.readyState>=2 && !reduced.matches && innerWidth>700 && now-lastAmbient>80) {
      if (context) context.drawImage(video,0,0,180,320);
      lastAmbient=now;
    }
    if (!video.paused) updateTimeline();
    requestAnimationFrame(frame);
  }
  window.addEventListener('noctis:language', () => {
    activeScene=-1;
    updatePlayback();updateSound();updateTimeline();
    $('#mode-toggle span').textContent=t(scrollMode ? 'Otomatik oynat' : 'Kaydırarak yönet');
    fullButton.setAttribute('aria-label',t(document.fullscreenElement ? 'Tam ekrandan çık' : 'Tam ekranı aç'));
  });
  updateSound();updateTimeline();wakeControls();
  if (video.readyState>=3) ready();
  requestAnimationFrame(frame);
})();
