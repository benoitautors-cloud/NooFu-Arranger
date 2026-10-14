import { useEffect, useState } from "react";

export default function BpmInput({
  value,
  onApply,
}: {
  value: number;
  onApply: (bpm: number) => boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(String(value));
    setError("");
  }, [value]);
  function apply() {
    const next = Number(draft.trim().replace(",", "."));
    if (!draft.trim() || !Number.isFinite(next) || next < 20 || next > 400) {
      setError("Saisissez un BPM entre 20 et 400.");
      return false;
    }
    if (next !== value && !onApply(next)) {
      setDraft(String(value));
      return false;
    }
    setDraft(String(next));
    setError("");
    return true;
  }
  return (
    <div>
      <div className="toolbar">
        <label>
          BPM
          <input
            aria-label="BPM"
            aria-invalid={!!error}
            aria-describedby={error ? "bpm-error" : undefined}
            style={{ width: 85 }}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (apply()) e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setDraft(String(value));
                setError("");
              }
            }}
          />
        </label>
        <button onClick={apply} disabled={draft === String(value)}>
          Appliquer BPM
        </button>
      </div>
      {error && (
        <small id="bpm-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
