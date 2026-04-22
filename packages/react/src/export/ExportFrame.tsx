import type { ReactNode } from "react";

import { ThemeProvider } from "../ThemeContext.js";
import { DARK_THEME, LIGHT_THEME } from "../theme.js";
import type { ExportChartSpec, ExportFrameSpec } from "./types.js";
import { unsupportedExportChartKind } from "./chart-kind.js";
import { resolveExportBackground } from "./background.js";
import { BumpChart } from "../BumpChart.js";
import { Formation } from "../Formation.js";
import { Heatmap } from "../Heatmap.js";
import { PassFlow } from "../PassFlow.js";
import { PassMap } from "../PassMap.js";
import { PassNetwork } from "../PassNetwork.js";
import { PercentileBar } from "../PercentileSurfaces.js";
import { PizzaChart } from "../PizzaChart.js";
import { RadarChart } from "../RadarChart.js";
import { ScatterPlot } from "../ScatterPlot.js";
import { ShotMap } from "../ShotMap.js";
import { Territory } from "../Territory.js";
import { XGTimeline } from "../XGTimeline.js";

function renderChartPreview(chart: ExportChartSpec): ReactNode {
  switch (chart.kind) {
    case "bump-chart":
      return <BumpChart {...chart.props} staticMode={true} />;
    case "pizza-chart":
      return <PizzaChart {...chart.props} staticMode={true} />;
    case "formation":
      return <Formation {...chart.props} />;
    case "pass-network":
      return <PassNetwork {...chart.props} egoHighlight={false} />;
    case "territory":
      return <Territory {...chart.props} />;
    case "shot-map":
      return <ShotMap {...chart.props} />;
    case "pass-map":
      return <PassMap {...chart.props} />;
    case "pass-flow":
      return <PassFlow {...chart.props} />;
    case "heatmap":
      return <Heatmap {...chart.props} />;
    case "scatter-plot":
      return <ScatterPlot {...chart.props} />;
    case "xg-timeline":
      return <XGTimeline {...chart.props} showCrosshair={false} />;
    case "radar-chart":
      return <RadarChart {...chart.props} />;
    case "percentile-bar":
      return <PercentileBar {...chart.props} />;
    default:
      return unsupportedExportChartKind((chart as { kind: string }).kind);
  }
}

export function ExportFrame({ spec }: { spec: ExportFrameSpec }) {
  const theme = spec.theme === "dark" ? DARK_THEME : LIGHT_THEME;
  const background = resolveExportBackground(spec.background, theme, spec.theme);

  return (
    <ThemeProvider value={theme}>
      <section
        aria-label="Export frame preview"
        style={{
          width: spec.width,
          minHeight: spec.height,
          display: "grid",
          gap: 20,
          padding: spec.padding,
          boxSizing: "border-box",
          background,
          color: theme.text.primary,
          fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <header style={{ display: "grid", gap: 8 }}>
          {spec.eyebrow ? (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: theme.text.secondary,
              }}
            >
              {spec.eyebrow}
            </div>
          ) : null}
          {spec.title ? (
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05 }}>{spec.title}</h1>
          ) : null}
          {spec.subtitle ? (
            <p
              style={{
                margin: 0,
                fontSize: 18,
                lineHeight: 1.35,
                color: theme.text.secondary,
              }}
            >
              {spec.subtitle}
            </p>
          ) : null}
        </header>

        <div>{renderChartPreview(spec.chart)}</div>

        {spec.footer ? (
          <footer style={{ fontSize: 13, color: theme.text.secondary }}>
            {spec.footer}
          </footer>
        ) : null}
      </section>
    </ThemeProvider>
  );
}
