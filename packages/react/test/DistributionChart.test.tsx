import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DistributionChart, DistributionComparison } from "../src/index";

afterEach(() => {
  cleanup();
});

const overlaySeries = [
  {
    id: "liv",
    label: "Liverpool",
    values: [8, 10, 12, 14, 15, 17, 18, 20, 24],
  },
  {
    id: "mci",
    label: "Manchester City",
    values: [9, 11, 12, 13, 15, 16, 18, 21, 23],
  },
];

describe("<DistributionChart />", () => {
  it("renders a labeled chart shell with a legend", () => {
    render(<DistributionChart series={overlaySeries} xLabel="Shots per match" />);

    expect(
      screen.getByLabelText("Distribution chart: 2 series for Shots per match"),
    ).toBeInTheDocument();
    expect(screen.getByText("Liverpool")).toBeInTheDocument();
    expect(screen.getByText("Manchester City")).toBeInTheDocument();
  });

  it("shows marker tooltip content on focus", () => {
    render(
      <DistributionChart
        series={overlaySeries}
        xLabel="Shots per match"
        defaultMarker="median"
      />,
    );

    const marker = screen.getAllByRole("button", { name: /Liverpool:/ })[0]!;
    fireEvent.focus(marker);

    const tooltip = screen.getByTestId("distributionchart-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(within(tooltip).getByText("Series")).toBeInTheDocument();
    expect(within(tooltip).getByText("Median")).toBeInTheDocument();
  });

  it("renders the empty-state message when every series is invalid", () => {
    render(
      <DistributionChart
        series={[{ id: "empty", label: "Empty", values: [null, undefined, Number.NaN] }]}
        xLabel="Shots per match"
      />,
    );

    expect(screen.getByText("No plottable distribution data")).toBeInTheDocument();
  });
});

describe("<DistributionComparison />", () => {
  const rows = [
    {
      id: "shots",
      label: "Shots",
      series: overlaySeries,
      valueFormatter: (value: number) => value.toFixed(0),
    },
    {
      id: "xg-per-shot",
      label: "xG Per Shot",
      series: [
        {
          id: "liv",
          label: "Liverpool",
          values: [0.05, 0.06, 0.08, 0.09, 0.1, 0.11, 0.13],
        },
        {
          id: "mci",
          label: "Manchester City",
          values: [0.04, 0.06, 0.07, 0.08, 0.1, 0.11, 0.12],
        },
      ],
      valueFormatter: (value: number) => value.toFixed(2),
    },
  ] as const;

  it("renders stacked row labels and a shared legend", () => {
    render(<DistributionComparison rows={rows} defaultMarker="mean" />);

    expect(screen.getByLabelText("Distribution comparison: 2 rows")).toBeInTheDocument();
    expect(screen.getByText("Shots")).toBeInTheDocument();
    expect(screen.getByText("xG Per Shot")).toBeInTheDocument();
    expect(screen.getAllByText("Liverpool").length).toBeGreaterThan(0);
  });

  it("shows comparison tooltip content on marker focus", () => {
    render(<DistributionComparison rows={rows} defaultMarker="mean" />);

    const marker = screen.getAllByRole("button", { name: /Shots, Liverpool:/ })[0]!;
    fireEvent.focus(marker);

    const tooltip = screen.getByTestId("distributioncomparison-tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(within(tooltip).getByText("Metric")).toBeInTheDocument();
    expect(within(tooltip).getByText("Shots")).toBeInTheDocument();
  });
});
