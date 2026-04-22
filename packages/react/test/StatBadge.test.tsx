import { cleanup, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "../src/ThemeContext";
import { StatBadge, StatBadgeRow } from "../src/StatBadge";
import type { Stat } from "../src/StatBadge";
import { DARK_THEME } from "../src/theme";

afterEach(cleanup);

const baseStats: Stat[] = [
  { label: "Possession", home: "56%", away: "44%", homeValue: 56, awayValue: 44 },
  { label: "Shots", home: "14", away: "9", homeValue: 14, awayValue: 9 },
  { label: "xG", home: "1.8", away: "0.7", homeValue: 1.8, awayValue: 0.7 },
];

describe("<StatBadgeRow /> — rendering", () => {
  it("renders one badge per stat in the row", () => {
    const { getAllByTestId } = render(<StatBadgeRow stats={baseStats} />);
    expect(getAllByTestId("statbadge")).toHaveLength(3);
  });

  it("renders home and away values in each badge", () => {
    const { getAllByTestId } = render(<StatBadgeRow stats={baseStats} />);
    const homeValues = getAllByTestId("statbadge-home-value").map((n) => n.textContent);
    const awayValues = getAllByTestId("statbadge-away-value").map((n) => n.textContent);
    expect(homeValues).toEqual(["56%", "14", "1.8"]);
    expect(awayValues).toEqual(["44%", "9", "0.7"]);
  });

  it("exposes a section role with the default aria-label", () => {
    const { getByRole } = render(<StatBadgeRow stats={baseStats} />);
    const section = getByRole("region", { name: "Match statistics" });
    expect(section).toBeInTheDocument();
  });

  it("respects a custom ariaLabel on the row", () => {
    const { getByRole } = render(
      <StatBadgeRow stats={baseStats} ariaLabel="Arsenal v Liverpool — first half" />,
    );
    expect(
      getByRole("region", { name: "Arsenal v Liverpool — first half" }),
    ).toBeInTheDocument();
  });

  it("exposes a group role with a descriptive aria-label on each badge", () => {
    const { getAllByRole } = render(<StatBadgeRow stats={baseStats} />);
    const groups = getAllByRole("group");
    expect(groups).toHaveLength(3);
    expect(groups[0]?.getAttribute("aria-label")).toBe("Possession: home 56%, away 44%");
  });

  it("renders an empty section without crashing when stats is empty", () => {
    const { getByRole, queryAllByTestId } = render(<StatBadgeRow stats={[]} />);
    const section = getByRole("region", { name: "Match statistics" });
    expect(section.getAttribute("data-empty")).toBe("true");
    expect(queryAllByTestId("statbadge")).toHaveLength(0);
  });
});

describe("<StatBadge /> — emphasis", () => {
  it("marks the home side as winner when home is higher (default higherIsBetter)", () => {
    const stat: Stat = {
      label: "Shots",
      home: "14",
      away: "9",
      homeValue: 14,
      awayValue: 9,
    };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    expect(getByTestId("statbadge").getAttribute("data-winner")).toBe("home");
  });

  it("marks the away side as winner when away is higher", () => {
    const stat: Stat = {
      label: "Shots",
      home: "9",
      away: "14",
      homeValue: 9,
      awayValue: 14,
    };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    expect(getByTestId("statbadge").getAttribute("data-winner")).toBe("away");
  });

  it("marks neither side as winner on a numeric tie", () => {
    const stat: Stat = {
      label: "Corners",
      home: "5",
      away: "5",
      homeValue: 5,
      awayValue: 5,
    };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    expect(getByTestId("statbadge").getAttribute("data-winner")).toBe("tie");
  });

  it("inverts emphasis when higherIsBetter is false", () => {
    const stat: Stat = {
      label: "Fouls",
      home: "12",
      away: "5",
      homeValue: 12,
      awayValue: 5,
      higherIsBetter: false,
    };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    // Lower (away = 5) wins.
    expect(getByTestId("statbadge").getAttribute("data-winner")).toBe("away");
  });

  it("treats matching display strings as a tie when raw values are missing", () => {
    const stat: Stat = { label: "Possession", home: "50%", away: "50%" };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    expect(getByTestId("statbadge").getAttribute("data-winner")).toBe("tie");
  });

  it("renders an em-dash placeholder when a value string is empty", () => {
    const stat: Stat = { label: "xG", home: "", away: "0.7" };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    expect(getByTestId("statbadge-home-value").textContent).toBe("—");
    expect(getByTestId("statbadge-away-value").textContent).toBe("0.7");
  });
});

describe("<StatBadge /> — proportional bar", () => {
  it("renders the bar when bar=true and raw values are present", () => {
    const stat: Stat = {
      label: "Possession",
      home: "60%",
      away: "40%",
      homeValue: 60,
      awayValue: 40,
      bar: true,
    };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    const bar = getByTestId("statbadge-bar");
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute("data-degenerate")).toBe("false");
    const homeSeg = getByTestId("statbadge-bar-home");
    const awaySeg = getByTestId("statbadge-bar-away");
    expect(homeSeg.getAttribute("style")).toContain("width: 60%");
    expect(awaySeg.getAttribute("style")).toContain("width: 40%");
  });

  it("omits the bar when bar=true but raw values are missing", () => {
    const stat: Stat = { label: "Possession", home: "60%", away: "40%", bar: true };
    const { queryByTestId } = render(<StatBadge stat={stat} />);
    expect(queryByTestId("statbadge-bar")).toBeNull();
  });

  it("omits the bar when bar=true but a raw value is NaN", () => {
    const stat: Stat = {
      label: "xG",
      home: "1.8",
      away: "?",
      homeValue: 1.8,
      awayValue: Number.NaN,
      bar: true,
    };
    const { queryByTestId } = render(<StatBadge stat={stat} />);
    expect(queryByTestId("statbadge-bar")).toBeNull();
  });

  it("omits the bar for negative raw values", () => {
    const stat: Stat = {
      label: "Net xG",
      home: "1.1",
      away: "-0.4",
      homeValue: 1.1,
      awayValue: -0.4,
      bar: true,
    };
    const { queryByTestId } = render(<StatBadge stat={stat} />);
    expect(queryByTestId("statbadge-bar")).toBeNull();
  });

  it("renders the bar as a 50/50 degenerate split when both values are zero", () => {
    const stat: Stat = {
      label: "Goals",
      home: "0",
      away: "0",
      homeValue: 0,
      awayValue: 0,
      bar: true,
    };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    const bar = getByTestId("statbadge-bar");
    expect(bar.getAttribute("data-degenerate")).toBe("true");
    expect(getByTestId("statbadge-bar-home").getAttribute("style")).toContain(
      "width: 50%",
    );
    expect(getByTestId("statbadge-bar-away").getAttribute("style")).toContain(
      "width: 50%",
    );
  });

  it("does not render any bars when no stats opt in", () => {
    const { queryAllByTestId } = render(<StatBadgeRow stats={baseStats} />);
    expect(queryAllByTestId("statbadge-bar")).toHaveLength(0);
  });
});

describe("<StatBadge /> — orientation", () => {
  it("defaults to horizontal", () => {
    const { getByTestId } = render(<StatBadge stat={baseStats[0]!} />);
    expect(getByTestId("statbadge").getAttribute("data-orientation")).toBe("horizontal");
  });

  it("supports vertical orientation", () => {
    const { getByTestId } = render(
      <StatBadge stat={baseStats[0]!} orientation="vertical" />,
    );
    expect(getByTestId("statbadge").getAttribute("data-orientation")).toBe("vertical");
  });

  it("propagates orientation through StatBadgeRow", () => {
    const { getAllByTestId, getByTestId } = render(
      <StatBadgeRow stats={baseStats} orientation="vertical" />,
    );
    expect(getByTestId("statbadge-row").getAttribute("data-orientation")).toBe(
      "vertical",
    );
    for (const badge of getAllByTestId("statbadge")) {
      expect(badge.getAttribute("data-orientation")).toBe("vertical");
    }
  });
});

describe("<StatBadge /> — theming", () => {
  it("uses the shared UITheme tokens when wrapped in ThemeProvider", () => {
    const { getByTestId } = render(
      <ThemeProvider value={DARK_THEME}>
        <StatBadge stat={{ ...baseStats[0]!, bar: true }} />
      </ThemeProvider>,
    );

    expect(getByTestId("statbadge-label")).toHaveStyle({
      color: DARK_THEME.text.secondary,
    });
    expect(getByTestId("statbadge-home-value")).toHaveStyle({
      color: DARK_THEME.text.primary,
    });
    expect(getByTestId("statbadge-bar")).toHaveStyle({
      background: DARK_THEME.border.subtle,
    });
  });

  it("supports semantic style tokens for value, label, bar, and chrome treatment", () => {
    const { getByTestId } = render(
      <StatBadge
        stat={{ ...baseStats[0]!, bar: true }}
        styles={{
          chrome: { backgroundColor: "#faf5ef" },
          label: { color: "#7c2d12" },
          bar: { trackColor: "#fed7aa" },
          home: {
            barColor: "#c8102e",
            valueColor: "#9f1239",
            winnerValueColor: "#7f1d1d",
          },
          away: {
            barColor: "#132257",
            valueColor: "#1d4ed8",
            winnerValueColor: "#0f172a",
          },
        }}
      />,
    );

    expect(getByTestId("statbadge")).toHaveStyle({ background: "#faf5ef" });
    expect(getByTestId("statbadge-label")).toHaveStyle({ color: "#7c2d12" });
    expect(getByTestId("statbadge-bar")).toHaveStyle({ background: "#fed7aa" });
    expect(getByTestId("statbadge-home-value")).toHaveStyle({ color: "#7f1d1d" });
    expect(getByTestId("statbadge-bar-home")).toHaveStyle({ background: "#c8102e" });
    expect(getByTestId("statbadge-bar-away")).toHaveStyle({ background: "#132257" });
  });

  it("propagates row-level semantic styles to each badge", () => {
    const { getAllByTestId } = render(
      <StatBadgeRow
        stats={baseStats.map((stat) => ({ ...stat, bar: true }))}
        styles={{
          label: { color: "#92400e" },
          home: { barColor: "#c8102e" },
          away: { barColor: "#132257" },
        }}
      />,
    );

    for (const label of getAllByTestId("statbadge-label")) {
      expect(label).toHaveStyle({ color: "#92400e" });
    }
    for (const segment of getAllByTestId("statbadge-bar-home")) {
      expect(segment).toHaveStyle({ background: "#c8102e" });
    }
    for (const segment of getAllByTestId("statbadge-bar-away")) {
      expect(segment).toHaveStyle({ background: "#132257" });
    }
  });
});

describe("<StatBadge /> — edge cases", () => {
  it("renders very long labels without throwing", () => {
    const stat: Stat = {
      label: "Expected goals from open play, excluding penalties and direct free kicks",
      home: "1.43",
      away: "0.92",
      homeValue: 1.43,
      awayValue: 0.92,
    };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    expect(getByTestId("statbadge-label").textContent).toContain("Expected goals");
  });

  it("renders very large values without breaking the layout", () => {
    const stat: Stat = {
      label: "Total touches",
      home: "1,234,567",
      away: "987,654",
      homeValue: 1234567,
      awayValue: 987654,
    };
    const { getByTestId } = render(<StatBadge stat={stat} />);
    expect(getByTestId("statbadge-home-value").textContent).toBe("1,234,567");
    expect(getByTestId("statbadge-away-value").textContent).toBe("987,654");
  });
});

describe("<StatBadgeRow /> — accessibility", () => {
  it("is axe-clean for the zero-config row", async () => {
    const { container } = render(<StatBadgeRow stats={baseStats} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("is axe-clean with bars and a custom ariaLabel", async () => {
    const stats: Stat[] = baseStats.map((s) => ({ ...s, bar: true }));
    const { container } = render(
      <StatBadgeRow stats={stats} ariaLabel="Arsenal vs Liverpool — full time" />,
    );
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it("is axe-clean for an empty row", async () => {
    const { container } = render(<StatBadgeRow stats={[]} />);
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
