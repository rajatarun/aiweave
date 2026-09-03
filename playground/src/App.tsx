import { useEffect, useState } from "react";
import {
  CapillaryBleedSurface,
  ChambaRumalCard,
  KasutiMatrix,
  TantuBanner,
  TantuBleedCanvas,
  TantuButton,
  TantuCard,
  TantuCell,
  TantuDialog,
  TantuFold,
  TantuInput,
  TantuLoom,
  TantuMeter,
  TantuNotice,
  TantuSelect,
  TantuSlider,
  TantuStepper,
  TantuTable,
  TantuTabs,
  TantuTag,
  TantuToggle,
  TANTU_DYES,
  type BleedDye,
} from "@aiweave/tantu";
import "@aiweave/tantu/styles.css";
// Optional. The design system is complete without it — the type roles resolve
// to stacks the reader's machine already has. This line is what opting into
// the three Tantu typefaces looks like; delete it and the app still works,
// just in the reader's own faces.
import "@aiweave/tantu/fonts.css";

/**
 * A working application, not a component gallery.
 *
 * The point of a playground is to answer the question a gallery cannot: what
 * does it feel like to *build* something with this? So this is a small tool —
 * a loom's shift record — assembled from Tantu the way a consumer would
 * assemble it, with the theme and direction switches wired to the same two
 * attributes the system actually reads.
 */

type Theme = "light" | "dark";
type Direction = "ltr" | "rtl";

/**
 * A beam is the whole state of one piece of work. The register is not a
 * decorative table beside the controls — it *is* what the controls edit, so
 * putting a beam on the loom loads its tension and its bath, and moving either
 * writes back into the row you can see.
 */
interface Beam {
  id: string;
  warp: string;
  picks: number;
  dye: BleedDye;
  /** Percent, the same scale the slider speaks. Newtons are for reading. */
  tension: number;
  /** Mordanted before dyeing, which is what fixes the colour in the fibre. */
  mordant: boolean;
  stage: string;
}

const WARPS = ["Cotton 40s", "Cotton 60s", "Tussar silk"];

/** Display only. A loom is dressed in newtons; a slider is not. */
const newtons = (percent: number) => `${(4 + 8 * (percent / 100)).toFixed(1)} N`;

/**
 * The five baths the capillary engine knows how to mix.
 *
 * The colour of each is not written here. `TANTU_DYES` names the custom
 * property every dye mirrors, and the shader reads that property off the live
 * element — so re-dyeing the system through CSS moves the bleed and the
 * swatch together instead of letting them drift apart.
 */
const BATHS: { id: BleedDye; label: string }[] = [
  { id: "madder", label: "Madder root" },
  { id: "indigo", label: "Indigo vat" },
  { id: "copper", label: "Copper sulphate" },
  { id: "marigold", label: "Marigold" },
  { id: "iron", label: "Iron liquor" },
];

const labelFor = (id: BleedDye) => BATHS.find((b) => b.id === id)?.label.toLowerCase() ?? id;

const STAGES = [
  { id: "warp", label: "Wind" },
  { id: "dress", label: "Dress" },
  { id: "weave", label: "Weave" },
  { id: "cut", label: "Cut" },
];

/** What a freshly dressed beam carries before anyone touches it. */
const STOCK = { tension: 50, dye: "madder" as BleedDye, picks: 48, mordant: false, stage: "warp" };

/**
 * The register at the start of the shift. The first beam is at stock tension
 * so the page opens as the system ships rather than at a setting someone
 * chose; the other two are mid-shift, which is what a register looks like.
 */
const INITIAL_BEAMS: Beam[] = [
  { id: "b1", warp: "Cotton 40s", picks: 48, dye: "madder", tension: STOCK.tension, mordant: true, stage: "weave" },
  { id: "b2", warp: "Cotton 60s", picks: 62, dye: "indigo", tension: 68, mordant: false, stage: "dress" },
  { id: "b3", warp: "Tussar silk", picks: 71, dye: "marigold", tension: 34, mordant: true, stage: "warp" },
];

export default function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [direction, setDirection] = useState<Direction>("ltr");
  const [cutting, setCutting] = useState(false);
  const [beams, setBeams] = useState<Beam[]>(INITIAL_BEAMS);
  const [activeId, setActiveId] = useState<string | null>(INITIAL_BEAMS[0].id);
  const [cutLog, setCutLog] = useState<string[]>([]);
  const [dressed, setDressed] = useState(0);
  const [dyed, setDyed] = useState("");

  // One source of truth. Tension, bath and progression are not three
  // independent settings that happen to sit near a table — they are the beam
  // the loom is carrying, which is why moving one updates the row.
  const active = beams.find((b) => b.id === activeId) ?? null;
  const tension = active?.tension ?? STOCK.tension;
  const bath = active?.dye ?? STOCK.dye;
  const stage = active?.stage ?? STOCK.stage;

  const editActive = (patch: Partial<Beam>) =>
    setBeams((bs) => bs.map((b) => (b.id === activeId ? { ...b, ...patch } : b)));

  /**
   * Everything in the vat comes out the same colour.
   *
   * The register is above the vat, so the rows changing is feedback a reader
   * has to already be looking at — hence the announcement, which carries
   * role="status" and so reaches someone who cannot see the table at all.
   */
  function dyeEveryBeam() {
    if (!beams.length) return;
    setBeams((bs) => bs.map((b) => ({ ...b, dye: bath })));
    setDyed(
      `${beams.length} beam${beams.length === 1 ? "" : "s"} went into the ${labelFor(bath)} ` +
        `bath. The register above carries the new dye on every row.`,
    );
  }

  /** Dress a new beam and put it straight on the loom, at stock. */
  function dressBeam() {
    const n = dressed + 1;
    const beam: Beam = {
      id: `n${n}`,
      warp: WARPS[n % WARPS.length],
      picks: STOCK.picks,
      dye: STOCK.dye,
      tension: STOCK.tension,
      mordant: STOCK.mordant,
      stage: STOCK.stage,
    };
    setDressed(n);
    setBeams((bs) => [...bs, beam]);
    setActiveId(beam.id);
  }

  /**
   * Cut the cloth: the piece comes off, and the beam leaves the register for
   * good. Both footer buttons used to call the same close, which made the word
   * IRREVERSIBLE decoration — a confirmation is only a pattern worth showing if
   * the two answers lead somewhere different. The loom takes up whatever is
   * still dressed, or stands empty.
   */
  function cutTheCloth() {
    if (!active) return;
    const remaining = beams.filter((b) => b.id !== active.id);
    setBeams(remaining);
    setActiveId(remaining[0]?.id ?? null);
    setCutLog((log) => [...log, active.warp]);
    setCutting(false);
  }

  // Tantu reads all three from the document. Setting them here is the whole
  // of the integration — there is no provider, no context, no hook to
  // install. Tension is a 0..1 scalar; the slider speaks percent because
  // that is what a meter wants, so it is divided once, here.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.style.setProperty("--tantu-tension", String(tension / 100));
  }, [theme, direction, tension]);

  return (
    <>
      {/* The page ground itself is cloth. Press anywhere the app has not
          already claimed — the margin either side of the loom, the gap
          between cards — and dye wicks out of the substrate. Press a card and
          it does not, because the bleed bus stands the substrate down for
          every registered owner above it. Only a sibling of the loom: the
          loom takes TantuCell, TantuCard and ChambaRumalCard as children and
          nothing else. */}
      <TantuBleedCanvas />

      <TantuLoom viewTalimCode="PLAY-01">
        <TantuCell warpSpan={12}>
          <div
            style={{
              display: "flex",
              gap: "var(--tantu-knot-2)",
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h1 style={{ fontFamily: "var(--tantu-font-display)", margin: 0 }}>Shift record</h1>
              <p style={{ margin: 0, color: "var(--tantu-ink-secondary)" }}>
                Loom 4 · edit anything; it is a real app.
              </p>
            </div>
            <div style={{ display: "flex", gap: "var(--tantu-knot-1)" }}>
              <TantuButton
                variant="secondary"
                onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? "Dark" : "Light"}
              </TantuButton>
              <TantuButton
                variant="secondary"
                onClick={() => setDirection((d) => (d === "ltr" ? "rtl" : "ltr"))}
              >
                {direction === "ltr" ? "RTL" : "LTR"}
              </TantuButton>
            </div>
          </div>
        </TantuCell>

        <TantuCell warpSpan={12}>
          <TantuBanner tone="info">
            Switch the direction. Nothing here is written twice — every inline-axis rule is
            logical, and the arrow keys in the tabs below reverse on their own.
          </TantuBanner>
        </TantuCell>

        <TantuCell warpSpan={6}>
          <TantuCard talimCode="BEAM">
            <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Beam register</h2>
            <p style={{ color: "var(--tantu-ink-secondary)", marginTop: 0 }}>
              Put a beam on the loom and every control below picks it up. Move the tension or
              change the bath and the row you are reading changes with it — the register is the
              state, not a picture of it.
            </p>
            <TantuTable
              caption="Beams currently dressed"
              rows={beams}
              rowKey={(r) => r.id}
              empty="Every beam is cut. Dress another to put something back on the loom."
              columns={[
                { key: "warp", header: "Warp", cell: (r) => r.warp },
                { key: "picks", header: "Picks / in", cell: (r) => r.picks },
                {
                  key: "dye",
                  header: "Dye",
                  // The mordant reads here rather than in a column of its own:
                  // it is a property of the dyeing, and a sixth column at this
                  // span would cost the table its reflow at 320px.
                  cell: (r) => (
                    <>
                      <TantuTag tone="accent">{labelFor(r.dye)}</TantuTag>
                      {r.mordant ? (
                        <span
                          className="tantu-meta-talim"
                          style={{ display: "block", color: "var(--tantu-ink-secondary)" }}
                        >
                          mordanted
                        </span>
                      ) : null}
                    </>
                  ),
                },
                { key: "tension", header: "Tension", cell: (r) => newtons(r.tension) },
                {
                  key: "loom",
                  header: "On the loom",
                  cell: (r) =>
                    r.id === activeId ? (
                      <TantuTag tone="accent">Dressed</TantuTag>
                    ) : (
                      // The visible word is inside the accessible name, which is
                      // what WCAG 2.5.3 asks for — a row of buttons all reading
                      // "Dress" is ambiguous to anyone listing them, and an
                      // aria-label that replaced the word rather than extending
                      // it would break speech input instead.
                      <TantuButton
                        variant="ghost"
                        aria-label={`Dress ${r.warp}`}
                        onClick={() => setActiveId(r.id)}
                      >
                        Dress
                      </TantuButton>
                    ),
                },
              ]}
            />
            <div style={{ marginTop: "var(--tantu-knot-3)" }}>
              <TantuButton variant="secondary" onClick={dressBeam}>
                Dress a new beam
              </TantuButton>
            </div>
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={6}>
          <TantuCard talimCode="TENSION">
            <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Warp tension</h2>
            <p style={{ color: "var(--tantu-ink-secondary)", marginTop: 0 }}>
              {active
                ? `Dressing ${active.warp}, at ${newtons(active.tension)}. `
                : "No beam on the loom. Dress one in the register to the side. "}
              Drag this and watch the whole page re-sett, not just this card. Tension
              decides how close the threads sit, and every measurement in the system
              descends from that one number — so the gaps, the rules and the
              counted-thread tracking all move together, because they share a cause.
            </p>
            <TantuMeter label="Across the width" value={tension} />
            <div style={{ marginTop: "var(--tantu-knot-3)" }}>
              <TantuSlider
                label="Warp tension"
                min={0}
                max={100}
                value={tension}
                disabled={!active}
                onChange={(v) => editActive({ tension: v })}
              />
            </div>

            {/* The derived values, live. The dial is felt rather than seen, so
                showing the thread it resolves to is what makes the mechanism
                legible — including that it lands on whole pixels, because a
                fractional thread does not exist. */}
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "var(--tantu-knot-1) var(--tantu-knot-2)",
                margin: "var(--tantu-knot-3) 0 0",
                fontFamily: "var(--tantu-font-mono)",
                fontSize: "0.8rem",
                color: "var(--tantu-ink-secondary)",
              }}
            >
              <dt>thread</dt>
              <dd style={{ margin: 0 }}>{Math.round(8 - 4 * (tension / 100))}px</dd>
              <dt>knot-4</dt>
              <dd style={{ margin: 0 }}>{Math.round(8 - 4 * (tension / 100)) * 4}px</dd>
              <dt>sett</dt>
              <dd style={{ margin: 0 }}>
                {tension < 34 ? "open" : tension > 72 ? "close" : "even"}
              </dd>
            </dl>

            {tension > 85 ? (
              <div style={{ marginTop: "var(--tantu-knot-3)" }}>
                <TantuNotice tone="caution" title="Over-tensioned">
                  The warp will part before the next pick.
                </TantuNotice>
              </div>
            ) : null}
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={6}>
          <TantuCard talimCode="SETUP">
            {/* This card had no heading and said nothing about what it edited.
                Its four controls all write into the beam register two columns
                away, so using one looked like pressing a button that did
                nothing — the effect was real and simply out of view. Naming the
                beam is the whole fix. */}
            <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Setup</h2>
            <p style={{ color: "var(--tantu-ink-secondary)", marginTop: 0 }}>
              {active ? (
                <>
                  Dressing <strong>{active.warp}</strong>. Everything here edits the beam on the
                  loom — the register above takes the change as you make it.
                </>
              ) : (
                "No beam on the loom. Dress one in the register above."
              )}
            </p>
            <TantuTabs
              items={[
                {
                  id: "warp",
                  label: "Warp",
                  content: (
                    <div style={{ display: "grid", gap: "var(--tantu-knot-3)", paddingTop: "var(--tantu-knot-2)" }}>
                      <TantuInput
                        label="Ends per inch"
                        audio={false}
                        type="number"
                        min={1}
                        value={active ? String(active.picks) : ""}
                        disabled={!active}
                        onChange={(e) =>
                          editActive({ picks: Number(e.target.value) || 0 })
                        }
                      />
                      <TantuSelect
                        label="Fibre"
                        value={active?.warp ?? WARPS[0]}
                        disabled={!active}
                        onChange={(e) => editActive({ warp: e.target.value })}
                      >
                        {WARPS.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </TantuSelect>
                    </div>
                  ),
                },
                {
                  id: "dye",
                  label: "Dye",
                  content: (
                    <div style={{ display: "grid", gap: "var(--tantu-knot-3)", paddingTop: "var(--tantu-knot-2)" }}>
                      <TantuSelect
                        label="Bath"
                        value={bath}
                        disabled={!active}
                        onChange={(e) => editActive({ dye: e.target.value as BleedDye })}
                        hint="Dyes the beam on the loom, and the vat below."
                      >
                        {BATHS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </TantuSelect>
                      <TantuToggle
                        audio={false}
                        checked={active?.mordant ?? false}
                        disabled={!active}
                        onChange={(e) => editActive({ mordant: e.target.checked })}
                      >
                        Mordant first
                      </TantuToggle>
                    </div>
                  ),
                },
              ]}
            />
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={6}>
          <ChambaRumalCard
            obverse={
              <>
                <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Today</h2>
                <p>
                  {beams.length} beam{beams.length === 1 ? "" : "s"} dressed.{" "}
                  {cutLog.length === 0
                    ? "One cut pending."
                    : `${cutLog.length} cut${cutLog.length > 1 ? "s" : ""} off the beam.`}
                </p>
                <p style={{ color: "var(--tantu-ink-secondary)" }}>
                  Turn it over — the dye wicks across on the same law as the vat below.
                </p>
              </>
            }
            reverse={
              <>
                <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Yesterday</h2>
                <p>Warp parted at pick 1,204. Re-tensioned and resumed.</p>
              </>
            }
          />
        </TantuCell>

        {/* The vat.
            Tantu's state changes are dye moving through cloth, and that is not
            a metaphor in the code: the front position follows the
            Lucas-Washburn wicking law, L proportional to root t, which is a
            different shape from the saturation curve that usually stands in for
            "ink spreading" and different again from any cubic bezier. Half the
            travel is over in the first third of the duration and the rest is a
            long crawl. Reading that is one thing; pressing it is another, which
            is why it is here rather than only in the changelog.

            It is a working part of the app, not a demo tile — the bath selected
            in Setup is the dye that comes out of it. */}
        <TantuCell warpSpan={12}>
          <TantuCard talimCode="VAT">
            <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>The vat</h2>
            <p style={{ color: "var(--tantu-ink-secondary)", marginTop: 0, maxWidth: "72ch" }}>
              Five baths, each a real pigment in the register rather than a hex typed into a
              component. Press any square: the dye wicks out along the warp, because cotton
              does not draw it equally in both axes. The bath chosen in Setup is the one in
              the long cloth below.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
                gap: "var(--tantu-knot-2)",
              }}
            >
              {BATHS.map((b) => (
                <CapillaryBleedSurface
                  key={b.id}
                  dye={b.id}
                  maxRadius={130}
                  style={{
                    minHeight: "8rem",
                    display: "grid",
                    alignContent: "start",
                    gap: "var(--tantu-knot-1)",
                    padding: "var(--tantu-knot-2)",
                    border: "1px solid var(--tantu-border-hairline)",
                  }}
                >
                  {/* The pigment at rest. Without it the colour of a bath is
                      only ever revealed by pressing, which leaves a reader who
                      does not use a pointer with five identical grey squares. */}
                  <span
                    aria-hidden="true"
                    style={{
                      display: "block",
                      inlineSize: "100%",
                      blockSize: "var(--tantu-knot-3)",
                      backgroundColor: `var(${TANTU_DYES[b.id].token})`,
                    }}
                  />
                  <strong style={{ fontSize: "0.9rem" }}>{b.label}</strong>
                  <code
                    style={{
                      fontFamily: "var(--tantu-font-mono)",
                      fontSize: "0.7rem",
                      color: "var(--tantu-ink-secondary)",
                    }}
                  >
                    {TANTU_DYES[b.id].token}
                  </code>
                </CapillaryBleedSurface>
              ))}
            </div>

            <p style={{ color: "var(--tantu-ink-secondary)", maxWidth: "72ch" }}>
              Six live surfaces on this page — five squares, the long cloth, and the page
              ground behind everything — and one WebGL context between them. Safari caps live
              contexts and drops the oldest past the cap, so a context per surface blanks
              surfaces mid-scroll.
            </p>

            <CapillaryBleedSurface
              dye={bath}
              style={{
                minHeight: "11rem",
                display: "grid",
                placeItems: "center",
                gap: "var(--tantu-knot-2)",
                padding: "var(--tantu-knot-4)",
                border: "1px solid var(--tantu-border-hairline)",
              }}
            >
              <p style={{ margin: 0, textAlign: "center", maxWidth: "42ch" }}>
                A button inside a bleeding surface is one press, not two. The innermost thing
                that answers the gesture owns it, and the cloth beneath stays dry — press the
                button, then press beside it.
              </p>
              {/* This button used to read "Commit the madder bath" and have no
                  handler at all. It was here to demonstrate gesture
                  arbitration, which it does — but a label that names an action
                  is a promise, and a vat that cannot dye anything is a strange
                  thing to put on a page about dyeing. Now it does the work a
                  vat does: everything in it comes out the same colour. */}
              <TantuButton variant="primary" disabled={!beams.length} onClick={dyeEveryBeam}>
                Dye {beams.length === 1 ? "the beam" : `all ${beams.length} beams`}{" "}
                {labelFor(bath)}
              </TantuButton>
            </CapillaryBleedSurface>

            {dyed ? (
              <div style={{ marginTop: "var(--tantu-knot-3)" }}>
                <TantuNotice tone="success" title="Out of the vat">
                  {dyed}
                </TantuNotice>
              </div>
            ) : null}
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={6}>
          <TantuCard talimCode="RATE">
            <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Picks per inch</h2>
            {/* Read off the register, so "Ends per inch" in Setup has somewhere
                visible to land. A chart beside a table that disagrees with it is
                worse than no chart. */}
            {beams.length ? (
              <KasutiMatrix
                caption="By beam, this shift"
                audio={false}
                data={beams.map((b) => ({ label: b.warp, value: b.picks }))}
              />
            ) : (
              <p style={{ color: "var(--tantu-ink-secondary)" }}>Nothing on any loom to count.</p>
            )}
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={6}>
          <TantuCard talimCode="NOTES">
            <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Standing orders</h2>
            <TantuFold
              items={[
                { id: "a", label: "Dressing the loom", content: <p>Beam, cross, heddles, reed.</p> },
                { id: "b", label: "Cutting", content: <p>Only at the selvedge. Only once.</p> },
              ]}
            />
            <div style={{ marginTop: "var(--tantu-knot-4)" }}>
              {/* Each beam carries its own progression, so this moves when a
                  different beam goes on the loom. Without onChange the stepper
                  renders its stops disabled, which is the right read when there
                  is nothing dressed to advance. */}
              <TantuStepper
                currentStepId={stage}
                steps={STAGES}
                onChange={active ? (id) => editActive({ stage: id }) : undefined}
              />
            </div>
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={12}>
          {/* The outcome, announced rather than only drawn. TantuNotice carries
              role="status" below the critical tone, so a reader who cannot see
              the stepper fall back to Wind is still told the cut happened —
              which is the part a destructive confirmation usually forgets. */}
          {cutLog.length > 0 ? (
            <div style={{ marginBottom: "var(--tantu-knot-3)" }}>
              <TantuNotice tone="success" title="Cloth cut">
                Cut {cutLog.length}: {cutLog[cutLog.length - 1]} came off the beam and left the
                register.{" "}
                {active
                  ? `The loom has taken up ${active.warp}.`
                  : "Nothing is on the loom — dress a beam to start another piece."}
              </TantuNotice>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: "var(--tantu-knot-2)", justifyContent: "flex-end" }}>
            <TantuButton variant="ghost">Save draft</TantuButton>
            <TantuButton variant="primary" disabled={!active} onClick={() => setCutting(true)}>
              Cut the cloth
            </TantuButton>
          </div>
        </TantuCell>

        <TantuDialog
          open={cutting}
          title="Cut the cloth"
          meta="IRREVERSIBLE"
          onClose={() => setCutting(false)}
          footer={
            <div style={{ display: "flex", gap: "var(--tantu-knot-1)", justifyContent: "flex-end" }}>
              <TantuButton variant="ghost" onClick={() => setCutting(false)}>
                Cancel
              </TantuButton>
              <TantuButton variant="primary" onClick={cutTheCloth}>
                Cut
              </TantuButton>
            </div>
          }
        >
          <p>
            Once the selvedge is crossed the cloth cannot be re-tensioned on this beam. Cutting
            takes {active?.warp ?? "the piece"} off and strikes it from the register — the
            tension you set, the bath you chose and the progression through the shift go with
            it. The loom takes up whatever is still dressed.
          </p>
          <p>
            Hold Tab — focus stays inside this panel, and Escape hands it back to the button that
            opened it. Cancel and Cut both close it; only one of them empties the beam.
          </p>
        </TantuDialog>
      </TantuLoom>
    </>
  );
}
