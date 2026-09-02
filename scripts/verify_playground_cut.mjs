/**
 * A confirmation dialog is only a pattern if the two answers differ.
 *
 * "Cut the cloth" opened a modal marked IRREVERSIBLE whose Cancel and Cut
 * buttons both called the same close handler. Everything about it was correct
 * — focus containment, Escape, focus restoration, the label, the tone — and it
 * did nothing, which the story sweep, the axe pass and the tension audit all
 * agreed was fine, because none of them presses a button and then asks what
 * changed. That is the gap this closes.
 *
 * It runs both branches from the same dirtied state and asserts they diverge,
 * so it cannot be satisfied by a Cut that merely closes convincingly; and it
 * asserts the outcome is announced rather than only drawn, because a
 * destructive action that resets three controls silently is a failure a
 * sighted reviewer will never see.
 *
 * Run: node scripts/verify_playground_cut.mjs   (needs playground/dist)
 */
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { launchChromium } from "./chromium.mjs";

const ROOT = path.resolve("playground/dist");
if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("playground/dist is missing — run `npm --prefix playground run build` first");
  process.exit(2);
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".svg": "image/svg+xml" };

const server = await new Promise((r) => {
  const s = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, "index.html");
    res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  s.listen(0, "127.0.0.1", () => r(s));
});
const BASE = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
};

const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });

  const tension = () =>
    page.evaluate(() => document.documentElement.style.getPropertyValue("--tantu-tension"));
  const stage = () =>
    page.evaluate(
      () =>
        document
          .querySelector('.tantu-stepper-step[aria-current="step"] .tantu-stepper-label-text')
          ?.textContent?.trim(),
    );
  // TantuSelect is a listbox that keeps a hidden <select> for form submission;
  // the value a person actually sees is the trigger's label, so read that.
  const bathField = () =>
    page.locator(".tantu-field").filter({ has: page.locator("label", { hasText: "Bath" }) });
  const bath = () => bathField().locator(".tantu-spool-active").innerText();

  // Dirty the beam through the real controls, not by poking state.
  await page.getByRole("slider", { name: "Warp tension" }).focus();
  for (let i = 0; i < 8; i += 1) await page.keyboard.press("ArrowRight");
  await page.getByRole("tab", { name: "Dye" }).click();
  await bathField().locator("button.tantu-select").click();
  await bathField().getByRole("option", { name: "Indigo vat" }).click();
  await bathField().locator(".tantu-spool-active").filter({ hasText: "Indigo vat" }).waitFor();

  const dirty = { tension: await tension(), bath: await bath(), stage: await stage() };
  check("the beam can be moved off stock", dirty.tension !== "0.5" && dirty.bath === "Indigo vat",
    `${dirty.tension} / ${dirty.bath} / ${dirty.stage}`);

  const opener = page.getByRole("button", { name: "Cut the cloth" });
  const dialog = page.getByRole("dialog", { name: "Cut the cloth" });
  const confirm = () => page.getByRole("dialog").getByRole("button", { name: "Cut", exact: true });

  // Cancel: the escape hatch has to actually be one.
  await opener.click();
  await dialog.waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });

  check("cancel leaves the beam exactly as it was",
    (await tension()) === dirty.tension && (await bath()) === dirty.bath && (await stage()) === dirty.stage,
    `${await tension()} / ${await bath()} / ${await stage()}`);
  check("cancel announces nothing", (await page.locator(".tantu-notice-success").count()) === 0);

  // Cut: the beam goes back to stock.
  await opener.click();
  await dialog.waitFor();
  await confirm().click();
  await page.getByRole("dialog").waitFor({ state: "detached" });

  check("cut returns tension to stock", (await tension()) === "0.5", await tension());
  check("cut drains the vat", (await bath()) === "Madder root", await bath());
  check("cut falls the progression back to Wind", (await stage()) === "Wind", await stage());

  const notice = page.locator(".tantu-notice-success");
  check("cut raises one notice", (await notice.count()) === 1);
  check("the outcome is announced, not only drawn",
    (await notice.getAttribute("role")) === "status", await notice.getAttribute("role"));
  check("the shift record counts the cut",
    (await page.locator(".tantu-card-rumal").innerText()).includes("1 cut off the beam"));

  // Mutating state on confirm must not cost the modal contract.
  check("focus returns to the opener",
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Cut the cloth",
    await page.evaluate(() => document.activeElement?.textContent?.trim()));

  await opener.click();
  await confirm().click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  check("the count advances on a second cut", (await notice.innerText()).includes("Cut 2"));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${"=".repeat(60)}\n${failures.length} failing`);
process.exit(failures.length ? 1 : 0);
