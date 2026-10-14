import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const viewport = useRef<HTMLDivElement>(null),
    wave = useRef<HTMLDivElement>(null),
    ws = useRef<WaveSurfer | null>(null),
    selectionRef = useRef(selection),
    callbacks = useRef({ onReady, onError });
  const [seconds, setSeconds] = useState(0),
    [playing, setPlaying] = useState(false),
    [zoom, setZoom] = useState(50),
    [followPlayback, setFollowPlayback] = useState(true),
    [loop, setLoop] = useState(false),
    [loading, setLoading] = useState(true),
    [duration, setDuration] = useState(p.source?.duration ?? 0);
  const followRef = useRef(followPlayback),
    zoomRef = useRef(zoom),
    loopRef = useRef(loop),
    audition = useRef(false),
    anchor = useRef<number | null>(null);
  selectionRef.current = selection;
  loopRef.current = loop;
  followRef.current = followPlayback;
  zoomRef.current = zoom;
  callbacks.current = { onReady, onError };
  const resizing = useRef<{ side: "start" | "end"; range: Range } | null>(null);
  const span = barDuration(p.bpm, p.timeSignature),
    bars = Math.max(1, Math.ceil(duration / span)),
    width = Math.max(1, duration * zoom),
    barWidth = span * zoom;
  const rulerTouches = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number; time: number } | null>(
    null,
  );
  const tap = useRef<{ id: number; x: number; y: number } | null>(null);
  const pan = useRef<{ x: number; left: number } | null>(null);
  const zoomAnchor = useRef<{ time: number; x: number } | null>(null);
  useLayoutEffect(() => {
    if (zoomAnchor.current && viewport.current) {
      viewport.current.scrollLeft =
        zoomAnchor.current.time * zoom - zoomAnchor.current.x;
      zoomAnchor.current = null;
    }
  }, [zoom]);
  function beginRulerGesture() {
    const points = [...rulerTouches.current.values()],
      view = viewport.current;
    if (!view) return;
    if (points.length === 2) {
      const middle =
        (points[0].x + points[1].x) / 2 - view.getBoundingClientRect().left;
      pinch.current = {
        distance: Math.max(
          1,
          Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        ),
        zoom: zoomRef.current,
        time: (view.scrollLeft + middle) / zoomRef.current,
      };
      pan.current = null;
    } else if (points.length === 1) {
      pinch.current = null;
      pan.current = { x: points[0].x, left: view.scrollLeft };
    } else {
      pinch.current = null;
      pan.current = null;
    }
  }
  function rulerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    rulerTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    tap.current =
      rulerTouches.current.size === 1
        ? { id: e.pointerId, x: e.clientX, y: e.clientY }
        : null;
    beginRulerGesture();
  }
  function rulerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!rulerTouches.current.has(e.pointerId) || !viewport.current) return;
    rulerTouches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (
      tap.current &&
      Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 6
    )
      tap.current = null;
    const points = [...rulerTouches.current.values()];
    if (points.length >= 2 && pinch.current) {
      const distance = Math.hypot(
        points[1].x - points[0].x,
        points[1].y - points[0].y,
      );
      const middle =
        (points[0].x + points[1].x) / 2 -
        viewport.current.getBoundingClientRect().left;
      const next = Math.max(
        viewport.current.clientWidth / (duration || 1),
        Math.min(400, (pinch.current.zoom * distance) / pinch.current.distance),
      );
      zoomAnchor.current = { time: pinch.current.time, x: middle };
      setZoom(next);
    } else if (points.length === 1 && pan.current) {
      viewport.current.scrollLeft =
        pan.current.left - (e.clientX - pan.current.x);
    }
  }
  function rulerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (
      e.type === "pointerup" &&
      tap.current?.id === e.pointerId &&
      viewport.current
    ) {
      const time = Math.max(
        0,
        Math.min(
          duration,
          (viewport.current.scrollLeft +
            e.clientX -
            viewport.current.getBoundingClientRect().left) /
            zoomRef.current,
        ),
      );
      audition.current = false;
      const region = selectionRef.current;
      if (region) {
        const bounds = timestamps(pRef.current, region);
        if (time < bounds.startSeconds || time >= bounds.endSeconds) {
          setLoop(false);
          loopRef.current = false;
        }
      }
      ws.current?.setTime(time);
    }
    tap.current = null;
    if (rulerTouches.current.delete(e.pointerId)) beginRulerGesture();
  }
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
      const view = viewport.current;
      if (
        view &&
        followRef.current &&
        w.isPlaying() &&
        anchor.current === null &&
        rulerTouches.current.size === 0
      ) {
        const cursor = t * zoomRef.current;
        if (
          cursor < view.scrollLeft ||
          cursor > view.scrollLeft + view.clientWidth * 0.8
        ) {
          view.scrollLeft = Math.max(0, cursor - view.clientWidth * 0.2);
        }
      }
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
      <div className="zoom">
        <button
          aria-label="Dézoomer"
          onClick={() => setZoom(Math.max(0.05, zoom / 1.5))}
        >
          − Dézoomer
        </button>
        <button
          aria-label="Zoomer"
          onClick={() => setZoom(Math.min(400, zoom * 1.5))}
        >
          + Zoomer
        </button>
        <button
          onClick={() => {
            const width =
              viewport.current?.clientWidth ?? window.innerWidth - 32;
            setZoom(width / (duration || 1));
            if (viewport.current) viewport.current.scrollLeft = 0;
          }}
        >
          Vue complète
        </button>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={followPlayback}
          onChange={(e) => setFollowPlayback(e.target.checked)}
        />
        Suivre la lecture
      </label>
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
            aria-label="Boucler la sélection"
            disabled={!selection}
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
          />
          Boucler la sélection
        </label>
        <output>
          {seconds.toFixed(1)} / {duration.toFixed(1)} s
        </output>
      </div>
      <small>
        Appui sur la règle : déplacer la lecture. Deux doigts : zoomer /
        dézoomer.
      </small>
      <div className="timeline-scroll" ref={viewport}>
        <div className="timeline-content" style={{ width }}>
          <div
            className="ruler"
            aria-label="Règle des mesures : zoom à deux doigts"
            onPointerDown={rulerDown}
            onPointerMove={rulerMove}
            onPointerUp={rulerUp}
            onPointerCancel={rulerUp}
            onLostPointerCapture={rulerUp}
          >
            {Array.from({ length: bars }, (_, i) => (
              <div key={i} style={{ left: i * barWidth, width: barWidth }}>
                <b>
                  {i % Math.max(1, Math.ceil(44 / barWidth)) === 0 ? i + 1 : ""}
                </b>
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
              const handle =
                e.target instanceof Element
                  ? e.target.closest("[data-selection-edge]")
                  : null;
              const side = handle?.getAttribute("data-selection-edge");
              if (selection && (side === "start" || side === "end")) {
                resizing.current = { side, range: { ...selection } };
                anchor.current = barAt(e);
                return;
              }
              const bar = barAt(e);
              if (
                selection &&
                bar >= selection.barStart &&
                bar <= selection.barEnd
              ) {
                anchor.current = null;
                return;
              }
              resizing.current = null;
              anchor.current = bar;
              onSelect(selectedRange(bar, bar, bars));
            }}
            onPointerMove={(e) => {
              const drag = resizing.current;
              if (drag) {
                const bar = barAt(e);
                onSelect(
                  drag.side === "start"
                    ? {
                        barStart: Math.min(bar, drag.range.barEnd),
                        barEnd: drag.range.barEnd,
                      }
                    : {
                        barStart: drag.range.barStart,
                        barEnd: Math.max(bar, drag.range.barStart),
                      },
                );
              } else if (anchor.current !== null)
                onSelect(selectedRange(anchor.current, barAt(e), bars));
            }}
            onPointerUp={() => {
              anchor.current = null;
              resizing.current = null;
            }}
            onPointerCancel={() => {
              anchor.current = null;
              resizing.current = null;
            }}
            style={{ backgroundSize: `${barWidth}px 100%` }}
          >
            {selection && (
              <div
                className={`selected ${(selection.barEnd - selection.barStart + 1) * barWidth < 88 ? "compact" : ""}`}
                style={{
                  left: (selection.barStart - 1) * barWidth,
                  width: (selection.barEnd - selection.barStart + 1) * barWidth,
                }}
              >
                <span className="selection-caption">
                  Mesures {selection.barStart}–{selection.barEnd}
                </span>
                <button
                  className="selection-handle start"
                  data-selection-edge="start"
                  aria-label="Ajuster le début de la sélection"
                  title="Glisser pour déplacer le début"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                      e.preventDefault();
                      onSelect({
                        ...selection,
                        barStart: Math.max(
                          1,
                          Math.min(
                            selection.barEnd,
                            selection.barStart +
                              (e.key === "ArrowRight" ? 1 : -1),
                          ),
                        ),
                      });
                    }
                  }}
                >
                  <span>↔</span>
                </button>
                <button
                  className="selection-handle end"
                  data-selection-edge="end"
                  aria-label="Ajuster la fin de la sélection"
                  title="Glisser pour déplacer la fin"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                      e.preventDefault();
                      onSelect({
                        ...selection,
                        barEnd: Math.max(
                          selection.barStart,
                          Math.min(
                            bars,
                            selection.barEnd +
                              (e.key === "ArrowRight" ? 1 : -1),
                          ),
                        ),
                      });
                    }
                  }}
                >
                  <span>↔</span>
                </button>
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
    </section>
  );
}
