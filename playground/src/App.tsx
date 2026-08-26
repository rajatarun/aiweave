import { useEffect, useState } from "react";
import {
  ChambaRumalCard,
  KasutiMatrix,
  TantuBanner,
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
} from "@aiweave/tantu";
import "@aiweave/tantu/styles.css";

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

export default function App() {
  const [theme, setTheme] = useState<Theme>("light");
  const [direction, setDirection] = useState<Direction>("ltr");
  const [cutting, setCutting] = useState(false);
  const [tension, setTension] = useState(62);

  // Tantu reads both from the document. Setting them here is the whole of the
  // integration — there is no provider, no context, no hook to install.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("dir", direction);
  }, [theme, direction]);

  return (
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
            <h1 style={{ fontFamily: "var(--font-kalam)", margin: 0 }}>Shift record</h1>
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
          <h2 style={{ fontFamily: "var(--font-kalam)", marginTop: 0 }}>Beam register</h2>
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
          <h2 style={{ fontFamily: "var(--font-kalam)", marginTop: 0 }}>Tension</h2>
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
                    <TantuSelect label="Bath" defaultValue="madder">
                      <option value="madder">Madder root</option>
                      <option value="indigo">Indigo vat</option>
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
              <h2 style={{ fontFamily: "var(--font-kalam)", marginTop: 0 }}>Today</h2>
              <p>Three beams dressed. One cut pending.</p>
              <p style={{ color: "var(--tantu-ink-secondary)" }}>Press the card.</p>
            </>
          }
          reverse={
            <>
              <h2 style={{ fontFamily: "var(--font-kalam)", marginTop: 0 }}>Yesterday</h2>
              <p>Warp parted at pick 1,204. Re-tensioned and resumed.</p>
            </>
          }
        />
      </TantuCell>

      <TantuCell warpSpan={6}>
        <TantuCard talimCode="RATE">
          <h2 style={{ fontFamily: "var(--font-kalam)", marginTop: 0 }}>Picks per inch</h2>
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
          <h2 style={{ fontFamily: "var(--font-kalam)", marginTop: 0 }}>Standing orders</h2>
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
  );
}
