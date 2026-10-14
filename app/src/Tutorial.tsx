import { useEffect, useState } from "react";
import { helpFor } from "./tutorialHelp";
export default function Tutorial() {
  const [enabled, setEnabled] = useState(false),
    [help, setHelp] = useState<{ title: string; text: string } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    function explain(event: Event) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest("[data-tutorial-ui]")) return;
      const control = target.closest(
        "button,input:not([type=file]),select,textarea,summary,.ruler,.selection-surface",
      );
      if (!control) return;
      if (
        event instanceof KeyboardEvent &&
        ![
          "Enter",
          " ",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(event.key)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setHelp(helpFor(control));
    }
    for (const name of ["pointerdown", "click", "keydown"])
      document.addEventListener(name, explain, {
        capture: true,
        passive: false,
      });
    return () => {
      for (const name of ["pointerdown", "click", "keydown"])
        document.removeEventListener(name, explain, true);
    };
  }, [enabled]);
  function toggle() {
    setEnabled(!enabled);
    setHelp(
      !enabled
        ? {
            title: "Mode tuto activé",
            text: "Touchez un bouton, un champ ou la timeline pour découvrir son rôle. Aucune action n’est exécutée pendant le tuto. Choisissez Quitter le tuto pour travailler normalement.",
          }
        : null,
    );
  }
  return (
    <>
      <button
        data-tutorial-ui
        aria-pressed={enabled}
        className={enabled ? "active tutorial-toggle" : "tutorial-toggle"}
        onClick={toggle}
      >
        {enabled ? "Quitter le tuto" : "Mode tuto"}
      </button>
      {enabled && help && (
        <aside
          data-tutorial-ui
          className="tutorial-panel"
          aria-label="Aide du mode tuto"
        >
          <div role="status" aria-live="polite">
            <strong>{help.title}</strong>
            <p>{help.text}</p>
          </div>
          <div className="toolbar">
            <button onClick={() => setHelp(null)}>Compris</button>
            <button onClick={toggle}>Quitter le tuto</button>
          </div>
        </aside>
      )}
    </>
  );
}
