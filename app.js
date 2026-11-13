/* ============================================================
   鲸鱼娘变化器 — 交互逻辑
   主题一（默认）：v1 鲸系浓度滑轨（经典 5 档三视图）
   主题二：鲸鱼娘 v2 六档滑轨（B–G）
   主题三：暴击展示（固定立绘 + 程序化冲击 + 连击跳字）
   纯原生实现：无依赖、无构建步骤。
   ============================================================ */

(() => {
  'use strict';

  /* ------------------------------------------------------------
     配置
     ------------------------------------------------------------ */

  const STORAGE_KEY = 'whale-changer-v2:v1';

  // 主题一（默认）：v1「鲸鱼娘变化器」的经典 5 档三视图
  const CLASSIC_GRADES = [
    { name: '小鲸鱼', desc: '刚学会吐泡泡，连尾巴都还是软的。' },
    { name: '鲸鱼娘', desc: '今天的女仆装熨得很平整。' },
    { name: '鲸灵', desc: '海水开始绕着指尖打转。' },
    { name: '鲸圣', desc: '整片海都听见了她的呼吸。' },
    { name: '鲸祖', desc: '鲸祖降临，潮汐为她让路。' },
  ];

  const V2_GRADES = [
    { name: 'B 微澜', desc: '风平浪静，只漾开一圈小小的涟漪。' },
    { name: 'C 轻潮', desc: '潮水轻轻漫过裙摆。' },
    { name: 'D 浪涌', desc: '海面开始起伏，呼吸也深了一寸。' },
    { name: 'E 深海', desc: '深海的压强，从胸口缓缓传上来。' },
    { name: 'F 鲸涛', desc: '整片海都跟着她一起涨落。' },
    { name: 'G 鲸祖', desc: '鲸祖降临，潮汐为她让路。' },
  ];

  // 两套滑轨素材：主题一 / 主题二各用一套，帧数与文案随之切换。
  const FRAME_SETS = {
    classic: {
      label: '经典 5 档',
      dir: 'assets/aligned/',
      sources: [
        'assets/aligned/a.jpeg',
        'assets/aligned/c.jpeg',
        'assets/aligned/d.jpeg',
        'assets/aligned/g.jpeg',
        'assets/aligned/h.jpeg',
      ],
      grades: CLASSIC_GRADES,
    },
    v2: {
      label: '鲸鱼娘 v2 六档',
      dir: 'assets/',
      sources: [
        'assets/b.jpeg',
        'assets/c.jpeg',
        'assets/d.jpeg',
        'assets/e.jpeg',
        'assets/f.jpeg',
        'assets/g.jpeg',
      ],
      grades: V2_GRADES,
    },
  };
  const SET_IDS = Object.keys(FRAME_SETS);
  const DEFAULT_SET = 'classic';

  const DEFAULTS = {
    title: '鲸鱼娘变化器',
    subtitle: '拖动滑片，调节今天的鲸系浓度',
    accent: '#4fc3f7',
    sound: true,
    impactSeries: 'new-burst',
    mode: 'cup',
    theme: 'classic', // classic = 主题一，v2 = 主题二，burst = 主题三（暴击展示）
  };

  /* 撞玻璃：来自「蓝发鲸鱼女仆 · 图片与 GIF 完整合集」的十组贴玻璃立绘原图。
     每组一张 still.png（原九宫格动画的高清原图），由 tools/sync_impact.py 同步。 */

  const IMPACT_SERIES = [
    { id: 'new-burst', label: '新版 · 撞玻璃九连拍' },
    { id: 'new-crack', label: '新版 · 撞玻璃九宫格' },
    { id: 'new-grid', label: '新版 · 撞玻璃九格' },
    { id: 'new-fall', label: '新版 · 撞窗后仰' },
    { id: 'old-knock', label: '初版 · 玻璃碰撞' },
    { id: 'old-kiss', label: '初版 · 玻璃轻吻' },
    { id: 'old-bash', label: '初版 · 撞击玻璃' },
    { id: 'old-combo', label: '初版 · 撞玻璃九连击' },
    { id: 'old-face', label: '初版 · 玻璃贴脸' },
    { id: 'old-rebound', label: '初版 · 撞玻璃反弹' },
  ];

  const hasImpactSeries = (id) => IMPACT_SERIES.some((s) => s.id === id);
  const isMode = (v) => v === 'cup' || v === 'rush';
  const isTheme = (v) => v === 'classic' || v === 'v2' || v === 'burst';
  // 两套滑轨主题（主题一 / 主题二）；主题三不滑轨
  const isSlideTheme = (v) => v === 'classic' || v === 'v2';

  const PRESET_COLORS = [
    '#4fc3f7', // 深海青
    '#7dd3fc', // 浅鲸蓝
    '#a78bfa', // 暮紫
    '#f472b6', // 珊瑚粉
    '#fbbf24', // 琥珀
    '#34d399', // 海藻绿
  ];

  let N = 0; // 当前图片包的帧数，切换图片包时更新
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  /* ------------------------------------------------------------
     DOM
     ------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);

  const els = {
    eyebrow: $('eyebrow'),
    title: $('title'),
    subtitle: $('subtitle'),
    display: $('display'),
    frameStack: $('frameStack'),
    emptyHint: $('emptyHint'),
    burstFrame: $('burstFrame'),
    burstModes: $('burstModes'),
    burstActions: $('burstActions'),
    burstBodies: $('burstBodies'),
    burstPad: $('burstPad'),
    burstTap: $('burstTap'),
    burstTapSub: $('burstTapSub'),
    burstBreak: $('burstBreak'),
    impact: $('impact'),
    impactFrame: $('impactFrame'),
    impactFlash: $('impactFlash'),
    impactCracks: $('impactCracks'),
    captionLevel: $('captionLevel'),
    captionName: $('captionName'),
    captionDesc: $('captionDesc'),
    meterValue: $('meterValue'),
    meterLabel: $('meterLabel'),
    modeTabs: $('modeTabs'),
    modeCup: $('modeCup'),
    modeRush: $('modeRush'),
    track: $('track'),
    trackFill: $('trackFill'),
    trackGlow: $('trackGlow'),
    slider: $('slider'),
    ticks: $('ticks'),
    gradeLabels: $('gradeLabels'),
    soundToggle: $('soundToggle'),
    soundIcon: $('soundIcon'),
    soundText: $('soundText'),
    inputTheme: $('inputTheme'),
    inputImpact: $('inputImpact'),
    impactPreview: $('impactPreview'),
    impactField: $('impactField'),
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
  // 主题一默认停在 50%（v1 初始位置）；主题二/三固定在最右端
  let current = config.theme === 'classic' ? 0.5 : 1;
  let target = current;
  let lastIdx = -1; // 上一次生效的档位
  let booted = false;
  let mode = config.mode; // cup = 杯型变化（v2 原行为），rush = 贴脸冲撞
  let theme = config.theme; // classic = 主题一，v2 = 主题二，burst = 主题三（暴击展示）
  let lastRushStep = -1; // 冲撞模式上一次触发的撞击档
  let rushFullHit = false; // 满力撞击去抖：一次推到底只触发一次
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

  function makeDefaultGradesBySet() {
    const map = {};
    SET_IDS.forEach((id) => {
      map[id] = FRAME_SETS[id].grades.map((g) => ({ ...g }));
    });
    return map;
  }

  function defaultConfig() {
    return {
      title: DEFAULTS.title,
      subtitle: DEFAULTS.subtitle,
      accent: DEFAULTS.accent,
      sound: DEFAULTS.sound,
      impactSeries: DEFAULTS.impactSeries,
      mode: DEFAULTS.mode,
      theme: DEFAULTS.theme,
      gradesBySet: makeDefaultGradesBySet(),
    };
  }

  function loadConfig() {
    const base = defaultConfig();

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
      if (isMode(saved.mode)) base.mode = saved.mode;
      if (isTheme(saved.theme)) {
        base.theme = saved.theme;
      } else if (saved.theme === 'cup') {
        // 旧版只有一个滑轨主题：按当时保存的图片包还原
        base.theme = saved.pack === 'v2' ? 'v2' : 'classic';
      }
      if (typeof saved.impactSeries === 'string' && hasImpactSeries(saved.impactSeries)) {
        base.impactSeries = saved.impactSeries;
      }

      const applyGrades = (setId, list) => {
        if (!Array.isArray(list)) return;
        const grades = base.gradesBySet[setId];
        if (!grades) return;
        list.forEach((g, i) => {
          if (!grades[i] || !g) return;
          if (typeof g.name === 'string' && g.name.trim()) grades[i].name = g.name;
          if (typeof g.desc === 'string') grades[i].desc = g.desc;
        });
      };

      const savedSets = saved.gradesBySet || saved.gradesByPack;
      if (savedSets && typeof savedSets === 'object') {
        SET_IDS.forEach((id) => applyGrades(id, savedSets[id]));
      }
      // 更早的配置只有一套六档 grades，迁移到 v2 素材
      if (Array.isArray(saved.grades)) applyGrades('v2', saved.grades);
    } catch (err) {
      // localStorage 不可用时按默认配置运行
    }

    return base;
  }

  function activeSetId() {
    return theme === 'v2' ? 'v2' : DEFAULT_SET;
  }

  function activeSet() {
    return FRAME_SETS[activeSetId()];
  }

  function activeGrades() {
    const id = activeSetId();
    const grades = config.gradesBySet && config.gradesBySet[id];
    if (Array.isArray(grades) && grades.length) return grades;
    return FRAME_SETS[id].grades;
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
      this.noiseBuffer = buffer;

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

    /* 撞玻璃：低频闷响 + 高频玻璃碎响，强度 0..1 */
    impact(strength) {
      if (!this.enabled || !this.ctx) return;
      const s = Math.max(0, Math.min(1, strength));
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(126, t);
      osc.frequency.exponentialRampToValueAtTime(44, t + 0.2);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15 + 0.2 * s, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.29);

      if (!this.noiseBuffer) return;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2300;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t + 0.012);
      ng.gain.exponentialRampToValueAtTime(0.045 + 0.085 * s, t + 0.022);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      noise.connect(hp);
      hp.connect(ng);
      ng.connect(this.ctx.destination);
      noise.start(t + 0.008);
      noise.stop(t + 0.2);
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
    const grades = activeGrades();
    const n = grades.length;
    grades.forEach((grade, i) => {
      const label = document.createElement('span');
      label.className = 'grade-label';
      if (i === 0) label.classList.add('is-first');
      if (i === n - 1) label.classList.add('is-last');
      label.style.left = (i / (n - 1)) * 100 + '%';
      label.textContent = grade.name;
      els.gradeLabels.appendChild(label);
    });
  }

  function updateEmptyHint() {
    const set = activeSet();
    const names = set.sources
      .map((src) => src.slice(src.lastIndexOf('/') + 1))
      .join(' · ');
    els.emptyHint.innerHTML =
      '把 ' +
      set.sources.length +
      ' 张图片放进 <code>' +
      set.dir +
      '</code>，命名为<br><code>' +
      names +
      '</code>';
  }

  function buildFrames() {
    // 只移除旧帧，保留空图提示、GIF 层与主题三的神临立绘层
    Array.prototype.forEach.call(
      els.frameStack.querySelectorAll('img:not(.rush-figure):not(.burst-card-figure)'),
      (img) => img.remove()
    );
    frames.length = 0;

    updateEmptyHint();

    const sources = activeSet().sources;
    N = sources.length;
    let settled = 0;

    sources.forEach((src) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.style.opacity = '0';
      img.style.visibility = 'hidden';

      const settle = () => {
        if (!frames.includes(img)) return; // 旧包的迟到事件忽略
        settled += 1;
        if (settled < sources.length) return;
        const anyLoaded = frames.some((f) => f.naturalWidth > 0);
        els.emptyHint.style.display = anyLoaded ? 'none' : 'block';
        // 图片解码完成后强制重绘一次，避免切换图片包时空白
        render(current);
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
    const burstOn = theme === 'burst';
    // 冲撞模式的贴脸立绘、主题三的神临立绘/动作帧都是独立图层，
    // 底下的滑轨帧一律隐藏，否则立绘四周会露出三视图
    const figureOn = burstOn || mode === 'rush';

    for (let i = 0; i < N; i++) {
      const img = frames[i];
      if (!img) continue;
      if (figureOn) {
        img.style.opacity = '0';
        img.style.visibility = 'hidden';
        continue;
      }
      const weight = Math.max(0, 1 - Math.abs(pos - i));
      img.style.opacity = weight.toFixed(3);
      img.style.visibility = weight > 0.002 ? 'visible' : 'hidden';
    }

    // rush-figure 只服务冲撞模式；主题三姿态帧用 .burst-card-figure（CSS 按类显示）
    if (els.rushFigure) {
      const rushOn = mode === 'rush';
      els.rushFigure.style.opacity = rushOn ? '1' : '0';
      els.rushFigure.style.visibility = rushOn ? 'visible' : 'hidden';
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
    if (!burstOn && idx !== lastIdx) {
      lastIdx = idx;
      if (mode === 'cup') updateGrade(idx, true);
    }

    if (!burstOn && mode === 'rush') renderRush(t);
  }

  /* 冲撞模式：往右推 = 贴脸越近 + 撞得越猛；往左回拉不撞 */
  function renderRush(t) {
    const idx = Math.round(t * (N - 1));
    const pct = t * 100;

    // 贴脸推近：立绘随位置放大冲向观众（CSS 以脚部为轴缩放）
    els.display.style.setProperty('--rush-scale', (1 + 0.28 * t).toFixed(4));

    const levelText = Math.round(pct) + '%';
    if (els.captionLevel.textContent !== levelText) {
      els.captionLevel.textContent = levelText;
    }
    els.slider.setAttribute('aria-valuetext', '冲撞力度 ' + Math.round(pct) + '%');

    if (!booted) {
      lastRushStep = idx;
      return;
    }

    // 满力撞击：推到底触发一次最强撞击（去抖，回拉到 90% 以内才重新武装）
    if (t >= 0.99) {
      if (!rushFullHit) {
        rushFullHit = true;
        playImpact(1);
      }
      lastRushStep = idx;
      return;
    }
    if (t < 0.9) rushFullHit = false;

    // 跨过撞击档：只有往右才撞，力度取当前位置
    if (idx > lastRushStep) {
      lastRushStep = idx;
      playImpact(clamp01(t));
    } else if (idx < lastRushStep) {
      lastRushStep = idx;
    }
  }

  function setMode(next) {
    mode = isMode(next) ? next : 'cup';
    config.mode = mode;
    const rush = mode === 'rush';

    document.body.classList.toggle('is-rush', rush);
    els.modeCup.classList.toggle('is-active', !rush);
    els.modeCup.setAttribute('aria-selected', String(!rush));
    els.modeRush.classList.toggle('is-active', rush);
    els.modeRush.setAttribute('aria-selected', String(rush));

    els.meterLabel.textContent = rush ? '撞力' : '鲸度';
    els.slider.setAttribute('aria-label', rush ? '冲撞力度' : '杯型');

    lastRushStep = Math.round(current * (N - 1));
    // 已经停在最右端时进入冲撞模式，不立刻补一次满力撞击
    rushFullHit = current >= 0.99;

    if (rush) {
      els.captionName.textContent = '冲撞力度';
      els.captionDesc.textContent = '往右推，撞得一次比一次狠。';
      els.slider.setAttribute('aria-valuetext', '冲撞力度 ' + Math.round(current * 100) + '%');
    } else {
      updateGrade(Math.max(0, lastIdx), false);
    }

    render(current);
    saveConfig();
  }

  const THEME_EYEBROW = {
    classic: 'WHALE‑GIRL RHEOSTAT',
    v2: 'WHALE‑GIRL CUP DIAL',
    burst: 'WHALE‑GIRL IMPACT',
  };

  // 主题切换：主题一/二 = 滑轨（各用一套素材），主题三 = 固定立绘 + 暴击展示
  function applyTheme(next) {
    theme = isTheme(next) ? next : 'classic';
    config.theme = theme;
    const burst = theme === 'burst';

    document.body.classList.toggle('theme-classic', theme === 'classic');
    document.body.classList.toggle('theme-v2', theme === 'v2');
    document.body.classList.toggle('theme-burst', burst);

    if (els.eyebrow) els.eyebrow.textContent = THEME_EYEBROW[theme];
    if (els.inputTheme) els.inputTheme.value = theme;

    // 杯型/冲撞切换三套主题都不展示：滑轨主题只有滑杆，主题三用暴击按钮
    els.modeTabs.hidden = true;
    if (els.burstPad) els.burstPad.hidden = !burst;
    if (els.burstModes) els.burstModes.hidden = !burst;
    // 撞击动画设置只服务于已隐藏的冲撞模式，三套主题都收起
    els.impactField.hidden = true;

    resetBurst();

    if (burst) {
      // 先退出可能残留的冲撞模式，再固定停在原图位置
      setMode('cup');
      target = 1;
      current = 1;
      els.captionLevel.textContent = '暴击';
      els.captionName.textContent = '暴击展示';
      els.captionDesc.textContent = '点「神临」推进一帧；按住 5 秒自动播连招，连击到 30 脱力。';
      els.slider.setAttribute('aria-valuetext', '暴击展示');
      lastIdx = -1;
      render(current);
      paintBurstFrame();
      // 主题三不装滑轨帧，空图提示必须显式收起（否则首屏直接进主题三会看到白板）
      els.emptyHint.style.display = 'none';
      saveConfig();
      return;
    }

    // 滑轨主题：按当前素材集重建帧与刻度（主题一 5 档 / 主题二 6 档）
    buildFrames();
    buildGradeLabels();
    syncSettingsInputs();

    // 主题一落回 v1 初始位置（50%），主题二停在最右端（G，即原图）
    target = theme === 'classic' ? 0.5 : 1;
    current = target;
    lastIdx = -1;
    setMode('cup');
  }

  function updateGrade(idx, animate) {
    const grades = activeGrades();
    const grade = grades[idx] || grades[0];
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
      // 主题一保持默认项目的行为：跨档只换档，不闪撞击层
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

  /* ------------------------------------------------------------
     撞玻璃
     ------------------------------------------------------------ */

  const impact = {
    series: null,
    src: '',
    img: null,
    ready: false,
    timer: null,
    playing: false,
    queued: 0,
  };

  function impactSrc(seriesId) {
    return 'assets/impact/' + seriesId + '/still.png';
  }

  // 冲撞模式的主体立绘：固定用默认系列，不理会设置里的撞击动画选择
  const RUSH_FIGURE_SRC = 'assets/impact/new-burst/still.png';

  function buildRushFigure() {
    const img = document.createElement('img');
    img.className = 'rush-figure';
    img.src = RUSH_FIGURE_SRC;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.style.opacity = '0';
    img.style.visibility = 'hidden';
    img.addEventListener('load', () => {
      if (booted) render(current);
    }, { once: true });
    els.frameStack.appendChild(img);
    els.rushFigure = img;
  }

  // 主题三「神临」立绘：5 种身材各一张，独立成一个图层，
  // 避免和冲撞模式的 rush-figure 抢 src 与 object-fit
  function buildCardFigure() {
    const img = document.createElement('img');
    img.className = 'burst-card-figure';
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    if (BURST_BODIES.length) img.src = BURST_BODIES[0].card;
    img.addEventListener('load', () => {
      if (booted) render(current);
    }, { once: true });
    els.frameStack.appendChild(img);
    els.cardFigure = img;
  }

  function loadImpactSeries(seriesId) {
    const id = hasImpactSeries(seriesId) ? seriesId : DEFAULTS.impactSeries;
    impact.series = id;
    impact.ready = false;
    impact.src = impactSrc(id);

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = impact.src;
      const done = () => {
        impact.ready = true;
        resolve();
      };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      impact.img = img;
    });
  }

  // 撞击层亮出贴玻璃立绘（背景虚化同图铺底）；冲撞模式强制用冲撞主体那张
  function showImpactStill(src) {
    const use = mode === 'rush' ? RUSH_FIGURE_SRC : (src || impact.src);
    if (!impact.ready || !use) return;
    if (els.impactFrame.getAttribute('src') !== use) {
      els.impactFrame.src = use;
    }
    els.impact.style.setProperty('--impact-bg', 'url("' + use + '")');
  }

  /* ------------------------------------------------------------
     主题三：暴击展示（点击驱动逐帧）

     帧号只由点击推进，不点就停在当前帧。素材由 assets/burst/sets.js
     描述（tools/sync_actions.py 生成）：

       动作行   走路 / 挥手 / 蹦跳 / 摔倒 / 坐下 / 连招
       身材行   A / B / C / D / E，每种身材各带一套动作图集
       神临     当前身材的静止立绘；点一下进入当前动作的第 0 帧
       破壁     A–E 共用同一支「突破次元」图集，点一次自动放到末帧

     点「神临」推进一帧，按住 5 秒自动播放连招；连击到 30 判定脱力，
     自动放完当前身材的摔倒序列后停住，再点一下回到神临立绘。
     ------------------------------------------------------------ */

  const BURST_EXHAUST_AT = 30;
  const BURST_HOLD_DELAY = 5000; // 按住这么久才进入自动播放
  const BURST_HOLD_INTERVAL = 110;
  const BURST_BREAK_INTERVAL = 130;

  // 资产表由 tools/sync_actions.py 生成为 window.BURST_BODIES / BURST_SETS / BURST_BREAKS
  const BURST_BODIES = Array.isArray(window.BURST_BODIES) ? window.BURST_BODIES : [];
  const BURST_SETS = Array.isArray(window.BURST_SETS) ? window.BURST_SETS : [];
  // 破壁（突破次元）：三支共用素材，难度 1/2/3，每次点等概率随机挑一支。
  // 方图按宽度铺满，所以展示层靠 kind === 'break' 换尺寸策略。
  const BURST_BREAKS = Array.isArray(window.BURST_BREAKS) ? window.BURST_BREAKS : [];

  const BURST_ACTION_ORDER = ['walk', 'wave', 'jump', 'fall', 'sit', 'combo'];
  const BURST_ACTION_LABELS = {
    walk: '走路',
    wave: '挥手',
    jump: '蹦跳',
    fall: '摔倒',
    sit: '坐下',
    combo: '连招',
  };

  // 连招 = 五组动作按按钮顺序串联（连招自身不参与串联）
  const BURST_COMBO_ORDER = ['walk', 'wave', 'jump', 'fall', 'sit'];
  const BURST_DEFAULT_ACTION = 'combo';

  const BURST_TIERS = [
    { upTo: 9, label: '砰' },
    { upTo: 19, label: '砰砰' },
    { upTo: 29, label: '鲸涛' },
    { upTo: Infinity, label: '脱力' },
  ];

  const burst = {
    bodyId: BURST_BODIES.length ? BURST_BODIES[0].id : 'a',
    action: BURST_DEFAULT_ACTION,
    view: 'shenlin', // shenlin = 静止立绘，sheet = 动作图集，break = 破壁
    count: 0, // 帧号 / 累计推进次数（自动连播也走它）
    hits: 0, // 手动连击数：只由单次点击累加，自动连播不算，脱力也只看它
    exhausted: false,
    exhaustPlaying: false, // 摔倒序列正在自动播放：此时点击无效，播完才允许复活
    breakPlaying: false,
    breakId: null, // 上一次播的破壁 id，用来避免连出同一支
    breakSet: null, // 正在/刚播完的那支（破壁停在末帧时要继续用它）
    breakToken: 0, // 每次切换来源自增，用来作废还在等图片加载的旧播放
    autoTimer: null,
    btnTimer: null,
    holdTimer: null,
    holdRepeat: null,
    holdFired: false,
    suppressClick: false,
  };

  const wrapIndex = (i, n) => ((i % n) + n) % n;

  function burstTier(combo) {
    for (let i = 0; i < BURST_TIERS.length; i++) {
      if (combo <= BURST_TIERS[i].upTo) return BURST_TIERS[i];
    }
    return BURST_TIERS[BURST_TIERS.length - 1];
  }

  function burstSetById(id) {
    return BURST_SETS.find((s) => s.id === id) || null;
  }

  function burstSetOf(bodyId, action) {
    return burstSetById(bodyId + '-' + action);
  }

  function currentBurstSet() {
    return burstSetOf(burst.bodyId, burst.action);
  }

  function currentBurstBody() {
    return BURST_BODIES.find((b) => b.id === burst.bodyId) || BURST_BODIES[0] || null;
  }

  // 连招帧序列：每种身材各串一遍，按身材缓存
  const burstComboCache = new Map();
  function comboSequence(bodyId) {
    if (burstComboCache.has(bodyId)) return burstComboCache.get(bodyId);
    const seq = [];
    for (const action of BURST_COMBO_ORDER) {
      const set = burstSetOf(bodyId, action);
      if (!set || !set.sheet) continue;
      for (let i = 0; i < set.total; i++) seq.push({ set, index: i });
    }
    burstComboCache.set(bodyId, seq);
    return seq;
  }

  // 预解码：连招会连着播五张图集，先让浏览器把当前身材的图集都解一遍
  function preloadBurstBody(bodyId) {
    for (const action of BURST_COMBO_ORDER) {
      const set = burstSetOf(bodyId, action);
      if (!set || !set.sheet) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = set.sheet;
    }
  }

  // 动作帧：只换图集与 background-position，换帧零解码成本。
  // 网格与帧数全部来自 sets.js，4×4 / 3×3 都能直接跑。
  function paintSheetFrame(set, index) {
    const af = els.burstFrame;
    if (!af || !set || !set.sheet) return;
    if (af.dataset.set !== set.id) {
      af.dataset.set = set.id;
      af.style.setProperty('--sheet', 'url("' + set.sheet + '")');
      af.style.setProperty('--bw', set.cols * 100 + '%');
      af.style.setProperty('--bh', set.rows * 100 + '%');
      af.style.setProperty('--ar', String(set.ar || 1));
    }
    // 破壁是满幅方图，按宽度铺满才不会切掉两侧的碎玻璃
    af.classList.toggle('is-square', set.kind === 'break');
    const i = wrapIndex(index, set.total);
    const col = i % set.cols;
    const row = Math.floor(i / set.cols);
    const bx = set.cols > 1 ? (col / (set.cols - 1)) * 100 : 0;
    const by = set.rows > 1 ? (row / (set.rows - 1)) * 100 : 0;
    af.style.setProperty('--bx', bx.toFixed(4) + '%');
    af.style.setProperty('--by', by.toFixed(4) + '%');
  }

  // 让 sprite 层接管画面
  function showSheetLayer() {
    els.frameStack.classList.add('is-action');
    els.frameStack.classList.remove('is-shenlin');
  }

  // 回到静止立绘（神临）
  function showShenlinLayer() {
    els.frameStack.classList.remove('is-action');
    els.frameStack.classList.add('is-shenlin');
  }

  // 一次点击推进一帧
  function paintBurstFrame() {
    if (burst.view === 'break' && burst.breakSet) {
      showSheetLayer();
      paintSheetFrame(burst.breakSet, burst.count);
      return;
    }
    if (burst.view !== 'sheet') {
      showShenlinLayer();
      return;
    }

    const set = currentBurstSet();
    if (!set) {
      showShenlinLayer();
      return;
    }
    showSheetLayer();

    if (set.kind === 'combo') {
      const seq = comboSequence(burst.bodyId);
      if (!seq.length) return;
      const item = seq[wrapIndex(burst.count, seq.length)];
      paintSheetFrame(item.set, item.index);
      return;
    }
    paintSheetFrame(set, burst.count);
  }

  // 档位与连击数写在「神临」按钮的副标题上（原来浮在人物上，会挡脸）
  function setBurstReadout() {
    if (!els.burstTapSub) return;
    const tier = burstTier(burst.hits);
    let text;
    if (burst.view === 'break') {
      const level = burst.breakSet ? burst.breakSet.difficulty : 1;
      text = '破壁 · 难度 ' + level;
    } else if (burst.exhausted) {
      text = '脱力 · 点一下复活';
    } else if (burst.view !== 'sheet') {
      text = '神临';
    } else if (burst.holdRepeat) {
      // 自动连播不累计连击，也不脱力，只报当前帧号
      text = '自动连播 · ×' + burst.count;
    } else if (burst.hits <= 0) {
      text = tier.label;
    } else {
      text = tier.label + ' · ×' + burst.hits;
    }
    els.burstTapSub.textContent = text;
    els.burstTap.classList.toggle(
      'is-break',
      burst.exhausted || (!burst.holdRepeat && tier.label === '鲸涛')
    );
    restartClass(els.burstTapSub, 'is-pop');
  }

  function flashBurstButton(el) {
    const target = el || els.burstTap;
    if (!target) return;
    restartClass(target, 'is-firing');
    clearTimeout(burst.btnTimer);
    burst.btnTimer = setTimeout(() => {
      target.classList.remove('is-firing');
    }, 340);
  }

  // 脱力：不管当前在哪个动作，都自动放完当前身材的摔倒序列并停在最后一帧。
  // 只有手动连击会走到这里，自动连播不会（连播只推进画面，不累计连击）。
  function startExhaust() {
    burst.exhausted = true;
    burst.exhaustPlaying = true;
    burst.hits = BURST_EXHAUST_AT;
    stopBurstHold();
    cancelBurstBreak();
    clearTimeout(burst.autoTimer);
    const fall = burstSetOf(burst.bodyId, 'fall');
    if (!fall) {
      burst.exhaustPlaying = false;
      return;
    }
    burst.view = 'sheet';
    showSheetLayer();

    let i = 0;
    const step = () => {
      burst.count = i;
      paintSheetFrame(fall, i);
      i += 1;
      if (i < fall.total) {
        burst.autoTimer = setTimeout(step, 90);
      } else {
        burst.count = fall.total - 1;
        burst.exhaustPlaying = false;
        burst.autoTimer = null;
        setBurstReadout();
      }
    };
    step();
    sound.click(180);
    setBurstReadout();
    if (navigator.vibrate) navigator.vibrate([14, 40, 14]);
  }

  // 脱力后点一下：回到神临立绘，连击归零
  function reviveBurst() {
    burst.exhausted = false;
    burst.exhaustPlaying = false;
    clearTimeout(burst.autoTimer);
    burst.autoTimer = null;
    burst.view = 'shenlin';
    burst.count = 0;
    burst.hits = 0;
    showShenlinLayer();
    setBurstReadout();
    sound.click(420);
  }

  // 一次点击 = 推进一帧，没有其它自动动画
  function hitBurst(opts) {
    if (theme !== 'burst') return;
    const quiet = !!(opts && opts.quiet); // quiet = 长按自动连播，不累计连击

    // 破壁是一次性播放，播完停在末帧；播放中点击不打断
    if (burst.breakPlaying) return;

    if (burst.exhausted) {
      // 摔倒序列还在自动播放时，点击先不响应：否则连点会一路点穿，
      // 脱力动画刚起第一帧就被复活取消，等于看不到脱力。
      if (burst.exhaustPlaying) return;
      reviveBurst();
      return;
    }

    // 破壁停在末帧：点一下收回神临立绘
    if (burst.view === 'break') {
      burst.view = 'shenlin';
      burst.count = 0;
      showShenlinLayer();
      setBurstReadout();
      sound.click(360);
      return;
    }

    // 从神临立绘进入当前动作：亮出第 0 帧，这一下就算第一次点击
    if (burst.view !== 'sheet') {
      burst.view = 'sheet';
      burst.count = 0;
      burst.hits = quiet ? burst.hits : burst.hits + 1;
      syncBurstControls();
      paintBurstFrame();
      setBurstReadout();
      sound.click(320);
      if (!quiet) {
        flashBurstButton();
        if (navigator.vibrate) navigator.vibrate(6);
        if (burst.hits >= BURST_EXHAUST_AT) startExhaust();
      }
      return;
    }

    burst.count += 1;
    if (!quiet) burst.hits += 1;
    paintBurstFrame();
    setBurstReadout();

    const tone = 320 + Math.min(burst.count % 120, 60) * 4;
    sound.click(tone);
    if (!quiet) {
      flashBurstButton();
      if (navigator.vibrate) navigator.vibrate(6);
    }

    // 自动连播永远不脱力：连播是展示，连击才是状态
    if (!quiet && burst.hits >= BURST_EXHAUST_AT) startExhaust();
  }

  // 破壁图集按需加载：第一次点某支时等解码，之后直接播
  const burstSheetLoads = new Map();
  function loadBurstSheet(set) {
    if (!set || !set.sheet) return Promise.resolve(false);
    if (burstSheetLoads.has(set.sheet)) return burstSheetLoads.get(set.sheet);
    const task = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = set.sheet;
    });
    burstSheetLoads.set(set.sheet, task);
    return task;
  }

  function preloadBurstSheet(set) {
    loadBurstSheet(set);
  }

  // 等概率随机，但不跟上一支重复（三支依次出现，不会连着看同一支）
  function pickBurstBreak() {
    if (BURST_BREAKS.length <= 1) return BURST_BREAKS[0];
    const pool = BURST_BREAKS.filter((b) => b.id !== burst.breakId);
    const list = pool.length ? pool : BURST_BREAKS;
    return list[Math.floor(Math.random() * list.length)];
  }

  // 作废还没播完 / 还在等加载的破壁
  function cancelBurstBreak() {
    burst.breakToken += 1;
    burst.breakPlaying = false;
  }

  // 逐帧播放一张破壁图集，放完停在末帧
  function runBurstBreak(set, token) {
    burst.breakSet = set;
    showSheetLayer();
    let i = 0;
    const step = () => {
      if (burst.breakToken !== token) return;
      burst.count = i;
      paintSheetFrame(set, i);
      setBurstReadout();
      i += 1;
      if (i < set.total) {
        burst.autoTimer = setTimeout(step, BURST_BREAK_INTERVAL);
      } else {
        burst.autoTimer = null;
        burst.breakPlaying = false;
        burst.count = set.total - 1;
        setBurstReadout();
        // 剩下两支下次要用，先让浏览器解码
        BURST_BREAKS.forEach((b) => {
          if (b.id !== set.id) preloadBurstSheet(b);
        });
      }
    };
    step();
    sound.impact(0.8);
    if (navigator.vibrate) navigator.vibrate([10, 26, 16]);
  }

  // 破壁（突破次元）：三支共用素材，点一次等概率随机挑一支（不连出同一支）
  function playBreak() {
    if (theme !== 'burst' || !BURST_BREAKS.length || burst.breakPlaying) return;
    sound.ensure();
    stopBurstHold();
    clearTimeout(burst.autoTimer);
    burst.autoTimer = null;
    burst.exhausted = false;
    burst.exhaustPlaying = false;
    burst.breakPlaying = true;
    burst.view = 'break';
    burst.count = 0;
    burst.hits = 0;
    flashBurstButton(els.burstBreak);

    const set = pickBurstBreak();
    burst.breakId = set.id;
    burst.breakSet = set;
    const token = ++burst.breakToken;
    setBurstReadout();

    // 第一次点某支时图集还没落盘：先等它解码，避免停在上一张画面上
    loadBurstSheet(set).then((ok) => {
      if (burst.breakToken !== token) return;
      if (!ok) {
        burst.breakPlaying = false;
        setBurstReadout();
        return;
      }
      runBurstBreak(set, token);
    });
  }

  /* --- 长按：按住「神临」5 秒后自动播放连招 --- */

  function startBurstHold(event) {
    if (theme !== 'burst') return;
    if (burst.holdTimer || burst.holdRepeat) return;
    sound.ensure();

    if (event && event.pointerId !== undefined && els.burstTap.setPointerCapture) {
      try {
        els.burstTap.setPointerCapture(event.pointerId);
      } catch (err) {
        /* 指针已失效，忽略 */
      }
    }

    burst.holdFired = false;
    burst.suppressClick = false;
    els.burstTap.classList.add('is-arming');

    // 5 秒到点才开始自动播放，中途松手等同于一次普通点击
    burst.holdTimer = setTimeout(() => {
      burst.holdTimer = null;
      if (theme !== 'burst' || burst.exhausted || burst.breakPlaying) return;
      burst.holdFired = true;
      burst.suppressClick = true;
      els.burstTap.classList.add('is-holding');

      // 长按固定播连招：先把当前动作切成连招第 0 帧
      burst.action = 'combo';
      burst.view = 'sheet';
      burst.count = 0;
      syncBurstControls();
      paintBurstFrame();
      setBurstReadout();

      burst.holdRepeat = setInterval(() => {
        if (theme !== 'burst' || burst.exhausted || burst.exhaustPlaying) {
          stopBurstHold();
          return;
        }
        hitBurst({ quiet: true });
      }, BURST_HOLD_INTERVAL);
    }, BURST_HOLD_DELAY);
  }

  function stopBurstHold() {
    clearTimeout(burst.holdTimer);
    clearInterval(burst.holdRepeat);
    burst.holdTimer = null;
    burst.holdRepeat = null;
    // 长按结束后浏览器还会补一个 click，这里吃掉，避免多走一帧
    if (burst.holdFired) {
      burst.suppressClick = true;
      burst.holdFired = false;
    }
    if (els.burstTap) {
      els.burstTap.classList.remove('is-holding');
      els.burstTap.classList.remove('is-arming');
    }
  }

  /* --- 选择器：动作行 + 身材行 --- */

  function buildBurstControls() {
    if (els.burstActions) {
      els.burstActions.innerHTML = '';
      for (const action of BURST_ACTION_ORDER) {
        // 连招没有自己的图集，但要能主动选（会从第一组动作串起来）
        if (action !== 'combo' && !burstSetOf(burst.bodyId, action)) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'burst-mode';
        btn.dataset.action = action;
        btn.textContent = BURST_ACTION_LABELS[action] || action;
        els.burstActions.appendChild(btn);
      }
    }
    buildBurstBodies();
    syncBurstControls();
  }

  function buildBurstBodies() {
    if (!els.burstBodies) return;
    els.burstBodies.innerHTML = '';
    if (!BURST_BODIES.length) {
      els.burstBodies.hidden = true;
      return;
    }
    els.burstBodies.hidden = false;
    for (const body of BURST_BODIES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'burst-mode is-card';
      btn.dataset.body = body.id;
      btn.textContent = body.label;
      btn.setAttribute('aria-label', '身材 ' + body.label);
      els.burstBodies.appendChild(btn);
    }
  }

  // 同步高亮：动作行按 action，身材行按 bodyId
  function syncBurstControls() {
    if (els.burstActions) {
      els.burstActions.querySelectorAll('[data-action]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.action === burst.action);
      });
    }
    if (els.burstBodies) {
      els.burstBodies.querySelectorAll('[data-body]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.body === burst.bodyId);
      });
    }
  }

  // 选中某个动作：重置帧号并立刻给第 0 帧，避免停在 baseline 上看不出差别
  function selectBurstAction(action) {
    if (!action) return;
    stopBurstHold();
    clearTimeout(burst.autoTimer);
    burst.autoTimer = null;
    burst.exhausted = false;
    burst.exhaustPlaying = false;
    cancelBurstBreak();
    burst.action = action;
    burst.view = 'sheet';
    burst.count = 0;
    burst.hits = 0;
    preloadBurstBody(burst.bodyId);
    syncBurstControls();
    paintBurstFrame();
    setBurstReadout();
  }

  // 换身材：动作与视图不变，只把图集/立绘换成这一位的（各自的动作素材）
  function selectBurstBody(bodyId) {
    const body = BURST_BODIES.find((b) => b.id === bodyId);
    if (!body) return;
    stopBurstHold();
    clearTimeout(burst.autoTimer);
    burst.autoTimer = null;
    burst.exhausted = false;
    burst.exhaustPlaying = false;
    cancelBurstBreak();
    burst.bodyId = body.id;
    burst.count = 0;
    burst.hits = 0;
    if (els.cardFigure && els.cardFigure.getAttribute('src') !== body.card) {
      els.cardFigure.src = body.card;
    }
    if (!burstSetOf(body.id, burst.action)) burst.action = BURST_DEFAULT_ACTION;
    if (burst.view === 'break') burst.view = 'shenlin';
    if (burst.view === 'sheet') preloadBurstBody(body.id);
    syncBurstControls();
    paintBurstFrame();
    setBurstReadout();
  }

  // 离开主题三或重置：清掉连击、帧态与残留类，回到默认身材的神临立绘
  function resetBurst() {
    stopBurstHold();
    clearTimeout(burst.autoTimer);
    clearTimeout(burst.btnTimer);
    burst.autoTimer = null;
    burst.btnTimer = null;
    burst.count = 0;
    burst.hits = 0;
    burst.exhausted = false;
    burst.exhaustPlaying = false;
    cancelBurstBreak();
    burst.breakSet = null;
    burst.action = BURST_DEFAULT_ACTION;
    burst.view = 'shenlin';
    if (BURST_BODIES.length) burst.bodyId = BURST_BODIES[0].id;

    const body = currentBurstBody();
    if (els.cardFigure && body && els.cardFigure.getAttribute('src') !== body.card) {
      els.cardFigure.src = body.card;
    }

    els.frameStack.classList.remove('is-action');
    els.frameStack.classList.add('is-shenlin');
    els.frameStack.classList.remove('is-punch');
    els.display.classList.remove('is-hit');
    els.impactFlash.classList.remove('is-on');
    els.impactCracks.classList.remove('is-on');
    if (els.burstFrame) els.burstFrame.classList.remove('is-square');
    if (els.burstTap) {
      els.burstTap.classList.remove('is-break', 'is-firing', 'is-holding', 'is-arming');
    }
    if (els.burstBreak) els.burstBreak.classList.remove('is-firing');
    syncBurstControls();
    if (els.burstTapSub) {
      els.burstTapSub.textContent = '神临';
      els.burstTapSub.classList.remove('is-pop');
    }
  }

  function restartClass(el, cls) {
    el.classList.remove(cls);
    // 强制回流，让同一个动画能连续重播
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function strike(strength) {
    const s = clamp01(strength);
    // 白闪峰值、裂纹速度与粗细都从该变量读取；0.5 时与旧版视觉完全一致
    els.display.style.setProperty('--hit-strength', s.toFixed(3));
    els.display.style.setProperty('--shake', (4 + 11 * s).toFixed(1));
    restartClass(els.display, 'is-hit');
    restartClass(els.impactFlash, 'is-on');
    restartClass(els.impactCracks, 'is-on');

    sound.impact(0.35 + 0.65 * s);
    if (navigator.vibrate) navigator.vibrate([10, 26, 14]);
  }

  // 撞击装饰类的统一收尾。减弱动效下 CSS 把这些动画置为 none，
  // animationend 不会触发，必须显式移除，否则类会一直挂住。
  function clearImpactDecor() {
    els.display.classList.remove('is-hit');
    els.impactFlash.classList.remove('is-on');
    els.impactCracks.classList.remove('is-on');
  }

  function playImpact(strength) {
    const s = clamp01(strength);
    if (!impact.ready) return;

    if (impact.playing) {
      impact.queued = Math.min(1, impact.queued + 1);
      return;
    }

    impact.playing = true;
    impact.queued = 0;
    els.display.classList.add('is-impacting');

    showImpactStill();
    strike(s);

    // 撞得越狠，贴脸立绘停留越久；减弱动效下 CSS 不播逐帧/震屏，逻辑统一
    clearTimeout(impact.timer);
    impact.timer = setTimeout(() => {
      clearImpactDecor();
      finishImpact(s);
    }, 240 + 140 * s);
  }

  function finishImpact(strength) {
    impact.playing = false;

    if (impact.queued > 0) {
      impact.queued = 0;
      playImpact(strength);
      return;
    }

    els.display.classList.remove('is-impacting');
  }

  function buildImpactOptions() {
    els.inputImpact.innerHTML = '';
    IMPACT_SERIES.forEach((series) => {
      const opt = document.createElement('option');
      opt.value = series.id;
      opt.textContent = series.label;
      els.inputImpact.appendChild(opt);
    });
    els.inputImpact.value = config.impactSeries;
  }

  function applyConfig() {
    document.title = config.title;
    els.title.textContent = config.title;
    els.subtitle.textContent = config.subtitle;
    document.documentElement.style.setProperty('--accent', config.accent);
    els.inputAccent.value = config.accent;
    els.inputImpact.value = config.impactSeries;
    els.inputTheme.value = config.theme;

    // 主题三的档位文案固定为暴击展示，不随档位设置变化
    if (theme !== 'burst') {
      buildGradeLabels();
      updateGrade(Math.max(0, lastIdx), false);
    }
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
    const dt = Math.max(0, Math.min(48, now - lastFrameTime)) / 16.667;
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
    els.inputImpact.value = config.impactSeries;
    els.inputTheme.value = config.theme;

    els.gradeFields.innerHTML = '';
    activeGrades().forEach((grade, i) => {
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

    els.modeCup.addEventListener('click', () => setMode('cup'));
    els.modeRush.addEventListener('click', () => {
      sound.ensure();
      setMode('rush');
      // 切入冲撞模式给一次轻撞反馈（与设置里切换撞击动画的行为一致）
      if (impact.ready) playImpact(0.4);
    });

    // 主题三：点「神临」或直接点立绘推进一帧；按住「神临」5 秒自动播放连招
    els.burstTap.addEventListener('click', () => {
      // 长按松手后浏览器还会补一个 click，这里吃掉，避免多走一帧
      if (burst.suppressClick) {
        burst.suppressClick = false;
        return;
      }
      sound.ensure();
      hitBurst();
    });
    els.burstTap.addEventListener('pointerdown', startBurstHold);
    els.burstTap.addEventListener('pointerup', stopBurstHold);
    els.burstTap.addEventListener('pointercancel', stopBurstHold);
    els.burstTap.addEventListener('lostpointercapture', stopBurstHold);
    els.burstBreak.addEventListener('click', playBreak);
    els.burstPad.addEventListener('contextmenu', (e) => e.preventDefault());
    els.display.addEventListener('click', () => {
      if (theme !== 'burst') return;
      sound.ensure();
      hitBurst();
    });
    // 连点立绘不弹系统菜单，也不触发双击缩放
    els.display.addEventListener('contextmenu', (e) => {
      if (theme === 'burst') e.preventDefault();
    });

    // 主题三：动作 / 身材切换（事件委托，改数据不用再绑事件）
    els.burstModes.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        sound.ensure();
        selectBurstAction(actionBtn.dataset.action);
        return;
      }
      const bodyBtn = e.target.closest('[data-body]');
      if (!bodyBtn) return;
      sound.ensure();
      selectBurstBody(bodyBtn.dataset.body);
    });

    els.inputTheme.addEventListener('change', () => {
      applyTheme(els.inputTheme.value);
    });

    els.soundToggle.addEventListener('click', () => {
      config.sound = !config.sound;
      sound.setEnabled(config.sound);
      if (config.sound) sound.ensure();
      syncSoundButton();
      saveConfig();
    });

    els.inputImpact.addEventListener('change', () => {
      config.impactSeries = hasImpactSeries(els.inputImpact.value)
        ? els.inputImpact.value
        : DEFAULTS.impactSeries;
      saveConfig();
      loadImpactSeries(config.impactSeries).then(() => playImpact(0.9));
    });

    els.impactPreview.addEventListener('click', () => {
      sound.ensure();
      if (impact.ready) {
        playImpact(0.9);
      } else {
        loadImpactSeries(config.impactSeries).then(() => playImpact(0.9));
      }
    });

    // 撞击动画收尾后清掉类名，下一次撞击才能重新触发同一段动画
    els.display.addEventListener('animationend', (e) => {
      if (e.animationName === 'impact-shake') els.display.classList.remove('is-hit');
    });
    // 主题三的镜头冲击同理，播完摘掉类，避免动画状态一直挂着
    els.frameStack.addEventListener('animationend', (e) => {
      if (e.animationName === 'burst-punch') els.frameStack.classList.remove('is-punch');
    });
    els.impactFlash.addEventListener('animationend', () => {
      els.impactFlash.classList.remove('is-on');
    });
    els.impactCracks.addEventListener('animationend', () => {
      els.impactCracks.classList.remove('is-on');
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
      const grades = activeGrades();
      if (!grades[i]) return;

      const setDefaults = FRAME_SETS[activeSetId()] ? FRAME_SETS[activeSetId()].grades : [];
      if (field === 'name') {
        const fallback = setDefaults[i] ? setDefaults[i].name : grades[i].name;
        grades[i].name = input.value.trim() || fallback;
      } else if (field === 'desc') {
        grades[i].desc = input.value;
      }
      applyConfig();
      saveConfig();
    });

    els.resetBtn.addEventListener('click', () => {
      config = defaultConfig();
      sound.setEnabled(config.sound);
      loadImpactSeries(config.impactSeries);
      applyTheme(config.theme);
      target = config.theme === 'classic' ? 0.5 : 1;
      current = target;
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
    buildRushFigure();
    buildCardFigure();
    buildSwatches();
    buildImpactOptions();
    // 两级选择器的按钮由 BURST_SETS 生成，必须在 applyTheme（内部会 resetBurst）之前建好
    buildBurstControls();
    loadImpactSeries(config.impactSeries);
    applyTheme(config.theme);
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
