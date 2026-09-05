// Cross-component dye coordination. Exported so consumers can register
// their own bleed-emitting components into the same arbitration.
export * from "./lib/bleed-bus.js";

// Writing direction. Exported so a consumer building its own composite widget
// can follow the same inline-axis rules the built-in ones do.
export * from "./lib/direction.js";

// The vat. Exported so a consumer can name a dye without copying its hex:
// every dye here mirrors a custom property, and `resolveDye` reads that
// property off the live element, so a re-dyed subtree stays consistent
// between what the shader paints and what CSS paints beside it.
export * from "./lib/dye.js";

export * from "./components/TantuLoom.js";
export * from "./components/TantuCell.js";
export * from "./components/TantuCard.js";
export * from "./components/ChambaRumalCard.js";
export * from "./components/TantuLayout.js";
export * from "./components/TalimThread.js";
export * from "./components/TantuButton.js";
export * from "./components/TantuInput.js";
export * from "./components/TantuTextarea.js";
export * from "./components/TantuSelect.js";
export * from "./components/TantuToggle.js";
export * from "./components/TantuSlider.js";
export * from "./components/TantuGuptBandhan.js";
export * from "./components/TantuTabs.js";
export * from "./components/TantuFold.js";
export * from "./components/TantuStepper.js";
export * from "./components/TantuPagination.js";
export * from "./components/TantuTrail.js";
export * from "./components/TantuPopover.js";
export * from "./components/TantuTooltip.js";
export * from "./components/TantuDialog.js";
export * from "./components/TantuTraceSearch.js";
export * from "./components/TantuMakuShuttle.js";
export * from "./components/TantuDarshanLens.js";
export * from "./components/TantuTag.js";
export * from "./components/TantuSeal.js";
export * from "./components/TantuAvatarGroup.js";
export * from "./components/TantuMeter.js";
export * from "./components/TantuNotice.js";
export * from "./components/TantuBanner.js";
export * from "./components/TantuTable.js";
export * from "./components/TantuRupture.js";
export * from "./components/SikkuKolamLoader.js";
export * from "./components/TantuLoading.js";
export * from "./components/KasutiMatrix.js";
export * from "./components/JamdaniBlock.js";
export * from "./components/PatolaField.js";
export * from "./components/TantuPhad.js";
export * from "./components/TantuPanchang.js";
// Commerce. Structural, and deliberately named for what each one does rather
// than for any cloth or region: a shop in Oaxaca and a shop in Kutch reach for
// the same seven, and dress them through the pack.
export * from "./components/TantuImage.js";
export * from "./components/TantuPrice.js";
export * from "./components/TantuQuantity.js";
export * from "./components/TantuSwatchSet.js";
export * from "./components/TantuGallery.js";
export * from "./components/TantuProvenance.js";
export * from "./components/TantuProductCard.js";

export * from "./components/TantuBleedCanvas.js";
export * from "./components/CapillaryBleedSurface.js";
export * from "./components/InkBleedFilter.js";
export * from "./components/TantuAcousticToggle.js";
export * from "./components/TantuAcousticPalette.js";

// The hooks the components are built from.
//
// These shipped in the tarball from the first version and were reachable from
// nowhere: index.ts did not re-export them, and the `exports` map blocks deep
// imports, so ~38 KB of `useDarshanLens`, `useMakuShuttle` and
// `useCapillaryBleed` travelled to every consumer as dead weight. They are
// genuinely useful on their own — a consumer building a composite widget wants
// the same keyboard routing and the same dye engine the built-ins use — so the
// fix is to export them rather than to stop shipping them.
export * from "./hooks/useCapillaryBleed.js";
export * from "./hooks/useDarshanLens.js";
export * from "./hooks/useMakuShuttle.js";
