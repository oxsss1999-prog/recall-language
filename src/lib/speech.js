/*
 * Text-to-speech with the browser's built-in voices (Web Speech API).
 *
 * Cards often mix pinyin and characters, e.g.
 *   "Wǒ xǐhuan hé péngyou yìqǐ guàngjiē. (我喜欢和朋友一起逛街。)"
 * A Chinese voice reads characters well but mangles pinyin, so when a text
 * contains Chinese characters we speak only the characters.
 *
 * Important: we never speak Chinese without an actual Chinese voice. If we
 * only set lang="zh-CN", many browsers fall back to the system voice (e.g.
 * Korean), which reads 人山人海 as "인산인해".
 */

const HAN = /[㐀-䶿一-鿿豈-﫿]/;
const HAN_RUN = /[㐀-䶿一-鿿豈-﫿　-〿！-？]+/g;
const HANGUL = /[가-힣]/g;

export const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Decide what to say and in which language. Returns null if nothing speakable. */
export function speakable(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (HAN.test(s)) {
    const han = (s.match(HAN_RUN) || []).join(' ').replace(/^[（(]|[）)]$/g, '').trim();
    return han ? { text: han, lang: 'zh-CN' } : null;
  }
  const hangul = (s.match(HANGUL) || []).length;
  const letters = s.replace(/[^\p{L}]/gu, '').length || 1;
  return { text: s, lang: hangul / letters > 0.5 ? 'ko-KR' : 'en-US' };
}

/* ---------- voices ---------- */

let voices = [];
let ready = null;

/** Resolves once the browser has delivered its voice list (it loads asynchronously). */
export function loadVoices() {
  if (!supported) return Promise.resolve([]);
  const now = window.speechSynthesis.getVoices();
  if (now.length) { voices = now; return Promise.resolve(voices); }
  if (!ready) {
    ready = new Promise(resolve => {
      const done = () => { voices = window.speechSynthesis.getVoices(); if (voices.length) resolve(voices); };
      window.speechSynthesis.addEventListener?.('voiceschanged', done);
      // Some browsers never fire the event; poll briefly as a fallback.
      let tries = 0;
      const t = setInterval(() => { done(); if (voices.length || ++tries > 20) { clearInterval(t); resolve(voices); } }, 100);
    });
  }
  return ready;
}
if (supported) loadVoices();

const isZh = v => /^(zh|cmn)/i.test(v.lang.replace('_', '-'));

// Best-sounding Mandarin voices first.
const PREFERRED = ['Google 普通话', 'Tingting', 'Ting-Ting', 'Lili', 'Yu-shu', 'Microsoft Xiaoxiao', 'Microsoft Yunxi', 'Microsoft Huihui', 'Meijia'];

/** Mandarin voices available on this device, best first. */
export function chineseVoices() {
  const zh = voices.filter(isZh);
  const mainland = zh.filter(v => /(zh|cmn)[-_](CN|Hans)/i.test(v.lang));
  const rest = zh.filter(v => !mainland.includes(v));
  const rank = v => { const i = PREFERRED.findIndex(n => v.name.includes(n)); return i < 0 ? 99 : i; };
  return [...mainland.sort((a, b) => rank(a) - rank(b)), ...rest.sort((a, b) => rank(a) - rank(b))];
}

function pickVoice(lang, preferredName) {
  const base = lang.split('-')[0];
  if (base === 'zh') {
    const list = chineseVoices();
    return list.find(v => v.name === preferredName) || list[0] || null;
  }
  const same = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(base));
  return same.find(v => v.lang.replace('_', '-') === lang) || same[0] || null;
}

/**
 * Speak text.
 * opts: rate (0.5–1.2), voice (preferred Chinese voice name), onEnd, onMissingVoice(lang)
 * Resolves true if speech started.
 */
let missingHandler = null;
/** Called (once per page load) when Chinese text can't be spoken. */
export function onMissingVoice(fn) { missingHandler = fn; }
let warned = false;

const VOICE_KEY = 'recall.zhVoice';
export function getVoicePref() { try { return localStorage.getItem(VOICE_KEY) || ''; } catch { return ''; } }
export function setVoicePref(name) { try { localStorage.setItem(VOICE_KEY, name); } catch { /* ignore */ } }

export async function speak(text, { rate = 1, voice: voiceName = getVoicePref(), onEnd, onMissingVoice: onMissing } = {}) {
  if (!supported) return false;
  const what = speakable(text);
  if (!what) return false;
  await loadVoices();
  const voice = pickVoice(what.lang, voiceName);
  if (!voice) {
    // Never let a Korean/English voice read Chinese characters.
    const fn = onMissing || missingHandler;
    if (fn && !warned) { warned = true; fn(what.lang); }
    onEnd?.();
    return false;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(what.text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
  synth.speak(u);
  return true;
}

export function stop() { if (supported) window.speechSynthesis.cancel(); }

export const MISSING_ZH_HELP =
  'No Chinese voice on this device. Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Chinese (China mainland) → download Tingting or Lili, then reload. iPhone: Settings → Accessibility → Spoken Content → Voices → Chinese.';
