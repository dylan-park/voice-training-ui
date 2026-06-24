import createPraatModule from "../dist/praat-voice-garden.js";
import { analyzePcmWithPraat } from "../src/praatWasmAnalyzer.js";

const sampleRate = Number(process.argv[2] || 16_000);
const frequency = Number(process.argv[3] || 180);
const durationSeconds = Number(process.argv[4] || 1);
const samples = sine({ sampleRate, frequency, durationSeconds });

const module = await createPraatModule();
const raw = module.analyzePcmJson(samples, sampleRate, 75, 500);
const result = JSON.parse(raw);

if (result.error) {
  throw new Error(result.error);
}

const summary = {
  engine: result.engine,
  sampleRate: result.sampleRate,
  duration: result.duration,
  expectedFrequency: frequency,
  meanPitch: result.pitch.mean,
  medianPitch: result.pitch.median,
  formants: result.formants,
  voiceQuality: result.voiceQuality,
  intensity: result.intensity,
  weight: result.weight,
  voicedFrames: result.pitch.voicedFrames,
  frameCount: result.pitch.frames.length,
};

console.log(JSON.stringify(summary, null, 2));

if (Math.abs(result.pitch.mean - frequency) > 2) {
  throw new Error(`Mean pitch ${result.pitch.mean} is not close to expected ${frequency}`);
}

if (result.pitch.voicedFrames <= 0 || result.pitch.frames.length <= 0) {
  throw new Error("Expected voiced pitch frames");
}

for (const [label, value] of [
  ["HNR", result.voiceQuality?.hnr],
  ["jitter", result.voiceQuality?.jitter],
  ["intensity mean", result.intensity?.mean],
]) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite ${label}, got ${value}`);
  }
}

const shaped = await analyzePcmWithPraat({ samples, sampleRate, registerFloor: 130 });
console.log(
  JSON.stringify(
    {
      shapedEngine: shaped.diagnostics.engine,
      shapedMeanPitch: shaped.recording.pitch.mean_hz,
      shapedHnr: shaped.recording.voice_quality.hnr_db,
      shapedJitter: shaped.recording.voice_quality.jitter_pct,
      shapedF2: shaped.recording.formants.f2_hz,
      shapedWeight: shaped.recording.weight?.h1a3c_db,
      shapedFrameCount: shaped.detail.frames.t.length,
      shapedInRegisterPct: shaped.recording.register.in_register_pct,
      unsupportedMetrics: shaped.diagnostics.unsupportedMetrics,
    },
    null,
    2,
  ),
);

if (shaped.diagnostics.engine !== "praat-wasm") {
  throw new Error(`Expected praat-wasm shaped engine, got ${shaped.diagnostics.engine}`);
}

if (Math.abs(shaped.recording.pitch.mean_hz - frequency) > 2) {
  throw new Error(`Shaped mean pitch ${shaped.recording.pitch.mean_hz} is not close to expected ${frequency}`);
}

if (!Number.isFinite(shaped.recording.voice_quality.hnr_db)) {
  throw new Error("Expected shaped HNR to be finite");
}

if (!Number.isFinite(shaped.recording.voice_quality.jitter_pct)) {
  throw new Error("Expected shaped jitter to be finite");
}

const phraseSamples = phraseLandingClip({ sampleRate });
const phraseShaped = await analyzePcmWithPraat({ samples: phraseSamples, sampleRate, registerFloor: 130 });
console.log(
  JSON.stringify(
    {
      phraseCount: phraseShaped.detail.phrases.length,
      phraseRegister: phraseShaped.recording.register,
      phraseUnsupportedMetrics: phraseShaped.diagnostics.unsupportedMetrics,
    },
    null,
    2,
  ),
);

if (phraseShaped.diagnostics.unsupportedMetrics.includes("phrases")) {
  throw new Error("phrases should not be marked unsupported");
}

if (phraseShaped.detail.phrases.length !== 2) {
  throw new Error(`Expected 2 phrases, got ${phraseShaped.detail.phrases.length}`);
}

if (phraseShaped.recording.register.n_phrases !== phraseShaped.detail.phrases.length) {
  throw new Error("Register phrase count should match detail phrase count");
}

if (phraseShaped.recording.register.phrases_landed_pct !== 50) {
  throw new Error(`Expected 50% phrase landing, got ${phraseShaped.recording.register.phrases_landed_pct}`);
}

for (const [label, value] of [
  ["onset sub-register pct", phraseShaped.recording.register.onset_sub_pct],
  ["mid sub-register pct", phraseShaped.recording.register.mid_sub_pct],
  ["offset sub-register pct", phraseShaped.recording.register.offset_sub_pct],
]) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite ${label}, got ${value}`);
  }
}

if (phraseShaped.recording.register.offset_sub_pct <= phraseShaped.recording.register.onset_sub_pct) {
  throw new Error("Expected phrase endings to have more sub-register time than starts");
}

for (const metric of [
  "voice_quality.hnr_db",
  "voice_quality.jitter_pct",
  "intensity.mean_db",
]) {
  if (shaped.diagnostics.unsupportedMetrics.includes(metric)) {
    throw new Error(`${metric} should not be marked unsupported`);
  }
}

const vowelSamples = syntheticVowel({ sampleRate, frequency, durationSeconds: 1.5 });
const vowelRaw = JSON.parse(module.analyzePcmJson(vowelSamples, sampleRate, 75, 500));
const vowelShaped = await analyzePcmWithPraat({ samples: vowelSamples, sampleRate, registerFloor: 130 });
console.log(
  JSON.stringify(
    {
      vowelFormants: vowelShaped.recording.formants,
      vowelWeight: vowelShaped.recording.weight,
      vowelUnsupportedMetrics: vowelShaped.diagnostics.unsupportedMetrics,
    },
    null,
    2,
  ),
);

for (const [label, value] of [
  ["raw F1", vowelRaw.formants?.f1],
  ["raw F2", vowelRaw.formants?.f2],
  ["raw F3", vowelRaw.formants?.f3],
  ["raw corrected weight", vowelRaw.weight?.h1a3c],
  ["shaped F1", vowelShaped.recording.formants.f1_hz],
  ["shaped F2", vowelShaped.recording.formants.f2_hz],
  ["shaped F3", vowelShaped.recording.formants.f3_hz],
  ["shaped corrected weight", vowelShaped.recording.weight?.h1a3c_db],
]) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite ${label}, got ${value}`);
  }
}

for (const metric of [
  "formants.f1_hz",
  "formants.f2_hz",
  "formants.f3_hz",
  "weight.h1a3c_db",
]) {
  if (vowelShaped.diagnostics.unsupportedMetrics.includes(metric)) {
    throw new Error(`${metric} should not be marked unsupported`);
  }
}

function sine({ sampleRate, frequency, durationSeconds }) {
  const sampleCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    out[i] = 0.2 * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return out;
}

function phraseLandingClip({ sampleRate }) {
  return concatSegments(
    [
      { hz: 180, seconds: 0.5, amp: 0.3 },
      { seconds: 0.24, amp: 0 },
      { startHz: 180, endHz: 110, seconds: 0.52, amp: 0.3 },
    ],
    sampleRate,
  );
}

function concatSegments(segments, sampleRate) {
  const length = segments.reduce((sum, segment) => sum + Math.round(segment.seconds * sampleRate), 0);
  const samples = new Float32Array(length);
  let offset = 0;
  let phase = 0;

  for (const segment of segments) {
    const segmentLength = Math.round(segment.seconds * sampleRate);
    const amp = segment.amp ?? 0.3;
    const startHz = segment.startHz ?? segment.hz ?? 0;
    const endHz = segment.endHz ?? startHz;
    for (let i = 0; i < segmentLength; i += 1) {
      const fraction = segmentLength > 1 ? i / (segmentLength - 1) : 0;
      const hz = startHz + (endHz - startHz) * fraction;
      samples[offset + i] = hz > 0 && amp > 0 ? amp * Math.sin(phase) : 0;
      phase += hz > 0 ? (2 * Math.PI * hz) / sampleRate : 0;
    }
    offset += segmentLength;
  }

  return samples;
}

function syntheticVowel({ sampleRate, frequency, durationSeconds }) {
  const sampleCount = Math.max(1, Math.round(sampleRate * durationSeconds));
  const out = new Float32Array(sampleCount);
  const formants = [650, 1800, 2900];
  const bandwidths = [90, 140, 220];
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    let y = 0;
    for (let harmonic = 1; harmonic * frequency < 5000; harmonic += 1) {
      const hz = harmonic * frequency;
      y += (formantBoost(hz, formants, bandwidths) / harmonic) * Math.sin(2 * Math.PI * hz * t);
    }
    out[i] = y;
  }
  normalize(out, 0.25);
  return out;
}

function formantBoost(hz, formants, bandwidths) {
  let value = 0;
  for (let i = 0; i < formants.length; i += 1) {
    const x = (hz - formants[i]) / bandwidths[i];
    value += Math.exp(-0.5 * x * x) * 5;
  }
  return Math.max(value, 0.05);
}

function normalize(samples, peak) {
  let max = 0;
  for (const sample of samples) max = Math.max(max, Math.abs(sample));
  if (max === 0) return;
  for (let i = 0; i < samples.length; i += 1) samples[i] = (samples[i] / max) * peak;
}
