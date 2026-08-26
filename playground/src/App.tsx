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

const BEAMS = [
  { id: "b1", warp: "Cotton 40s", picks: 48, dye: "Madder root", tension: "9.0 N" },
  { id: "b2", warp: "Cotton 60s", picks: 62, dye: "Indigo vat", tension: "8.4 N" },
  { id: "b3", warp: "Tussar silk", picks: 71, dye: "Katha bark", tension: "6.2 N" },
];

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

export default function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [direction, setDirection] = useState<Direction>("ltr");
  const [cutting, setCutting] = useState(false);
  const [tension, setTension] = useState(62);
  const [bath, setBath] = useState<BleedDye>("madder");

  // Tantu reads both from the document. Setting them here is the whole of the
  // integration — there is no provider, no context, no hook to install.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("dir", direction);
  }, [theme, direction]);

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
            <TantuTable
              caption="Beams currently dressed"
              rows={BEAMS}
              rowKey={(r) => r.id}
              columns={[
                { key: "warp", header: "Warp", cell: (r) => r.warp },
                { key: "picks", header: "Picks / in", cell: (r) => r.picks },
                { key: "dye", header: "Dye", cell: (r) => <TantuTag tone="accent">{r.dye}</TantuTag> },
                { key: "tension", header: "Tension", cell: (r) => r.tension },
              ]}
            />
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={6}>
          <TantuCard talimCode="TENSION">
            <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Tension</h2>
            <TantuMeter label="Across the width" value={tension} />
            <div style={{ marginTop: "var(--tantu-knot-3)" }}>
              <TantuSlider
                label="Beat force"
                min={0}
                max={100}
                value={tension}
                onChange={setTension}
              />
            </div>
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
            <TantuTabs
              items={[
                {
                  id: "warp",
                  label: "Warp",
                  content: (
                    <div style={{ display: "grid", gap: "var(--tantu-knot-3)", paddingTop: "var(--tantu-knot-2)" }}>
                      <TantuInput label="Ends per inch" audio={false} defaultValue="48" />
                      <TantuSelect label="Fibre" defaultValue="cotton">
                        <option value="cotton">Cotton 40s</option>
                        <option value="silk">Tussar silk</option>
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
                        onChange={(e) => setBath(e.target.value as BleedDye)}
                        hint="Changes the dye in the vat below."
                      >
                        {BATHS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </TantuSelect>
                      <TantuToggle audio={false}>Mordant first</TantuToggle>
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
                <p>Three beams dressed. One cut pending.</p>
                <p style={{ color: "var(--tantu-ink-secondary)" }}>Press the card.</p>
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
              <TantuButton variant="primary">Commit the {labelFor(bath)} bath</TantuButton>
            </CapillaryBleedSurface>
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={6}>
          <TantuCard talimCode="RATE">
            <h2 style={{ fontFamily: "var(--tantu-font-display)", marginTop: 0 }}>Picks per inch</h2>
            <KasutiMatrix
              caption="By loom, this shift"
              audio={false}
              data={[
                { label: "Loom 1", value: 48 },
                { label: "Loom 2", value: 62 },
                { label: "Loom 3", value: 71 },
                { label: "Loom 4", value: 55 },
              ]}
            />
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
              <TantuStepper
                currentStepId="weave"
                steps={[
                  { id: "warp", label: "Wind" },
                  { id: "dress", label: "Dress" },
                  { id: "weave", label: "Weave" },
                  { id: "cut", label: "Cut" },
                ]}
              />
            </div>
          </TantuCard>
        </TantuCell>

        <TantuCell warpSpan={12}>
          <div style={{ display: "flex", gap: "var(--tantu-knot-2)", justifyContent: "flex-end" }}>
            <TantuButton variant="ghost">Save draft</TantuButton>
            <TantuButton variant="primary" onClick={() => setCutting(true)}>
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
              <TantuButton variant="primary" onClick={() => setCutting(false)}>
                Cut
              </TantuButton>
            </div>
          }
        >
          <p>
            Once the selvedge is crossed the cloth cannot be re-tensioned on this beam. Hold Tab
            — focus stays inside this panel, and Escape hands it back to the button that opened it.
          </p>
        </TantuDialog>
      </TantuLoom>
    </>
  );
}
