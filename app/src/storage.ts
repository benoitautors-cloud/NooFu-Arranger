import { openDB } from "idb";
import { migrate, type Project } from "./model";
const db = openDB("noofu-arranger", 1, {
  upgrade(d) {
    d.createObjectStore("projects", { keyPath: "id" });
    d.createObjectStore("audio");
  },
});
export async function listProjects() {
  const rows: unknown[] = await (await db).getAll("projects");
  return rows
    .flatMap((r) => {
      try {
        return [migrate(r)];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function saveProject(p: Project) {
  await (await db).put("projects", migrate(p));
}
export async function saveAudio(id: string, file: Blob) {
  await (await db).put("audio", file, id);
}
export async function loadAudio(id: string): Promise<Blob | undefined> {
  return (await db).get("audio", id);
}
export async function deleteProject(id: string) {
  const t = (await db).transaction(["projects", "audio"], "readwrite");
  await t.objectStore("projects").delete(id);
  await t.objectStore("audio").delete(id);
  await t.done;
}
