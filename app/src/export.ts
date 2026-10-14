import { zipSync, strToU8 } from "fflate";
import { editPlan, instructions, type Project } from "./model";
import { loadAudio } from "./storage";
export function download(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 30000);
}
export async function exportZip(p: Project, include: boolean) {
  const files: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify(p, null, 2)),
    "edit_plan.json": strToU8(JSON.stringify(editPlan(p), null, 2)),
    "CODEX_INSTRUCTIONS.md": strToU8(instructions(p)),
  };
  if (include) {
    const audio = await loadAudio(p.id);
    if (!audio) throw new Error("Audio absent : réimportez le fichier source.");
    if (audio.size > 100 * 1024 * 1024)
      throw new Error(
        "Audio supérieur à 100 Mo : exportez sans audio et joignez le fichier séparément.",
      );
    files[
      "audio/" + (p.source?.name ?? "source.audio").replace(/[\\/]/g, "_")
    ] = new Uint8Array(await audio.arrayBuffer());
  }
  const bytes = zipSync(files, { level: 0 });
  download(
    new Blob([bytes.slice().buffer], { type: "application/zip" }),
    "noofu-arranger-project.zip",
  );
}
