const help: Record<string, string> = {
  "+ NEW PROJECT":
    "Crée un nouveau projet local. Donnez-lui un titre, puis importez votre fichier audio. Vos autres projets sont conservés.",
  "IMPORT AUDIO":
    "Ouvre le sélecteur de fichiers pour charger un WAV, MP3 ou un autre audio compatible. Le fichier reste sur votre appareil. Remplacer un audio déjà annoté demande confirmation.",
  "IMPORT PROJECT":
    "Charge une sauvegarde project.json et crée un projet distinct. Réimportez ensuite le même audio pour retrouver l’écoute ; les notes sont conservées.",
  "EXPORT PROJECT":
    "Télécharge project.json avec le titre, la grille, les notes, références et règles. Cette sauvegarde ne contient pas l’audio : gardez aussi le fichier source.",
  "EXPORT FOR CODEX":
    "Télécharge un ZIP contenant le projet, edit_plan.json et CODEX_INSTRUCTIONS.md. Les mesures sélectionnées y deviennent des temps précis que Codex peut utiliser pour créer une nouvelle version.",
  "COPY CODEX PROMPT":
    "Copie une consigne prête à coller dans Codex. Joignez aussi le ZIP exporté et le fichier audio s’il n’est pas inclus.",
  PLAY: "Lance ou reprend la lecture depuis le curseur. Ne modifie pas le son.",
  PAUSE: "Met la lecture en pause et garde le curseur à sa position.",
  "PLAY SELECTION":
    "Écoute seulement les mesures sélectionnées, puis s’arrête à leur fin. Activez Boucler la sélection pour répéter cette région.",
  "Boucler la sélection":
    "Répète les mesures sélectionnées pendant la lecture. Choisissez d’abord une région, cochez cette option, puis appuyez sur PLAY SELECTION.",
  "Suivre la lecture":
    "Fait défiler la timeline pour garder le curseur de lecture visible. Décochez cette option pour examiner librement une autre région pendant l’écoute.",
  Dézoomer:
    "Affiche davantage de mesures en réduisant la largeur de la timeline. Vous pouvez aussi rapprocher deux doigts sur la règle numérotée.",
  Zoomer:
    "Agrandit les mesures pour les examiner plus précisément. Vous pouvez aussi écarter deux doigts sur la règle numérotée.",
  "Vue complète":
    "Affiche le morceau entier dans la largeur de l’écran et revient au début de la vue. La lecture et la sélection restent à leur emplacement.",
  BPM: "Saisissez le tempo en battements de noire par minute, puis utilisez Appliquer BPM ou Entrée. La grille est recalculée ; le fichier audio n’est pas accéléré ni ralenti.",
  "Appliquer BPM":
    "Valide le tempo saisi entre 20 et 400 BPM. Avec des annotations existantes, une confirmation prévient que leurs temps vont être recalculés.",
  Mesure:
    "Choisit la signature rythmique : 4/4, 3/4 ou 6/8. La grille suit cette signature ; en 6/8, le BPM reste exprimé en noires.",
  "Mesure début":
    "Première mesure de la sélection, numérotée à partir de 1. Vous pouvez effacer le champ pour réécrire ; validez ensuite les deux limites avec Appliquer la plage.",
  "Mesure fin":
    "Dernière mesure de la sélection, incluse. Elle doit être supérieure ou égale au début et rester dans le morceau. Validez ensuite avec Appliquer la plage.",
  "Appliquer la plage":
    "Valide ensemble les champs Début et Fin, puis déplace la sélection sur ces mesures. Cela ne coupe ni ne transforme l’audio.",
  "+ ANNOTATION":
    "Crée une note attachée à la sélection et ouvre son éditeur. Choisissez un type, écrivez votre instruction et éventuellement nommez une référence. Tout est enregistré localement.",
  "Effacer sélection":
    "Retire la sélection visuelle. Les annotations déjà créées et le fichier audio sont conservés.",
  "Nom du projet":
    "Renomme ce projet local. Effacez et réécrivez le titre, puis appuyez sur Entrée ou quittez le champ pour enregistrer.",
  "Nom de référence":
    "Donne un nom unique à cette région, par exemple GROOVE_A. Ce nom permet de réutiliser la région exacte comme référence dans d’autres instructions.",
  Instruction:
    "Écrivez librement ce que Codex devra changer dans cette région et ce qu’il doit conserver. La note est sauvegardée automatiquement ; l’application ne réalise pas la transformation.",
  "Règles globales":
    "Instructions pour le morceau entier, une par ligne. Par exemple : conserver toutes les voix. Elles sont ajoutées au paquet Codex.",
  "Position de lecture":
    "Déplace le curseur dans l’audio. Vous pouvez aussi toucher un point de la règle grise numérotée.",
  "↶ Undo":
    "Annule la dernière modification du projet ou d’une annotation dans cette session. Les fichiers audio ne sont pas modifiés.",
  "↷ Redo":
    "Rétablit une modification annulée avec Undo, tant qu’aucune nouvelle modification n’a remplacé cet historique.",
  Dupliquer:
    "Crée une deuxième annotation avec les mêmes limites, type et instruction. Le nom de référence n’est pas dupliqué pour éviter les doublons.",
  Supprimer:
    "Supprime cette annotation et ses liens structurés de référence. L’audio reste intact ; Undo permet de revenir sur la suppression pendant la session.",
  "Appliquer la sélection":
    "Remplace les limites de cette annotation par la région actuellement sélectionnée sur l’onde.",
  Insérer:
    "Ajoute le nom de cette référence dans votre instruction et crée le lien structuré vers sa région audio exacte.",
  "Terminé ×":
    "Ferme l’éditeur. Les notes sont enregistrées automatiquement pendant la saisie ; aucun bouton Sauvegarder n’est nécessaire.",
  Fermer: "Ferme le message affiché.",
};
const tags: Record<string, string> = {
  CUT: "demander une coupe",
  MOVE: "demander un déplacement",
  COPY: "demander une copie",
  LOOP: "demander une répétition dans la future version",
  MUTE: "demander de rendre un élément muet",
  DRUMS: "donner une instruction sur la batterie",
  VOCAL: "donner une instruction sur les voix",
  FX: "demander un effet ou un traitement",
  TRANSITION: "décrire une transition",
  REFERENCE: "signaler une région de référence",
  "FREE NOTE": "écrire une instruction libre",
  VARIATION: "décrire une variation",
  ARRANGEMENT: "décrire la structure du morceau",
};
export function helpFor(control: Element): { title: string; text: string } {
  if (control.matches("select"))
    return { title: "Mesure", text: help["Mesure"] };
  const label =
    control.getAttribute("aria-label") ||
    control.textContent?.trim().replace(/\s+/g, " ") ||
    control.closest("label")?.textContent?.trim() ||
    "Commande";
  if (control.classList.contains("ruler"))
    return {
      title: "Règle des mesures",
      text: "Un appui place le curseur de lecture à cet endroit. Glissez avec un doigt pour défiler. Rapprochez deux doigts pour dézoomer, écartez-les pour zoomer. Ces gestes ne changent pas la sélection.",
    };
  if (control.classList.contains("selection-surface"))
    return {
      title: "Sélection sur la forme d’onde",
      text: "Touchez une mesure ou glissez sur plusieurs pour sélectionner une région. La sélection se cale sur les limites des mesures. PLAY SELECTION l’écoute ; + ANNOTATION y attache une instruction.",
    };
  if (control.closest(".tags"))
    return {
      title: label,
      text: `Ce type sert à ${tags[label] ?? "classer votre instruction"}. C’est une étiquette pour Codex : aucune modification sonore n’est appliquée ici.`,
    };
  if (
    control.closest(".annotation-lanes") ||
    (control.matches("button") &&
      control
        .closest("details")
        ?.querySelector("summary")
        ?.textContent?.startsWith("REFERENCES"))
  )
    return {
      title: label,
      text: "Ouvre cette région dans l’éditeur pour consulter ou modifier sa note et son nom de référence. La sélection se place sur les mesures correspondantes.",
    };
  if (control.matches("summary"))
    return {
      title: label,
      text: label.startsWith("GLOBAL")
        ? help["Règles globales"]
        : "Affiche les régions que vous avez nommées comme références. Touchez un nom pour retrouver ses mesures et son instruction.",
    };
  if (control.closest(".projects"))
    return {
      title: label,
      text: label.startsWith("Supprimer")
        ? "Supprime ce projet et son audio local après confirmation. Exportez une sauvegarde auparavant."
        : "Ouvre ce projet avec son audio, sa grille, ses annotations et ses références sauvegardées localement.",
    };
  if (control.closest(".reference-links") && control.matches("input"))
    return {
      title: "Lier une référence",
      text: "Cochez pour relier cette instruction à la région nommée. Le lien utilise un identifiant stable, conservé même si vous renommez la référence.",
    };
  if (control.matches("input[type=checkbox]") && label.includes("INCLUDE"))
    return {
      title: "Inclure l’audio source",
      text: "Ajoute le fichier audio au ZIP Codex, seulement si vous le cochez. Désactivé par défaut pour alléger l’export. Maximum 100 Mo ; au-delà, joignez l’audio séparément.",
    };
  if (/^(1|2|4|8|16) BARS?$/.test(label))
    return {
      title: label,
      text: `Sélectionne ${label.split(" ")[0]} mesure(s) à partir du début de la sélection actuelle, ou de la première mesure. La plage est limitée par la fin du morceau.`,
    };
  if (label.includes("NooFu"))
    return {
      title: "Accueil projets",
      text: "Revient à la liste de vos projets locaux. Le projet actuel est enregistré avant de quitter.",
    };
  return {
    title: label,
    text:
      help[label] ??
      "Cette commande agit sur le projet ou sa note. Quittez le mode tuto pour l’utiliser.",
  };
}
