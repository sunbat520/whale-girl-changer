/* ============================================================
   鲸鱼娘变化器 — 交互逻辑
   纯原生实现：无依赖、无构建步骤。
   ============================================================ */

(() => {
  'use strict';

  /* ------------------------------------------------------------
     配置
     ------------------------------------------------------------ */

  const STORAGE_KEY = 'whale-changer:v1';

  // 图片按档位顺序排列。想换图或改顺序，直接改这里。
  const FRAME_SOURCES = [
    'assets/a.jpeg',
    'assets/c.jpeg',
    'assets/d.jpeg',
    'assets/g.jpeg',
    'assets/h.jpeg',
  ];

  const DEFAULT_GRADES = [
    { name: '小鲸鱼', desc: '刚学会吐泡泡，连尾巴都还是软的。' },
    { name: '鲸鱼娘', desc: '今天的女仆装熨得很平整。' },
    { name: '鲸灵', desc: '海水开始绕着指尖打转。' },
    { name: '鲸圣', desc: '整片海都听见了她的呼吸。' },
    { name: '鲸祖', desc: '鲸祖降临，潮汐为她让路。' },
  ];

  const DEFAULTS = {
    title: '鲸鱼娘变化器',
    subtitle: '拖动滑片，调节今天的鲸系浓度',
    accent: '#4fc3f7',
    sound: true,
    grades: DEFAULT_GRADES,
  };

  const PRESET_COLORS = [
    '#4fc3f7', // 深海青
    '#7dd3fc', // 浅鲸蓝
    '#a78bfa', // 暮紫
    '#f472b6', // 珊瑚粉
    '#fbbf24', // 琥珀
    '#34d399', // 海藻绿
  ];

  const N = FRAME_SOURCES.length;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  /* ------------------------------------------------------------
     DOM
     ------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);

  const els = {
    title: $('title'),
    subtitle: $('subtitle'),
    frameStack: $('frameStack'),
    emptyHint: $('emptyHint'),
    captionLevel: $('captionLevel'),
    captionName: $('captionName'),
    captionDesc: $('captionDesc'),
    meterValue: $('meterValue'),
    track: $('track'),
    trackFill: $('trackFill'),
    trackGlow: $('trackGlow'),
    slider: $('slider'),
    ticks: $('ticks'),
    gradeLabels: $('gradeLabels'),
    soundToggle: $('soundToggle'),
    soundIcon: $('soundIcon'),
    soundText: $('soundText'),
    settingsToggle: $('settingsToggle'),
    settings: $('settings'),
    settingsClose: $('settingsClose'),
    scrim: $('scrim'),
    inputTitle: $('inputTitle'),
    inputSubtitle: $('inputSubtitle'),
    gradeFields: $('gradeFields'),
    swatches: $('swatches'),
    inputAccent: $('inputAccent'),
    resetBtn: $('resetBtn'),
  };

  /* ------------------------------------------------------------
     状态
     ------------------------------------------------------------ */

  let config = loadConfig();
  let current = 0.5; // 当前显示位置 0..1
  let target = 0.5; // 目标位置 0..1
  let lastIdx = -1; // 上一次生效的档位
  let booted = false;
  let dragging = false;
  let rafId = null;
  let lastFrameTime = 0;
  let descTimer = null;
  let saveTimer = null;

  const frames = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------------------
     配置读写
     ------------------------------------------------------------ */

  function loadConfig() {
    const base = {
      title: DEFAULTS.title,
      subtitle: DEFAULTS.subtitle,
      accent: DEFAULTS.accent,
      sound: DEFAULTS.sound,
      grades: DEFAULTS.grades.map((g) => ({ ...g })),
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return base;

      if (typeof saved.title === 'string' && saved.title.trim()) base.title = saved.title;
      if (typeof saved.subtitle === 'string') base.subtitle = saved.subtitle;
      if (typeof saved.accent === 'string' && /^#[0-9a-f]{6}$/i.test(saved.accent)) {
        base.accent = saved.accent;
      }
      if (typeof saved.sound === 'boolean') base.sound = saved.sound;

      if (Array.isArray(saved.grades)) {
        saved.grades.forEach((g, i) => {
          if (!base.grades[i] || !g) return;
          if (typeof g.name === 'string' && g.name.trim()) base.grades[i].name = g.name;
          if (typeof g.desc === 'string') base.grades[i].desc = g.desc;
        });
      }
    } catch (err) {
      // localStorage 不可用时按默认配置运行
    }

    return base;
  }

  function saveConfig() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (err) {
        // 忽略隐私模式下的写入失败
      }
    }, 180);
  }

  /* ------------------------------------------------------------
     音效引擎（Web Audio 实时合成，无音频文件）
     ------------------------------------------------------------ */

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.noiseGain = null;
      this.enabled = true;
    }

    ensure() {
      if (!this.enabled) return;
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }

      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      this.ctx = new AC();

      // 摩擦声：循环白噪声 + 带通滤波
      const sr = this.ctx.sampleRate;
      const buffer = this.ctx.createBuffer(1, sr * 2, sr);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();

      this.noiseGain = gain;
    }

    setEnabled(on) {
      this.enabled = on;
      if (!on && this.noiseGain && this.ctx) {
        this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      }
    }

    friction(intensity) {
      if (!this.enabled || !this.ctx || !this.noiseGain) return;
      const level = Math.min(0.1, Math.max(0, intensity) * 0.1);
      this.noiseGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.04);
    }

    click(freq) {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.055);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  const sound = new SoundEngine();

  /* ------------------------------------------------------------
     构建静态结构
     ------------------------------------------------------------ */

  function buildTicks() {
    const frag = document.createDocumentFragment();
    for (let v = 0; v <= 100; v += 5) {
      const tick = document.createElement('span');
      tick.className = v % 25 === 0 ? 'tick major' : 'tick';
      tick.style.left = v + '%';
      frag.appendChild(tick);
    }
    els.ticks.appendChild(frag);
  }

  function buildGradeLabels() {
    els.gradeLabels.innerHTML = '';
    config.grades.forEach((grade, i) => {
      const label = document.createElement('span');
      label.className = 'grade-label';
      if (i === 0) label.classList.add('is-first');
      if (i === N - 1) label.classList.add('is-last');
      label.style.left = (i / (N - 1)) * 100 + '%';
      label.textContent = grade.name;
      els.gradeLabels.appendChild(label);
    });
  }

  function buildFrames() {
    let settled = 0;

    FRAME_SOURCES.forEach((src) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.style.opacity = '0';
      img.style.visibility = 'hidden';

      const settle = () => {
        settled += 1;
        if (settled < N) return;
        const anyLoaded = frames.some((f) => f.naturalWidth > 0);
        els.emptyHint.style.display = anyLoaded ? 'none' : 'block';
      };

      img.addEventListener('load', settle, { once: true });
      img.addEventListener('error', settle, { once: true });

      els.frameStack.appendChild(img);
      frames.push(img);
    });
  }

  function buildSwatches() {
    PRESET_COLORS.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.color = color;
      btn.style.background = color;
      btn.setAttribute('aria-label', '主题色 ' + color);
      els.swatches.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------
     渲染
     ------------------------------------------------------------ */

  function render(t) {
    const pos = t * (N - 1);
    const pct = t * 100;

    for (let i = 0; i < N; i++) {
      const weight = Math.max(0, 1 - Math.abs(pos - i));
      const img = frames[i];
      img.style.opacity = weight.toFixed(3);
      img.style.visibility = weight > 0.002 ? 'visible' : 'hidden';
    }

    els.slider.style.left = pct + '%';
    els.slider.setAttribute('aria-valuenow', String(Math.round(pct)));
    els.trackGlow.style.left = pct + '%';
    els.trackFill.style.width = 'calc((100% - 24px) * ' + t.toFixed(4) + ')';

    const meterText = String(Math.round(pct));
    if (els.meterValue.textContent !== meterText) {
      els.meterValue.textContent = meterText;
    }

    const idx = Math.round(pos);
    if (idx !== lastIdx) {
      lastIdx = idx;
      updateGrade(idx, true);
    }
  }

  function updateGrade(idx, animate) {
    const grade = config.grades[idx] || config.grades[0];
    if (!grade) return;

    els.captionLevel.textContent = 'Lv.' + (idx + 1);
    els.captionName.textContent = grade.name;
    els.slider.setAttribute('aria-valuetext', 'Lv.' + (idx + 1) + ' ' + grade.name);

    Array.prototype.forEach.call(els.gradeLabels.children, (el, i) => {
      el.classList.toggle('is-active', i === idx);
    });

    if (animate && booted) {
      swapDesc(grade.desc);
      sound.click(720 + idx * 120);
      if (navigator.vibrate) navigator.vibrate(6);
    } else {
      els.captionDesc.textContent = grade.desc;
    }
  }

  function swapDesc(text) {
    els.captionDesc.classList.add('is-swapping');
    clearTimeout(descTimer);
    descTimer = setTimeout(() => {
      els.captionDesc.textContent = text;
      els.captionDesc.classList.remove('is-swapping');
    }, 130);
  }

  function applyConfig() {
    document.title = config.title;
    els.title.textContent = config.title;
    els.subtitle.textContent = config.subtitle;
    document.documentElement.style.setProperty('--accent', config.accent);
    els.inputAccent.value = config.accent;

    buildGradeLabels();
    updateGrade(Math.max(0, lastIdx), false);
    syncSwatchActive();
  }

  function syncSwatchActive() {
    Array.prototype.forEach.call(els.swatches.children, (btn) => {
      btn.classList.toggle(
        'is-active',
        btn.dataset.color.toLowerCase() === config.accent.toLowerCase()
      );
    });
  }

  function syncSoundButton() {
    const on = config.sound;
    els.soundToggle.setAttribute('aria-pressed', String(on));
    els.soundIcon.textContent = on ? '🔊' : '🔇';
    els.soundText.textContent = on ? '音效开' : '音效关';
  }

  /* ------------------------------------------------------------
     动画循环
     ------------------------------------------------------------ */

  function kick() {
    if (rafId != null) return;
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function loop(now) {
    const dt = Math.min(48, now - lastFrameTime) / 16.667;
    lastFrameTime = now;

    const diff = target - current;
    if (Math.abs(diff) > 0.0004) {
      current += diff * Math.min(1, 0.2 * dt);
    } else {
      current = target;
    }

    render(current);
    sound.friction(reducedMotion.matches ? 0 : Math.min(1, Math.abs(diff) * 30));

    if (current !== target) {
      rafId = requestAnimationFrame(loop);
    } else {
      rafId = null;
      sound.friction(0);
    }
  }

  /* ------------------------------------------------------------
     指针 / 键盘 / 滚轮
     ------------------------------------------------------------ */

  function pointerToT(clientX) {
    const rect = els.track.getBoundingClientRect();
    return clamp01((clientX - rect.left) / rect.width);
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    sound.ensure();
    dragging = true;
    target = pointerToT(e.clientX);
    kick();
    els.slider.focus({ preventScroll: true });
    try {
      els.track.setPointerCapture(e.pointerId);
    } catch (err) {
      // 某些浏览器不支持 pointer capture，不影响拖拽
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    target = pointerToT(e.clientX);
    kick();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try {
      els.track.releasePointerCapture(e.pointerId);
    } catch (err) {
      // 已自动释放
    }
  }

  function onKeyDown(e) {
    let next = target;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next += e.shiftKey ? 0.1 : 0.02;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next -= e.shiftKey ? 0.1 : 0.02;
        break;
      case 'PageUp':
        next += 0.1;
        break;
      case 'PageDown':
        next -= 0.1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    sound.ensure();
    target = clamp01(next);
    kick();
  }

  function onWheel(e) {
    e.preventDefault();
    sound.ensure();
    target = clamp01(target - e.deltaY * 0.0012);
    kick();
  }

  /* ------------------------------------------------------------
     设置面板
     ------------------------------------------------------------ */

  function openSettings() {
    syncSettingsInputs();
    els.settings.classList.add('is-open');
    els.settings.setAttribute('aria-hidden', 'false');
    els.scrim.hidden = false;
    document.body.style.overflow = 'hidden';
    els.settingsClose.focus({ preventScroll: true });
  }

  function closeSettings() {
    els.settings.classList.remove('is-open');
    els.settings.setAttribute('aria-hidden', 'true');
    els.scrim.hidden = true;
    document.body.style.overflow = '';
    els.settingsToggle.focus({ preventScroll: true });
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function syncSettingsInputs() {
    els.inputTitle.value = config.title;
    els.inputSubtitle.value = config.subtitle;
    els.inputAccent.value = config.accent;

    els.gradeFields.innerHTML = '';
    config.grades.forEach((grade, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'grade-field';
      wrap.innerHTML =
        '<div class="grade-field-head">Lv.' + (i + 1) + '</div>' +
        '<input type="text" maxlength="12" data-field="name" data-index="' + i + '" ' +
        'aria-label="Lv.' + (i + 1) + ' 名称" value="' + escapeAttr(grade.name) + '">' +
        '<input type="text" maxlength="40" data-field="desc" data-index="' + i + '" ' +
        'aria-label="Lv.' + (i + 1) + ' 文案" value="' + escapeAttr(grade.desc) + '">';
      els.gradeFields.appendChild(wrap);
    });

    syncSwatchActive();
  }

  /* ------------------------------------------------------------
     事件绑定
     ------------------------------------------------------------ */

  function bindEvents() {
    els.track.addEventListener('pointerdown', onPointerDown);
    els.track.addEventListener('pointermove', onPointerMove);
    els.track.addEventListener('pointerup', onPointerUp);
    els.track.addEventListener('pointercancel', onPointerUp);
    els.slider.addEventListener('keydown', onKeyDown);
    els.track.addEventListener('wheel', onWheel, { passive: false });

    els.soundToggle.addEventListener('click', () => {
      config.sound = !config.sound;
      sound.setEnabled(config.sound);
      if (config.sound) sound.ensure();
      syncSoundButton();
      saveConfig();
    });

    els.settingsToggle.addEventListener('click', openSettings);
    els.settingsClose.addEventListener('click', closeSettings);
    els.scrim.addEventListener('click', closeSettings);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.settings.classList.contains('is-open')) {
        closeSettings();
      }
    });

    els.inputTitle.addEventListener('input', () => {
      config.title = els.inputTitle.value.trim() || DEFAULTS.title;
      applyConfig();
      saveConfig();
    });

    els.inputSubtitle.addEventListener('input', () => {
      config.subtitle = els.inputSubtitle.value;
      applyConfig();
      saveConfig();
    });

    els.inputAccent.addEventListener('input', () => {
      config.accent = els.inputAccent.value;
      applyConfig();
      saveConfig();
    });

    els.swatches.addEventListener('click', (e) => {
      const btn = e.target.closest('.swatch');
      if (!btn) return;
      config.accent = btn.dataset.color;
      applyConfig();
      saveConfig();
    });

    els.gradeFields.addEventListener('input', (e) => {
      const input = e.target.closest('input[data-field]');
      if (!input) return;
      const i = Number(input.dataset.index);
      const field = input.dataset.field;
      if (!config.grades[i]) return;

      if (field === 'name') {
        config.grades[i].name = input.value.trim() || DEFAULT_GRADES[i].name;
      } else if (field === 'desc') {
        config.grades[i].desc = input.value;
      }
      applyConfig();
      saveConfig();
    });

    els.resetBtn.addEventListener('click', () => {
      config = {
        title: DEFAULTS.title,
        subtitle: DEFAULTS.subtitle,
        accent: DEFAULTS.accent,
        sound: DEFAULTS.sound,
        grades: DEFAULT_GRADES.map((g) => ({ ...g })),
      };
      sound.setEnabled(config.sound);
      target = 0.5;
      kick();
      syncSettingsInputs();
      syncSoundButton();
      applyConfig();
      saveConfig();
    });
  }

  /* ------------------------------------------------------------
     PWA：注册 Service Worker（首次访问后可离线运行）
     ------------------------------------------------------------ */

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    const host = location.hostname;
    const isLocalhost =
      host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
    // Service Worker 只在 HTTPS 或 localhost 下可用
    if (location.protocol !== 'https:' && !isLocalhost) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // 注册失败（隐私模式、被禁用等）不影响正常运行
      });
    });
  }

  /* ------------------------------------------------------------
     启动
     ------------------------------------------------------------ */

  function init() {
    sound.setEnabled(config.sound);

    buildTicks();
    buildFrames();
    buildSwatches();
    buildGradeLabels();
    syncSoundButton();

    document.documentElement.style.setProperty('--accent', config.accent);
    els.title.textContent = config.title;
    els.subtitle.textContent = config.subtitle;

    render(current);
    bindEvents();
    registerServiceWorker();

    booted = true;
  }

  init();
})();
