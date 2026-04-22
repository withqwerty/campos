import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";

import { CellLabel, SmallMultiples } from "../src/SmallMultiples";

type Team = {
  id: string;
  name: string;
  record: string;
};

const teams: Team[] = [
  { id: "ars", name: "Arsenal", record: "4W-1D" },
  { id: "liv", name: "Liverpool", record: "3W-2D" },
];

describe("<SmallMultiples /> — SSR", () => {
  it("renders semantic region and figure markup on the server", () => {
    const html = renderToString(
      <SmallMultiples
        items={teams}
        getItemKey={(team) => team.id}
        renderLabel={(team) => <CellLabel title={team.name} caption={team.record} />}
        renderCell={(team) => <div>{team.name}</div>}
      />,
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Small multiples grid"');
    expect(html).toContain("<figure");
    expect(html).toContain("<figcaption");
    expect(html).toContain("Arsenal");
  });

  it("renders the empty-state contract on the server", () => {
    const html = renderToString(
      <SmallMultiples
        items={[]}
        getItemKey={(team: Team) => team.id}
        renderCell={() => null}
      />,
    );

    expect(html).toContain('data-empty="true"');
    expect(html).toContain("No items to compare.");
  });
});
