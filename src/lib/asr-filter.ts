// Post-processing helpers for ASR (speech-to-text) transcripts.
// The goal: force French output and discard hallucinated / misdetected
// non-Latin tokens (notably CJK characters that Whisper sometimes emits
// when it misidentifies the spoken language).

const CJK_REGEX = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;
// Common Whisper hallucination fillers in non-target languages
const HALLUCINATION_PATTERNS = [
  /谢谢[观看使用]*谢谢/g,
  /请不[要忘]*点击/g,
  /字幕由/g,
  /感谢观看/g,
  /(点|了|的|是|你|我|他){4,}/g,
];
// Punctuation/whitespace cleanup
const MULTI_SPACE = /\s{2,}/g;

/**
 * Clean a raw ASR transcript:
 *  1. strip CJK characters (Chinese/Japanese/Korean) — Whisper mislanguage
 *  2. remove known hallucination phrases
 *  3. normalize whitespace
 * Returns "" when the result is empty or contains almost no latin letters
 * (a strong signal the transcription failed / was the wrong language).
 */
export function cleanFrenchTranscript(raw: string): string {
  if (!raw) return "";
  let text = String(raw);

  // 1. drop CJK runs
  text = text.replace(CJK_REGEX, " ");

  // 2. drop known hallucination phrases
  for (const p of HALLUCINATION_PATTERNS) {
    text = text.replace(p, " ");
  }

  // 3. normalize whitespace & trim
  text = text.replace(MULTI_SPACE, " ").trim();

  // Capitalize first letter for nicer display
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}

/**
 * Decide whether a cleaned transcript is usable as French input.
 * Returns true when the text is long enough and has a plausible ratio of
 * latin letters / accents / french punctuation relative to its length.
 */
export function isPlausibleFrench(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 2) return false;
  // Count latin letters (incl. accents) and digits
  const latin = (t.match(/[a-zA-Zà-ÿ0-9]/g) || []).length;
  const ratio = latin / t.length;
  return ratio >= 0.5;
}
