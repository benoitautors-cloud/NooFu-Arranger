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
