(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const t = (message, values) => window.NoctisI18n?.t(message, values) ?? message;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const stage = $('#stage');
  const experience = $('#baslangic');
  const canvas = $('#atmosphere');
  const ctx = canvas.getContext('2d');
  const toast = $('#toast');
  const dialog = $('#detail-dialog');
  const dialogArea = $('#dialog-image-area');
  const detailImage = $('#detail-image');
  const viewer = $('#product-viewer');
  const heroImage = $('.watch-float img');
  let toastTimer;
  let motionPaused = reducedMotion.matches;
  let currentScene = -1;
  let stageLength = 1;
  let experienceStart = 0;
  let scrollDirty = true;
  let currentTone = 'crimson';
  let lastFocus = null;
  let soundOn = false;
  let audioContext;
  let masterGain;
  let lastFrame = 0;
  let inView = true;
  let width = innerWidth;
  let height = innerHeight;
  let pointer = {x:0,y:0};
  const sceneTitles = ['BAŞLANGIÇ', 'EŞİK', 'KARAKTER'];
  const tones = {
    crimson: {name:'Crimson',code:'01',description:'Kızıl bir kadran. Gümüş çizgiler arasında sıcak ve güçlü bir odak.',filter:'none',color:'#761d2d',alt:'Kızıl kadranlı, sivri metal detaylı NOCTIS konsept saati'},
    obsidian: {name:'Obsidian',code:'02',description:'Derin siyah. Metalin keskin çizgileriyle buluşan sakin bir ifade.',filter:'grayscale(1) brightness(.78) contrast(1.1)',color:'#2a252e',alt:'Siyah kadranlı, sivri metal detaylı NOCTIS konsept saati'},
    moon: {name:'Moon',code:'03',description:'Gümüş bir yansıma. Karanlığın içinde ışığa yaklaşan bir ton.',filter:'grayscale(1) brightness(1.25) contrast(.83)',color:'#67616c',alt:'Gümüş tonlu, sivri metal detaylı NOCTIS konsept saati'}
  };
  const particles = Array.from({length:32}, () => ({x:Math.random(),y:Math.random(),r:.3+Math.random()*1.1,v:.00002+Math.random()*.000055,o:.1+Math.random()*.4}));

  function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible');
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 3400);
  }

  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    experienceStart = experience.getBoundingClientRect().top + scrollY;
    stageLength = Math.max(1, experience.offsetHeight - height);
    scrollDirty = true;
    if (motionPaused) drawAtmosphere(0);
  }

  function drawAtmosphere(delta) {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const particle of particles) {
      if (!motionPaused) {
        particle.y -= particle.v * delta;
        particle.x += Math.sin(particle.y * 9) * delta * .000002;
        if (particle.y < -.01) particle.y = 1.02;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(231,166,146,${particle.o})`;
      ctx.arc(particle.x * width, particle.y * height, particle.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  function updateScene() {
    const progress = clamp((scrollY - experienceStart) / stageLength, 0, 1);
    stage.style.setProperty('--scene-progress', progress.toFixed(4));
    $('#experience-progress').style.width = `${progress * 100}%`;
    const scene = Math.min(2, Math.floor(progress * 3));
    if (scene !== currentScene) {
      currentScene = scene;
      stage.dataset.scene = String(scene);
      $$('[data-copy]').forEach(copy => {
        const active = Number(copy.dataset.copy) === scene;
        copy.classList.toggle('active', active);
        copy.setAttribute('aria-hidden', String(!active));
        copy.inert = !active;
      });
      $$('.chapter-nav [data-goto]').forEach(button => {
        if (Number(button.dataset.goto) === scene) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      $('#scene-number').textContent = String(scene + 1).padStart(2, '0');
      $('#scene-title').textContent = t(sceneTitles[scene]);
      $('#scroll-next').setAttribute('aria-label', scene === 2 ? t('Koleksiyona git') : t('{number}. sahneye geç', {number:scene + 2}));
    }
    scrollDirty = false;
  }

  function goToScene(scene) {
    const target = scene === 0 ? experienceStart : experienceStart + stageLength * (scene / 3 + .035);
    window.scrollTo({top:target,behavior:reducedMotion.matches ? 'instant' : 'smooth'});
  }

  $$('[data-goto]').forEach(button => button.addEventListener('click', () => goToScene(Number(button.dataset.goto))));
  $('#scroll-next').addEventListener('click', () => {
    if (currentScene < 2) goToScene(currentScene + 1);
    else $('#koleksiyon').scrollIntoView({behavior:reducedMotion.matches ? 'instant' : 'smooth'});
  });
  window.addEventListener('scroll', () => { scrollDirty = true; }, {passive:true});
  window.addEventListener('resize', resize, {passive:true});

  function setMotion(paused) {
    motionPaused = paused;
    document.body.classList.toggle('paused', paused);
    const button = $('#motion-toggle');
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', t(paused ? 'Hareketleri sürdür' : 'Hareketleri duraklat'));
    $('.motion-label',button).textContent = t(paused ? 'DEVAM ET' : 'DURAKLAT');
    if (paused) {
      stage.style.setProperty('--pointer-x', 0);
      stage.style.setProperty('--pointer-y', 0);
      viewer.style.setProperty('--tilt-x', '0deg');
      viewer.style.setProperty('--tilt-y', '0deg');
    }
    drawAtmosphere(0);
  }
  $('#motion-toggle').addEventListener('click', () => setMotion(!motionPaused));
  reducedMotion.addEventListener('change', event => setMotion(event.matches));
  setMotion(motionPaused);

  stage.addEventListener('pointermove', event => {
    if (motionPaused || !finePointer.matches) return;
    pointer.x = (event.clientX / width - .5) * 2;
    pointer.y = (event.clientY / height - .5) * 2;
    stage.style.setProperty('--pointer-x', pointer.x.toFixed(3));
    stage.style.setProperty('--pointer-y', pointer.y.toFixed(3));
  }, {passive:true});
  stage.addEventListener('pointerleave', () => {
    stage.style.setProperty('--pointer-x', 0);
    stage.style.setProperty('--pointer-y', 0);
  });

  viewer.addEventListener('pointermove', event => {
    const box = viewer.getBoundingClientRect();
    const x = clamp((event.clientX - box.left) / box.width, 0, 1);
    const y = clamp((event.clientY - box.top) / box.height, 0, 1);
    viewer.style.setProperty('--light-x', `${x*100}%`);
    viewer.style.setProperty('--light-y', `${y*100}%`);
    if (!motionPaused && finePointer.matches) {
      viewer.style.setProperty('--tilt-y', `${(x-.5)*15}deg`);
      viewer.style.setProperty('--tilt-x', `${(.5-y)*9}deg`);
    }
  }, {passive:true});
  viewer.addEventListener('pointerleave', () => {
    viewer.style.setProperty('--tilt-x', '0deg');
    viewer.style.setProperty('--tilt-y', '0deg');
    viewer.style.setProperty('--light-x', '50%');
    viewer.style.setProperty('--light-y', '45%');
  });

  function selectTone(tone) {
    if (!tones[tone]) return;
    currentTone = tone;
    const data = tones[tone];
    document.body.dataset.tone = tone;
    viewer.dataset.tone = tone;
    $('#tone-name').textContent = data.name;
    $('#viewer-code').textContent = `N — ${data.code} / ${data.name.toUpperCase()}`;
    $('#design-note p').textContent = t(data.description);
    $('#detail-title').textContent = data.name;
    $$('.tone-watch').forEach(img => { img.alt = t(data.alt); });
  }
  $$('input[name="tone"]').forEach(input => input.addEventListener('change', () => selectTone(input.value)));
  selectTone('crimson');

  function resetView() {
    $('#zoom-range').value = '100';
    $('#zoom-value').value = '100%';
    detailImage.style.setProperty('--zoom', '1');
    detailImage.style.setProperty('--detail-ry', '0deg');
    detailImage.style.setProperty('--detail-rx', '0deg');
  }
  function openViewer(event) {
    lastFocus = event.currentTarget;
    resetView();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('dialog-open');
    $('#close-dialog').focus({preventScroll:true});
  }
  $('#open-viewer').addEventListener('click', openViewer);
  $('#detail-button').addEventListener('click', openViewer);
  $('#close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    lastFocus?.focus({preventScroll:true});
  });
  $('#zoom-range').addEventListener('input', event => {
    const value = Number(event.target.value);
    detailImage.style.setProperty('--zoom', String(value/100));
    $('#zoom-value').value = `${value}%`;
  });
  $('#reset-view').addEventListener('click', resetView);
  let detailPointerId = null;
  dialogArea.addEventListener('pointerdown', event => {
    detailPointerId = event.pointerId;
    dialogArea.setPointerCapture(event.pointerId);
  });
  dialogArea.addEventListener('pointermove', event => {
    if (motionPaused || (!finePointer.matches && detailPointerId !== event.pointerId)) return;
    const box = dialogArea.getBoundingClientRect();
    const x = clamp((event.clientX-box.left)/box.width,0,1);
    const y = clamp((event.clientY-box.top)/box.height,0,1);
    detailImage.style.setProperty('--detail-ry', `${(x-.5)*22}deg`);
    detailImage.style.setProperty('--detail-rx', `${(.5-y)*13}deg`);
  }, {passive:true});
  function clearDetailPointer() {
    detailPointerId = null;
    detailImage.style.setProperty('--detail-ry', '0deg');
    detailImage.style.setProperty('--detail-rx', '0deg');
  }
  dialogArea.addEventListener('pointerup', clearDetailPointer);
  dialogArea.addEventListener('pointercancel', clearDetailPointer);
  dialogArea.addEventListener('pointerleave', () => { if (detailPointerId === null) clearDetailPointer(); });

  async function createAmbience() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) throw new Error('audio-unavailable');
    audioContext = new AudioContextConstructor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioContext.destination);
    const compressor = audioContext.createDynamicsCompressor();
    compressor.connect(masterGain);
    [65.406,97.999,130.813].forEach((frequency,index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? .18 : .045;
      oscillator.connect(gain).connect(compressor);
      oscillator.start();
    });
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate*4, audioContext.sampleRate);
    const channel = buffer.getChannelData(0);
    let brown = 0;
    for (let i=0;i<channel.length;i++) { brown=(brown+Math.random()*.04-.02)/1.02;channel[i]=brown*3; }
    const noise = audioContext.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const lowpass = audioContext.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=320;
    const noiseGain = audioContext.createGain();noiseGain.gain.value=.19;
    noise.connect(lowpass).connect(noiseGain).connect(compressor);noise.start();
  }
  function updateSoundButton() {
    const button = $('#sound-toggle');
    button.setAttribute('aria-pressed', String(soundOn));
    button.setAttribute('aria-label', t(soundOn ? 'Ortam sesini kapat' : 'Ortam sesini aç'));
    $('use',button).setAttribute('href', soundOn ? '#i-sound' : '#i-mute');
    $('span',button).textContent = t(soundOn ? 'SES AÇIK' : 'SES KAPALI');
  }
  $('#sound-toggle').addEventListener('click', async () => {
    try {
      if (!audioContext) await createAmbience();
      await audioContext.resume();
      soundOn = !soundOn;
      masterGain.gain.setTargetAtTime(soundOn ? .45 : 0, audioContext.currentTime, .3);
      updateSoundButton();
    } catch {
      soundOn = false;updateSoundButton();notify(t('Bu tarayıcıda ortam sesi açılamadı.'));
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (audioContext && soundOn) {
      if (document.hidden) audioContext.suspend();
      else audioContext.resume().catch(() => {});
    }
    lastFrame = 0;
  });

  $('#save-card').addEventListener('click', async () => {
    const button = $('#save-card');
    if (button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy','true');
    try {
      const selected = tones[currentTone];
      await document.fonts.ready;
      if (!heroImage.complete) await heroImage.decode();
      const card = document.createElement('canvas');card.width=1200;card.height=1500;
      const context = card.getContext('2d');
      if (!context) throw new Error('canvas-unavailable');
      const gradient = context.createRadialGradient(600,650,20,600,650,1000);
      gradient.addColorStop(0,selected.color);gradient.addColorStop(1,'#0e0a0e');
      context.fillStyle=gradient;context.fillRect(0,0,1200,1500);
      context.strokeStyle='#ccb3a644';context.lineWidth=1;context.strokeRect(45,45,1110,1410);
      context.textAlign='center';context.fillStyle='#e4d3c6';context.font='72px "Noctis Serif", Georgia';
      context.fillText('N O C T I S',600,155);
      context.font='13px "Noctis Sans", Arial';context.fillStyle='#b4938b';context.fillText('S C U L P T E D   I N   S H A D O W',600,197);
      context.save();context.filter=selected.filter;
      context.drawImage(heroImage,150,255,900,900);context.restore();
      context.font='62px "Noctis Serif", Georgia';context.fillStyle='#e4d3c6';context.fillText(selected.name,600,1240);
      context.font='italic 29px "Noctis Serif", Georgia';context.fillStyle='#bfa398';context.fillText(t('Zaman geçer. İz kalır.'),600,1295);
      context.font='13px "Noctis Sans", Arial';context.fillStyle='#8c726d';context.fillText(t('2026  /  KONSEPT TASARIM KOLEKSİYONU'),600,1392);
      const blob = await new Promise(resolve => card.toBlob(resolve,'image/png'));
      if (!blob) throw new Error('export-failed');
      const url=URL.createObjectURL(blob);const link=document.createElement('a');
      link.href=url;link.download=`NOCTIS_${selected.name}_${window.NoctisI18n?.language==='en' ? 'Design' : 'Tasarim'}.png`;document.body.appendChild(link);link.click();link.remove();
      setTimeout(() => URL.revokeObjectURL(url),60000);
      notify(`${selected.name} ${t('tasarım kartı hazırlandı.')}`);
    } catch {
      notify(t('Tasarım kartı oluşturulamadı. Lütfen yeniden deneyin.'));
    } finally {
      button.disabled=false;button.removeAttribute('aria-busy');
    }
  });

  document.addEventListener('keydown', event => {
    if (dialog.open || /INPUT|TEXTAREA|SELECT|BUTTON|A/.test(document.activeElement?.tagName || '') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (scrollY > experienceStart + stageLength) return;
    if (event.key === 'ArrowDown') {event.preventDefault();$('#scroll-next').click();}
    if (event.key === 'ArrowUp') {event.preventDefault();goToScene(Math.max(0,currentScene-1));}
  });

  const markReady = () => document.body.classList.add('assets-ready');
  if (heroImage.complete && heroImage.naturalWidth) markReady();
  else {heroImage.addEventListener('load',markReady,{once:true});heroImage.addEventListener('error',markReady,{once:true});}
  new IntersectionObserver(entries => {inView=entries[0].isIntersecting;}, {threshold:0}).observe(experience);
  function frame(time) {
    if (scrollDirty) updateScene();
    if (!document.hidden && inView && !motionPaused && time-lastFrame>32) {
      drawAtmosphere(lastFrame ? Math.min(time-lastFrame,65) : 32);lastFrame=time;
    }
    requestAnimationFrame(frame);
  }
  window.addEventListener('noctis:language', () => {
    currentScene=-1;
    updateScene();setMotion(motionPaused);updateSoundButton();selectTone(currentTone);
  });
  resize();updateScene();requestAnimationFrame(frame);
})();
