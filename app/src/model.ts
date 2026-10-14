import { z } from "zod";
export const VERSION = "0.1.3";
export const tags = [
  "CUT",
  "MOVE",
  "COPY",
  "LOOP",
  "MUTE",
  "DRUMS",
  "VOCAL",
  "FX",
  "TRANSITION",
  "REFERENCE",
  "FREE NOTE",
  "VARIATION",
  "ARRANGEMENT",
] as const;
const range = z
  .object({
    barStart: z.number().int().positive(),
    barEnd: z.number().int().positive(),
  })
  .refine((r) => r.barEnd >= r.barStart, "Invalid bar range");
export const annotationSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(tags),
    barStart: z.number().int().positive(),
    barEnd: z.number().int().positive(),
    instruction: z.string(),
    referenceName: z.string(),
    referenceIds: z.array(z.string()),
  })
  .refine((r) => r.barEnd >= r.barStart);
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    appVersion: z.string(),
    id: z.string().min(1),
    name: z.string().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
    bpm: z.number().min(20).max(400),
    timeSignature: z.object({
      numerator: z.number().int().min(1).max(32),
      denominator: z
        .number()
        .int()
        .refine((n) => [2, 4, 8, 16].includes(n)),
    }),
    source: z
      .object({
        name: z.string(),
        size: z.number().nonnegative(),
        type: z.string(),
        duration: z.number().positive(),
      })
      .nullable(),
    annotations: z.array(annotationSchema),
    globalRules: z.string(),
  })
  .superRefine((p, c) => {
    const ids = new Set(p.annotations.map((a) => a.id));
    if (ids.size !== p.annotations.length)
      c.addIssue({ code: "custom", message: "Duplicate annotation IDs" });
    const names = p.annotations.map((a) => a.referenceName).filter(Boolean);
    if (new Set(names).size !== names.length)
      c.addIssue({ code: "custom", message: "Duplicate reference names" });
    const refs = new Set(
      p.annotations.filter((a) => a.referenceName).map((a) => a.id),
    );
    for (const a of p.annotations) {
      if (a.referenceIds.some((id) => !refs.has(id)))
        c.addIssue({ code: "custom", message: "Missing reference" });
      if (
        p.source &&
        a.barEnd >
          Math.ceil(p.source.duration / barDuration(p.bpm, p.timeSignature))
      )
        c.addIssue({ code: "custom", message: "Region outside audio" });
    }
  });
export type Project = z.infer<typeof projectSchema>;
export type Annotation = z.infer<typeof annotationSchema>;
export type Range = z.infer<typeof range>;
export function barDuration(bpm: number, signature: Project["timeSignature"]) {
  return ((60 / bpm) * signature.numerator * 4) / signature.denominator;
}
export function timestamps(p: Project, r: Range) {
  range.parse(r);
  const d = barDuration(p.bpm, p.timeSignature);
  return {
    startSeconds: (r.barStart - 1) * d,
    endSeconds: Math.min(r.barEnd * d, p.source?.duration ?? Infinity),
  };
}
export function selectedRange(a: number, b: number, max: number): Range {
  return {
    barStart: Math.max(1, Math.min(max, Math.min(a, b))),
    barEnd: Math.max(1, Math.min(max, Math.max(a, b))),
  };
}
export function newProject(name = "Nouveau projet"): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    appVersion: VERSION,
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    bpm: 130,
    timeSignature: { numerator: 4, denominator: 4 },
    source: null,
    annotations: [],
    globalRules: "",
  };
}
export function migrate(input: unknown): Project {
  return projectSchema.parse(input);
}
export function editPlan(p: Project) {
  projectSchema.parse(p);
  const ordered = [...p.annotations].sort(
    (a, b) =>
      a.barStart - b.barStart ||
      a.barEnd - b.barEnd ||
      a.id.localeCompare(b.id),
  );
  return {
    schemaVersion: "1.0",
    app: "NooFu Arranger",
    appVersion: VERSION,
    project: {
      name: p.name,
      sourceAudio: p.source?.name ?? null,
      durationSeconds: p.source?.duration ?? 0,
      bpm: p.bpm,
      timeSignature: p.timeSignature,
      tempoUnit: "quarter-note",
      barOriginSeconds: 0,
    },
    globalRules: p.globalRules.split("\n").filter((x) => x.trim()),
    references: ordered
      .filter((a) => a.referenceName)
      .map((a) => ({
        id: a.id,
        name: a.referenceName,
        sourceAudio: p.source?.name,
        ...{ barStart: a.barStart, barEnd: a.barEnd },
        ...timestamps(p, a),
      })),
    annotations: ordered.map((a) => ({
      ...a,
      ...timestamps(p, a),
      references: a.referenceIds.map(
        (id) => p.annotations.find((x) => x.id === id)?.referenceName,
      ),
      scope: "region",
      status: "pending",
    })),
    recurringRules: [],
  };
}
export function instructions(p: Project) {
  const e = editPlan(p);
  return `# NooFu Arranger Edit Plan\n\nSource: ${e.project.sourceAudio}\nTempo: ${p.bpm} BPM (quarter-note)\nTime signature: ${p.timeSignature.numerator}/${p.timeSignature.denominator}\n\nBar numbers are 1-based and inclusive; timestamps are authoritative, end-exclusive. The last bar may be truncated by the audio end. These notes are instructions, not edits already applied. Preserve everything not requested to change.\n\n## References\n${e.references.map((r) => `\n### ${r.name}\nBars ${r.barStart}–${r.barEnd}; ${r.startSeconds.toFixed(6)} → ${r.endSeconds.toFixed(6)} seconds. ID: ${r.id}\n`).join("")}\n## Region instructions\n${e.annotations.map((a) => `\n### ${a.type}: bars ${a.barStart}–${a.barEnd}\nTime: ${a.startSeconds.toFixed(6)} → ${a.endSeconds.toFixed(6)} seconds\nReferences: ${a.references.join(", ") || "none"}\n\n${a.instruction}\n`).join("")}\n## Global rules\n${e.globalRules.map((r) => `- ${r}`).join("\n")}\n`;
}
export const handoff =
  "Open the attached NooFu Arranger edit package. Read CODEX_INSTRUCTIONS.md and edit_plan.json. Use the selected source regions as authoritative musical references. Apply every pending annotation and global rule. Exact source timestamps are provided; do not reinterpret bar locations manually. Create the next version while preserving anything not requested to change. If source audio is not included, ask for the source file named in the plan.";
