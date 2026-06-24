import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize, resolve } from "node:path";

const repoRoot = resolve("..");
const port = Number(process.env.PRAAT_WASM_SMOKE_PORT || 4178);
const sampleRate = 16_000;
const frequency = 180;

const mimeTypes = new Map([
  [".html", "text/html"],
  [".js", "text/javascript"],
  [".wasm", "application/wasm"],
]);

const html = `<!doctype html>
<meta charset="utf-8">
<script type="module">
const worker = new Worker("/praat-wasm/src/worker.js", { type: "module" });
const sampleRate = ${sampleRate};
const frequency = ${frequency};
const vowelSamples = syntheticVowel({ sampleRate, frequency, durationSeconds: 1.5 });
const phraseSamples = phraseLandingClip({ sampleRate });

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

let vowelResult = null;

worker.onmessage = (event) => {
  const message = event.data;
  if (!message.ok) {
    window.__result = { ok: false, error: message.error };
    return;
  }

  if (message.id === 1) {
    vowelResult = message.result;
    worker.postMessage(
      { id: 2, input: { samples: phraseSamples, sampleRate, registerFloor: 130 } },
      [phraseSamples.buffer],
    );
    return;
  }

  const phraseResult = message.result;
  window.__result = {
    ok: true,
    engine: vowelResult.diagnostics.engine,
    mean: vowelResult.recording.pitch.mean_hz,
    hnr: vowelResult.recording.voice_quality.hnr_db,
    jitter: vowelResult.recording.voice_quality.jitter_pct,
    f2: vowelResult.recording.formants.f2_hz,
    f3: vowelResult.recording.formants.f3_hz,
    weight: vowelResult.recording.weight?.h1a3c_db,
    frames: vowelResult.detail.frames.t.length,
    inRegister: vowelResult.recording.register.in_register_pct,
    unsupportedMetrics: vowelResult.diagnostics.unsupportedMetrics,
    phraseCount: phraseResult.detail.phrases.length,
    phraseRegisterCount: phraseResult.recording.register.n_phrases,
    phrasesLandedPct: phraseResult.recording.register.phrases_landed_pct,
    onsetSubPct: phraseResult.recording.register.onset_sub_pct,
    midSubPct: phraseResult.recording.register.mid_sub_pct,
    offsetSubPct: phraseResult.recording.register.offset_sub_pct,
    phraseUnsupportedMetrics: phraseResult.diagnostics.unsupportedMetrics,
  };
};

worker.onerror = (event) => {
  window.__result = { ok: false, error: event.message };
};

worker.postMessage(
  { id: 1, input: { samples: vowelSamples, sampleRate, registerFloor: 130 } },
  [vowelSamples.buffer],
);
</script>`;

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(html);
      return;
    }

    const file = normalize(resolve(repoRoot, `.${url.pathname}`));
    if (!file.startsWith(repoRoot)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }

    const bytes = await readFile(file);
    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(file)) || "application/octet-stream",
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(404);
    response.end(String(error));
  }
});

await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));

let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  const result = await page
    .waitForFunction(() => window.__result, null, { timeout: 15_000 })
    .then((handle) => handle.jsonValue());

  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    throw new Error(result.error);
  }
  if (result.engine !== "praat-wasm") {
    throw new Error(`Expected praat-wasm engine, got ${result.engine}`);
  }
  if (Math.abs(result.mean - frequency) > 2) {
    throw new Error(`Mean pitch ${result.mean} is not close to expected ${frequency}`);
  }
  if (result.frames <= 0) {
    throw new Error("Expected voiced pitch frames");
  }
  for (const [label, value] of [
    ["HNR", result.hnr],
    ["jitter", result.jitter],
    ["F2", result.f2],
    ["F3", result.f3],
    ["corrected weight", result.weight],
  ]) {
    if (!Number.isFinite(value)) {
      throw new Error(`Expected finite ${label}, got ${value}`);
    }
  }
  for (const metric of [
    "formants.f2_hz",
    "formants.f3_hz",
    "voice_quality.hnr_db",
    "voice_quality.jitter_pct",
    "weight.h1a3c_db",
  ]) {
    if (result.unsupportedMetrics.includes(metric)) {
      throw new Error(`${metric} should not be marked unsupported`);
    }
  }
  if (result.phraseUnsupportedMetrics.includes("phrases")) {
    throw new Error("phrases should not be marked unsupported");
  }
  if (result.phraseCount !== 2) {
    throw new Error(`Expected 2 phrases, got ${result.phraseCount}`);
  }
  if (result.phraseRegisterCount !== result.phraseCount) {
    throw new Error("Register phrase count should match detail phrase count");
  }
  if (result.phrasesLandedPct !== 50) {
    throw new Error(`Expected 50% phrase landing, got ${result.phrasesLandedPct}`);
  }
  for (const [label, value] of [
    ["onset sub-register pct", result.onsetSubPct],
    ["mid sub-register pct", result.midSubPct],
    ["offset sub-register pct", result.offsetSubPct],
  ]) {
    if (!Number.isFinite(value)) {
      throw new Error(`Expected finite ${label}, got ${value}`);
    }
  }
  if (result.offsetSubPct <= result.onsetSubPct) {
    throw new Error("Expected phrase endings to have more sub-register time than starts");
  }
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return import("../../dashboard-react/node_modules/playwright/index.mjs");
  }
}

async function launchBrowser() {
  const { chromium } = await importPlaywright();
  try {
    return await chromium.launch({ headless: true });
  } catch (managedError) {
    try {
      return await chromium.launch({ channel: "msedge", headless: true });
    } catch {
      throw managedError;
    }
  }
}
