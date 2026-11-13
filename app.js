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
    burstCards: $('burstCards'),
    burstPad: $('burstPad'),
    burstTap: $('burstTap'),
    burstTapSub: $('burstTapSub'),
    burstHold: $('burstHold'),
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
    // 只移除旧帧，保留空图提示、GIF 层与主题三的固定立绘/人物卡
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
    // 主题二与冲撞模式都以贴玻璃立绘为主体；主题三姿态帧改用人物卡层
    const poseSet = burstOn && currentBurstSet();
    const poseOn = !!(poseSet && poseSet.kind === 'pose');
    const figureOn = poseOn || mode === 'rush';

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
      els.captionDesc.textContent = '点一次推进一帧；按住「长按」自动循环，连击到 30 脱力。';
      els.slider.setAttribute('aria-valuetext', '暴击展示');
      lastIdx = -1;
      render(current);
      paintBurstFrame();
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

  // 主题三「撞墙」姿态帧的底图：三套人物卡共用同一套 transform，
  // 独立成一个图层，避免和冲撞模式的 rush-figure 抢 src 与 object-fit
  function buildCardFigure() {
    const img = document.createElement('img');
    img.className = 'burst-card-figure';
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    if (BURST_CARDS.length) img.src = BURST_CARDS[0].sheet;
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

       动作行   撞墙 / 走路 / 挥手 / 蹦跳 / 摔倒 / 坐下 / 连招
       人物卡   三套造型，只替换「撞墙」姿态帧的底图

     单击按钮或点立绘走一帧；按住「长按」按钮 180ms 后每 110ms 自动循环。
     连击到 30 判定脱力，自动放完摔倒序列后停住，再点一下重新站起。
     ------------------------------------------------------------ */

  const BURST_EXHAUST_AT = 30;
  const BURST_HOLD_DELAY = 180;
  const BURST_HOLD_INTERVAL = 110;

  // 资产表由 tools/sync_actions.py 生成为 window.BURST_SETS / BURST_CARDS
  const BURST_SETS = Array.isArray(window.BURST_SETS) ? window.BURST_SETS : [];
  const BURST_CARDS = Array.isArray(window.BURST_CARDS) ? window.BURST_CARDS : [];

  const BURST_ACTION_ORDER = ['impact', 'walk', 'wave', 'jump', 'fall', 'sit', 'combo'];
  const BURST_ACTION_LABELS = {
    impact: '撞墙',
    walk: '走路',
    wave: '挥手',
    jump: '蹦跳',
    fall: '摔倒',
    sit: '坐下',
    combo: '连招',
  };

  // 连招顺序 = 按钮顺序（撞墙是姿态帧，不参与串联）
  const BURST_COMBO_ORDER = ['walk', 'wave', 'jump', 'fall', 'sit'];

  // 10 帧撞击姿态：贴脸推近 → 压扁 → 回弹 → 下落 → 归位
  const BURST_POSES = [
    { s: 1.000, sy: 1.000, rot: 0.0, x: 0, y: 0, tone: 300 },
    { s: 1.022, sy: 0.994, rot: -0.4, x: 0, y: -2, tone: 330 },
    { s: 1.056, sy: 0.978, rot: -0.9, x: 0, y: -4, tone: 370 },
    { s: 1.090, sy: 0.954, rot: -1.3, x: 1, y: -3, tone: 410 },
    { s: 1.116, sy: 0.930, rot: -1.6, x: 2, y: -1, tone: 450 },
    { s: 1.070, sy: 0.962, rot: 0.6, x: -2, y: 2, tone: 480 },
    { s: 1.022, sy: 0.990, rot: 1.2, x: -3, y: 6, tone: 510 },
    { s: 1.000, sy: 0.996, rot: 0.8, x: -2, y: 10, tone: 530 },
    { s: 1.006, sy: 1.000, rot: 0.3, x: 0, y: 5, tone: 510 },
    { s: 1.000, sy: 1.000, rot: 0.0, x: 0, y: 0, tone: 480 },
  ];

  const BURST_TIERS = [
    { upTo: 9, label: '砰' },
    { upTo: 19, label: '砰砰' },
    { upTo: 29, label: '鲸涛' },
    { upTo: Infinity, label: '脱力' },
  ];

  const burst = {
    setId: 'impact-pose', // BURST_SETS 里的 id，决定图集/帧数/网格
    cardId: BURST_CARDS.length ? BURST_CARDS[0].id : null,
    count: 0, // 累计点击 = 连击数 = 帧计数
    exhausted: false,
    exhaustPlaying: false, // 摔倒序列正在自动播放：此时点击无效，播完才允许复活
    autoTimer: null,
    btnTimer: null,
    holdTimer: null,
    holdRepeat: null,
  };

  function burstTier(combo) {
    for (let i = 0; i < BURST_TIERS.length; i++) {
      if (combo <= BURST_TIERS[i].upTo) return BURST_TIERS[i];
    }
    return BURST_TIERS[BURST_TIERS.length - 1];
  }

  function setBurstButton(firing) {
    if (!els.burstTap) return;
    els.burstTap.classList.toggle('is-firing', firing);
  }

  function burstSetById(id) {
    return BURST_SETS.find((s) => s.id === id) || BURST_SETS[0] || null;
  }

  function currentBurstSet() {
    return burstSetById(burst.setId);
  }

  function currentBurstAction() {
    const set = currentBurstSet();
    return set ? set.action : 'impact';
  }

  function burstSetsForAction(action) {
    return BURST_SETS.filter((s) => s.action === action);
  }

  // 每个动作只有一组图集，这里保留函数形态方便以后加画风版本
  function preferredBurstSet(action) {
    const pool = burstSetsForAction(action);
    return pool.length ? pool[0] : null;
  }

  // 连招：五套动作按按钮顺序串成一条长序列，缓存一次即可
  let burstComboSeq = null;
  function comboSequence() {
    if (burstComboSeq) return burstComboSeq;
    const seq = [];
    for (const action of BURST_COMBO_ORDER) {
      const set = BURST_SETS.find((s) => s.action === action);
      if (!set) continue;
      for (let i = 0; i < set.total; i++) seq.push({ set, index: i });
    }
    burstComboSeq = seq;
    return seq;
  }

  // 姿态帧：值直接写进人物卡的 CSS 变量（撞墙的推近/压扁/回弹）
  function paintPoseFrame(index) {
    const total = BURST_POSES.length;
    const pose = BURST_POSES[((index % total) + total) % total];
    const fig = els.cardFigure;
    if (!fig || !pose) return;
    fig.style.setProperty('--f-scale', pose.s.toFixed(3));
    fig.style.setProperty('--f-sy', pose.sy.toFixed(3));
    fig.style.setProperty('--f-rot', pose.rot.toFixed(2) + 'deg');
    fig.style.setProperty('--f-x', pose.x + 'px');
    fig.style.setProperty('--f-y', pose.y + 'px');
  }

  // 动作帧：只换图集与 background-position，换帧零解码成本。
  // 网格与帧数全部来自 sets.js，4×2 / 4×4 / 3×3 都能直接跑。
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
    const total = set.total;
    const i = ((index % total) + total) % total;
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
    els.frameStack.classList.remove('is-burst-pose');
  }

  // 一次点击推进一帧
  function paintBurstFrame() {
    const set = currentBurstSet();
    if (!set) return;

    if (set.kind === 'pose') {
      els.frameStack.classList.remove('is-action');
      els.frameStack.classList.add('is-burst-pose');
      paintPoseFrame(burst.count);
      return;
    }

    showSheetLayer();
    if (set.kind === 'combo') {
      const seq = comboSequence();
      if (!seq.length) return;
      const item = seq[((burst.count % seq.length) + seq.length) % seq.length];
      paintSheetFrame(item.set, item.index);
      return;
    }
    paintSheetFrame(set, burst.count);
  }

  // 档位与连击数写在「单击」按钮的副标题上（原来浮在人物上，会挡脸）
  function setBurstReadout(combo, tier, exhausted) {
    if (!els.burstTapSub) return;
    els.burstTapSub.textContent =
      exhausted || combo <= 0 ? tier.label : tier.label + ' · ×' + combo;
    els.burstTap.classList.toggle('is-break', exhausted || tier.label === '鲸涛');
    restartClass(els.burstTapSub, 'is-pop');
  }

  // 脱力：不管当前在哪个动作，都自动放完摔倒序列并停在最后一帧
  function startExhaust() {
    burst.exhausted = true;
    burst.exhaustPlaying = true;
    stopBurstHold();
    clearTimeout(burst.autoTimer);
    const fall = BURST_SETS.find((s) => s.action === 'fall');
    if (!fall) {
      burst.exhaustPlaying = false;
      return;
    }
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
      }
    };
    step();
    sound.click(180);
    setBurstReadout(BURST_EXHAUST_AT, BURST_TIERS[3], true);
    if (navigator.vibrate) navigator.vibrate([14, 40, 14]);
  }

  // 脱力后点一下：重新站起来，从第 1 帧继续
  function reviveBurst() {
    burst.exhausted = false;
    burst.exhaustPlaying = false;
    clearTimeout(burst.autoTimer);
    burst.autoTimer = null;
    burst.count = 0;
    paintBurstFrame();
    setBurstReadout(0, BURST_TIERS[0], false);
    sound.click(420);
  }

  // 一次点击 = 推进一帧，没有其它自动动画
  function hitBurst(opts) {
    if (theme !== 'burst') return;
    const quiet = !!(opts && opts.quiet);
    if (burst.exhausted) {
      // 摔倒序列还在自动播放时，点击先不响应：否则连点会一路点穿，
      // 脱力动画刚起第一帧就被复活取消，等于看不到脱力。
      if (burst.exhaustPlaying) return;
      reviveBurst();
      return;
    }

    burst.count += 1;
    paintBurstFrame();

    const tier = burstTier(burst.count);
    setBurstReadout(burst.count, tier, false);

    const set = currentBurstSet();
    const tone =
      set && set.kind === 'pose'
        ? BURST_POSES[burst.count % BURST_POSES.length].tone
        : 320 + Math.min(burst.count, 60) * 4;
    sound.click(tone);
    if (!quiet && navigator.vibrate) navigator.vibrate(6);

    if (!quiet) {
      setBurstButton(true);
      restartClass(els.burstTap, 'is-firing');
      clearTimeout(burst.btnTimer);
      burst.btnTimer = setTimeout(() => setBurstButton(false), 320);
    }

    if (burst.count >= BURST_EXHAUST_AT) startExhaust();
  }

  /* --- 长按：按住「长按」按钮自动循环 --- */

  function startBurstHold(event) {
    if (theme !== 'burst') return;
    if (event) event.preventDefault();
    if (burst.holdTimer || burst.holdRepeat) return;
    sound.ensure();
    if (event && event.pointerId !== undefined && els.burstHold.setPointerCapture) {
      try {
        els.burstHold.setPointerCapture(event.pointerId);
      } catch (err) {
        /* 指针已失效，忽略 */
      }
    }
    els.burstHold.classList.add('is-holding');
    // 按下立刻走一帧，短按也有反馈
    hitBurst({ quiet: true });
    burst.holdTimer = setTimeout(() => {
      burst.holdTimer = null;
      burst.holdRepeat = setInterval(() => {
        if (theme !== 'burst' || burst.exhausted) {
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
    if (els.burstHold) els.burstHold.classList.remove('is-holding');
  }

  /* --- 选择器：动作行 + 人物卡行 --- */

  function buildBurstControls() {
    if (els.burstActions) {
      const actions = BURST_ACTION_ORDER.filter((a) => burstSetsForAction(a).length);
      els.burstActions.innerHTML = '';
      for (const action of actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'burst-mode';
        btn.dataset.action = action;
        btn.textContent = BURST_ACTION_LABELS[action] || action;
        els.burstActions.appendChild(btn);
      }
    }
    buildBurstCards();
    syncBurstControls();
  }

  function buildBurstCards() {
    if (!els.burstCards) return;
    els.burstCards.innerHTML = '';
    if (!BURST_CARDS.length) {
      els.burstCards.hidden = true;
      return;
    }
    els.burstCards.hidden = false;
    for (const card of BURST_CARDS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'burst-mode is-card';
      btn.dataset.card = card.id;
      btn.textContent = card.label;
      els.burstCards.appendChild(btn);
    }
  }

  // 同步高亮：动作行按 action，人物卡行按 cardId
  function syncBurstControls() {
    const action = currentBurstAction();
    if (els.burstActions) {
      els.burstActions.querySelectorAll('[data-action]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.action === action);
      });
    }
    if (els.burstCards) {
      els.burstCards.querySelectorAll('[data-card]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.card === burst.cardId);
      });
    }
  }

  // 选中某一组：重置帧号并立刻给一帧，避免停在 baseline 上看不出差别
  function selectBurstSet(set) {
    if (!set) return;
    stopBurstHold();
    burst.setId = set.id;
    burst.exhausted = false;
    burst.exhaustPlaying = false;
    clearTimeout(burst.autoTimer);
    burst.autoTimer = null;
    burst.count = 1;
    syncBurstControls();
    paintBurstFrame();
    setBurstReadout(1, burstTier(1), false);
  }

  function setBurstAction(action) {
    selectBurstSet(preferredBurstSet(action));
  }

  // 换人物卡：换掉「撞墙」姿态帧的底图，并自动切到撞墙动作
  function setBurstCard(cardId) {
    const card = BURST_CARDS.find((c) => c.id === cardId) || BURST_CARDS[0];
    if (!card) return;
    burst.cardId = card.id;
    if (els.cardFigure && els.cardFigure.getAttribute('src') !== card.sheet) {
      els.cardFigure.src = card.sheet;
    }
    setBurstAction('impact');
  }

  // 离开主题三或重置：清掉连击、帧态与残留类
  function resetBurst() {
    stopBurstHold();
    clearTimeout(burst.autoTimer);
    clearTimeout(burst.btnTimer);
    burst.autoTimer = null;
    burst.btnTimer = null;
    burst.count = 0;
    burst.exhausted = false;
    burst.exhaustPlaying = false;

    const home = burstSetById('impact-pose');
    burst.setId = home ? home.id : 'impact-pose';

    els.frameStack.classList.remove('is-action');
    els.frameStack.classList.remove('is-burst-pose');
    els.frameStack.classList.remove('is-punch');
    els.display.classList.remove('is-hit');
    els.impactFlash.classList.remove('is-on');
    els.impactCracks.classList.remove('is-on');
    if (els.cardFigure) {
      for (const p of ['--f-scale', '--f-sy', '--f-rot', '--f-x', '--f-y']) {
        els.cardFigure.style.removeProperty(p);
      }
    }
    syncBurstControls();
    if (els.burstTapSub) {
      els.burstTapSub.textContent = '砰';
      els.burstTapSub.classList.remove('is-pop');
    }
    if (els.burstTap) els.burstTap.classList.remove('is-break');
    setBurstButton(false);
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

    // 主题三：单击按钮、长按按钮或直接点立绘都能推进一帧
    els.burstTap.addEventListener('click', () => {
      sound.ensure();
      hitBurst();
    });
    els.burstHold.addEventListener('pointerdown', startBurstHold);
    els.burstHold.addEventListener('pointerup', stopBurstHold);
    els.burstHold.addEventListener('pointercancel', stopBurstHold);
    els.burstHold.addEventListener('lostpointercapture', stopBurstHold);
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

    // 主题三：动作 / 人物卡切换（事件委托，改数据不用再绑事件）
    els.burstModes.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        sound.ensure();
        setBurstAction(actionBtn.dataset.action);
        return;
      }
      const cardBtn = e.target.closest('[data-card]');
      if (!cardBtn) return;
      sound.ensure();
      setBurstCard(cardBtn.dataset.card);
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
