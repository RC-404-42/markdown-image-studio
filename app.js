/* global markdownit, DOMPurify, hljs, html2canvas */

const SAMPLE_MARKDOWN = `# 把文字變成一張好看的圖

這是一個真正支援 **Markdown** 的離線文章圖片工具。你可以使用 *斜體*、~~刪除線~~、\`行內程式碼\`，也能微調字體、行距、字距與四邊留白。

## GitHub Flavored Markdown

- 支援巢狀項目清單
  - 第二層內容也會正確縮排
  - 長句會依照畫布寬度自然換行，不再被裁掉
- [x] 已完成的待辦事項
- [ ] 還沒完成的待辦事項

> 文章不是一堆被硬塞進 Canvas 的字；排版需要節奏、留白，以及讓眼睛喘氣的地方。

### 表格

| 功能 | 離線 | 可調整 |
| :--- | :---: | ---: |
| Markdown 渲染 | ✓ | 語法完整 |
| 圖片輸出 | ✓ | PNG / JPG / WebP |
| 長文分頁 | ✓ | 高度自訂 |

### 程式碼區塊

\`\`\`javascript
const article = render(markdown);
await exportAsImage(article, { scale: 2 });
\`\`\`

---

輸出時不會修改原稿，也不會把內容傳到任何伺服器。`;

const DEFAULT_SETTINGS = Object.freeze({
  fontFamily: '"Microsoft JhengHei", sans-serif',
  codeFont: '"Cascadia Code", "Microsoft JhengHei", monospace',
  fontSize: 20,
  lineHeight: 1.75,
  letterSpacing: 0,
  paragraphSpacing: 16,
  headingScale: 1,
  firstLineIndent: 0,
  textAlign: 'left',
  codeWrap: true,
  softBreaks: false,
  width: 900,
  radius: 20,
  paddingLinked: true,
  paddingTop: 72,
  paddingRight: 76,
  paddingBottom: 72,
  paddingLeft: 76,
  previewZoom: 70,
  backgroundColor: '#fffdf8',
  textColor: '#302d2a',
  accentColor: '#715ee0',
  mutedColor: '#6f6b68',
  borderColor: '#dfdcd5',
  quoteBackground: '#f5f1e9',
  codeBackground: '#171923',
  codeText: '#e8e8ef',
  fileName: 'markdown-article',
  exportMode: 'long',
  pageHeight: 1600,
  format: 'png',
  scale: 2,
  quality: 94,
});

const NUMERIC_SETTINGS = new Set([
  'fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'headingScale',
  'firstLineIndent', 'width', 'radius', 'paddingTop', 'paddingRight',
  'paddingBottom', 'paddingLeft', 'previewZoom', 'pageHeight', 'scale', 'quality',
]);

const COLOR_SETTINGS = new Set([
  'backgroundColor', 'textColor', 'accentColor', 'mutedColor', 'borderColor',
  'quoteBackground', 'codeBackground', 'codeText',
]);

const COLOR_PRESETS = {
  paper: {
    backgroundColor: '#fffdf8', textColor: '#302d2a', accentColor: '#715ee0',
    mutedColor: '#6f6b68', borderColor: '#dfdcd5', quoteBackground: '#f5f1e9',
    codeBackground: '#171923', codeText: '#e8e8ef',
  },
  midnight: {
    backgroundColor: '#12141d', textColor: '#ececf4', accentColor: '#a895ff',
    mutedColor: '#a4a8b6', borderColor: '#343846', quoteBackground: '#1b1e2a',
    codeBackground: '#090b11', codeText: '#edf0f5',
  },
  sepia: {
    backgroundColor: '#f1e5cf', textColor: '#49382a', accentColor: '#9b573e',
    mutedColor: '#796653', borderColor: '#cdbda4', quoteBackground: '#e8d8bd',
    codeBackground: '#392f2a', codeText: '#f4eadc',
  },
  ink: {
    backgroundColor: '#f4f6f8', textColor: '#15181d', accentColor: '#2764d8',
    mutedColor: '#626a76', borderColor: '#d4d9e0', quoteBackground: '#e9edf3',
    codeBackground: '#101722', codeText: '#e8edf5',
  },
  sakura: {
    backgroundColor: '#fff5f7', textColor: '#46363d', accentColor: '#c65f82',
    mutedColor: '#8a6f78', borderColor: '#ead6dd', quoteBackground: '#f8e7ed',
    codeBackground: '#31252b', codeText: '#f9edf1',
  },
  wisteria: {
    backgroundColor: '#17131f', textColor: '#f1eaf7', accentColor: '#c39bf2',
    mutedColor: '#aaa0b4', borderColor: '#3b3148', quoteBackground: '#221b2d',
    codeBackground: '#0d0a13', codeText: '#eee6f6',
  },
};

const elements = {
  markdownInput: document.querySelector('#markdownInput'),
  markdownPreview: document.querySelector('#markdownPreview'),
  exportCard: document.querySelector('#exportCard'),
  previewScaleBox: document.querySelector('#previewScaleBox'),
  renderInfo: document.querySelector('#renderInfo'),
  exportEstimate: document.querySelector('#exportEstimate'),
  documentStats: document.querySelector('#documentStats'),
  statusMessage: document.querySelector('#statusMessage'),
  exportButton: document.querySelector('#exportButton'),
  openOutputButton: document.querySelector('#openOutputButton'),
  exportMarkdownButton: document.querySelector('#exportMarkdownButton'),
  pageHeightControl: document.querySelector('#pageHeightControl'),
  qualityControl: document.querySelector('#qualityControl'),
  captureHost: document.querySelector('#captureHost'),
  markdownFileInput: document.querySelector('#markdownFileInput'),
  imageFileInput: document.querySelector('#imageFileInput'),
  fontFileInput: document.querySelector('#fontFileInput'),
  customFontLabel: document.querySelector('#customFontLabel'),
  toast: document.querySelector('#toast'),
  saveState: document.querySelector('#saveState'),
  offlineStatus: document.querySelector('#offlineStatus'),
  resultSheet: document.querySelector('#resultSheet'),
  resultGallery: document.querySelector('#resultGallery'),
  shareAllButton: document.querySelector('#shareAllButton'),
  undoButton: document.querySelector('#undoButton'),
  redoButton: document.querySelector('#redoButton'),
};

function normalizeStoredPalette(palette) {
  if (!palette || typeof palette !== 'object') return null;
  const normalized = {};
  for (const key of COLOR_SETTINGS) {
    if (!/^#[0-9a-f]{6}$/i.test(String(palette[key] || ''))) return null;
    normalized[key] = String(palette[key]).toLowerCase();
  }
  return normalized;
}

function loadCustomPalettes() {
  try {
    const stored = JSON.parse(localStorage.getItem('markdown-image-custom-palettes') || '[]');
    return [0, 1].map((index) => normalizeStoredPalette(stored[index]));
  } catch {
    return [null, null];
  }
}

function createDefaultSettings() {
  const settings = { ...DEFAULT_SETTINGS };
  if (window.matchMedia('(max-width: 900px)').matches) settings.previewZoom = 40;
  return settings;
}

function loadStoredState() {
  try {
    const storedValue = localStorage.getItem('markdown-image-settings');
    const storedSettings = JSON.parse(storedValue || '{}');
    const settings = { ...DEFAULT_SETTINGS, ...storedSettings };
    if (!storedValue && window.matchMedia('(max-width: 900px)').matches) settings.previewZoom = 40;
    if (String(settings.fontFamily).includes('LocalFont_')) settings.fontFamily = DEFAULT_SETTINGS.fontFamily;
    return {
      text: localStorage.getItem('markdown-image-draft') || SAMPLE_MARKDOWN,
      settings,
    };
  } catch {
    return { text: SAMPLE_MARKDOWN, settings: createDefaultSettings() };
  }
}

const storedState = loadStoredState();
const state = {
  text: storedState.text,
  settings: storedState.settings,
  generatedFiles: [],
  generatedPreviews: [],
  resultUrls: [],
  exporting: false,
  customFontDataUrl: null,
  customFontFamily: null,
  customPalettes: loadCustomPalettes(),
};

const md = markdownit({
  html: false,
  linkify: true,
  typographer: true,
  breaks: state.settings.softBreaks,
  highlight(code, language) {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return md.utils.escapeHtml(code);
    }
  },
});

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet('rel', 'noreferrer');
  return self.renderToken(tokens, index, options);
};

md.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const source = token.attrGet('src') || '';
  const alt = token.content || '圖片';
  const isEmbeddedImage = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);/i.test(source) || source.startsWith('blob:');
  const isRemoteImage = /^https:\/\//i.test(source);
  if (!isEmbeddedImage && !isRemoteImage) {
    return `<span class="image-placeholder remote-image-error">🖼 ${md.utils.escapeHtml(alt)}（只支援 HTTPS 網路圖片或本機內嵌圖片）</span>`;
  }
  if (isRemoteImage) {
    token.attrSet('crossorigin', 'anonymous');
    token.attrSet('referrerpolicy', 'no-referrer');
    token.attrSet('loading', 'eager');
    token.attrSet('data-remote-image', 'true');
  }
  return self.renderToken(tokens, index, options);
};

let renderTimer;
let persistTimer;
let toastTimer;
let captureStylesPromise;
let captureStyleRules;

const EDITOR_HISTORY_LIMIT = 180;
const editorHistory = {
  entries: [],
  index: -1,
  applying: false,
  lastInputGroup: '',
  lastInputAt: 0,
};

function currentEditorSnapshot() {
  return {
    value: elements.markdownInput.value,
    selectionStart: elements.markdownInput.selectionStart,
    selectionEnd: elements.markdownInput.selectionEnd,
  };
}

function updateHistoryButtons() {
  elements.undoButton.disabled = editorHistory.index <= 0;
  elements.redoButton.disabled = editorHistory.index >= editorHistory.entries.length - 1;
}

function resetEditorHistory() {
  editorHistory.entries = [currentEditorSnapshot()];
  editorHistory.index = 0;
  editorHistory.lastInputGroup = '';
  editorHistory.lastInputAt = 0;
  updateHistoryButtons();
}

function recordEditorHistory(inputType = '', forceNew = false) {
  if (editorHistory.applying) return;
  const snapshot = currentEditorSnapshot();
  const current = editorHistory.entries[editorHistory.index];
  if (current?.value === snapshot.value) {
    editorHistory.entries[editorHistory.index] = snapshot;
    updateHistoryButtons();
    return;
  }

  const now = Date.now();
  const group = ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(inputType)
    ? inputType
    : '';
  const canCoalesce = !forceNew
    && group
    && group === editorHistory.lastInputGroup
    && now - editorHistory.lastInputAt < 700
    && editorHistory.index === editorHistory.entries.length - 1;

  if (canCoalesce) {
    editorHistory.entries[editorHistory.index] = snapshot;
  } else {
    editorHistory.entries.splice(editorHistory.index + 1);
    editorHistory.entries.push(snapshot);
    if (editorHistory.entries.length > EDITOR_HISTORY_LIMIT) editorHistory.entries.shift();
    editorHistory.index = editorHistory.entries.length - 1;
  }
  editorHistory.lastInputGroup = group;
  editorHistory.lastInputAt = now;
  updateHistoryButtons();
}

function restoreEditorHistory(nextIndex) {
  const snapshot = editorHistory.entries[nextIndex];
  if (!snapshot) return;
  editorHistory.applying = true;
  editorHistory.index = nextIndex;
  elements.markdownInput.value = snapshot.value;
  elements.markdownInput.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  state.text = snapshot.value;
  editorHistory.applying = false;
  editorHistory.lastInputGroup = '';
  updateHistoryButtons();
  queueRender(true);
  elements.markdownInput.focus();
}

function undoEditor() {
  if (editorHistory.index > 0) restoreEditorHistory(editorHistory.index - 1);
}

function redoEditor() {
  if (editorHistory.index < editorHistory.entries.length - 1) restoreEditorHistory(editorHistory.index + 1);
}

function replaceEditorText(value) {
  elements.markdownInput.value = value;
  elements.markdownInput.setSelectionRange(value.length, value.length);
  state.text = value;
  recordEditorHistory('', true);
  queueRender(true);
}

function showToast(message, type = '') {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.className = `toast visible ${type}`.trim();
  toastTimer = setTimeout(() => { elements.toast.className = 'toast'; }, 3400);
}

function setStatus(message, type = '') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = type;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const value = String(hex).replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function mixColors(foreground, background, foregroundWeight) {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  const weight = clamp(foregroundWeight, 0, 1);
  const values = ['r', 'g', 'b'].map((key) => Math.round(fg[key] * weight + bg[key] * (1 - weight)));
  return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function formatOutput(setting, value) {
  const suffixes = {
    fontSize: ' px', letterSpacing: ' px', paragraphSpacing: ' px', width: ' px',
    radius: ' px', pageHeight: ' px', previewZoom: '%', quality: '%',
    lineHeight: '×', headingScale: '×', firstLineIndent: ' em', scale: '×',
  };
  return `${value}${suffixes[setting] || ''}`;
}

function syncControls() {
  document.querySelectorAll('[data-setting]').forEach((input) => {
    const setting = input.dataset.setting;
    const value = state.settings[setting];
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value;
  });

  document.querySelectorAll('[data-output]').forEach((output) => {
    const setting = output.dataset.output;
    output.textContent = formatOutput(setting, state.settings[setting]);
  });

  elements.pageHeightControl.hidden = state.settings.exportMode !== 'pages';
  elements.qualityControl.hidden = state.settings.format === 'png';
}

function currentColorPalette() {
  return Object.fromEntries(Array.from(COLOR_SETTINGS, (key) => [key, state.settings[key]]));
}

function renderCustomPalettes() {
  state.customPalettes.forEach((palette, index) => {
    const applyButton = document.querySelector(`[data-custom-palette-apply="${index}"]`);
    const status = document.querySelector(`[data-custom-palette-status="${index}"]`);
    const clearButton = document.querySelector(`[data-custom-palette-clear="${index}"]`);
    const swatch = applyButton.querySelector('i');
    applyButton.disabled = !palette;
    applyButton.classList.toggle('has-palette', Boolean(palette));
    swatch.style.setProperty('--a', palette?.backgroundColor || '#252936');
    swatch.style.setProperty('--b', palette?.accentColor || '#5d6372');
    status.textContent = palette ? '已儲存，可隨時覆寫' : '尚未儲存';
    clearButton.disabled = !palette;
  });
}

function saveCustomPalette(index) {
  state.customPalettes[index] = currentColorPalette();
  renderCustomPalettes();
  persistState();
  showToast(`目前配色已儲存到自訂 ${index + 1}。`);
}

function applyCustomPalette(index) {
  const palette = state.customPalettes[index];
  if (!palette) return;
  Object.assign(state.settings, palette);
  applySettings();
  persistState();
  showToast(`已套用自訂配色 ${index + 1}。`);
}

function clearCustomPalette(index) {
  state.customPalettes[index] = null;
  renderCustomPalettes();
  persistState();
  showToast(`已清除自訂配色 ${index + 1}。`);
}

function resetEverything() {
  state.settings = createDefaultSettings();
  state.customPalettes = [null, null];
  state.customFontDataUrl = null;
  state.customFontFamily = null;
  state.generatedFiles = [];
  state.generatedPreviews = [];
  clearResultUrls();
  closeResultSheet();
  elements.resultGallery.replaceChildren();
  elements.openOutputButton.hidden = true;
  document.querySelectorAll('#fontFamily option[data-custom-font]').forEach((option) => option.remove());
  elements.customFontLabel.textContent = 'TTF / OTF / WOFF';
  replaceEditorText(SAMPLE_MARKDOWN);
  applySettings();
  renderCustomPalettes();
  persistState();
  setStatus('準備好了。');
  showToast('範例草稿、配色、排版與輸出設定都已恢復預設。');
}

function applySettings() {
  const settings = state.settings;
  const card = elements.exportCard;
  card.style.width = `${settings.width}px`;
  card.style.padding = `${settings.paddingTop}px ${settings.paddingRight}px ${settings.paddingBottom}px ${settings.paddingLeft}px`;
  card.style.borderRadius = `${settings.radius}px`;
  card.style.backgroundColor = settings.backgroundColor;
  card.style.color = settings.textColor;
  card.style.setProperty('--article-bg', settings.backgroundColor);
  card.style.setProperty('--article-text', settings.textColor);
  card.style.setProperty('--article-accent', settings.accentColor);
  card.style.setProperty('--article-muted', settings.mutedColor);
  card.style.setProperty('--article-border', settings.borderColor);
  card.style.setProperty('--article-quote-bg', settings.quoteBackground);
  card.style.setProperty('--article-code-bg', settings.codeBackground);
  card.style.setProperty('--article-code-text', settings.codeText);
  card.style.setProperty('--article-code-border', mixColors(settings.codeText, settings.codeBackground, .12));
  card.style.setProperty('--article-inline-code-bg', mixColors(settings.accentColor, settings.backgroundColor, .10));
  card.style.setProperty('--article-table-head', mixColors(settings.accentColor, settings.backgroundColor, .08));
  card.style.setProperty('--article-row-alt', mixColors(settings.mutedColor, settings.backgroundColor, .04));
  card.style.setProperty('--article-muted-bg', mixColors(settings.mutedColor, settings.backgroundColor, .05));
  card.style.setProperty('--article-font', settings.fontFamily);
  card.style.setProperty('--article-code-font', settings.codeFont);
  card.style.setProperty('--article-size', `${settings.fontSize}px`);
  card.style.setProperty('--article-line-height', settings.lineHeight);
  card.style.setProperty('--article-letter-spacing', `${settings.letterSpacing}px`);
  card.style.setProperty('--article-paragraph-space', `${settings.paragraphSpacing}px`);
  card.style.setProperty('--article-indent', `${settings.firstLineIndent}em`);
  card.style.setProperty('--article-align', settings.textAlign);
  card.style.setProperty('--article-radius', `${settings.radius}px`);
  card.style.setProperty('--article-code-wrap', settings.codeWrap ? 'pre-wrap' : 'pre');
  card.style.setProperty('--article-code-overflow', settings.codeWrap ? 'anywhere' : 'normal');
  card.style.setProperty('--h1-size', `${settings.fontSize * 2.05 * settings.headingScale}px`);
  card.style.setProperty('--h2-size', `${settings.fontSize * 1.62 * settings.headingScale}px`);
  card.style.setProperty('--h3-size', `${settings.fontSize * 1.32 * settings.headingScale}px`);
  card.style.setProperty('--h4-size', `${settings.fontSize * 1.08 * settings.headingScale}px`);

  syncControls();
  requestAnimationFrame(updatePreviewGeometry);
}

function enhanceTaskLists(root) {
  root.querySelectorAll('li').forEach((item) => {
    const container = item.firstElementChild?.tagName === 'P' ? item.firstElementChild : item;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const firstText = walker.nextNode();
    if (!firstText) return;
    const match = firstText.nodeValue.match(/^\s*\[([ xX])\]\s+/);
    if (!match) return;
    firstText.nodeValue = firstText.nodeValue.slice(match[0].length);
    const checked = match[1].toLowerCase() === 'x';
    const checkbox = document.createElement('span');
    checkbox.className = `task-checkbox${checked ? ' is-checked' : ''}`;
    checkbox.setAttribute('role', 'checkbox');
    checkbox.setAttribute('aria-checked', String(checked));
    checkbox.setAttribute('aria-disabled', 'true');
    checkbox.textContent = checked ? '✓' : '';
    container.insertBefore(checkbox, container.firstChild);
    item.classList.add('task-list-item');
  });
}

function enhancePageBreaks(root) {
  root.querySelectorAll('p').forEach((paragraph) => {
    if (paragraph.textContent.trim() !== '[[分頁]]') return;
    const marker = document.createElement('div');
    marker.className = 'page-break-marker';
    paragraph.replaceWith(marker);
  });
}

function replaceRemoteImageWithError(image) {
  if (!image.isConnected) return;
  let sourceName = '這個來源';
  try { sourceName = new URL(image.currentSrc || image.src).hostname || sourceName; } catch { /* use generic source name */ }
  const alt = image.alt?.trim() || '網路圖片';
  const placeholder = document.createElement('span');
  placeholder.className = 'image-placeholder remote-image-error';
  placeholder.textContent = `🖼 ${alt}（${sourceName} 未允許跨網域讀取，或圖片網址無法使用；請改用允許 CORS 的 HTTPS 圖片或本機內嵌圖片）`;
  image.replaceWith(placeholder);
  requestAnimationFrame(updatePreviewGeometry);
}

function enhanceRemoteImages(root) {
  root.querySelectorAll('img[data-remote-image]').forEach((image) => {
    image.addEventListener('load', () => requestAnimationFrame(updatePreviewGeometry), { once: true });
    image.addEventListener('error', () => replaceRemoteImageWithError(image), { once: true });
    if (image.complete) {
      if (image.naturalWidth > 0) requestAnimationFrame(updatePreviewGeometry);
      else replaceRemoteImageWithError(image);
    }
  });
}

function renderMarkdown() {
  md.set({ breaks: state.settings.softBreaks });
  const rendered = md.render(state.text);
  elements.markdownPreview.innerHTML = DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['crossorigin', 'referrerpolicy', 'loading', 'data-remote-image'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style'],
  });
  enhanceTaskLists(elements.markdownPreview);
  enhancePageBreaks(elements.markdownPreview);
  enhanceRemoteImages(elements.markdownPreview);

  const characterCount = state.text.replace(/\s/g, '').length;
  const lineCount = state.text ? state.text.split('\n').length : 0;
  elements.documentStats.textContent = `${characterCount.toLocaleString()} 字 · ${lineCount.toLocaleString()} 行`;
  requestAnimationFrame(updatePreviewGeometry);
}

function updatePreviewGeometry() {
  const zoom = state.settings.previewZoom / 100;
  const width = state.settings.width;
  const height = Math.ceil(elements.exportCard.scrollHeight);
  elements.exportCard.style.transform = `scale(${zoom})`;
  elements.previewScaleBox.style.width = `${Math.ceil(width * zoom)}px`;
  elements.previewScaleBox.style.height = `${Math.ceil(height * zoom)}px`;

  const physicalWidth = Math.round(width * state.settings.scale);
  const physicalHeight = Math.round(height * state.settings.scale);
  const effectivePageHeight = Math.min(state.settings.pageHeight, getSafeCssHeight());
  const pageEstimate = state.settings.exportMode === 'pages'
    ? Math.max(1, Math.ceil(height / effectivePageHeight))
    : 1;
  elements.renderInfo.textContent = `${width} × ${height} px · 預覽 ${state.settings.previewZoom}%`;
  elements.exportEstimate.textContent = state.settings.exportMode === 'pages'
    ? `預估 ${pageEstimate} 張 · 每張最高 ${physicalWidth} × ${effectivePageHeight * state.settings.scale} px`
    : `輸出約 ${physicalWidth} × ${physicalHeight} px${height > getSafeCssHeight() ? ' · 過高時自動分張' : ''}`;
}

function persistState() {
  clearTimeout(persistTimer);
  elements.saveState.textContent = '正在儲存草稿…';
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem('markdown-image-settings', JSON.stringify(state.settings));
      localStorage.setItem('markdown-image-custom-palettes', JSON.stringify(state.customPalettes));
      if (state.text.length < 3_000_000) {
        localStorage.setItem('markdown-image-draft', state.text);
        elements.saveState.textContent = '草稿已儲存在本機';
      } else {
        elements.saveState.textContent = '草稿過大，僅儲存設定';
      }
    } catch {
      elements.saveState.textContent = '草稿太大，無法自動儲存';
    }
  }, 450);
}

function queueRender(reparse = true) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    if (reparse) renderMarkdown();
    else applySettings();
  }, 55);
  persistState();
}

function normalizeInputValue(input) {
  const setting = input.dataset.setting;
  if (input.type === 'checkbox') return input.checked;
  if (NUMERIC_SETTINGS.has(setting)) {
    let value = Number(input.value);
    if (!Number.isFinite(value)) value = DEFAULT_SETTINGS[setting];
    if (input.min !== '') value = Math.max(Number(input.min), value);
    if (input.max !== '') value = Math.min(Number(input.max), value);
    return value;
  }
  return input.value;
}

function handleSettingInput(event) {
  const input = event.target.closest('[data-setting]');
  if (!input) return;
  const setting = input.dataset.setting;
  const value = normalizeInputValue(input);

  if (COLOR_SETTINGS.has(setting) && !/^#[0-9a-f]{6}$/i.test(value)) return;
  state.settings[setting] = value;

  if (setting.startsWith('padding') && setting !== 'paddingLinked' && state.settings.paddingLinked) {
    ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'].forEach((key) => {
      state.settings[key] = value;
    });
  }

  syncControls();
  queueRender(setting === 'softBreaks');
}

function insertAround(prefix, suffix, placeholder) {
  const textarea = elements.markdownInput;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  textarea.setRangeText(`${prefix}${selected}${suffix}`, start, end, 'end');
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function prefixSelectedLines(prefix) {
  const textarea = elements.markdownInput;
  const start = textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
  const nextBreak = textarea.value.indexOf('\n', textarea.selectionEnd);
  const end = nextBreak === -1 ? textarea.value.length : nextBreak;
  const block = textarea.value.slice(start, end);
  const replaced = block.split('\n').map((line, index) => typeof prefix === 'function' ? prefix(line, index) : `${prefix}${line}`).join('\n');
  textarea.setRangeText(replaced, start, end, 'select');
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertBlock(content) {
  const textarea = elements.markdownInput;
  const start = textarea.selectionStart;
  const leading = start > 0 && !textarea.value.slice(0, start).endsWith('\n\n') ? '\n\n' : '';
  textarea.setRangeText(`${leading}${content}\n\n`, start, textarea.selectionEnd, 'end');
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function normalizeRemoteImageUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('圖片網址格式不正確。'); }
  if (url.protocol !== 'https:') throw new Error('網路圖片只支援 HTTPS 網址。');
  if (url.username || url.password) throw new Error('圖片網址不能包含帳號或密碼。');
  return url.href;
}

function escapeMarkdownAlt(value) {
  return String(value || '網路圖片')
    .replace(/\r?\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function insertRemoteImageFromPrompt() {
  const input = window.prompt('貼上 HTTPS 圖片網址：');
  if (input === null || !input.trim()) return;
  const url = normalizeRemoteImageUrl(input);
  const altInput = window.prompt('圖片說明（可留白）：', '網路圖片');
  if (altInput === null) return;
  insertBlock(`![${escapeMarkdownAlt(altInput)}](<${url}>)`);
  showToast('已插入網路圖片；來源需允許 CORS 才能預覽與輸出。');
}

function dispatchEditorInput(inputType, data = null) {
  try {
    elements.markdownInput.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType,
      data,
    }));
  } catch {
    elements.markdownInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

async function writeClipboardText(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the selection-based copy used by older Safari versions.
    }
  }

  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.left = '-9999px';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.select();
  const copied = typeof document.execCommand === 'function' && document.execCommand('copy');
  helper.remove();
  if (!copied) throw new Error('瀏覽器未允許存取剪貼簿，請使用 Ctrl/Cmd+C。');
}

async function readClipboardText() {
  if (window.isSecureContext && navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      throw new Error('瀏覽器未允許讀取剪貼簿，請使用系統貼上或 Ctrl/Cmd+V。');
    }
  }
  throw new Error('這個瀏覽器不支援按鈕貼上，請使用系統貼上或 Ctrl/Cmd+V。');
}

async function copyEditorSelection() {
  const textarea = elements.markdownInput;
  const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  if (!selected) {
    showToast('請先選取要複製的文字。');
    textarea.focus();
    return false;
  }
  await writeClipboardText(selected);
  showToast('已複製選取文字。');
  textarea.focus();
  return true;
}

async function cutEditorSelection() {
  const textarea = elements.markdownInput;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start === end) {
    showToast('請先選取要剪下的文字。');
    textarea.focus();
    return;
  }
  await writeClipboardText(textarea.value.slice(start, end));
  textarea.setRangeText('', start, end, 'start');
  textarea.focus();
  dispatchEditorInput('deleteByCut');
  showToast('已剪下選取文字。');
}

async function pasteIntoEditor() {
  const textarea = elements.markdownInput;
  const text = await readClipboardText();
  textarea.setRangeText(String(text || ''), textarea.selectionStart, textarea.selectionEnd, 'end');
  textarea.focus();
  dispatchEditorInput('insertFromPaste', String(text || ''));
  showToast('已貼上剪貼簿文字。');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('讀取檔案失敗'));
    reader.readAsDataURL(file);
  });
}

function sanitizeFileName(name) {
  return String(name || 'markdown-article')
    .replace(/\.(png|jpe?g|webp|md)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 120) || 'markdown-article';
}

function waitForImages(container) {
  return Promise.all(Array.from(container.querySelectorAll('img')).map(async (image) => {
    if (!image.complete) {
      try { await image.decode(); } catch { /* validate naturalWidth below */ }
    }
    if (image.naturalWidth > 0) return;
    if (image.dataset.remoteImage) {
      throw new Error('有網路圖片無法載入；請確認網址可直接開啟，而且圖片來源允許 CORS。');
    }
    throw new Error('有一張圖片無法載入，請重新選擇圖片後再試一次。');
  }));
}

function createEmptyPage(pageHeight) {
  const card = elements.exportCard.cloneNode(false);
  card.removeAttribute('id');
  card.classList.add('capture-page');
  card.style.transform = 'none';
  card.style.boxShadow = 'none';
  card.style.width = `${state.settings.width}px`;
  card.style.height = `${pageHeight}px`;
  card.style.minHeight = `${pageHeight}px`;
  card.style.maxHeight = `${pageHeight}px`;
  card.dataset.captureHeight = String(pageHeight);
  const body = document.createElement('div');
  body.className = 'markdown-body';
  card.appendChild(body);
  elements.captureHost.appendChild(card);
  return { card, body };
}

function cloneTextSlice(root, start, end) {
  let cursor = 0;

  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeStart = cursor;
      const nodeEnd = cursor + node.nodeValue.length;
      cursor = nodeEnd;
      const sliceStart = Math.max(start, nodeStart) - nodeStart;
      const sliceEnd = Math.min(end, nodeEnd) - nodeStart;
      return sliceEnd > sliceStart
        ? document.createTextNode(node.nodeValue.slice(sliceStart, sliceEnd))
        : null;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const clone = node.cloneNode(false);
    Array.from(node.childNodes).forEach((child) => {
      const childClone = visit(child);
      if (childClone) clone.appendChild(childClone);
    });
    return clone.childNodes.length > 0 ? clone : null;
  }

  return visit(root);
}

function splitOversizedTextNode(sourceNode, page, availableHeight) {
  const textLength = sourceNode.textContent.length;
  if (textLength < 2 || !['P', 'PRE', 'BLOCKQUOTE', 'UL', 'OL'].includes(sourceNode.tagName)) {
    return null;
  }

  let low = 1;
  let high = textLength - 1;
  let best = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = cloneTextSlice(sourceNode, 0, middle);
    page.body.replaceChildren(candidate);
    if (page.body.scrollHeight <= availableHeight) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (best === 0) {
    page.body.replaceChildren();
    return null;
  }

  const first = cloneTextSlice(sourceNode, 0, best);
  const remainder = cloneTextSlice(sourceNode, best, textLength);
  page.body.replaceChildren(first);
  return remainder;
}

function buildPaginatedCards(pageHeight, compactPages) {
  const availableHeight = pageHeight - state.settings.paddingTop - state.settings.paddingBottom;
  const sourceNodes = Array.from(elements.markdownPreview.children);
  const pages = [];
  let current = createEmptyPage(pageHeight);
  pages.push(current);

  const queue = [...sourceNodes];
  while (queue.length > 0) {
    const sourceNode = queue.shift();
    if (sourceNode.classList.contains('page-break-marker')) {
      if (current.body.children.length > 0) {
        current = createEmptyPage(pageHeight);
        pages.push(current);
      }
      continue;
    }

    const clone = sourceNode.cloneNode(true);
    current.body.appendChild(clone);

    if (current.body.scrollHeight > availableHeight && current.body.children.length > 1) {
      clone.remove();
      current = createEmptyPage(pageHeight);
      pages.push(current);
      current.body.appendChild(clone);
    }

    if (current.body.scrollHeight > availableHeight && current.body.children.length === 1) {
      const remainder = splitOversizedTextNode(sourceNode, current, availableHeight);
      if (remainder) {
        queue.unshift(remainder);
        current = createEmptyPage(pageHeight);
        pages.push(current);
      } else {
        const expandedHeight = Math.ceil(current.body.scrollHeight + state.settings.paddingTop + state.settings.paddingBottom);
        current.card.style.height = `${expandedHeight}px`;
        current.card.style.minHeight = `${expandedHeight}px`;
        current.card.style.maxHeight = `${expandedHeight}px`;
        current.card.dataset.captureHeight = String(expandedHeight);
        current = createEmptyPage(pageHeight);
        pages.push(current);
      }
    }
  }

  if (pages.length > 1 && pages.at(-1).body.children.length === 0) {
    pages.pop().card.remove();
  }

  if (compactPages) {
    pages.forEach(({ card, body }) => {
      const compactHeight = Math.ceil(body.scrollHeight + state.settings.paddingTop + state.settings.paddingBottom);
      card.style.height = `${compactHeight}px`;
      card.style.minHeight = `${compactHeight}px`;
      card.style.maxHeight = `${compactHeight}px`;
      card.dataset.captureHeight = String(compactHeight);
    });
  }

  return pages.map((page) => page.card);
}

function getSafeCssHeight() {
  const physicalWidth = state.settings.width * state.settings.scale;
  const safePhysicalHeight = Math.min(10000, Math.floor(16_000_000 / physicalWidth));
  return Math.max(600, Math.min(7000, Math.floor(safePhysicalHeight / state.settings.scale)));
}

function buildCaptureCards() {
  elements.captureHost.replaceChildren();
  const articleHeight = Math.ceil(elements.exportCard.scrollHeight);
  const safeCssHeight = getSafeCssHeight();

  if (state.settings.exportMode === 'long' && articleHeight <= safeCssHeight) {
    const card = elements.exportCard.cloneNode(true);
    card.removeAttribute('id');
    card.querySelector('[id="markdownPreview"]')?.removeAttribute('id');
    card.style.transform = 'none';
    card.style.boxShadow = 'none';
    card.style.minHeight = '0';
    elements.captureHost.appendChild(card);
    return [card];
  }

  if (state.settings.exportMode === 'pages') {
    return buildPaginatedCards(Math.min(state.settings.pageHeight, safeCssHeight), false);
  }

  return buildPaginatedCards(safeCssHeight, true);
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('瀏覽器無法建立圖片資料。'));
    }, mimeType, quality);
  });
}

function createThumbnail(canvas) {
  const maxWidth = 360;
  const ratio = Math.min(1, maxWidth / canvas.width);
  const thumbnail = document.createElement('canvas');
  thumbnail.width = Math.max(1, Math.round(canvas.width * ratio));
  thumbnail.height = Math.max(1, Math.round(canvas.height * ratio));
  thumbnail.getContext('2d').drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
  const dataUrl = thumbnail.toDataURL('image/jpeg', .76);
  thumbnail.width = 1;
  thumbnail.height = 1;
  return dataUrl;
}

function loadCaptureStyles() {
  if (!captureStylesPromise) {
    captureStylesPromise = fetch('./capture-styles.css?v=120')
      .then((response) => {
        if (!response.ok) throw new Error(`無法載入輸出排版（HTTP ${response.status}）。`);
        return response.text();
      })
      .then((cssText) => {
        if (/\b(?:color|lab|lch|oklab|oklch)\s*\(/i.test(cssText)) {
          throw new Error('輸出排版含有不相容的色彩函式。');
        }
        return cssText;
      })
      .catch((error) => {
        captureStylesPromise = null;
        throw error;
      });
  }
  return captureStylesPromise;
}

function waitForLayout(targetWindow = window) {
  return new Promise((resolve) => {
    targetWindow.requestAnimationFrame(() => targetWindow.requestAnimationFrame(resolve));
  });
}

function parseCaptureStyleRules(cssText) {
  const style = document.createElement('style');
  style.media = 'not all';
  style.textContent = cssText;
  document.head.appendChild(style);

  const rules = [...(style.sheet?.cssRules || [])]
    .filter((rule) => rule.type === 1)
    .map((rule) => ({
      selector: rule.selectorText,
      cssText: rule.style.cssText,
    }));
  style.remove();
  return rules;
}

function inlineCaptureStyles(root, cssText) {
  if (!captureStyleRules) captureStyleRules = parseCaptureStyleRules(cssText);
  const nodes = [root, ...root.querySelectorAll('*')];
  const originalInlineStyles = new WeakMap(
    nodes.map((node) => [node, node.style.cssText]),
  );

  captureStyleRules.forEach(({ selector, cssText: ruleCssText }) => {
    const targets = [];
    if (root.matches(selector)) targets.push(root);
    targets.push(...root.querySelectorAll(selector));

    targets.forEach((target) => {
      target.style.cssText += `;${ruleCssText}`;
    });
  });

  nodes.forEach((node) => {
    const originalStyle = originalInlineStyles.get(node);
    if (originalStyle) node.style.cssText += `;${originalStyle}`;
  });
}

function measureCaptureHeight(card) {
  const article = card.querySelector('.markdown-body');
  if (!article) return Math.max(1, Math.ceil(card.scrollHeight));

  const cardRect = card.getBoundingClientRect();
  const articleRect = article.getBoundingClientRect();
  const paddingBottom = Number.parseFloat(getComputedStyle(card).paddingBottom) || 0;
  return Math.max(1, Math.ceil(articleRect.bottom - cardRect.top + paddingBottom));
}

function traceRoundedRect(context, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(safeRadius, 0);
  context.lineTo(width - safeRadius, 0);
  context.quadraticCurveTo(width, 0, width, safeRadius);
  context.lineTo(width, height - safeRadius);
  context.quadraticCurveTo(width, height, width - safeRadius, height);
  context.lineTo(safeRadius, height);
  context.quadraticCurveTo(0, height, 0, height - safeRadius);
  context.lineTo(0, safeRadius);
  context.quadraticCurveTo(0, 0, safeRadius, 0);
  context.closePath();
}

function cropCanvasHeight(sourceCanvas, targetHeight) {
  const height = Math.max(1, Math.min(sourceCanvas.height, Math.round(targetHeight)));
  if (height >= sourceCanvas.height) return sourceCanvas;

  const width = sourceCanvas.width;
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = height;

  const context = croppedCanvas.getContext('2d');
  const radius = Math.min(
    state.settings.radius * state.settings.scale,
    width / 2,
    height / 2,
  );
  traceRoundedRect(context, width, height, radius);
  context.clip();
  context.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, width, height);

  sourceCanvas.width = 1;
  sourceCanvas.height = 1;
  return croppedCanvas;
}

async function captureCard(card) {
  const captureCss = await loadCaptureStyles();
  const width = state.settings.width;
  const fixedPageHeight = Number(card.dataset.captureHeight || 0);
  const captureToken = `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  card.dataset.captureToken = captureToken;
  card.style.boxSizing = 'border-box';
  card.style.width = `${width}px`;
  card.style.transform = 'none';
  card.style.boxShadow = 'none';
  card.style.margin = '0';
  if (!fixedPageHeight) {
    card.style.height = 'auto';
    card.style.minHeight = '0';
    card.style.maxHeight = 'none';
  }

  await waitForLayout();
  inlineCaptureStyles(card, captureCss);
  await waitForLayout();
  const height = Math.max(1, Math.ceil(fixedPageHeight || measureCaptureHeight(card)));
  card.style.height = `${height}px`;
  card.style.minHeight = `${height}px`;
  card.style.maxHeight = `${height}px`;
  card.style.overflow = 'hidden';
  await waitForLayout();

  let cloneMeasuredHeight = height;

  try {
    const canvas = await html2canvas(card, {
      scale: state.settings.scale,
      width,
      height,
      x: 0,
      y: 0,
      windowWidth: Math.max(1200, width),
      windowHeight: Math.max(800, height),
      backgroundColor: null,
      allowTaint: false,
      useCORS: true,
      logging: false,
      imageTimeout: 15000,
      scrollX: 0,
      scrollY: 0,
      onclone: async (clonedDocument) => {
        const style = clonedDocument.createElement('style');
        style.dataset.captureStyles = 'true';
        style.textContent = captureCss;
        clonedDocument.head.appendChild(style);

        const clonedCard = clonedDocument.querySelector(`[data-capture-token="${captureToken}"]`);
        if (!clonedCard) throw new Error('找不到輸出畫布，請重新整理後再試一次。');

        clonedDocument.documentElement.style.margin = '0';
        clonedDocument.documentElement.style.padding = '0';
        clonedDocument.documentElement.style.background = 'transparent';
        clonedDocument.body.style.cssText = `margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent;`;
        clonedDocument.body.replaceChildren(clonedCard);

        clonedCard.style.boxSizing = 'border-box';
        clonedCard.style.position = 'relative';
        clonedCard.style.inset = 'auto';
        clonedCard.style.margin = '0';
        clonedCard.style.width = `${width}px`;
        clonedCard.style.height = `${height}px`;
        clonedCard.style.minHeight = `${height}px`;
        clonedCard.style.maxHeight = `${height}px`;
        clonedCard.style.transform = 'none';
        clonedCard.style.boxShadow = 'none';
        clonedCard.style.overflow = 'hidden';

        if (state.customFontDataUrl && state.customFontFamily) {
          const ClonedFontFace = clonedDocument.defaultView.FontFace;
          const clonedFont = new ClonedFontFace(state.customFontFamily, `url(${state.customFontDataUrl})`);
          await clonedFont.load();
          clonedDocument.fonts.add(clonedFont);
        }
        await clonedDocument.fonts.ready;
        clonedCard.getBoundingClientRect();

        if (!fixedPageHeight) {
          const clonedArticle = clonedCard.querySelector('.markdown-body');
          if (clonedArticle) {
            const cardRect = clonedCard.getBoundingClientRect();
            const articleRect = clonedArticle.getBoundingClientRect();
            const clonedCardStyles = clonedDocument.defaultView.getComputedStyle(clonedCard);
            const paddingBottom = Number.parseFloat(clonedCardStyles.paddingBottom) || 0;
            cloneMeasuredHeight = Math.max(
              1,
              Math.ceil(articleRect.bottom - cardRect.top + paddingBottom),
            );
          }
        }
      },
    });

    if (!fixedPageHeight) {
      const targetHeight = Math.min(
        canvas.height,
        Math.max(1, Math.ceil(cloneMeasuredHeight * state.settings.scale)),
      );
      if (targetHeight < canvas.height - 1) return cropCanvasHeight(canvas, targetHeight);
    }
    return canvas;
  } finally {
    delete card.dataset.captureToken;
  }
}

async function exportImages() {
  if (state.exporting) return;

  state.exporting = true;
  state.generatedFiles = [];
  state.generatedPreviews = [];
  elements.exportButton.disabled = true;
  elements.exportButton.querySelector('.button-label').textContent = '準備輸出';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  elements.exportButton.prepend(spinner);
  setStatus('正在整理字體、圖片與分頁…');

  try {
    await document.fonts.ready;
    await waitForImages(elements.exportCard);
    const cards = buildCaptureCards();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(cards.map(waitForImages));

    const extension = state.settings.format;
    const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    const quality = state.settings.quality / 100;
    const baseName = sanitizeFileName(state.settings.fileName);

    for (let index = 0; index < cards.length; index += 1) {
      elements.exportButton.querySelector('.button-label').textContent = `輸出 ${index + 1}/${cards.length}`;
      setStatus(`正在繪製第 ${index + 1} / ${cards.length} 張圖片…`);
      const canvas = await captureCard(cards[index]);
      const blob = await canvasToBlob(canvas, mimeType, quality);
      const pageSuffix = cards.length > 1 ? `-${String(index + 1).padStart(2, '0')}` : '';
      state.generatedFiles.push(new File([blob], `${baseName}${pageSuffix}.${extension}`, { type: mimeType }));
      state.generatedPreviews.push(createThumbnail(canvas));
      canvas.width = 1;
      canvas.height = 1;
    }

    elements.openOutputButton.hidden = false;
    renderResultSheet();
    setStatus(`完成！已產生 ${state.generatedFiles.length} 張圖片。`, 'success');
    showToast(`圖片製作完成，共 ${state.generatedFiles.length} 張。`);
  } catch (error) {
    console.error('Export failed:', error);
    setStatus(`輸出失敗：${error?.message || '未知錯誤'}`, 'error');
    showToast(`輸出失敗：${error?.message || '未知錯誤'}`, 'error');
  } finally {
    elements.captureHost.replaceChildren();
    state.exporting = false;
    elements.exportButton.disabled = false;
    elements.exportButton.querySelector('.button-label').textContent = '輸出圖片';
    elements.exportButton.querySelector('.spinner')?.remove();
  }
}

function clearResultUrls() {
  state.resultUrls.forEach((url) => URL.revokeObjectURL(url));
  state.resultUrls = [];
}

function renderResultSheet() {
  clearResultUrls();
  elements.resultGallery.replaceChildren();

  state.generatedFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    state.resultUrls.push(url);
    const item = document.createElement('article');
    item.className = 'result-item';

    const image = document.createElement('img');
    image.src = state.generatedPreviews[index] || url;
    image.alt = `輸出圖片 ${index + 1}`;

    const meta = document.createElement('div');
    const label = document.createElement('span');
    label.textContent = `${index + 1}. ${file.name}`;
    const download = document.createElement('a');
    download.href = url;
    download.download = file.name;
    download.textContent = '下載這張';
    meta.append(label, download);
    item.append(image, meta);
    elements.resultGallery.appendChild(item);
  });

  elements.resultSheet.hidden = false;
  document.body.classList.add('sheet-open');
}

function closeResultSheet() {
  elements.resultSheet.hidden = true;
  document.body.classList.remove('sheet-open');
}

async function shareGeneratedFiles() {
  if (state.generatedFiles.length === 0) return;
  const shareData = {
    title: 'Markdown 文章圖片',
    text: `共 ${state.generatedFiles.length} 張文章圖片`,
    files: state.generatedFiles,
  };

  if (navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      showToast('已開啟系統分享選單。');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }

  showToast('目前瀏覽器無法一次分享，請使用每張圖片下方的下載按鈕。', 'error');
  renderResultSheet();
}

function downloadBlob(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportMarkdownBackup() {
  const file = new File([state.text], `${sanitizeFileName(state.settings.fileName)}.md`, {
    type: 'text/plain;charset=utf-8',
  });
  const shareData = { title: file.name, files: [file] };

  if (navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  downloadBlob(file);
  showToast('Markdown 備份已下載。');
}

document.querySelectorAll('.tab-button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab));
  });
});

document.querySelector('.sidebar').addEventListener('input', handleSettingInput);
document.querySelector('.sidebar').addEventListener('change', handleSettingInput);

elements.markdownInput.addEventListener('input', (event) => {
  state.text = elements.markdownInput.value;
  recordEditorHistory(event.inputType || '');
  queueRender(true);
});

elements.markdownInput.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redoEditor();
    else undoEditor();
  } else if (key === 'y') {
    event.preventDefault();
    redoEditor();
  }
});

document.querySelector('.editor-toolbar').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-command]');
  if (!button) return;
  const command = button.dataset.command;
  try {
    if (command === 'undo') undoEditor();
    else if (command === 'redo') redoEditor();
    else if (command === 'cut') await cutEditorSelection();
    else if (command === 'copy') await copyEditorSelection();
    else if (command === 'paste') await pasteIntoEditor();
    else if (command === 'heading') prefixSelectedLines('## ');
    else if (command === 'bold') insertAround('**', '**', '粗體文字');
    else if (command === 'italic') insertAround('*', '*', '斜體文字');
    else if (command === 'strike') insertAround('~~', '~~', '刪除文字');
    else if (command === 'quote') prefixSelectedLines('> ');
    else if (command === 'bullet') prefixSelectedLines('- ');
    else if (command === 'ordered') prefixSelectedLines((line, index) => `${index + 1}. ${line}`);
    else if (command === 'task') prefixSelectedLines('- [ ] ');
    else if (command === 'link') insertAround('[', '](https://example.com)', '連結文字');
    else if (command === 'code') insertBlock('```\n程式碼\n```');
    else if (command === 'table') insertBlock('| 欄位一 | 欄位二 |\n| --- | --- |\n| 內容 | 內容 |');
    else if (command === 'pagebreak') insertBlock('[[分頁]]');
    else if (command === 'image') elements.imageFileInput.click();
    else if (command === 'remote-image') insertRemoteImageFromPrompt();
  } catch (error) {
    showToast(error?.message || '剪貼簿操作失敗。', 'error');
  }
});

document.querySelector('#importButton').addEventListener('click', () => elements.markdownFileInput.click());
document.querySelector('#loadSampleButton').addEventListener('click', () => {
  if (state.text !== SAMPLE_MARKDOWN && state.text.trim() && !window.confirm('載入範例會取代目前內容，要繼續嗎？')) return;
  replaceEditorText(SAMPLE_MARKDOWN);
  showToast('已載入範例草稿。');
});
document.querySelector('#clearButton').addEventListener('click', () => {
  if (!window.confirm('要清空目前的 Markdown 內容嗎？')) return;
  replaceEditorText('');
});
document.querySelector('#resetAllButton').addEventListener('click', resetEverything);

elements.markdownFileInput.addEventListener('change', async () => {
  const file = elements.markdownFileInput.files[0];
  if (!file) return;
  const importedText = await file.text();
  replaceEditorText(importedText);
  state.settings.fileName = file.name.replace(/\.(md|markdown|txt)$/i, '') || DEFAULT_SETTINGS.fileName;
  syncControls();
  elements.markdownFileInput.value = '';
  showToast(`已開啟 ${file.name}`);
});

elements.imageFileInput.addEventListener('change', async () => {
  const file = elements.imageFileInput.files[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) {
    showToast('圖片超過 15 MB，為避免輸出爆記憶體，請先縮小圖片。', 'error');
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    insertBlock(`![${file.name.replace(/\.[^.]+$/, '')}](${dataUrl})`);
    showToast('圖片已內嵌到 Markdown；整個過程都在本機。');
  } catch (error) {
    showToast(error.message || '圖片讀取失敗。', 'error');
  } finally {
    elements.imageFileInput.value = '';
  }
});

document.querySelector('#customFontButton').addEventListener('click', () => elements.fontFileInput.click());
elements.fontFileInput.addEventListener('change', async () => {
  const file = elements.fontFileInput.files[0];
  if (!file) return;
  try {
    if (file.size > 30 * 1024 * 1024) {
      throw new Error('字體檔案超過 30 MB，請選擇較小的字體檔。');
    }
    state.customFontDataUrl = await fileToDataUrl(file);
    const familyName = `LocalFont_${Date.now()}`;
    state.customFontFamily = familyName;
    const fontFace = new FontFace(familyName, `url(${state.customFontDataUrl})`);
    await fontFace.load();
    document.fonts.add(fontFace);
    const select = document.querySelector('#fontFamily');
    const option = document.createElement('option');
    option.value = `"${familyName}", sans-serif`;
    option.textContent = `本機：${file.name}`;
    option.dataset.customFont = 'true';
    select.appendChild(option);
    state.settings.fontFamily = option.value;
    elements.customFontLabel.textContent = file.name;
    applySettings();
    persistState();
    showToast(`已載入字體：${file.name}`);
  } catch (error) {
    state.customFontDataUrl = null;
    state.customFontFamily = null;
    showToast(error.message || '無法載入這個字體檔案。', 'error');
  } finally {
    elements.fontFileInput.value = '';
  }
});

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    Object.assign(state.settings, COLOR_PRESETS[button.dataset.preset]);
    applySettings();
    persistState();
  });
});

document.querySelectorAll('[data-custom-palette-apply]').forEach((button) => {
  button.addEventListener('click', () => applyCustomPalette(Number(button.dataset.customPaletteApply)));
});

document.querySelectorAll('[data-custom-palette-save]').forEach((button) => {
  button.addEventListener('click', () => saveCustomPalette(Number(button.dataset.customPaletteSave)));
});

document.querySelectorAll('[data-custom-palette-clear]').forEach((button) => {
  button.addEventListener('click', () => clearCustomPalette(Number(button.dataset.customPaletteClear)));
});

document.querySelector('#resetLayoutButton').addEventListener('click', () => {
  [
    'fontFamily', 'codeFont', 'fontSize', 'lineHeight', 'letterSpacing',
    'paragraphSpacing', 'headingScale', 'firstLineIndent', 'textAlign', 'codeWrap',
    'softBreaks', 'width', 'radius', 'paddingLinked', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'previewZoom',
  ].forEach((key) => { state.settings[key] = DEFAULT_SETTINGS[key]; });
  applySettings();
  renderMarkdown();
  persistState();
  showToast('排版設定已恢復預設值。');
});

elements.exportButton.addEventListener('click', exportImages);
elements.openOutputButton.addEventListener('click', renderResultSheet);
elements.exportMarkdownButton.addEventListener('click', exportMarkdownBackup);
elements.shareAllButton.addEventListener('click', shareGeneratedFiles);
elements.resultSheet.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-results]')) closeResultSheet();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.resultSheet.hidden) closeResultSheet();
});

elements.markdownPreview.addEventListener('click', (event) => {
  if (event.target.closest('a')) event.preventDefault();
});

const resizeObserver = new ResizeObserver(() => requestAnimationFrame(updatePreviewGeometry));
resizeObserver.observe(elements.exportCard);

function updateConnectionStatus() {
  if (!navigator.onLine) {
    elements.offlineStatus.innerHTML = '<i></i> 離線模式';
  } else if (navigator.serviceWorker?.controller) {
    elements.offlineStatus.innerHTML = '<i></i> 已可離線';
  } else {
    elements.offlineStatus.innerHTML = '<i></i> 本機運算';
  }
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('beforeunload', clearResultUrls);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
      await navigator.serviceWorker.ready;
      updateConnectionStatus();
    } catch (error) {
      console.warn('Offline cache unavailable:', error);
      elements.offlineStatus.innerHTML = '<i></i> 本機運算';
    }
  });
}

elements.markdownInput.value = state.text;
resetEditorHistory();
syncControls();
applySettings();
renderCustomPalettes();
renderMarkdown();
updateConnectionStatus();
document.documentElement.dataset.appReady = 'true';
document.querySelector('#bootNotice')?.remove();
