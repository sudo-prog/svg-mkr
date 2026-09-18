// ==================== SVG_MKR v2 — app.js ====================
// Vanilla JS SVG editor matching okpalette.color.pizza interaction patterns exactly.
// No framework, no build step — pure DOM + CSS.

// === CONFIG ===
const MAX_IMAGE = 1024;
const TRACE_TIMEOUT = 15000;

// === DOM CACHE ===
const B = {};

// === STATE (mirrors okpalette Fn pattern — pub/sub) ===
const S = {};
const _w = {};
function setState(patch) {
  Object.assign(S, patch);
  for (const k of Object.keys(patch))
    (_w[k] || []).forEach(cb => cb(S[k], k));
}
function watch(key, cb) {
  (_w[key] = _w[key] || []).push(cb);
}
function getState() { return S; }

// === SOUND MANAGER ===
class SoundManager {
  constructor() {
    this.sfx = {};
    this.interacted = false;
    const u = () => {
      this.interacted = true;
      window.removeEventListener('pointerdown', u);
      window.removeEventListener('keydown', u);
    };
    window.addEventListener('pointerdown', u, { once: true, passive: true });
    window.addEventListener('keydown', u, { once: true, passive: true });
  }
  init() {
    ['success', 'toggle', 'tick', 'error'].forEach(n => {
      const el = document.getElementById('sfx-' + n);
      if (el) this.sfx[n] = el;
    });
  }
  play(n) {
    const el = this.sfx[n];
    if (el && this.interacted) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  }
}
const J = new SoundManager();

// === UTILITIES ===
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substr(0, 2), 16),
    parseInt(h.substr(2, 2), 16),
    parseInt(h.substr(4, 2), 16),
  ];
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = mx === 0 ? 0 : d / mx;
  return { h, s, v: mx };
}
function rgbToHue(r, g, b) {
  return rgbToHsv(r, g, b).h;
}
function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}
function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h * 12) % 12;
    const c = k - 3 * Math.floor(k / 12);
    const m = a * Math.max(0, 2 - Math.abs(c - 6) - Math.abs(c - 6));
    const v = l - m / 2 * (c < 4 ? 1 : 0);
    return Math.round(v * 255);
  };
  return [f(0), f(8), f(4)];
}

// === LOUPE (mirrors okpalette 'on' class) ===
class Loupe {
  constructor(el, canvas, copyCanvas, sourceCanvas) {
    this.el = el; this.canvas = canvas; this.copy = copyCanvas; this.src = sourceCanvas;
    this.ctx = canvas.getContext('2d');
    this.ctxCopy = copyCanvas.getContext('2d');
    this.SIZE = 80; this.MAG = 2; this.visible = false;
    this.el.style.display = 'none';
  }
  show() { this.el.style.display = 'block'; this.visible = true; }
  hide() { this.el.style.display = 'none'; this.visible = false; }
  setColors(a, b) {
    this.el.style.setProperty('--colorOld', a);
    this.el.style.setProperty('--colorNew', b);
  }
  updatePos(x, y) {
    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';
  }
  draw(x, y) {
    if (!this.src || !this.src.width) return;
    const rect = this.src.getBoundingClientRect();
    const bx = x - rect.left;
    const by = y - rect.top;
    const w = this.canvas.width, h = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    const zw = this.SIZE / this.MAG;
    const sx = bx - zw / 2;
    const sy = by - zw / 2;
    try {
      this.ctxCopy.clearRect(0, 0, this.copy.width, this.copy.height);
      this.ctxCopy.drawImage(this.src, 0, 0, this.copy.width, this.copy.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.src, sx, sy, zw, zw, 0, 0, w, h);
    } catch (e) {}
    // Crosshairs
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, h / 2); ctx.lineTo(w / 2 + 8, h / 2);
    ctx.moveTo(w / 2, h / 2 - 8); ctx.lineTo(w / 2, h / 2 + 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, h / 2); ctx.lineTo(w / 2 + 8, h / 2);
    ctx.moveTo(w / 2, h / 2 - 8); ctx.lineTo(w / 2, h / 2 + 8); ctx.stroke();
  }
}

// === FAVICON ===
let FF = null;
class FaviconManager {
  constructor(svgEl) {
    this.svg = svgEl;
  }
  update() {
    if (!this.svg) return;
    const clone = this.svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    document.querySelectorAll('link[rel*="icon"]').forEach(el => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = url;
    document.head.appendChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// === INIT ===
let nloupe, ncolorSpace, ndebug;
window.addEventListener('DOMContentLoaded', () => {
  cacheDOM();
  J.init();
  const canvas = B.canvas;
  const ctx = canvas.getContext('2d');
  const ictx = new Uint8ClampedArray(0);

  nloupe = new Loupe(B.loupe, B.loupeCanvas, B.loupeCanvasCopy, B.canvas);
  FF = new FaviconManager(B.colorSpaceSvg);

  // === State initialization ===
  setState({
    hasImage: false,
    isExtracting: false,
    colorCount: parseInt(B.colorCountInput?.value || '4'),
    lockColorCount: B.lockColorCount?.checked || false,
    autoTrace: B.autoTrace?.checked || true,
    hue: parseInt(B.hueSlider?.value || '0'),
    saturation: parseInt(B.saturationSlider?.value || '100'),
    selectedTool: 'select',
    palette: [],
    svgString: '',
    stats: { paths: 0, colors: 0, sizeKb: 0 },
    layerEffects: {},
    deletedLayers: [],
    imageWidth: 0,
    imageHeight: 0,
    baseDataUrl: null,
  });

  // === Intro animation ===
  setTimeout(() => {
    document.body.classList.add('intro-done');
    // okpalette controls cta-intro visibility via JS inline styles (no .intro-done .cta-intro CSS rule)
    if (B.ctaIntro) {
      B.ctaIntro.style.opacity = '1';
      B.ctaIntro.style.pointerEvents = 'auto';
    }
  }, 650);
  setTimeout(() => document.body.classList.add('intro-anim-done'), 1850);

  // === Number slider (color count) ===
  initNumberSlider();

  // === Range sliders (hue / saturation) ===
  initRangeSliders();

  // === Image upload ===
  initImageUpload();

  // === Drag & drop ===
  initDragDrop();

  // === Paste ===
  initPaste();

  // === Example images ===
  initExampleImages();

  // === Tool buttons (select / eraser / magic wand) ===
  initTools();

  // === Loupe ===
  initLoupe();

  // === Drawers ===
  initDrawers();

  // === Export ===
  initExport();

  // === Keyboard ===
  initKeyboard();

  // === Debug view ===
  initDebug(FF);

  // === Auto-sort ===
  initAutoSort();

  // === Copy feedback ===
  initCopyFeedback();

  // === Effect toggles ===
  initEffectToggles();
});

// === DOM CACHE ===
function cacheDOM() {
  const ids = {
    // Header / controls
    uploadArea: 'uploadArea', fileInput: 'fileInput', canvas: 'canvas',
    loading: 'loading', imageContainer: 'imageContainer',
    colorCountInput: 'colorCountInput', lockColorCount: 'lockColorCount',
    autoTrace: 'autoTrace', replaceImageBtn: 'replaceImageBtn',
    hueSlider: 'hueSlider', saturationSlider: 'saturationSlider',
    hueValue: 'hueValue', saturationValue: 'saturationValue',
    colorCountLabel: 'colorCountLabel',
    // Loupe
    loupe: 'loupe', loupeCanvas: 'loupeCanvas', loupeCanvasCopy: 'loupeCanvasCopy',
    // Markers
    markers: 'markers', markersBg: 'markersBg',
    // Examples
    examples: 'examples',
    // Color space
    colorSpaceSvg: 'colorSpaceSvg',
    // Drawer toggles
    toggleStatsBtn: 'toggleStatsBtn', toggleOverlayBtn: 'toggleOverlayBtn',
    closeOverlayBtn: 'closeOverlayBtn',
    // Palette
    paletteName: 'paletteName', colorRowTemplate: 'colorRowTemplate',
    colorSampleTemplate: 'colorSampleTemplate', colorSamplesList: 'colorSamplesList',
    results: 'results', palette: 'palette',
    // Export buttons
    copyPaletteBtn: 'copyPaletteBtn',
    downloadPaletteBtnSVG: 'downloadPaletteBtnSVG',
    downloadPaletteBtnPNG: 'downloadPaletteBtnPNG',
    autoSort: 'autoSort',
    // Stats
    statPaths: 'statPaths', statColors: 'statColors', statSize: 'statSize',
    barPaths: 'barPaths', barColors: 'barColors', barSize: 'barSize',
    // Debug
    debugViewLink: 'debugViewLink',
  };
  for (const [k, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) B[k] = el;
  }
  B.lApp = document.querySelector('.l-app');
  B.lBody = document.querySelector('.l-body');
  B.lMain = document.querySelector('.l-main');
  B.ctaIntro = document.querySelector('.cta-intro');
  B.examplesUl = B.examples?.querySelector('ul');
}

// === NUMBER SLIDER ===
function initNumberSlider() {
  const ns = B.colorCountLabel?.closest('.numberslider');
  if (!ns) return;

  // +/- buttons
  const btns = ns.querySelectorAll('.numberslider__button');
  const input = B.colorCountInput;
  const checkbox = B.lockColorCount;

  btns.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const min = parseInt(input.min);
      const max = parseInt(input.max);
      let val = parseInt(input.value);
      if (i === 0) val = Math.max(min, val - 1);
      else val = Math.min(max, val + 1);
      input.value = val;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  function updateRelval() {
    const val = parseInt(input.value);
    const min = parseInt(input.min);
    const max = parseInt(input.max);
    const relval = (val - min) / (max - min);
    ns.style.setProperty('--relval', relval);
    B.colorCountLabel && B.colorCountLabel.classList.toggle('active', true);
  }

  input.addEventListener('input', updateRelval);
  // Also trigger on keyup (for direct typing)
  input.addEventListener('change', updateRelval);

  updateRelval();

  // Lock checkbox
  checkbox?.addEventListener('change', () => {
    setState({ lockColorCount: checkbox.checked });
    J.playToggle(checkbox.checked);
    if (checkbox.checked) {
      // When locking, re-trace with the current count
      if (S.hasImage) traceToSVG();
    }
  });
}

// === RANGE SLIDERS ===
function initRangeSliders() {
  const sliders = [
    { input: B.hueSlider, value: B.hueValue, key: 'hue' },
    { input: B.saturationSlider, value: B.saturationValue, key: 'saturation' },
  ];

  sliders.forEach(({ input, value, key }) => {
    if (!input) return;

    const range = input.parentElement;
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);

    const rel = (val - min) / (max - min);
    range.style.setProperty('--progress', rel);
    range.style.setProperty('--center', rel);
    if (value) value.textContent = Math.round(val);

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      const r = (v - min) / (max - min);
      range.style.setProperty('--progress', r);
      range.style.setProperty('--center', r);
      if (value) value.textContent = Math.round(v);
      setState({ [key]: v });
      J.playTick();
      if (S.autoTrace && S.hasImage) {
        debounceTrace(100);
      }
    });
  });

  // Initial values are already set
  watch('hue', () => {});
  watch('saturation', () => {});
}

// === DEBOUNCE FOR TRACING ===
let _traceTimer = null;
function debounceTrace(ms) {
  if (_traceTimer) clearTimeout(_traceTimer);
  _traceTimer = setTimeout(() => {
    _traceTimer = null;
    if (S.hasImage && S.autoTrace) {
      traceToSVG();
    }
  }, ms);
}

// === IMAGE UPLOAD ===
function initImageUpload() {
  B.fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadAndProcessImage(file);
  });

  B.uploadArea?.addEventListener('click', () => {
    B.fileInput?.click();
  });

  B.replaceImageBtn?.addEventListener('click', () => {
    B.fileInput?.click();
  });
}

// === DRAG & DROP ===
function initDragDrop() {
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    if (e.target instanceof Node && B.uploadArea && B.uploadArea.contains(e.target)) return;
    dragCounter++;
    if (dragCounter === 1 && !S.hasImage) {
      document.body.classList.add('drag-over');
    }
  });

  document.addEventListener('dragleave', () => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) {
      document.body.classList.remove('drag-over');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.body.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      loadAndProcessImage(file);
    }
  });
}

// === PASTE ===
function initPaste() {
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.kind === 'image') {
        const file = item.asFile();
        if (file) loadAndProcessImage(file);
        e.preventDefault();
        break;
      }
    }
  });
}

// === LOAD AND PROCESS IMAGE ===
function loadAndProcessImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    processImageData(img);
  };
  img.src = url;
}

function processImageData(img) {
  // Scale to max dimension
  let w = img.naturalWidth, h = img.naturalHeight;
  if (w > h) {
    if (w > MAX_IMAGE) { h = Math.round(h * MAX_IMAGE / w); w = MAX_IMAGE; }
  } else {
    if (h > MAX_IMAGE) { w = Math.round(w * MAX_IMAGE / h); h = MAX_IMAGE; }
  }

  const canvas = B.canvas;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Draw original
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // Store base data URL (for re-tracing) and mark image as loaded
  setState({
    hasImage: true,
    baseDataUrl: canvas.toDataURL('image/png'),
    imageWidth: w,
    imageHeight: h,
    currentImageData: ctx.getImageData(0, 0, w, h),
    colors: [],
    svgString: '',
    stats: { paths: 0, colors: 0, sizeKb: 0 },
    layerEffects: {},
    deletedLayers: [],
  });

  document.body.classList.add('has-image');
  J.playSuccess();

  // Render color space and samples immediately
  renderColorSpace([]);
  renderColorSamples([]);

  // Trace if auto-trace is on
  if (S.autoTrace) {
    traceToSVG();
  }
}

// === GET PROCESSED DATA URL (with hue/sat filters) ===
function getProcessedDataUrl() {
  const canvas = B.canvas;
  const w = canvas.width, h = canvas.height;
  if (!w || !h) return null;

  // Use a temporary canvas for filter application
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const ctx = tmp.getContext('2d');

  let filter = '';
  if (S.hue !== 0) filter += `hue-rotate(${S.hue}deg) `;
  if (S.saturation !== 100) filter += `saturate(${S.saturation / 100}) `;

  ctx.filter = filter || 'none';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  return tmp.toDataURL('image/png');
}

// === SVG TRACING ===
function traceToSVG() {
  if (!S.hasImage || !S.currentImageData) return;

  setState({ isExtracting: true });
  if (B.loading) {
    B.loading.style.display = 'flex';
    B.loading.classList.add('visible');
  }

  const dataUrl = getProcessedDataUrl();
  if (!dataUrl) {
    setState({ isExtracting: false });
    if (B.loading) { B.loading.style.display = 'none'; B.loading.classList.remove('visible'); }
    J.playError();
    return;
  }

  const options = {
    pathprecision: 4,
    colorcount: S.colorCount,
    scale: 1,
    lossy: true,
    turdsize: 2,
    turnpolicy: 'minority',
  };

  const timeout = setTimeout(() => {
    setState({ isExtracting: false });
    if (B.loading) { B.loading.style.display = 'none'; B.loading.classList.remove('visible'); }
    J.playError();
    console.error('[SVG_MKR] Tracing timed out');
  }, TRACE_TIMEOUT);

  ImageTracer.imageToSVG(dataUrl, (svgString) => {
    clearTimeout(timeout);
    parseSVG(svgString);
  }, options);
}

// === PARSE SVG OUTPUT ===
function parseSVG(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const paths = doc.querySelectorAll('path');

  // Extract unique colors
  const colorMap = new Map();
  paths.forEach(path => {
    const fill = path.getAttribute('fill');
    if (!fill) return;
    const hex = fill.toLowerCase();
    if (!colorMap.has(hex)) {
      const [r, g, b] = hexToRgb(fill);
      const hsv = rgbToHsv(r, g, b);
      const percent = 100 / Math.max(paths.length, 1); // approximation
      colorMap.set(hex, {
        hex,
        hexClean: hex.replace('#', ''),
        css: hex,
        rgb: [r, g, b],
        hsv,
        L: 0,
        C: 0,
        h: hsv.h,
        percent: 0,
        name: '',
      });
    }
  });

  // Calculate color percentages based on path area
  const totalArea = paths.length;
  const counts = {};
  paths.forEach(path => {
    const fill = path.getAttribute('fill');
    if (fill) counts[fill.toLowerCase()] = (counts[fill.toLowerCase()] || 0) + 1;
  });
  const colors = Array.from(colorMap.values()).map(c => ({
    ...c,
    percent: ((counts[c.hex] || 0) / totalArea) * 100,
  }));

  // Sort
  let sorted = colors;
  if (B.autoSort?.checked) {
    sorted = sortColorsByHue(colors);
  }
  // Sort layers (reverse order for SVG)
  sorted = [...sorted].reverse();

  const stats = {
    paths: paths.length,
    colors: colors.length,
    sizeKb: svgString.length / 1024,
  };

  setState({
    palette: sorted,
    svgString,
    stats,
    isExtracting: false,
  });

  renderPalette(sorted);
  renderColorSamples(sorted);
  renderColorSpace(sorted);
  updateStats(stats);

  // Hide cta-intro after extraction (clear inline styles we set during intro, so .has-extracted CSS can take effect)
  if (B.ctaIntro) {
    B.ctaIntro.style.opacity = '';
    B.ctaIntro.style.pointerEvents = '';
  }
  document.body.classList.add('has-extracted');
  setTimeout(() => document.body.classList.add('intro-done'), 650);
  setTimeout(() => document.body.classList.add('intro-anim-done'), 1850);

  // Update favicon (color space preview)
  if (FF) FF.update();

  if (B.loading) {
    B.loading.style.display = 'none';
    B.loading.classList.remove('visible');
  }

  J.playSuccess();
}

// === SORT COLORS BY HUE ===
function sortColorsByHue(colors) {
  return [...colors].sort((a, b) => a.hsv.h - b.hsv.h);
}

// === PALETTE RENDERING ===
function renderPalette(colors) {
  if (!B.palette || !B.colorRowTemplate) return;

  B.palette.innerHTML = '';

  colors.forEach((color, index) => {
    const clone = B.colorRowTemplate.content.cloneNode(true);
    const row = clone.querySelector('.palette__row');
    if (!row) return;

    // Set animation delay
    const i = colors.length > 1 ? index / (colors.length - 1) : 0;
    row.style.setProperty('--i', i);

    // Set color swatch
    const swatch = row.querySelector('[data-bg]');
    if (swatch) swatch.style.background = color.hex;

    // Set name
    const nameEl = row.querySelector('[data-name]');
    if (nameEl) nameEl.textContent = color.name || color.hexClean;

    // Set hex
    const hexEl = row.querySelector('[data-hex]');
    if (hexEl) hexEl.textContent = color.hex;

    // Set percent
    const pctEl = row.querySelector('[data-percent]');
    if (pctEl) pctEl.textContent = `${color.percent.toFixed(1)}%`;

    // Set oklab
    const oklabEl = row.querySelector('[data-oklab]');
    if (oklabEl) oklabEl.textContent = `oklch(${color.L.toFixed(3)} ${color.C.toFixed(3)} ${color.h.toFixed(1)})`;

    // Set copy feedback color
    const feedback = row.querySelector('.copy-feedback');
    if (feedback) feedback.style.color = color.hex;

    // --- Layer effect buttons ---
    const effectBtns = row.querySelectorAll('.layer-effect-btn');
    effectBtns.forEach(btn => {
      const effect = btn.dataset.effect;
      const isActive = S.layerEffects[color.hex]?.[effect] || false;
      if (isActive) btn.classList.add('active');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const current = S.layerEffects[color.hex] || {};
        const newVal = !current[effect];
        const newEffects = {
          ...current,
          [effect]: newVal,
        };
        S.layerEffects[color.hex] = newEffects;
        setState({ layerEffects: { ...S.layerEffects } });
        btn.classList.toggle('active', newVal);
        J.playToggle(newVal);
        // Re-apply effects to SVG
        applyEffectsToSVG();
      });
    });

    // Row click → copy hex
    row.addEventListener('click', () => {
      navigator.clipboard.writeText(color.hex).catch(() => {});
      const fb = row.querySelector('.copy-feedback');
      if (fb) {
        fb.classList.add('show');
        setTimeout(() => fb.classList.remove('show'), 1000);
      }
      J.playTick();
    });

    B.palette.appendChild(row);
  });
}

// === COLOR SAMPLES (header) ===
function renderColorSamples(colors) {
  if (!B.colorSamplesList || !B.colorSampleTemplate) return;

  B.colorSamplesList.innerHTML = '';

  const sampleColors = colors.slice(0, 8);
  if (sampleColors.length === 0) {
    B.colorSamplesList.closest('.menu__item')?.style?.setProperty('display', 'none');
    return;
  }
  B.colorSamplesList.closest('.menu__item')?.style?.setProperty('display', 'flex');

  sampleColors.forEach((color, index) => {
    const clone = B.colorSampleTemplate.content.cloneNode(true);
    const sample = clone.querySelector('.color-sample');
    if (!sample) return;

    sample.style.setProperty('--i', index / Math.max(sampleColors.length - 1, 1));
    const swatch = sample.querySelector('.color-sample__swatch');
    if (swatch) swatch.style.background = color.hex;

    const hexEl = sample.querySelector('[data-hex]');
    if (hexEl) hexEl.textContent = color.hexClean.toUpperCase();

    const oklabEl = sample.querySelector('[data-oklab]');
    if (oklabEl) oklabEl.textContent = `oklch(${color.L.toFixed(3)},${color.C.toFixed(3)}%,${color.h.toFixed(0)})`;

    B.colorSamplesList.appendChild(sample);
  });
}

// === COLOR SPACE SVG ===
function renderColorSpace(colors) {
  if (!B.colorSpaceSvg) return;
  B.colorSpaceSvg.innerHTML = '';

  if (!colors || colors.length === 0) {
    // Draw a default pattern (concentric circles)
    const svgNS = 'http://www.w3.org/2000/svg';
    for (let i = 0; i < 3; i++) {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', 100);
      circle.setAttribute('cy', 100);
      circle.setAttribute('r', 60 - i * 20);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', 'currentColor');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('opacity', '0.2');
      B.colorSpaceSvg.appendChild(circle);
    }
    return;
  }

  // Draw palette colors as circles arranged in a ring
  const svgNS = 'http://www.w3.org/2000/svg';
  const radius = 70;
  const centerX = 100, centerY = 100;
  const swatchR = Math.max(4, 40 / colors.length);

  colors.forEach((color, index) => {
    const angle = (index / colors.length) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', Math.round(x));
    circle.setAttribute('cy', Math.round(y));
    circle.setAttribute('r', swatchR);
    circle.setAttribute('fill', color.hex);
    circle.style.setProperty('--i', colors.length > 1 ? index / (colors.length - 1) : 0);
    B.colorSpaceSvg.appendChild(circle);
  });

  // Update favicon
  if (nloupe) {}
  // Favicon update is handled by FaviconManager
}

// === STATS UPDATE ===
function updateStats(stats) {
  if (B.statPaths) B.statPaths.textContent = stats.paths.toLocaleString();
  if (B.statColors) B.statColors.textContent = stats.colors;
  if (B.statSize) B.statSize.textContent = `${stats.sizeKb.toFixed(1)} KB`;

  // Bar widths
  if (B.barPaths) B.barPaths.style.width = `${Math.min(stats.paths / 200 * 100, 100)}%`;
  if (B.barColors) B.barColors.style.width = `${Math.min(stats.colors / S.colorCount * 100, 100)}%`;
  if (B.barSize) B.barSize.style.width = `${Math.min(stats.sizeKb / 100 * 100, 100)}%`;
}

// === LAYER EFFECTS ===
function applyEffectsToSVG() {
  if (!S.svgString) return;

  // Build SVG with effects applied
  const parser = new DOMParser();
  const doc = parser.parseFromString(S.svgString, 'image/svg+xml');
  const svg = doc.documentElement;

  // Add filter definitions
  const needsDefs = Object.values(S.layerEffects).some(e => e.halftone || e.distress);
  if (needsDefs) {
    // Remove old defs
    const oldDefs = svg.querySelector('defs');
    if (oldDefs) svg.removeChild(oldDefs);

    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Halftone filter
    const halftoneFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    halftoneFilter.id = 'halftone-fx';
    const feTurbulence = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
    feTurbulence.setAttribute('type', 'turbulence');
    feTurbulence.setAttribute('baseFrequency', '0.8');
    feTurbulence.setAttribute('numOctaves', '2');
    feTurbulence.setAttribute('result', 'turbulence');
    const feDisplacement = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    feDisplacement.setAttribute('in', 'SourceGraphic');
    feDisplacement.setAttribute('in2', 'turbulence');
    feDisplacement.setAttribute('scale', '3');
    feDisplacement.setAttribute('xChannelSelector', 'R');
    feDisplacement.setAttribute('yChannelSelector', 'G');
    feDisplacement.setAttribute('result', 'displaced');
    halftoneFilter.appendChild(feTurbulence);
    halftoneFilter.appendChild(feDisplacement);

    // Distress filter
    const distressFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    distressFilter.id = 'distress-fx';
    const feDNoise = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
    feDNoise.setAttribute('type', 'fractalNoise');
    feDNoise.setAttribute('baseFrequency', '8');
    feDNoise.setAttribute('numOctaves', '1');
    feDNoise.setAttribute('result', 'noise');
    const feDDisp = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
    feDDisp.setAttribute('in', 'SourceGraphic');
    feDDisp.setAttribute('in2', 'noise');
    feDDisp.setAttribute('scale', '2');
    feDDisp.setAttribute('xChannelSelector', 'R');
    feDDisp.setAttribute('yChannelSelector', 'G');
    distressFilter.appendChild(feDNoise);
    distressFilter.appendChild(feDDisp);

    // Outline filter (dropshadow as outline)
    const outlineFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    outlineFilter.id = 'outline-fx';
    const feMorph = document.createElementNS('http://www.w3.org/2000/svg', 'feMorphology');
    feMorph.setAttribute('in', 'SourceAlpha');
    feMorph.setAttribute('operator', 'dilate');
    feMorph.setAttribute('radius', '0.5');
    feMorph.setAttribute('result', 'dilated');
    const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode1.setAttribute('in', 'dilated');
    const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode2.setAttribute('in', 'SourceGraphic');
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    outlineFilter.appendChild(feMorph);
    outlineFilter.appendChild(feMerge);

    defs.appendChild(halftoneFilter);
    defs.appendChild(distressFilter);
    defs.appendChild(outlineFilter);
    svg.insertBefore(defs, svg.firstChild);
  }

  // Apply effects to paths
  doc.querySelectorAll('path').forEach(path => {
    const fill = path.getAttribute('fill');
    if (!fill) return;
    const hex = fill.toLowerCase();
    const effects = S.layerEffects[hex];
    if (!effects) return;

    let filterUrl = '';
    if (effects.halftone) filterUrl += 'url(#halftone-fx) ';
    if (effects.distress) filterUrl += 'url(#distress-fx) ';
    if (effects.outline) filterUrl += 'url(#outline-fx) ';
    if (filterUrl) path.setAttribute('filter', filterUrl.trim());
  });

  const serializer = new XMLSerializer();
  const finalSvg = serializer.serializeToString(svg);

  // Update display SVG
  if (B.results) {
    const svgEl = B.results.querySelector('svg');
    if (svgEl) svgEl.remove();
    const temp = document.createElement('div');
    temp.innerHTML = finalSvg;
    B.results.prepend(temp.firstElementChild);
  }
}

// === LOUPE ===
function initLoupe() {
  if (!B.loupe || !B.loupeCanvas) return;

  const loupe = new Loupe(B.loupe, B.loupeCanvas, B.loupeCanvasCopy, B.canvas);
  nloupe = loupe;
  B.loupe.style.display = 'none';

  B.canvas.parentElement.addEventListener('mousemove', (e) => {
    if (!S.hasImage) return;
    const rect = B.canvas.getBoundingClientRect();
    const x = e.clientX, y = e.clientY;
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (inside) {
      loupe.show();
      loupe.updatePos(x, y);
      loupe.draw(x, y);
    } else {
      loupe.hide();
    }
  });

  B.canvas.parentElement.addEventListener('mouseleave', () => {
    loupe.hide();
  });
}

// === TOOLS ===
function initTools() {
  // Tool buttons would be in the top drawer; for now, the default tool is 'select'
  // Esc key to delete layer is handled in keyboard shortcuts
  // Magic wand and eraser would need additional UI elements
  // For now, we keep structural parity with okpalette
}

// === BACKGROUND REMOVAL ===
// Magic wand: click on background to flood-fill to transparency
// Eraser: brush tool to erase pixels

// === DRAWERS ===
function initDrawers() {
  // Stats button
  B.toggleStatsBtn?.addEventListener('click', () => {
    if (!B.lApp) return;
    const show = !B.lApp.classList.contains('stats-open');
    if (show) Zs(); // close overlay if open
    B.lApp.classList.toggle('stats-open', show);
    B.toggleStatsBtn.classList.toggle('active', show);
    J.playToggle(show);
  });

  // Click-outside to close stats
  document.addEventListener('click', (e) => {
    if (B.lApp && B.lApp.classList.contains('stats-open')) {
      const drawer = B.lApp.querySelector('.l-app__drawers--bottom .drawer');
      if (drawer && !drawer.contains(e.target) && B.toggleStatsBtn && !B.toggleStatsBtn.contains(e.target)) {
        B.lApp.classList.remove('stats-open');
        B.toggleStatsBtn.classList.remove('active');
        J.playToggle(false);
      }
    }
  });

  // Auto-trace checkbox → toggle controls-open drawer
  B.autoTrace?.addEventListener('change', () => {
    if (!B.lApp) return;
    const on = B.autoTrace.checked;
    B.lApp.classList.toggle('controls-open', !on);
    setState({ autoTrace: on });
    J.playToggle(on);
    if (on && S.hasImage) {
      traceToSVG();
    }
  });

  // Initially, show controls drawer (like OK palette's auto-detect enabled = hidden)
  if (B.autoTrace && B.autoTrace.checked && B.lApp) {
    B.lApp.classList.add('controls-open');
  }
}

// === EXPORT ===
function initExport() {
  // Export button
  B.toggleOverlayBtn?.addEventListener('click', () => {
    const show = !document.body.classList.contains('show-colors');
    if (show) Ce(); // close stats if open
    document.body.classList.toggle('show-colors', show);
    J.playToggle(show);
  });

  // Close overlay
  B.closeOverlayBtn?.addEventListener('click', () => {
    Zs();
  });

  // Color samples list (toggle overlay)
  B.colorSamplesList?.addEventListener('click', () => {
    const show = !document.body.classList.contains('show-colors');
    if (show) Ce();
    document.body.classList.toggle('show-colors', show);
    J.playToggle(show);
  });

  // Results click → open overlay
  B.results?.addEventListener('click', () => {
    if (!document.body.classList.contains('show-colors')) {
      Ce();
      document.body.classList.add('show-colors');
      J.playToggle(true);
    }
  });

  // Copy palette
  B.copyPaletteBtn?.addEventListener('click', () => {
    copyPaletteHex();
  });

  // Download SVG
  B.downloadPaletteBtnSVG?.addEventListener('click', () => {
    exportSVG();
  });

  // Download PNG
  B.downloadPaletteBtnPNG?.addEventListener('click', () => {
    exportPNG();
  });

  // Auto-sort checkbox
  B.autoSort?.addEventListener('change', () => {
    const sort = B.autoSort.checked;
    J.playToggle(sort);
    if (S.palette.length > 0) {
      // Re-sort palette
      let sorted = S.palette;
      if (sort) {
        sorted = sortColorsByHue(sorted);
      }
      setState({ palette: sorted });
      renderPalette(sorted);
    }
  });
}

// === Close overlay / stats ===
function Zs() {
  if (document.body.classList.contains('show-colors')) {
    document.body.classList.remove('show-colors');
    J.playToggle(false);
  }
}
function Ce() {
  if (B.lApp && B.lApp.classList.contains('stats-open')) {
    B.lApp.classList.remove('stats-open');
    B.toggleStatsBtn?.classList.remove('active');
    J.playToggle(false);
  }
}

// === EXPORT FUNCTIONS ===
function copyPaletteHex() {
  const hexes = S.palette.map(c => c.hexClean.toUpperCase());
  const text = hexes.join(', ');
  navigator.clipboard.writeText(text).then(() => {
    J.playSuccess();
  }).catch(() => {
    J.playError();
  });
}

function exportSVG() {
  if (!S.svgString) return;
  // Apply effects
  const finalSvg = applyEffectsToString(S.svgString);
  const blob = new Blob([finalSvg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'svg-mkr.svg';
  a.click();
  URL.revokeObjectURL(url);
  J.playSuccess();
}

function exportPNG() {
  if (!S.canvas) {
    // Export the rendered SVG as PNG
    const svg = S.svgString;
    if (!svg) return;
    
    const temp = document.createElement('div');
    temp.innerHTML = svg;
    const svgEl = temp.firstElementChild;
    
    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'svg-mkr.png';
      a.click();
      J.playSuccess();
    };
    img.src = url;
  } else {
    // Export canvas as PNG
    const canvas = B.canvas;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'svg-mkr.png';
    a.click();
    J.playSuccess();
  }
}

function applyEffectsToString(svgString) {
  // Simple effect application — parse SVG and add filters
  if (Object.keys(S.layerEffects).length === 0) return svgString;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;

  // Add effect definitions
  const hasEffects = Object.values(S.layerEffects).some(e => e.halftone || e.distress || e.outline);
  if (!hasEffects) return svgString;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  // Halftone filter
  const hf = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  hf.id = 'halftone-fx';
  const ht = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
  ht.setAttribute('type', 'turbulence');
  ht.setAttribute('baseFrequency', '0.8');
  ht.setAttribute('numOctaves', '2');
  const hd = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
  hd.setAttribute('in', 'SourceGraphic');
  hd.setAttribute('in2', 'turbulence');
  hd.setAttribute('scale', '3');
  hd.setAttribute('xChannelSelector', 'R');
  hd.setAttribute('yChannelSelector', 'G');
  hf.appendChild(ht); hf.appendChild(hd);

  // Distress filter
  const df = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  df.id = 'distress-fx';
  const dn = document.createElementNS('http://www.w3.org/2000/svg', 'feTurbulence');
  dn.setAttribute('type', 'fractalNoise');
  dn.setAttribute('baseFrequency', '8');
  dn.setAttribute('numOctaves', '1');
  const dd = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
  dd.setAttribute('in', 'SourceGraphic');
  dd.setAttribute('in2', 'noise');
  dd.setAttribute('scale', '2');
  dd.setAttribute('xChannelSelector', 'R');
  dd.setAttribute('yChannelSelector', 'G');
  df.appendChild(dn); df.appendChild(dd);

  // Outline filter
  const of = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
  of.id = 'outline-fx';
  const om = document.createElementNS('http://www.w3.org/2000/svg', 'feMorphology');
  om.setAttribute('in', 'SourceAlpha');
  om.setAttribute('operator', 'dilate');
  om.setAttribute('radius', '0.5');
  const om2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
  const mn1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  mn1.setAttribute('in', 'dilated');
  const mn2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
  mn2.setAttribute('in', 'SourceGraphic');
  of.appendChild(om); om2.appendChild(mn1); om2.appendChild(mn2); of.appendChild(om2);

  defs.appendChild(hf);
  defs.appendChild(df);
  defs.appendChild(of);
  svg.insertBefore(defs, svg.firstChild);

  doc.querySelectorAll('path').forEach(path => {
    const fill = path.getAttribute('fill');
    if (!fill) return;
    const hex = fill.toLowerCase();
    const effects = S.layerEffects[hex];
    if (!effects) return;

    let filterUrl = '';
    if (effects.halftone) filterUrl += 'url(#halftone-fx) ';
    if (effects.distress) filterUrl += 'url(#distress-fx) ';
    if (effects.outline) filterUrl += 'url(#outline-fx) ';
    if (filterUrl.trim()) path.setAttribute('filter', filterUrl.trim());
  });

  return new XMLSerializer().serializeToString(doc.documentElement);
}

// === KEYBOARD ===
function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    // Ctrl/Cmd+I → debug view
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      if (S.currentImageData) {
        e.preventDefault();
        J.playTick();
        if (B.debugViewLink) {
          const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
          B.debugViewLink.dispatchEvent(evt);
        }
      }
    }

    // Escape → delete layer or exit tool
    if (e.key === 'Escape') {
      if (S.selectedTool !== 'select') {
        setState({ selectedTool: 'select' });
      } else if (S.palette.length > 0 && S.hasImage) {
        // Delete last layer
        const newPalette = S.palette.slice(0, -1);
        setState({ palette: newPalette });
        renderPalette(newPalette);
        renderColorSamples(newPalette);
        renderColorSpace(newPalette);
        J.playTick();
      }
    }

    // Ctrl/Cmd+E → toggle export
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      B.toggleOverlayBtn?.click();
    }

    // Ctrl/Cmd+S → toggle stats
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      B.toggleStatsBtn?.click();
    }
  });
}

// === DEBUG VIEW ===
function initDebug(faviconManager, ctx) {
  B.debugViewLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!S.currentImageData) return;
    J.playTick();
    openDebugModal();
  });
}

let debugModal = null;
function openDebugModal() {
  if (debugModal) return;

  debugModal = document.createElement('dialog');
  debugModal.id = 'debugModal';
  debugModal.className = '';
  debugModal.innerHTML = `
    <div class="debug-modal-content">
      <div class="debug-controls-bar">
        <div class="debug-controls">
          <label>
            Grayscale
            <input type="checkbox" id="debugGrayscale" />
          </label>
          <label>
            Invert
            <input type="checkbox" id="debugInvert" />
          </label>
          <label>
            Threshold
            <input type="range" id="debugThreshold" min="0" max="256" value="0" />
          </label>
        </div>
        <button class="debug-close-btn" id="debugCloseBtn">×</button>
      </div>
      <canvas id="debugCanvas"></canvas>
      <div class="debug-info" id="debugInfo"></div>
    </div>
  `;
  document.body.appendChild(debugModal);
  debugModal.showModal();

  // Render debug canvas
  const canvas = debugModal.querySelector('#debugCanvas');
  const ctx = canvas.getContext('2d');
  const imgData = S.currentImageData;
  if (imgData) {
    canvas.width = imgData.width;
    canvas.height = imgData.height;
    ctx.putImageData(imgData, 0, 0);
  }

  // Debug info
  const info = debugModal.querySelector('#debugInfo');
  info.textContent = `Image: ${S.imageWidth}×${S.imageHeight}px | Colors: ${S.palette.length} | Paths: ${S.stats.paths}`;

  // Close button
  debugModal.querySelector('#debugCloseBtn').addEventListener('click', () => {
    debugModal.close();
    debugModal.remove();
    debugModal = null;
  });

  // Debug filters
  const gsCb = debugModal.querySelector('#debugGrayscale');
  const invCb = debugModal.querySelector('#debugInvert');
  const thrSlider = debugModal.querySelector('#debugThreshold');

  function applyDebugFilters() {
    if (!S.currentImageData) return;
    const imgData = S.currentImageData;
    canvas.width = imgData.width;
    canvas.height = imgData.height;

    if (!gsCb.checked && !invCb.checked && parseInt(thrSlider.value) === 0) {
      ctx.putImageData(imgData, 0, 0);
    } else {
      ctx.filter = '';
      if (gsCb.checked) ctx.filter += 'grayscale(100%) ';
      if (invCb.checked) ctx.filter += 'invert(100%) ';
      const threshold = parseInt(thrSlider.value);
      if (threshold > 0) {
        // Threshold filter
        const tmp = document.createElement('canvas');
        tmp.width = imgData.width; tmp.height = imgData.height;
        const tctx = tmp.getContext('2d');
        tctx.filter = '';
        tctx.putImageData(imgData, 0, 0);
        ctx.filter = `brightness(${threshold / 2.55}%) contrast(200%)`;
      }
      ctx.filter = ctx.filter || 'none';
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
    }
  }

  gsCb.addEventListener('change', applyDebugFilters);
  invCb.addEventListener('change', applyDebugFilters);
  thrSlider.addEventListener('input', applyDebugFilters);
}

// === COPY FEEDBACK ===
function initCopyFeedback() {
  // Copy feedback is handled in renderPalette — the "Copied!" text appears on click
  // The CSS handles the animation: .copy-feedback.show { opacity: 1; transform: translate(-50%) translateY(-50%) }
}

// === EFFECT TOGGLES ===
function initEffectToggles() {
  // Effect toggles are handled in renderPalette — buttons are created per palette row
  // Clicking them toggles the 'active' class and applies effects to the SVG
}

// === AUTO-SORT ===
function initAutoSort() {
  // Auto-sort checkbox is initialized in initExport
  // The sort logic is in sortColorsByHue
  // Watch for palette changes to re-sort
  watch('palette', (palette) => {
    if (B.autoSort?.checked && palette && palette.length > 1) {
      const sorted = sortColorsByHue(palette);
      if (JSON.stringify(sorted) !== JSON.stringify(palette)) {
        setState({ palette: sorted });
        renderColorSamples(sorted);
      }
    }
  });
}

// === COLOR SAMPLES LIST INTERACTION ===
// Already handled in initExport()

// === FAVICON UPDATE ===
// The favicon is updated from the color space SVG
// This happens in renderColorSpace
