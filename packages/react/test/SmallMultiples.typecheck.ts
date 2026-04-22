import type {
  CellLabelProps,
  SharedPitchScale,
  SharedPitchScaleAccessors,
  SmallMultiplesProps,
  SmallMultiplesView,
} from "../src/index.js";
import { computeSharedPitchScale } from "../src/index.js";

type Team = {
  id: string;
  shots: number;
};

const sharedScale: SharedPitchScale = {
  sizeDomain: [0, 10],
  meta: {
    custom: [0, 1],
  },
};

const sharedScaleAccessors: SharedPitchScaleAccessors<Team> = {
  size: (team) => team.shots,
  meta: {
    custom: (team) => team.shots,
  },
};

const computedScale = computeSharedPitchScale(
  [{ id: "ars", shots: 3 }],
  sharedScaleAccessors,
);

const view: SmallMultiplesView = {
  pitchOrientation: "vertical",
  pitchCrop: "half",
  sharedScale,
};

const labelProps: CellLabelProps = {
  title: "Arsenal",
  caption: "1.8 xG",
};

const validProps: SmallMultiplesProps<Team> = {
  items: [],
  getItemKey: (team) => team.id,
  renderCell: (team, index, cellView) =>
    `${team.id}-${index}-${cellView.pitchOrientation ?? "unset"}`,
  renderLabel: (team) => team.id,
  columns: { minCellWidth: 220 },
  pitchOrientation: "horizontal",
  pitchCrop: "full",
  sharedScale,
};

const invalidCrop: SmallMultiplesProps<Team> = {
  items: [],
  getItemKey: (team) => team.id,
  renderCell: (team) => team.id,
  // @ts-expect-error SmallMultiples only supports "full" | "half" for pitchCrop.
  pitchCrop: "attacking-half",
};

const invalidKey: SmallMultiplesProps<Team> = {
  items: [],
  // @ts-expect-error Keys must be strings or numbers.
  getItemKey: () => true,
  renderCell: (team) => team.id,
};

const invalidScale: SharedPitchScale = {
  // @ts-expect-error Domains must be 2-tuples.
  sizeDomain: [0, 1, 2],
};

void [
  labelProps,
  validProps,
  invalidCrop,
  invalidKey,
  invalidScale,
  view,
  sharedScaleAccessors,
  computedScale,
];
