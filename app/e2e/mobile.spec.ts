import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const scratch = join(tmpdir(), "noofu-arranger-tests");
test.beforeAll(() => {
  mkdirSync(scratch, { recursive: true });
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=220:duration=8",
    "-ar",
    "32000",
    "-ac",
    "2",
    join(scratch, "test.wav"),
  ]);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    join(scratch, "test.wav"),
    join(scratch, "test.mp3"),
  ]);
});
test("Android-sized WAV workflow, annotations, export, persistence, PWA offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.wav"));
  await expect(page.getByText("test.wav", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Décodage de la forme", { exact: false }),
  ).toBeHidden();
  await page.getByRole("button", { name: "2 BARS", exact: true }).click();
  await page.getByRole("button", { name: "PLAY SELECTION" }).click();
  await expect(
    page.getByRole("button", { name: "PAUSE", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PAUSE", exact: true }).click();
  await page.getByRole("button", { name: "+ ANNOTATION" }).click();
  await page.getByLabel("Nom de référence").fill("GROOVE_A");
  await page
    .getByLabel("Instruction", { exact: true })
    .fill("Keep this groove, only change the kick");
  await page.getByRole("button", { name: "Terminé ×" }).click();
  await expect(
    page.getByRole("button", { name: "GROOVE_A", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Règles globales")
    .evaluate((el: HTMLElement) =>
      el.closest("details")?.setAttribute("open", ""),
    );
  await page.getByLabel("Règles globales").fill("Preserve all voices");
  await expect(page.locator(".project-heading [role=status]")).toHaveText(
    "Sauvegardé localement",
  );
  const out = page.waitForEvent("download");
  await page.getByRole("button", { name: "EXPORT FOR CODEX" }).click();
  const zip = await out;
  expect(zip.suggestedFilename()).toBe("noofu-arranger-project.zip");
  await zip.saveAs(join(scratch, "export.zip"));
  await page.reload();
  await page.locator(".projects article > button:first-child").first().click();
  await expect(
    page.getByRole("button", { name: "GROOVE_A", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "GROOVE_A", exact: true }).click();
  await expect(page.getByLabel("Instruction", { exact: true })).toHaveValue(
    "Keep this groove, only change the kick",
  );
  await page.getByRole("button", { name: "Dupliquer" }).click();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(page.locator(".annotation-lanes button")).toHaveCount(2);
  await page.getByRole("button", { name: "↷ Redo" }).click();
  await expect(page.locator(".annotation-lanes button")).toHaveCount(1);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  expect(
    await page.evaluate(() => !!document.querySelector("link[rel=manifest]")),
  ).toBe(true);
  await page.reload();
  await page.waitForTimeout(300);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "PROJECTS" })).toBeVisible();
  await page.locator(".projects article > button:first-child").first().click();
  await expect(
    page.getByRole("button", { name: "GROOVE_A", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: join(scratch, "mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});
test("MP3 decoding and gesture selection", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.mp3"));
  await expect(page.getByText("test.mp3", { exact: true })).toBeVisible();
  const target = page.getByLabel("Glisser pour sélectionner des mesures");
  await target.scrollIntoViewIfNeeded();
  const rect = await target.boundingBox();
  if (!rect) throw new Error("Missing timeline");
  await page.mouse.move(rect.x + 20, rect.y + 60);
  await page.mouse.down();
  await page.mouse.move(rect.x + 200, rect.y + 60);
  await page.mouse.up();
  await expect(page.locator(".selected")).toContainText("Mesures 1–3");
  await page.getByRole("button", { name: "Effacer sélection" }).click();
  await target.scrollIntoViewIfNeeded();
  const touch = await target.boundingBox();
  if (!touch) throw new Error("Missing touch target");
  await page.touchscreen.tap(touch.x + 20, touch.y + 60);
  await expect(page.locator(".selected")).toContainText("Mesures 1–1");
  await page.setViewportSize({ width: 851, height: 393 });
  await page.screenshot({
    path: join(scratch, "landscape.png"),
    fullPage: true,
  });
});

test("BPM can be cleared and retyped on Android without intermediate grid changes", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  const bpm = page.getByLabel("BPM", { exact: true });
  await bpm.fill("");
  await expect(bpm).toHaveValue("");
  await bpm.pressSequentially("132");
  await expect(bpm).toHaveValue("132");
  await page.getByRole("button", { name: "Appliquer BPM" }).click();
  await expect(page.locator(".project-heading [role=status]")).toHaveText(
    "Sauvegardé localement",
  );
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(bpm).toHaveValue("130");
  await page.getByRole("button", { name: "↷ Redo" }).click();
  await expect(bpm).toHaveValue("132");
  await bpm.fill("1");
  await page.getByRole("button", { name: "Appliquer BPM" }).click();
  await expect(
    page.getByText("Saisissez un BPM entre 20 et 400."),
  ).toBeVisible();
  await bpm.fill("132,5");
  await bpm.press("Enter");
  await expect(bpm).toHaveValue("132.5");
  await expect(page.locator(".project-heading [role=status]")).toHaveText(
    "Sauvegardé localement",
  );
  await page.reload();
  await page.locator(".projects article > button:first-child").first().click();
  await expect(page.getByLabel("BPM", { exact: true })).toHaveValue("132.5");
});

test("title, overview zoom and selection loop remain usable on mobile", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  const title = page.getByLabel("Nom du projet");
  await title.fill("N");
  await title.press("Enter");
  await title.fill("");
  await expect(title).toHaveValue("");
  await title.fill("Entre les lumières");
  await title.press("Enter");
  await expect(title).toHaveValue("Entre les lumières");
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.wav"));
  await expect(page.getByText("test.wav", { exact: true })).toBeVisible();
  const content = page.locator(".timeline-content");
  const before = await content.evaluate((e) => e.getBoundingClientRect().width);
  await page.getByRole("button", { name: "Dézoomer", exact: true }).click();
  expect(
    await content.evaluate((e) => e.getBoundingClientRect().width),
  ).toBeLessThan(before);
  await page.getByRole("button", { name: "Vue complète" }).click();
  const widths = await page
    .locator(".timeline-scroll")
    .evaluate((e) => ({ scroll: e.scrollWidth, client: e.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  await page.getByRole("button", { name: "1 BAR", exact: true }).click();
  await page.getByLabel("Boucler la sélection").check();
  await expect(page.getByLabel("Boucler la sélection")).toBeChecked();
  await page.getByRole("button", { name: "PLAY SELECTION" }).click();
  await expect(
    page.getByRole("button", { name: "PAUSE", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(2500);
  await expect(
    page.getByRole("button", { name: "PAUSE", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PAUSE", exact: true }).click();
  await page.reload();
  await page.locator(".projects article > button:first-child").first().click();
  await expect(page.getByLabel("Nom du projet")).toHaveValue(
    "Entre les lumières",
  );
});

test("timeline follows playback and can be held still", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.wav"));
  await expect(page.getByText("test.wav", { exact: true })).toBeVisible();
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "Zoomer", exact: true }).click();
  await expect(page.getByLabel("Suivre la lecture")).toBeChecked();
  await page.getByRole("button", { name: "PLAY", exact: true }).click();
  await expect
    .poll(() => page.locator(".timeline-scroll").evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(0);
  await page.getByLabel("Suivre la lecture").uncheck();
  const held = await page
    .locator(".timeline-scroll")
    .evaluate((e) => e.scrollLeft);
  await page.waitForTimeout(400);
  expect(
    await page.locator(".timeline-scroll").evaluate((e) => e.scrollLeft),
  ).toBe(held);
  await page.getByRole("button", { name: "PAUSE", exact: true }).click();
});

test("bar limits allow clearing, crossing old boundaries and validating together", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.wav"));
  await expect(page.getByText("test.wav", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "4 BARS", exact: true }).click();
  const start = page.getByLabel("Mesure début"),
    end = page.getByLabel("Mesure fin");
  await end.fill("");
  await expect(end).toHaveValue("");
  await end.pressSequentially("2");
  await expect(page.locator(".selected")).toContainText("Mesures 1–4");
  await page.getByRole("button", { name: "Appliquer la plage" }).click();
  await expect(page.locator(".selected")).toContainText("Mesures 1–2");
  await start.fill("");
  await expect(start).toHaveValue("");
  await start.fill("3");
  await end.fill("4");
  await end.press("Enter");
  await expect(page.locator(".selected")).toContainText("Mesures 3–4");
  await end.fill("2");
  await page.getByRole("button", { name: "Appliquer la plage" }).click();
  await expect(page.getByText(/Choisissez des mesures entières/)).toBeVisible();
  await expect(page.locator(".selected")).toContainText("Mesures 3–4");
  await end.fill("4.5");
  await page.getByRole("button", { name: "Appliquer la plage" }).click();
  await expect(page.getByText(/Choisissez des mesures entières/)).toBeVisible();
  await end.fill("4");
  await end.press("Enter");
  await page.getByRole("button", { name: "+ ANNOTATION" }).click();
  await expect(page.locator(".sheet-header")).toContainText("Mesures 3–4");
});

test("legacy audio without metadata recovers bar controls", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.wav"));
  await expect(page.getByText("test.wav", { exact: true })).toBeVisible();
  await expect(page.locator(".project-heading [role=status]")).toHaveText(
    "Sauvegardé localement",
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("noofu-arranger", 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("projects", "readwrite"),
            store = tx.objectStore("projects");
          const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const row = cursor.result;
            if (row) store.put({ ...row.value, source: null });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await page.locator(".projects article > button:first-child").first().click();
  await expect(
    page.getByRole("button", { name: "4 BARS", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "4 BARS", exact: true }).click();
  await expect(page.locator(".selected")).toContainText("Mesures 1–4");
});

test("two-finger ruler pinch zooms both ways and preserves selected bars", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.wav"));
  await expect(page.getByText("test.wav", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2 BARS", exact: true }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Zoomer", exact: true }).click();
  const ruler = page.getByLabel("Règle des mesures : zoom à deux doigts");
  await ruler.scrollIntoViewIfNeeded();
  const rect = await ruler.boundingBox();
  if (!rect) throw new Error("No ruler");
  const cdp = await context.newCDPSession(page);
  const y = rect.y + 20;
  const content = page.locator(".timeline-content");
  const before = await content.evaluate((e) => e.getBoundingClientRect().width);
  const points = (a: number, b: number) => [
    { id: 1, x: rect.x + a, y },
    { id: 2, x: rect.x + b, y },
  ];
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(60, 290),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points(110, 240),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => content.evaluate((e) => e.getBoundingClientRect().width))
    .toBeLessThan(before);
  const smaller = await content.evaluate(
    (e) => e.getBoundingClientRect().width,
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(110, 240),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: points(50, 300),
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => content.evaluate((e) => e.getBoundingClientRect().width))
    .toBeGreaterThan(smaller);
  await expect(page.locator(".selected")).toContainText("Mesures 1–2");
  await cdp.detach();
});

test("tap on numbered ruler seeks accurately after scroll without changing selection", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.wav"));
  await expect(page.getByText("test.wav", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2 BARS", exact: true }).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Zoomer", exact: true }).click();
  const ruler = page.getByLabel("Règle des mesures : zoom à deux doigts");
  await ruler.scrollIntoViewIfNeeded();
  const view = page.locator(".timeline-scroll");
  await view.evaluate((e) => (e.scrollLeft = 200));
  const rect = await view.boundingBox(),
    rulerRect = await ruler.boundingBox();
  if (!rect || !rulerRect) throw new Error("No ruler");
  await page.touchscreen.tap(rect.x + 120, rulerRect.y + 20);
  const time = Number(
    await page
      .getByRole("slider", { name: "Position de lecture" })
      .inputValue(),
  );
  expect(time).toBeCloseTo(320 / 112.5, 1);
  await expect(page.locator(".selected")).toContainText("Mesures 1–2");
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x: rect.x + 220, y: rulerRect.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ id: 1, x: rect.x + 120, y: rulerRect.y + 20 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(
    Number(
      await page
        .getByRole("slider", { name: "Position de lecture" })
        .inputValue(),
    ),
  ).toBeCloseTo(time, 2);
  await cdp.detach();
});

test("tutorial explains controls without executing actions and can be exited", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Mode tuto", exact: true }).click();
  await expect(
    page.getByText("Mode tuto activé", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await expect(page.locator(".tutorial-panel")).toContainText(
    "Crée un nouveau projet local",
  );
  await expect(page.getByRole("heading", { name: "PROJECTS" })).toBeVisible();
  await page.locator("header > .tutorial-toggle").click();
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page.getByLabel("Nom du projet").fill("Tuto test");
  await page.getByLabel("Nom du projet").press("Enter");
  await page.getByRole("button", { name: "Mode tuto", exact: true }).click();
  await page.getByRole("button", { name: "IMPORT AUDIO", exact: true }).click();
  await expect(page.locator(".tutorial-panel")).toContainText(
    "sélecteur de fichiers",
  );
  await page.getByLabel("BPM", { exact: true }).click();
  await expect(page.locator(".tutorial-panel")).toContainText(
    "le fichier audio n’est pas accéléré",
  );
  await expect(page.getByLabel("BPM", { exact: true })).toHaveValue("130");
  await page
    .getByRole("button", { name: "EXPORT FOR CODEX", exact: true })
    .dispatchEvent("pointerdown", { pointerId: 1 });
  await expect(page.locator(".tutorial-panel")).toContainText("edit_plan.json");
  await page
    .locator(".tutorial-panel")
    .getByRole("button", { name: "Compris" })
    .click();
  await expect(page.locator(".tutorial-panel")).toBeHidden();
  await page
    .getByRole("button", { name: "EXPORT PROJECT", exact: true })
    .click();
  await expect(page.locator(".tutorial-panel")).toContainText(
    "Cette sauvegarde ne contient pas l’audio",
  );
  await page.locator("header > .tutorial-toggle").click();
  await expect(page.getByLabel("Nom du projet")).toHaveValue("Tuto test");
  await page.getByLabel("BPM", { exact: true }).fill("132");
  await page.getByRole("button", { name: "Appliquer BPM" }).click();
  await expect(page.getByLabel("BPM", { exact: true })).toHaveValue("132");
});

test("selection edges resize independently and outside tap starts a new selection", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "+ NEW PROJECT" }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(join(scratch, "test.wav"));
  await expect(page.getByText("test.wav", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2 BARS", exact: true }).click();
  const surface = page.getByLabel("Glisser pour sélectionner des mesures");
  await surface.scrollIntoViewIfNeeded();
  const rect = await surface.boundingBox(),
    bar = await page.locator(".ruler > div").first().boundingBox();
  if (!rect || !bar) throw new Error("Missing timeline");
  const cdp = await context.newCDPSession(page);
  async function drag(name: string, x: number) {
    await page
      .getByRole("button", { name, exact: true })
      .scrollIntoViewIfNeeded();
    const h = await page
      .getByRole("button", { name, exact: true })
      .boundingBox();
    if (!h) throw new Error("No handle");
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: h.x + h.width / 2, y: h.y + h.height / 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ id: 1, x, y: h.y + h.height / 2 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  await drag("Ajuster la fin de la sélection", rect.x + bar.width * 3.4);
  await expect(page.locator(".selection-caption")).toHaveText("Mesures 1–4");
  await drag("Ajuster le début de la sélection", rect.x + bar.width * 1.4);
  await expect(page.locator(".selection-caption")).toHaveText("Mesures 2–4");
  await page.touchscreen.tap(rect.x + bar.width * 2.5, rect.y + 90);
  await expect(page.locator(".selection-caption")).toHaveText("Mesures 2–4");
  await page.touchscreen.tap(rect.x + bar.width * 0.4, rect.y + 90);
  await expect(page.locator(".selection-caption")).toHaveText("Mesures 1–1");
  await page
    .getByRole("button", {
      name: "Ajuster la fin de la sélection",
      exact: true,
    })
    .press("ArrowRight");
  await expect(page.locator(".selection-caption")).toHaveText("Mesures 1–2");
  await page.getByRole("button", { name: "Vue complète" }).click();
  await page.getByLabel("Mesure début").fill("3");
  await page.getByLabel("Mesure fin").fill("3");
  await page.getByRole("button", { name: "Appliquer la plage" }).click();
  await expect(page.locator(".selected")).toHaveClass(/compact/);
  await drag("Ajuster le début de la sélection", rect.x + 30);
  await expect(page.locator(".selection-caption")).toHaveText("Mesures 1–3");
  await cdp.detach();
});
