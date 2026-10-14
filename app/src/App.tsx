import Tutorial from "./Tutorial";
import RangeInput from "./RangeInput";
import ProjectNameInput from "./ProjectNameInput";
import BpmInput from "./BpmInput";
import { useEffect, useRef, useState } from "react";
import Timeline from "./Timeline";
import {
  VERSION,
  tags,
  newProject,
  migrate,
  barDuration,
  handoff,
  type Project,
  type Range,
  type Annotation,
} from "./model";
import {
  listProjects,
  saveProject,
  saveAudio,
  loadAudio,
  deleteProject,
} from "./storage";
import { download, exportZip } from "./export";
export default function App() {
  const [projects, setProjects] = useState<Project[]>([]),
    [p, setP] = useState<Project | null>(null),
    [audio, setAudio] = useState<Blob>(),
    [selection, setSelection] = useState<Range | null>(null),
    [editing, setEditing] = useState<string | null>(null),
    [sheet, setSheet] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [include, setInclude] = useState(false);
  const past = useRef<Project[]>([]),
    future = useRef<Project[]>([]),
    current = useRef(p),
    queue = useRef(Promise.resolve()),
    typing = useRef<{ id: string; time: number } | null>(null);
  current.current = p;
  const fileInput = useRef<HTMLInputElement>(null),
    importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void listProjects()
      .then(setProjects)
      .catch((e) => setError(String(e)));
  }, []);
  function commit(next: Project, history = true, group?: string) {
    try {
      migrate(next);
    } catch {
      setError(
        "Cette modification placerait une région hors du fichier audio. Ajustez les régions avant de changer la grille.",
      );
      return false;
    }
    const old = current.current;
    const now = Date.now();
    if (history && old) {
      if (
        !group ||
        typing.current?.id !== group ||
        now - typing.current.time > 1000
      ) {
        past.current.push(old);
        if (past.current.length > 60) past.current.shift();
      }
      future.current = [];
    }
    typing.current = group ? { id: group, time: now } : null;
    next = {
      ...next,
      updatedAt: new Date().toISOString(),
      appVersion: VERSION,
    };
    current.current = next;
    setP(next);
    setStatus("Sauvegarde…");
    queue.current = queue.current
      .catch(() => {})
      .then(() => saveProject(next))
      .then(() => {
        setStatus("Sauvegardé localement");
      })
      .catch((e) => {
        setError("Sauvegarde impossible : " + String(e));
        setStatus("Non sauvegardé");
      });
    return true;
  }
  async function open(project: Project) {
    await queue.current;
    setAudio(undefined);
    setSelection(null);
    setEditing(null);
    setSheet(false);
    past.current = [];
    future.current = [];
    setP(project);
    current.current = project;
    setAudio(await loadAudio(project.id));
    setStatus("Sauvegardé localement");
  }
  async function home() {
    await queue.current;
    setProjects(await listProjects());
    setP(null);
    setAudio(undefined);
    setSheet(false);
  }
  function undo(redo = false) {
    const from = redo ? future : past,
      to = redo ? past : future;
    const next = from.current.pop();
    if (next && p) {
      to.current.push(p);
      commit(next, false);
    }
  }
  function select(r: Range) {
    setSelection(r);
    if (!sheet) setEditing(null);
  }
  function add() {
    if (!p || !selection) return;
    const a: Annotation = {
      id: crypto.randomUUID(),
      type: "FREE NOTE",
      ...selection,
      instruction: "",
      referenceName: "",
      referenceIds: [],
    };
    commit({ ...p, annotations: [...p.annotations, a] });
    setEditing(a.id);
    setSheet(true);
  }
  const annotation = p?.annotations.find((a) => a.id === editing);
  function updateAnnotation(changes: Partial<Annotation>, group?: string) {
    if (!p || !annotation) return;
    const next = { ...annotation, ...changes };
    if (
      next.referenceName &&
      p.annotations.some(
        (a) => a.id !== next.id && a.referenceName === next.referenceName,
      )
    ) {
      setError("Ce nom de référence existe déjà.");
      return;
    }
    commit(
      {
        ...p,
        annotations: p.annotations.map((a) => (a.id === next.id ? next : a)),
      },
      true,
      group,
    );
  }
  async function importAudio(file: File) {
    if (!p) return;
    const reattach =
      p.source?.name === file.name && p.source?.size === file.size && !audio;
    if (
      !reattach &&
      p.annotations.length &&
      !window.confirm(
        "Remplacer l’audio effacera les annotations pour éviter des références incorrectes. Continuer ?",
      )
    )
      return;
    try {
      await saveAudio(p.id, file);
      setSelection(null);
      setEditing(null);
      setSheet(false);
      if (!reattach) commit({ ...p, source: null, annotations: [] });
      pendingFile.current = reattach ? null : file;
      setAudio(file);
    } catch (e) {
      setError(String(e));
    }
  }
  const pendingFile = useRef<File | null>(null);
  function ready(duration: number) {
    const project = current.current;
    if (!project) return;
    const f = pendingFile.current;
    pendingFile.current = null;
    const sourceFile = f ?? (!project.source ? audio : undefined);
    if (sourceFile)
      commit({
        ...project,
        source: {
          name: sourceFile instanceof File ? sourceFile.name : "audio_source",
          size: sourceFile.size,
          type: sourceFile.type,
          duration,
        },
      });
  }
  async function importProject(file: File) {
    try {
      const raw = migrate(JSON.parse(await file.text()));
      const project = {
        ...raw,
        id: crypto.randomUUID(),
        name: raw.name + " (import)",
      };
      await saveProject(project);
      await open(project);
      setError("Projet importé. Réimportez son audio source pour écouter.");
    } catch (e) {
      setError("Projet invalide ou version incompatible : " + String(e));
    }
  }
  const references = p?.annotations.filter((a) => a.referenceName) ?? [];
  return (
    <>
      <header>
        <button onClick={() => void home()}>
          NooFu <span>ARRANGER</span>
        </button>
        <Tutorial />
        <small>v{VERSION}</small>
      </header>
      {error && (
        <div role="alert" className="notice">
          {error}
          <button onClick={() => setError("")}>Fermer</button>
        </div>
      )}
      <input
        hidden
        ref={importInput}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importProject(f);
          e.target.value = "";
        }}
      />
      {!p ? (
        <main>
          <h1>PROJECTS</h1>
          <p>Écouter. Sélectionner. Annoter.</p>
          <button
            className="primary"
            onClick={() => {
              const x = newProject();
              commit(x, false);
              setAudio(undefined);
            }}
          >
            + NEW PROJECT
          </button>
          <button onClick={() => importInput.current?.click()}>
            IMPORT PROJECT
          </button>
          <div className="projects">
            {projects.map((project) => (
              <article key={project.id}>
                <button onClick={() => void open(project)}>
                  <strong>{project.name}</strong>
                  <small>
                    {project.source?.name ?? "Sans audio"} ·{" "}
                    {project.annotations.length} notes
                  </small>
                </button>
                <button
                  aria-label={"Supprimer " + project.name}
                  onClick={() => {
                    if (confirm("Supprimer ce projet local et son audio ?"))
                      void deleteProject(project.id).then(() =>
                        listProjects().then(setProjects),
                      );
                  }}
                >
                  ×
                </button>
              </article>
            ))}
          </div>
          <p className="muted">
            Vos fichiers restent sur cet appareil. Exportez vos projets pour les
            sauvegarder.
          </p>
        </main>
      ) : (
        <main>
          <div className="project-heading">
            <ProjectNameInput
              key={p.id}
              value={p.name}
              onApply={(name) => commit({ ...p, name })}
            />
            <small role="status">{status}</small>
          </div>
          <div className="toolbar">
            <button
              className="primary"
              onClick={() => fileInput.current?.click()}
            >
              IMPORT AUDIO
            </button>
            <span className="filename">
              {p.source?.name ?? "WAV, MP3 ou audio compatible"}
            </span>
          </div>
          <input
            hidden
            ref={fileInput}
            type="file"
            accept="audio/*,.wav,.mp3"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importAudio(f);
              e.target.value = "";
            }}
          />
          <div className="toolbar">
            <BpmInput
              key={p.id}
              value={p.bpm}
              onApply={(v) => {
                if (
                  p.annotations.length &&
                  !confirm(
                    "Changer le tempo recalculera les temps de toutes les mesures. Continuer ?",
                  )
                )
                  return false;
                return commit({ ...p, bpm: v });
              }}
            />
            <label>
              Mesure
              <select
                value={`${p.timeSignature.numerator}/${p.timeSignature.denominator}`}
                onChange={(e) => {
                  if (
                    p.annotations.length &&
                    !confirm(
                      "Changer la signature recalculera les régions. Continuer ?",
                    )
                  )
                    return;
                  const [numerator, denominator] = e.target.value
                    .split("/")
                    .map(Number);
                  commit({ ...p, timeSignature: { numerator, denominator } });
                }}
              >
                <option>4/4</option>
                <option>3/4</option>
                <option>6/8</option>
              </select>
            </label>
            <button disabled={!past.current.length} onClick={() => undo()}>
              ↶ Undo
            </button>
            <button
              disabled={!future.current.length}
              onClick={() => undo(true)}
            >
              ↷ Redo
            </button>
          </div>
          {audio ? (
            <Timeline
              key={p.id}
              project={p}
              audio={audio}
              selection={selection}
              onSelect={select}
              onReady={ready}
              onError={setError}
              onAnnotation={(id) => {
                const a = p.annotations.find((a) => a.id === id);
                if (a) {
                  setSelection({ barStart: a.barStart, barEnd: a.barEnd });
                  setEditing(id);
                  setSheet(true);
                }
              }}
            />
          ) : (
            <div className="empty">
              Importez votre audio pour afficher la timeline.
              {p.source && (
                <p>
                  Le projet contient des notes, mais l’audio doit être
                  réimporté.
                </p>
              )}
            </div>
          )}
          <div className="selection-controls">
            <strong>
              {selection
                ? `Mesures ${selection.barStart}–${selection.barEnd}`
                : "Sélectionnez sur la forme d’onde"}
            </strong>
            <div className="toolbar">
              {[1, 2, 4, 8, 16].map((n) => (
                <button
                  key={n}
                  disabled={!p.source}
                  onClick={() => {
                    const max = Math.ceil(
                      (p.source?.duration ?? 0) /
                        barDuration(p.bpm, p.timeSignature),
                    );
                    const start = selection?.barStart ?? 1;
                    select({
                      barStart: start,
                      barEnd: Math.min(max, start + n - 1),
                    });
                  }}
                >
                  {n} BAR{n > 1 ? "S" : ""}
                </button>
              ))}
            </div>
            {selection && (
              <div className="toolbar">
                <RangeInput
                  key={p.id}
                  value={selection}
                  max={Math.ceil(
                    (p.source?.duration ?? 0) /
                      barDuration(p.bpm, p.timeSignature),
                  )}
                  onApply={select}
                />
                <button className="primary" onClick={add}>
                  + ANNOTATION
                </button>
                <button
                  onClick={() => {
                    setSelection(null);
                    setSheet(false);
                  }}
                >
                  Effacer sélection
                </button>
              </div>
            )}
          </div>
          <details>
            <summary>REFERENCES · {references.length}</summary>
            {references.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setSelection(a);
                  setEditing(a.id);
                  setSheet(true);
                }}
              >
                {a.referenceName} · {a.barStart}–{a.barEnd}
              </button>
            ))}
          </details>
          <details>
            <summary>GLOBAL RULES</summary>
            <textarea
              aria-label="Règles globales"
              placeholder="Une règle par ligne, pour tout le morceau…"
              value={p.globalRules}
              onChange={(e) =>
                commit({ ...p, globalRules: e.target.value }, true, "rules")
              }
            />
          </details>
          <section className="exports">
            <label className="check">
              <input
                type="checkbox"
                checked={include}
                onChange={(e) => setInclude(e.target.checked)}
              />
              INCLUDE SOURCE AUDIO (maximum 100 Mo)
            </label>
            <button
              className="primary"
              disabled={!p.source}
              onClick={() =>
                void exportZip(p, include).catch((e) => setError(String(e)))
              }
            >
              EXPORT FOR CODEX
            </button>
            <button
              onClick={() =>
                download(
                  new Blob([JSON.stringify(p, null, 2)], {
                    type: "application/json",
                  }),
                  "project.json",
                )
              }
            >
              EXPORT PROJECT
            </button>
            <button onClick={() => importInput.current?.click()}>
              IMPORT PROJECT
            </button>
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(handoff)
                  .then(() => setStatus("Prompt copié"))
                  .catch(() => setError(handoff))
              }
            >
              COPY CODEX PROMPT
            </button>
          </section>
        </main>
      )}
      {p && sheet && annotation && (
        <aside className="sheet" aria-label="Éditeur annotation">
          <div className="sheet-header">
            <strong>
              Mesures {annotation.barStart}–{annotation.barEnd}
            </strong>
            <button onClick={() => setSheet(false)}>Terminé ×</button>
          </div>
          <div className="tags">
            {tags.map((t) => (
              <button
                key={t}
                className={annotation.type === t ? "active" : ""}
                onClick={() => updateAnnotation({ type: t })}
              >
                {t}
              </button>
            ))}
          </div>
          <label>
            REFERENCE NAME
            <input
              aria-label="Nom de référence"
              placeholder="GROOVE_A"
              value={annotation.referenceName}
              onChange={(e) =>
                updateAnnotation(
                  { referenceName: e.target.value.trim().replace(/\s/g, "_") },
                  "reference-name",
                )
              }
            />
          </label>
          <textarea
            aria-label="Instruction"
            placeholder="Que faut-il changer dans cette région ?"
            value={annotation.instruction}
            onChange={(e) =>
              updateAnnotation({ instruction: e.target.value }, "instruction")
            }
          />
          <div className="reference-links">
            {references.map((r) => (
              <label key={r.id} className="check">
                <input
                  type="checkbox"
                  checked={annotation.referenceIds.includes(r.id)}
                  onChange={(e) =>
                    updateAnnotation({
                      referenceIds: e.target.checked
                        ? [...annotation.referenceIds, r.id]
                        : annotation.referenceIds.filter((id) => id !== r.id),
                    })
                  }
                />
                {r.referenceName}
                <button
                  onClick={() =>
                    updateAnnotation({
                      instruction:
                        annotation.instruction +
                        (annotation.instruction ? " " : "") +
                        r.referenceName,
                      referenceIds: [
                        ...new Set([...annotation.referenceIds, r.id]),
                      ],
                    })
                  }
                >
                  Insérer
                </button>
              </label>
            ))}
          </div>
          <div className="toolbar">
            <button
              onClick={() => {
                const copy = {
                  ...annotation,
                  id: crypto.randomUUID(),
                  referenceName: "",
                };
                commit({ ...p, annotations: [...p.annotations, copy] });
                setEditing(copy.id);
              }}
            >
              Dupliquer
            </button>
            <button
              onClick={() => {
                commit({
                  ...p,
                  annotations: p.annotations
                    .filter((a) => a.id !== annotation.id)
                    .map((a) => ({
                      ...a,
                      referenceIds: a.referenceIds.filter(
                        (id) => id !== annotation.id,
                      ),
                    })),
                });
                setSheet(false);
                setEditing(null);
              }}
            >
              Supprimer
            </button>
            <button
              disabled={!selection}
              onClick={() => {
                if (selection) updateAnnotation(selection);
              }}
            >
              Appliquer la sélection
            </button>
          </div>
          <small>Enregistrement automatique · audio inchangé</small>
        </aside>
      )}
    </>
  );
}
