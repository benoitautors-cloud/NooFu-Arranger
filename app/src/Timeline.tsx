import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import {
  barDuration,
  selectedRange,
  timestamps,
  type Project,
  type Range,
} from "./model";
type Props = {
  project: Project;
  audio: Blob;
  selection: Range | null;
  onSelect: (r: Range) => void;
  onReady: (duration: number) => void;
  onError: (s: string) => void;
  onAnnotation: (id: string) => void;
};
export default function Timeline({
  project: p,
  audio,
  selection,
  onSelect,
  onReady,
  onError,
  onAnnotation,
}: Props) {
  const wave = useRef<HTMLDivElement>(null),
    ws = useRef<WaveSurfer | null>(null),
    selectionRef = useRef(selection),
    callbacks = useRef({ onReady, onError });
  const [seconds, setSeconds] = useState(0),
    [playing, setPlaying] = useState(false),
    [zoom, setZoom] = useState(50),
    [loop, setLoop] = useState(false),
    [loading, setLoading] = useState(true),
    [duration, setDuration] = useState(p.source?.duration ?? 0);
  const loopRef = useRef(loop),
    audition = useRef(false),
    anchor = useRef<number | null>(null);
  selectionRef.current = selection;
  loopRef.current = loop;
  callbacks.current = { onReady, onError };
  const span = barDuration(p.bpm, p.timeSignature),
    bars = Math.max(1, Math.ceil(duration / span)),
    width = Math.max(320, duration * zoom),
    barWidth = span * zoom;
  const pRef = useRef(p);
  pRef.current = p;
  useEffect(() => {
    if (!wave.current) return;
    const url = URL.createObjectURL(audio);
    const w = WaveSurfer.create({
      container: wave.current,
      waveColor: "#7a9188",
      progressColor: "#b9f96d",
      cursorColor: "#fff",
      height: 160,
      interact: false,
      autoScroll: false,
      autoCenter: false,
      normalize: false,
    });
    ws.current = w;
    setLoading(true);
    w.on("ready", (d) => {
      setDuration(d);
      setLoading(false);
      callbacks.current.onReady(d);
    });
    w.on("play", () => setPlaying(true));
    w.on("pause", () => setPlaying(false));
    w.on("timeupdate", (t) => {
      setSeconds(t);
      const r = selectionRef.current;
      if (r && (loopRef.current || audition.current)) {
        const time = timestamps(pRef.current, r);
        if (t >= time.endSeconds - 0.015) {
          if (loopRef.current) w.setTime(time.startSeconds);
          else {
            w.pause();
            w.setTime(time.endSeconds);
            audition.current = false;
          }
        }
      }
    });
    w.on("finish", () => {
      if (loopRef.current && selectionRef.current) {
        w.setTime(timestamps(pRef.current, selectionRef.current).startSeconds);
        void w.play();
      }
    });
    w.on("error", (e) => {
      setLoading(false);
      callbacks.current.onError("Décodage audio impossible : " + e.message);
    });
    void w.load(url).catch(() => {});
    return () => {
      w.destroy();
      ws.current = null;
      URL.revokeObjectURL(url);
    };
  }, [audio]);
  function barAt(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(
      1,
      Math.min(bars, Math.floor((e.clientX - rect.left) / barWidth) + 1),
    );
  }
  function playSelection() {
    if (!selection) return;
    const t = timestamps(p, selection);
    audition.current = true;
    ws.current?.setTime(t.startSeconds);
    void ws.current?.play();
  }
  return (
    <section className="audio-tool" aria-label="Timeline audio">
      <div className="timeline-scroll">
        <div className="timeline-content" style={{ width }}>
          <div className="ruler">
            {Array.from({ length: bars }, (_, i) => (
              <div key={i} style={{ left: i * barWidth, width: barWidth }}>
                <b>{i + 1}</b>
                {barWidth > 100 &&
                  Array.from({ length: p.timeSignature.numerator }, (_, j) => (
                    <small
                      key={j}
                      style={{
                        left: (j * barWidth) / p.timeSignature.numerator,
                      }}
                    >
                      {i + 1}.{j + 1}
                    </small>
                  ))}
              </div>
            ))}
          </div>
          <div className="wave" ref={wave} />
          <div
            className="selection-surface"
            aria-label="Glisser pour sélectionner des mesures"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              anchor.current = barAt(e);
              onSelect(selectedRange(anchor.current, anchor.current, bars));
            }}
            onPointerMove={(e) => {
              if (anchor.current !== null)
                onSelect(selectedRange(anchor.current, barAt(e), bars));
            }}
            onPointerUp={() => (anchor.current = null)}
            onPointerCancel={() => (anchor.current = null)}
            style={{ backgroundSize: `${barWidth}px 100%` }}
          >
            {selection && (
              <div
                className="selected"
                style={{
                  left: (selection.barStart - 1) * barWidth,
                  width: (selection.barEnd - selection.barStart + 1) * barWidth,
                }}
              >
                Mesures {selection.barStart}–{selection.barEnd}
              </div>
            )}
          </div>
          <div
            className="annotation-lanes"
            style={{ height: Math.max(40, p.annotations.length * 36) }}
          >
            {p.annotations.map((a, i) => (
              <button
                key={a.id}
                style={{
                  left: (a.barStart - 1) * barWidth,
                  width: Math.max(44, (a.barEnd - a.barStart + 1) * barWidth),
                  top: i * 36,
                }}
                onClick={() => onAnnotation(a.id)}
                title={a.instruction}
              >
                {a.referenceName || a.type}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading && (
        <p role="status">
          Décodage de la forme d’onde… Les longs fichiers peuvent prendre un
          moment.
        </p>
      )}
      <div className="transport">
        <button
          disabled={loading}
          onClick={() => {
            audition.current = false;
            void ws.current?.playPause();
          }}
        >
          {playing ? "PAUSE" : "PLAY"}
        </button>
        <button disabled={!selection || loading} onClick={playSelection}>
          PLAY SELECTION
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />
          Boucle
        </label>
        <output>
          {seconds.toFixed(1)} / {duration.toFixed(1)} s
        </output>
      </div>
      <input
        aria-label="Position de lecture"
        type="range"
        min={0}
        max={duration || 1}
        step="0.01"
        value={seconds}
        onChange={(e) => {
          audition.current = false;
          ws.current?.setTime(Number(e.target.value));
        }}
      />
      <div className="zoom">
        <button onClick={() => setZoom(Math.max(2, zoom / 1.5))}>−</button>
        <button onClick={() => setZoom(Math.min(400, zoom * 1.5))}>+</button>
        <button
          onClick={() =>
            setZoom(Math.max(0.5, (window.innerWidth - 32) / (duration || 1)))
          }
        >
          FIT
        </button>
        <span>Glisser sur l’onde pour sélectionner · défiler sur la règle</span>
      </div>
    </section>
  );
}
