import { cleanup, render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CellLabel,
  SmallMultiples,
  type SmallMultiplesProps,
} from "../src/SmallMultiples";

afterEach(cleanup);

type Team = {
  id: string;
  name: string;
  record: string;
};

const teams: Team[] = [
  { id: "ars", name: "Arsenal", record: "4W-1D" },
  { id: "liv", name: "Liverpool", record: "3W-2D" },
  { id: "int", name: "Inter", record: "4W-0D" },
  { id: "nap", name: "Napoli", record: "2W-2D" },
];

function renderGrid(props: Partial<SmallMultiplesProps<Team>> = {}) {
  return render(
    <SmallMultiples
      items={teams}
      getItemKey={(team) => team.id}
      renderCell={(team) => <div data-testid={`cell-${team.id}`}>{team.name}</div>}
      {...props}
    />,
  );
}

describe("<SmallMultiples /> — rendering", () => {
  it("renders one figure per item", () => {
    const { getAllByRole } = renderGrid();
    expect(getAllByRole("figure")).toHaveLength(4);
  });

  it("renders a default empty state when items is empty", () => {
    const { getByRole, getByText, queryAllByRole } = render(
      <SmallMultiples
        items={[]}
        getItemKey={(team: Team) => team.id}
        renderCell={() => null}
      />,
    );

    expect(getByRole("region", { name: "Small multiples grid" })).toHaveAttribute(
      "data-empty",
      "true",
    );
    expect(getByText("No items to compare.")).toBeInTheDocument();
    expect(queryAllByRole("figure")).toHaveLength(0);
  });

  it("renders a custom empty state when provided", () => {
    const { getByText } = render(
      <SmallMultiples
        items={[]}
        getItemKey={(team: Team) => team.id}
        renderCell={() => null}
        emptyState={<p>No matchups selected.</p>}
      />,
    );

    expect(getByText("No matchups selected.")).toBeInTheDocument();
  });

  it("marks null cells as intentionally empty", () => {
    const { getAllByRole } = renderGrid({
      renderCell: (_, index) => (index === 1 ? null : <div>ok</div>),
    });

    const figures = getAllByRole("figure");
    expect(figures[1]).toHaveAttribute("data-campos-cell-empty", "true");
  });

  it("passes the final view object into renderCell", () => {
    const renderCell = vi.fn<SmallMultiplesProps<Team>["renderCell"]>(() => (
      <div>ok</div>
    ));

    render(
      <SmallMultiples
        items={teams}
        getItemKey={(team) => team.id}
        renderCell={renderCell}
        pitchOrientation="vertical"
        pitchCrop="half"
        sharedScale={{ sizeDomain: [0, 1] }}
      />,
    );

    expect(renderCell).toHaveBeenCalled();
    expect(renderCell.mock.calls[0]?.[2]).toEqual({
      pitchOrientation: "vertical",
      pitchCrop: "half",
      sharedScale: { sizeDomain: [0, 1] },
    });
  });
});

describe("<SmallMultiples /> — layout options", () => {
  it("uses a fixed column count when columns is numeric", () => {
    const { getByTestId } = renderGrid({ columns: 3 });
    expect(getByTestId("smallmultiples-grid").getAttribute("style")).toContain(
      "repeat(3, minmax(0, 1fr))",
    );
  });

  it("uses auto-fill minmax columns when minCellWidth is provided", () => {
    const { getByTestId } = renderGrid({ columns: { minCellWidth: 300 } });
    expect(getByTestId("smallmultiples-grid").getAttribute("style")).toContain(
      "repeat(auto-fill, minmax(300px, 1fr))",
    );
  });

  it("renders labels above the cell by default", () => {
    const { getAllByRole } = renderGrid({
      renderLabel: (team) => <CellLabel title={team.name} caption={team.record} />,
    });

    const firstFigure = getAllByRole("figure")[0];
    expect(firstFigure?.firstElementChild?.tagName).toBe("FIGCAPTION");
  });

  it("renders labels below the cell when labelPlacement='below'", () => {
    const { getAllByRole } = renderGrid({
      renderLabel: (team) => <CellLabel title={team.name} caption={team.record} />,
      labelPlacement: "below",
    });

    const firstFigure = getAllByRole("figure")[0];
    expect(firstFigure?.lastElementChild?.tagName).toBe("FIGCAPTION");
  });
});

describe("<SmallMultiples /> — error isolation", () => {
  function ThrowingChild(): never {
    throw new Error("boom");
  }

  it("renders an error placeholder when a returned subtree throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderGrid({
      renderCell: (_, index) => (index === 2 ? <ThrowingChild /> : <div>ok</div>),
    });

    expect(container.querySelector("[data-campos-cell-error='true']")).toBeTruthy();
    spy.mockRestore();
  });

  it("renders an error placeholder when renderCell throws synchronously", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderGrid({
      renderCell: (_, index) => {
        if (index === 0) {
          throw new Error("sync boom");
        }
        return <div>ok</div>;
      },
    });

    expect(container.querySelector("[data-campos-cell-error='true']")).toBeTruthy();
    spy.mockRestore();
  });

  it("calls onCellError with the failing item and index", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onCellError = vi.fn();

    renderGrid({
      renderCell: (_, index) => (index === 1 ? <ThrowingChild /> : <div>ok</div>),
      onCellError,
    });

    expect(onCellError).toHaveBeenCalledTimes(1);
    expect(onCellError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(onCellError.mock.calls[0]?.[1]).toEqual(teams[1]);
    expect(onCellError.mock.calls[0]?.[2]).toBe(1);
    spy.mockRestore();
  });

  it("logs both errors when onCellError throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderGrid({
      renderCell: (_, index) => (index === 1 ? <ThrowingChild /> : <div>ok</div>),
      onCellError: () => {
        throw new Error("reporter failed");
      },
    });

    expect(
      spy.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].startsWith("[SmallMultiples] original cell error:"),
      ),
    ).toBe(true);
    expect(
      spy.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].startsWith("[SmallMultiples] onCellError reporter threw:"),
      ),
    ).toBe(true);
    spy.mockRestore();
  });
});

describe("<SmallMultiples /> — diagnostics and accessibility", () => {
  it("warns when getItemKey returns duplicates in development", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <SmallMultiples
        items={teams}
        getItemKey={() => "dup"}
        renderCell={(team) => <div>{team.name}</div>}
      />,
    );

    expect(
      spy.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("getItemKey returned duplicate key"),
      ),
    ).toBe(true);
    spy.mockRestore();
  });

  it("is axe-clean for a labeled grid", async () => {
    const { container } = renderGrid({
      renderLabel: (team) => <CellLabel title={team.name} caption={team.record} />,
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("uses the default aria-label and respects custom overrides", () => {
    const defaultRender = renderGrid();
    expect(
      defaultRender.getByRole("region", { name: "Small multiples grid" }),
    ).toBeInTheDocument();
    defaultRender.unmount();

    const customRender = renderGrid({ ariaLabel: "Scouting comparison grid" });
    expect(
      customRender.getByRole("region", { name: "Scouting comparison grid" }),
    ).toBeInTheDocument();
  });
});
