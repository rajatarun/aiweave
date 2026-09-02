/**
 * The beam register is the playground's state, and this proves it.
 *
 * Two defects of the same shape live here. The register was a table of three
 * hardcoded rows with no action — a picture of state rather than state. And
 * "Cut the cloth" opened a modal marked IRREVERSIBLE whose Cancel and Cut both
 * called the same close, so the two answers were indistinguishable. Every
 * existing sweep passed on both, because the story pass, the axe run and the
 * tension audit all check *shape*: none of them presses a control and then
 * asks what changed.
 *
 * So these are consequence checks. They drive the real controls and read the
 * table back, they run both branches of the confirmation from the same dirtied
 * state and assert the branches diverge, and they take the register to empty
 * and back — because an app whose last row can be removed has an empty state
 * whether or not anyone designed one.
 *
 * Run: node scripts/verify_playground_beams.mjs   (needs playground/dist)
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

  // textContent, not innerText: the tags and buttons in this table are
  // uppercased in CSS, and innerText would return the rendered casing.
  const register = () =>
    page.$$eval(".tantu-table tbody tr", (trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.trim())),
    );
  const rowFor = async (warp) => (await register()).find((cells) => cells[0] === warp);

  const tension = () =>
    page.evaluate(() => document.documentElement.style.getPropertyValue("--tantu-tension"));
  const stage = () =>
    page.evaluate(() =>
      document
        .querySelector('.tantu-stepper-step[aria-current="step"] .tantu-stepper-label-text')
        ?.textContent?.trim(),
    );
  // TantuSelect is a listbox that keeps a hidden <select> for form submission;
  // the value a person actually sees is the trigger's label, so read that.
  const field = (label) =>
    page.locator(".tantu-field").filter({ has: page.locator("label", { hasText: label }) });
  const spool = (label) => field(label).locator(".tantu-spool-active").innerText();
  const pickSpool = async (label, option) => {
    await field(label).locator("button.tantu-select").click();
    await field(label).getByRole("option", { name: option }).click();
    await field(label).locator(".tantu-spool-active").filter({ hasText: option }).waitFor();
  };

  // --- The register starts as a register --------------------------------
  const start = await register();
  check("three beams are dressed at the start", start.length === 3, `${start.length} rows`);
  check("exactly one beam is on the loom", start.filter((r) => r[4] === "Dressed").length === 1,
    start.map((r) => `${r[0]}:${r[4]}`).join(", "));
  check("the page opens at the stock sett", (await tension()) === "0.5", await tension());

  // --- Putting a beam on the loom loads it ------------------------------
  await page.getByRole("button", { name: "Dress Cotton 60s" }).click();
  check("dressing a beam loads its tension", (await tension()) === "0.68", await tension());
  check("dressing a beam loads its progression", (await stage()) === "Dress", await stage());
  // The bath lives behind the Dye tab, and TantuTabs does not render the panel
  // it is not showing — so open it before reading, as a person would.
  await page.getByRole("tab", { name: "Dye" }).click();
  check("dressing a beam loads its bath", (await spool("Bath")) === "Indigo vat", await spool("Bath"));
  await page.getByRole("tab", { name: "Warp" }).click();
  check("the register marks which beam is on the loom",
    (await rowFor("Cotton 60s"))?.[4] === "Dressed" && (await rowFor("Cotton 40s"))?.[4] === "Dress");

  // --- Editing writes back into the row you can see ---------------------
  await page.getByRole("slider", { name: "Warp tension" }).focus();
  for (let i = 0; i < 8; i += 1) await page.keyboard.press("ArrowRight");
  check("moving the tension rewrites the register row",
    (await rowFor("Cotton 60s"))?.[3] === "10.1 N", (await rowFor("Cotton 60s"))?.[3]);

  await page.getByRole("tab", { name: "Dye" }).click();
  await pickSpool("Bath", "Iron liquor");
  check("changing the bath rewrites the register row",
    (await rowFor("Cotton 60s"))?.[2] === "iron liquor", (await rowFor("Cotton 60s"))?.[2]);

  await page.getByRole("tab", { name: "Warp" }).click();
  await field("Ends per inch").locator("input").fill("55");
  check("editing the ends rewrites the register row",
    (await rowFor("Cotton 60s"))?.[1] === "55", (await rowFor("Cotton 60s"))?.[1]);
  // textContent again — the chart's labels are uppercased in CSS.
  const chart = () =>
    page.locator(".tantu-card").filter({ hasText: "Picks per inch" }).first().textContent();
  const chartNames = async () => {
    const text = await chart();
    return (await register()).map((r) => r[0]).filter((warp) => text.includes(warp));
  };
  check("the picks chart is drawn from the register",
    (await chartNames()).length === 3, await chart());

  // --- Progression is per beam, not global ------------------------------
  await page.getByLabel("Progression").getByRole("button", { name: "Weave" }).click();
  check("the progression can be advanced", (await stage()) === "Weave", await stage());
  await page.getByRole("button", { name: "Dress Tussar silk" }).click();
  check("another beam brings its own progression", (await stage()) === "Wind", await stage());
  await page.getByRole("button", { name: "Dress Cotton 60s" }).click();
  check("and the first beam kept its own", (await stage()) === "Weave", await stage());

  // --- Cancel is an escape hatch ----------------------------------------
  const before = await register();
  const opener = page.getByRole("button", { name: "Cut the cloth" });
  const dialog = page.getByRole("dialog", { name: "Cut the cloth" });
  const confirm = () => page.getByRole("dialog").getByRole("button", { name: "Cut", exact: true });

  await opener.click();
  await dialog.waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  check("cancel leaves the register exactly as it was",
    JSON.stringify(await register()) === JSON.stringify(before));
  check("cancel announces nothing", (await page.locator(".tantu-notice-success").count()) === 0);

  // --- Cut strikes the beam from the register ---------------------------
  await opener.click();
  await dialog.waitFor();
  await confirm().click();
  await page.getByRole("dialog").waitFor({ state: "detached" });

  const afterCut = await register();
  check("cut removes the beam from the register", afterCut.length === 2, `${afterCut.length} rows`);
  check("the cut beam is gone by name", !afterCut.some((r) => r[0] === "Cotton 60s"));
  check("the loom takes up what is still dressed",
    afterCut.filter((r) => r[4] === "Dressed").length === 1,
    afterCut.map((r) => `${r[0]}:${r[4]}`).join(", "));

  const notice = page.locator(".tantu-notice-success");
  check("the outcome is announced, not only drawn",
    (await notice.count()) === 1 && (await notice.getAttribute("role")) === "status");
  check("the notice names the beam that came off",
    (await notice.innerText()).includes("Cotton 60s"), (await notice.innerText()).replace(/\n/g, " "));
  check("focus returns to the opener",
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Cut the cloth");
  check("the cut beam leaves the picks chart too",
    !(await chart()).includes("Cotton 60s") && (await chartNames()).length === 2, await chart());

  // --- The register can be emptied, and it is not a dead end ------------
  for (let i = 0; i < 2; i += 1) {
    await opener.click();
    await confirm().click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
  }
  const empty = await register();
  check("the register can be emptied", empty.length === 1 && empty[0][0].startsWith("Every beam is cut"),
    JSON.stringify(empty));
  check("with nothing dressed, the tension control is disabled",
    await page.getByRole("slider", { name: "Warp tension" }).isDisabled());
  check("with nothing dressed, there is nothing to cut",
    await opener.isDisabled());
  check("the sett falls back to stock", (await tension()) === "0.5", await tension());

  await page.getByRole("button", { name: "Dress a new beam" }).click();
  const dressed = await register();
  check("a new beam can be dressed", dressed.length === 1 && dressed[0][4] === "Dressed",
    JSON.stringify(dressed));
  check("it arrives at stock", (await tension()) === "0.5" && (await stage()) === "Wind",
    `${await tension()} / ${await stage()}`);
  check("and the loom is workable again", !(await opener.isDisabled()));
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${"=".repeat(60)}\n${failures.length} failing`);
process.exit(failures.length ? 1 : 0);
