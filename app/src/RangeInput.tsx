import { useEffect, useState } from "react";
import type { Range } from "./model";
export default function RangeInput({
  value,
  max,
  onApply,
}: {
  value: Range;
  max: number;
  onApply: (range: Range) => void;
}) {
  const [start, setStart] = useState(String(value.barStart));
  const [end, setEnd] = useState(String(value.barEnd));
  const [error, setError] = useState("");
  useEffect(() => {
    setStart(String(value.barStart));
    setEnd(String(value.barEnd));
    setError("");
  }, [value.barStart, value.barEnd]);
  function apply() {
    const first = Number(start),
      last = Number(end);
    if (
      !/^\d+$/.test(start.trim()) ||
      !/^\d+$/.test(end.trim()) ||
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(last) ||
      first < 1 ||
      last < first ||
      last > max
    ) {
      setError(
        `Choisissez des mesures entières entre 1 et ${max}, avec Fin supérieure ou égale à Début.`,
      );
      return false;
    }
    onApply({ barStart: first, barEnd: last });
    setStart(String(first));
    setEnd(String(last));
    setError("");
    return true;
  }
  function key(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (apply()) e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      setStart(String(value.barStart));
      setEnd(String(value.barEnd));
      setError("");
    }
  }
  return (
    <div>
      <div className="toolbar">
        <label>
          Début
          <input
            aria-label="Mesure début"
            style={{ width: 85 }}
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setError("");
            }}
            onKeyDown={key}
          />
        </label>
        <label>
          Fin
          <input
            aria-label="Mesure fin"
            style={{ width: 85 }}
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setError("");
            }}
            onKeyDown={key}
          />
        </label>
        <button disabled={max < 1} onClick={apply}>
          Appliquer la plage
        </button>
      </div>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
