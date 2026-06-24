import { describe, expect, it } from "vitest";
import { createRuleInsight } from "../src/services/insightRules";
import type { Recording, RecordingDetail } from "../src/types";
import type { AnalyzeDiagnostics } from "../src/services/analysisWorkerClient";

describe("createRuleInsight", () => {
  it("prioritizes pitch, melody, register, and unsupported metric badges", () => {
    const recording: Recording = {
      id: 42,
      label: "Fixture",
      note: "",
      date: "2026-06-24",
      source_file: "fixture",
      audio: null,
      duration_s: 4,
      pitch: {
        mean_hz: 150,
        median_hz: 150,
        min_hz: 120,
        max_hz: 180,
        range_hz: 60,
        sd_hz: 8,
      },
      formants: { f1_hz: null, f2_hz: null, f3_hz: null },
      voice_quality: { hnr_db: null, jitter_pct: null, shimmer_pct: null },
      intensity: { mean_db: null, min_db: null, max_db: null },
      register: {
        floor_hz: 130,
        in_register_pct: 62,
        semitones_sd: 1.8,
        in_register_semitones_sd: 1.6,
        onset_sub_pct: null,
        mid_sub_pct: null,
        offset_sub_pct: null,
        phrases_landed_pct: 50,
        n_phrases: 2,
      },
    };
    const detail: RecordingDetail = {
      register_floor_hz: 130,
      semitone_ref_hz: 100,
      duration_s: 4,
      time_step: 0.01,
      frames: { t: [0, 0.01, 0.02], hz: [140, null, 155] },
      phrases: [],
      summary: recording.register!,
    };
    const diagnostics: AnalyzeDiagnostics = {
      engine: "praat-wasm",
      sampleRate: 48000,
      samples: 192000,
      unsupportedMetrics: ["formants.f1_hz"],
      elapsedMs: 12,
    };

    const insight = createRuleInsight(recording, detail, diagnostics);

    expect(insight.recordingId).toBe(42);
    expect(insight.headline).toBe("Next practice focus");
    expect(insight.primaryIssue).toContain("average pitch");
    expect(insight.summary).toContain("150 Hz average pitch");
    expect(insight.badges).toContain("Praat WASM");
    expect(insight.badges).toContain("pitch lift");
    expect(insight.recommendedDrill).toContain("slightly higher");
  });

  it("describes only the metric groups that are still unsupported", () => {
    const recording: Recording = {
      id: 43,
      label: "Browser take",
      note: "",
      date: "2026-06-24",
      source_file: "browser-recording",
      audio: null,
      duration_s: 2,
      pitch: {
        mean_hz: 190,
        median_hz: 190,
        min_hz: 170,
        max_hz: 215,
        range_hz: 45,
        sd_hz: 12,
      },
      formants: { f1_hz: 650, f2_hz: 1800, f3_hz: 2800 },
      voice_quality: { hnr_db: 18, jitter_pct: 0.6, shimmer_pct: 2.1 },
      intensity: { mean_db: 62, min_db: 48, max_db: 70 },
      register: {
        floor_hz: 130,
        in_register_pct: 100,
        semitones_sd: 3.8,
        in_register_semitones_sd: 3.8,
        onset_sub_pct: null,
        mid_sub_pct: null,
        offset_sub_pct: null,
        phrases_landed_pct: null,
        n_phrases: 0,
      },
      weight: { h1a3c_db: 9, h1a3_db: 6, tilt_db_khz: null },
    };
    const detail: RecordingDetail = {
      register_floor_hz: 130,
      semitone_ref_hz: 100,
      duration_s: 2,
      time_step: 0.01,
      frames: { t: [0, 0.01, 0.02], hz: [180, 190, 200] },
      phrases: [],
      summary: recording.register!,
    };
    const diagnostics: AnalyzeDiagnostics = {
      engine: "praat-wasm",
      sampleRate: 48000,
      samples: 96000,
      unsupportedMetrics: ["phrases", "weight.tilt_db_khz"],
      elapsedMs: 20,
    };

    const insight = createRuleInsight(recording, detail, diagnostics);

    expect(insight.summary).toContain("phrase-ending detail is still hidden");
    expect(insight.summary).not.toContain("legacy weight tilt");
    expect(insight.summary).not.toContain("Formants, voice quality, and weight");
  });

  it("does not describe phrase detail as hidden when WASM phrases are populated", () => {
    const recording: Recording = {
      id: 44,
      label: "Phrase detail",
      note: "",
      date: "2026-06-24",
      source_file: "browser-recording",
      audio: null,
      duration_s: 2,
      pitch: {
        mean_hz: 180,
        median_hz: 180,
        min_hz: 112,
        max_hz: 185,
        range_hz: 73,
        sd_hz: 18,
      },
      formants: { f1_hz: 650, f2_hz: 1800, f3_hz: 2800 },
      voice_quality: { hnr_db: 18, jitter_pct: 0.6, shimmer_pct: 2.1 },
      intensity: { mean_db: 62, min_db: 48, max_db: 70 },
      register: {
        floor_hz: 130,
        in_register_pct: 87,
        semitones_sd: 2.5,
        in_register_semitones_sd: 3,
        onset_sub_pct: 0,
        mid_sub_pct: 0,
        offset_sub_pct: 39.4,
        phrases_landed_pct: 50,
        n_phrases: 2,
      },
      weight: { h1a3c_db: 9, h1a3_db: 6, tilt_db_khz: null },
    };
    const detail: RecordingDetail = {
      register_floor_hz: 130,
      semitone_ref_hz: 100,
      duration_s: 2,
      time_step: 0.01,
      frames: { t: [0, 0.01, 0.02], hz: [180, 150, 120] },
      phrases: [
        {
          start: 0,
          end: 0.5,
          onset_hz: 180,
          offset_hz: 180,
          min_hz: 180,
          started_in_register: true,
          ended_in_register: true,
          sub_register_pct: 0,
        },
        {
          start: 0.75,
          end: 1.25,
          onset_hz: 175,
          offset_hz: 121,
          min_hz: 112,
          started_in_register: true,
          ended_in_register: false,
          sub_register_pct: 25,
        },
      ],
      summary: recording.register!,
    };
    const diagnostics: AnalyzeDiagnostics = {
      engine: "praat-wasm",
      sampleRate: 48000,
      samples: 96000,
      unsupportedMetrics: ["weight.tilt_db_khz"],
      elapsedMs: 20,
    };

    const insight = createRuleInsight(recording, detail, diagnostics);

    expect(insight.summary).toContain("only 50% of phrase endings landed in register");
    expect(insight.summary).not.toContain("phrase-ending detail is still hidden");
  });
});
