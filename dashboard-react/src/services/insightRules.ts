import type { Insight, Recording, RecordingDetail } from "../types";
import type { AnalyzeDiagnostics } from "./analysisWorkerClient";

const TARGET_PITCH_HZ = 165;
const TARGET_IN_REGISTER_PCT = 80;
const TARGET_MELODY_ST = 2.5;
const TARGET_PHRASE_LANDING_PCT = 80;

export function createRuleInsight(
  recording: Recording,
  detail: RecordingDetail,
  diagnostics: AnalyzeDiagnostics,
): Insight {
  const badges: string[] = [diagnostics.engine === "praat-wasm" ? "Praat WASM" : diagnostics.engine];
  const issues: string[] = [];

  const meanPitch = recording.pitch.mean_hz;
  const melody = recording.register?.in_register_semitones_sd ?? recording.register?.semitones_sd ?? null;
  const inRegister = recording.register?.in_register_pct ?? null;
  const landed = recording.register?.phrases_landed_pct ?? null;

  if (meanPitch != null && meanPitch < TARGET_PITCH_HZ) {
    issues.push(`average pitch is ${Math.round(TARGET_PITCH_HZ - meanPitch)} Hz under the 165 Hz guide`);
    badges.push("pitch lift");
  }

  if (melody != null && melody < TARGET_MELODY_ST) {
    issues.push(`melody is compact at ${melody.toFixed(1)} st`);
    badges.push("more melody");
  }

  if (inRegister != null && inRegister < TARGET_IN_REGISTER_PCT) {
    issues.push(`${Math.round(100 - inRegister)}% of voiced frames are below the register floor`);
    badges.push("register floor");
  }

  if (landed != null && landed < TARGET_PHRASE_LANDING_PCT) {
    issues.push(`only ${Math.round(landed)}% of phrase endings landed in register`);
    badges.push("phrase endings");
  }

  if (describeUnsupportedGroups(diagnostics.unsupportedMetrics)) {
    badges.push("some metrics unavailable");
  }

  const primaryIssue = issues[0] ?? "this take has a usable pitch contour";
  const recommendedDrill = chooseDrill(primaryIssue);

  return {
    recordingId: recording.id,
    headline: issues.length ? "Next practice focus" : "Stable first browser take",
    summary: buildSummary(recording, detail, issues, diagnostics.unsupportedMetrics),
    badges: [...new Set(badges)].slice(0, 4),
    primaryIssue,
    recommendedDrill,
    createdAt: new Date().toISOString(),
  };
}

function buildSummary(
  recording: Recording,
  detail: RecordingDetail,
  issues: string[],
  unsupported: string[],
): string {
  const pitch = recording.pitch.mean_hz == null ? "unknown pitch" : `${Math.round(recording.pitch.mean_hz)} Hz average pitch`;
  const frames = detail.frames.hz.filter((hz) => hz != null).length;
  const issueText = issues.length ? `The main signal is that ${issues[0]}.` : "No urgent rule-based issue stood out from the available pitch metrics.";
  const missingGroups = describeUnsupportedGroups(unsupported);
  const missing = missingGroups ? ` ${missingGroups} ${missingGroups.includes(",") || missingGroups.includes(" and ") ? "are" : "is"} still hidden until the browser Praat wrappers support ${missingGroups.includes(",") || missingGroups.includes(" and ") ? "them" : "it"}.` : "";
  return `${pitch} across ${frames} voiced frames. ${issueText}${missing}`;
}

function describeUnsupportedGroups(unsupported: string[]): string {
  const groups = new Set<string>();
  if (unsupported.some((metric) => metric.startsWith("formants."))) groups.add("formants");
  if (unsupported.some((metric) => metric.startsWith("voice_quality."))) groups.add("voice quality");
  if (unsupported.some((metric) => metric === "phrases")) groups.add("phrase-ending detail");
  if (unsupported.some((metric) => metric.startsWith("weight.") && metric !== "weight.tilt_db_khz")) groups.add("weight");
  return formatList([...groups]);
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function chooseDrill(issue: string): string {
  if (issue.includes("average pitch")) {
    return "Read the same sentence three times, starting each attempt slightly higher, then keep the final word from falling.";
  }
  if (issue.includes("melody")) {
    return "Mark three words in the passage to gently rise on, then let the next word settle without dropping below the floor.";
  }
  if (issue.includes("below the register floor")) {
    return "Use a quiet hum at the register floor before speaking, then restart the sentence if the first syllable drops under it.";
  }
  if (issue.includes("phrase endings")) {
    return "Practice only the last two words of each phrase, landing the final word level instead of downsliding.";
  }
  return "Record one more take with the same passage so the trend chart can compare the new contour.";
}
