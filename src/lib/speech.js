import { getPrefs } from './prefs';
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

/* ---------- voice choice per language ---------- */

export const LANGS = [
  { code: 'zh', label: 'Chinese', sample: '我喜欢和朋友一起逛街。' },
  { code: 'en', label: 'English', sample: 'I like window shopping with my friends.' },
  { code: 'ko', label: 'Korean', sample: '친구들과 같이 쇼핑하는 걸 좋아해요.' },
];

const baseOf = v => {
  const l = v.lang.replace('_', '-').toLowerCase();
  return l.startsWith('cmn') ? 'zh' : l.split('-')[0];
};

// Natural-sounding voices first. Windows/Edge "Online (Natural)" voices and
// Google/Apple enhanced voices sound far better than the old desktop ones.
const PREFERRED = {
  zh: ['Microsoft Xiaoxiao Online', 'Microsoft Yunxi Online', 'Google 普通话', 'Tingting', 'Ting-Ting', 'Lili', 'Yu-shu', 'Microsoft Xiaoxiao', 'Microsoft Yunxi', 'Microsoft Huihui', 'Meijia'],
  en: ['Microsoft Ava Online', 'Microsoft Aria Online', 'Microsoft Jenny Online', 'Microsoft Andrew Online', 'Microsoft Emma Online', 'Microsoft Guy Online',
       'Google US English', 'Google UK English Female', 'Ava', 'Samantha', 'Zoe', 'Allison', 'Serena', 'Daniel', 'Karen', 'Moira'],
  ko: ['Microsoft SunHi Online', 'Microsoft InJoon Online', 'Google 한국의', 'Yuna', 'Microsoft Heami'],
};
const QUALITY = /natural|neural|premium|enhanced|online/i;
const REGION = { zh: /(zh|cmn)[-_](CN|Hans)/i, en: /en[-_](US|GB)/i, ko: /ko/i };

/** Voices for a language on this device, best-sounding first. */
export function voicesFor(base) {
  const pref = PREFERRED[base] || [];
  const score = v => {
    const i = pref.findIndex(n => v.name.includes(n));
    let s = i < 0 ? 50 : i;
    if (QUALITY.test(v.name)) s -= 30;
    if (REGION[base] && !REGION[base].test(v.lang)) s += 100;
    return s;
  };
  return voices.filter(v => baseOf(v) === base).sort((a, b) => score(a) - score(b));
}
export const chineseVoices = () => voicesFor('zh');

const keyFor = base => (base === 'zh' ? 'recall.zhVoice' : `recall.voice.${base}`);
export function getVoiceFor(base) { try { return localStorage.getItem(keyFor(base)) || ''; } catch { return ''; } }
export function setVoiceFor(base, name) { try { localStorage.setItem(keyFor(base), name); } catch { /* ignore */ } }
export const getVoicePref = () => getVoiceFor('zh');
export const setVoicePref = name => setVoiceFor('zh', name);

function pickVoice(lang, override) {
  const base = lang.split('-')[0];
  const list = voicesFor(base);
  return list.find(v => v.name === override) || list.find(v => v.name === getVoiceFor(base)) || list[0] || null;
}

/**
 * Speak text.
 * opts: rate (0.5–1.2), voice (voice name to try first), onEnd, onMissingVoice(lang)
 * Resolves true if speech started.
 */
let missingHandler = null;
/** Called (once per page load) when Chinese text can't be spoken. */
export function onMissingVoice(fn) { missingHandler = fn; }
let warned = false;

export async function speak(text, { rate = 1, voice: voiceName, onEnd, onMissingVoice: onMissing } = {}) {
  if (!supported) return false;
  const what = speakable(text);
  if (!what) return false;
  await loadVoices();
  const voice = pickVoice(what.lang, voiceName);
  if (!voice && what.lang.startsWith('zh')) {
    // Never let a Korean/English voice read Chinese characters.
    const fn = onMissing || missingHandler;
    if (fn && !warned) { warned = true; fn(what.lang); }
    onEnd?.();
    return false;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(what.text);
  if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = what.lang;
  u.rate = rate;
  u.volume = getPrefs().voiceVolume;
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
  synth.speak(u);
  return true;
}

export function stop() { if (supported) window.speechSynthesis.cancel(); }

export const MISSING_ZH_HELP =
  'No Chinese voice on this device. Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Chinese (China mainland) → download Tingting or Lili, then reload. iPhone: Settings → Accessibility → Spoken Content → Voices → Chinese.';
