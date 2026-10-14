import { useEffect, useState } from "react";
export default function ProjectNameInput({
  value,
  onApply,
}: {
  value: string;
  onApply: (name: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  function apply() {
    const name = draft.trim();
    if (!name) {
      setDraft(value);
      return;
    }
    if (name !== value) onApply(name);
  }
  return (
    <input
      aria-label="Nom du projet"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={apply}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setDraft(value);
        }
      }}
    />
  );
}
