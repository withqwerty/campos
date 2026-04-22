import type { ReactElement } from "react";

/**
 * Inline-path icon glyphs used by `MarkerIcon kind="goal" | "assist"`.
 *
 * The path data is lifted directly from the asset SVGs in
 * `assets/football-fill.svg`, `assets/football-outline.svg`,
 * `assets/boot-fill.svg`, and `assets/boot-outline.svg`. They are
 * inlined here (rather than referenced via `<image href="...">`) so
 * the glyph renders inside the parent Formation `<svg>` without
 * needing to ship a separate request — the marker SVG is the only
 * surface, and embedded paths are crisp at every scale.
 *
 * Each component renders a nested `<svg>` element so the source
 * viewBox is preserved (each asset has its own coordinate system) and
 * the output is centred on (0, 0) at the requested cell size. The
 * caller passes a marker radius `r` and the icon sizes itself to a
 * fraction of `r` matching `MARKER_ICON_CELL_SIZES`.
 *
 * Convention:
 *   goal   → football  (filled, with outline variant available)
 *   assist → boot      (filled, with outline variant available)
 */

const FOOTBALL_VIEWBOX = "0 0 72.371 72.372";
const BOOT_VIEWBOX = "0 0 60 60";
const FOOTBALL_OUTLINE_VIEWBOX = "0 0 480 480";
const ARROW_DOWN_VIEWBOX = "0 0 512 512";
const ARROW_UP_VIEWBOX = "0 0 64 64";

const ARROW_DOWN_PATH =
  "m444.009 275.145-81.34 108.58-89.751 119.808a21.139 21.139 0 0 1 -33.841 0l-89.746-119.808-81.34-108.58a21.14 21.14 0 0 1 16.918-33.817h85.76v-241.328h170.662v241.328h85.76a21.138 21.138 0 0 1 16.918 33.817z";

// Arrow up: triangle head + rectangular shaft (two separate paths)
const ARROW_UP_PATHS = [
  "m5.299 38.648 26.701-38.648 26.701 38.648z",
  "m20.094 36.493h23.812v27.507h-23.812z",
];

// Path data lifted verbatim from the asset files. See repo /assets/.
const FOOTBALL_FILL_PATH =
  "M22.57,2.648c-4.489,1.82-8.517,4.496-11.971,7.949C7.144,14.051,4.471,18.08,2.65,22.568C0.892,26.904,0,31.486,0,36.186c0,4.699,0.892,9.281,2.65,13.615c1.821,4.489,4.495,8.518,7.949,11.971c3.454,3.455,7.481,6.129,11.971,7.949c4.336,1.76,8.917,2.649,13.617,2.649c4.7,0,9.28-0.892,13.616-2.649c4.488-1.82,8.518-4.494,11.971-7.949c3.455-3.453,6.129-7.48,7.949-11.971c1.758-4.334,2.648-8.916,2.648-13.615c0-4.7-0.891-9.282-2.648-13.618c-1.82-4.488-4.496-8.518-7.949-11.971s-7.479-6.129-11.971-7.949C45.467,0.891,40.887,0,36.187,0C31.487,0,26.906,0.891,22.57,2.648z M9.044,51.419c-1.743-1.094-3.349-2.354-4.771-3.838c-2.172-6.112-2.54-12.729-1.101-19.01c0.677-1.335,1.447-2.617,2.318-3.845c0.269-0.379,0.518-0.774,0.806-1.142l8.166,4.832c0,0.064,0,0.134,0,0.205c-0.021,4.392,0.425,8.752,1.313,13.049c0.003,0.02,0.006,0.031,0.01,0.049l-6.333,9.93C9.314,51.579,9.177,51.503,9.044,51.419z M33.324,68.206c1.409,0.719,2.858,1.326,4.347,1.82c-6.325,0.275-12.713-1.207-18.36-4.447L33,68.018C33.105,68.085,33.212,68.149,33.324,68.206z M33.274,65.735L17.12,62.856c-1.89-2.295-3.59-4.723-5.051-7.318c-0.372-0.66-0.787-1.301-1.102-1.99l6.327-9.92c0.14,0.035,0.296,0.072,0.473,0.119c3.958,1.059,7.986,1.812,12.042,2.402c0.237,0.033,0.435,0.062,0.604,0.08l7.584,13.113c-1.316,1.85-2.647,3.69-4.007,5.51C33.764,65.155,33.524,65.446,33.274,65.735z M60.15,60.149c-1.286,1.287-2.651,2.447-4.08,3.481c-0.237-1.894-0.646-3.75-1.223-5.563l8.092-15.096c2.229-1.015,4.379-2.166,6.375-3.593c0.261-0.185,0.478-0.392,0.646-0.618C69.374,46.561,66.104,54.196,60.15,60.149z M59.791,40.571c0.301,0.574,0.598,1.154,0.896,1.742l-7.816,14.58c-0.045,0.01-0.088,0.02-0.133,0.026c-4.225,0.789-8.484,1.209-12.779,1.229l-7.8-13.487c1.214-2.254,2.417-4.517,3.61-6.781c0.81-1.536,1.606-3.082,2.401-4.627l16.143-1.658C56.29,34.495,58.163,37.457,59.791,40.571z M56.516,23.277c-0.766,2.023-1.586,4.025-2.401,6.031l-15.726,1.615c-0.188-0.248-0.383-0.492-0.588-0.725c-1.857-2.103-3.726-4.193-5.592-6.289c0.017-0.021,0.034-0.037,0.051-0.056c-0.753-0.752-1.508-1.504-2.261-2.258l4.378-13.181c0.302-0.08,0.606-0.147,0.913-0.18c2.38-0.242,4.763-0.516,7.149-0.654c1.461-0.082,2.93-0.129,4.416-0.024l10.832,12.209C57.314,20.943,56.95,22.124,56.516,23.277z M60.15,12.221c2.988,2.99,5.302,6.402,6.938,10.047c-2.024-1.393-4.188-2.539-6.463-3.473c-0.354-0.146-0.717-0.275-1.086-0.402L48.877,6.376c0.074-0.519,0.113-1.039,0.129-1.563C53.062,6.464,56.864,8.936,60.15,12.221z M25.334,4.182c0.042,0.031,0.062,0.057,0.086,0.064c2.437,0.842,4.654,2.082,6.744,3.553l-4.09,12.317c-0.021,0.006-0.041,0.012-0.061,0.021c-0.837,0.346-1.69,0.656-2.514,1.031c-3.395,1.543-6.705,3.252-9.823,5.301l-8.071-4.775c0.012-0.252,0.055-0.508,0.141-0.736c0.542-1.444,1.075-2.896,1.688-4.311c0.472-1.09,1.01-2.143,1.597-3.172c0.384-0.424,0.782-0.844,1.192-1.254c3.833-3.832,8.363-6.553,13.186-8.162C25.384,4.098,25.358,4.139,25.334,4.182z";

const FOOTBALL_OUTLINE_PATH =
  "m240 0c-132.546875 0-240 107.453125-240 240s107.453125 240 240 240 240-107.453125 240-240c-.148438-132.484375-107.515625-239.851562-240-240zm185.863281 115.121094-16.632812 70.703125-87.628907 29.207031-73.601562-58.871094v-86.746094l84-33.597656c38.03125 17.230469 70.523438 44.683594 93.863281 79.304688zm1.335938 247.640625-79.335938 12.527343-43.199219-57.066406 22.007813-88 86.65625-28.878906 49.640625 59.566406c-3.382812 36.371094-15.667969 71.351563-35.769531 101.851563zm-294.710938 12.582031-79.6875-12.582031c-20.101562-30.507813-32.382812-65.496094-35.761719-101.875l49.601563-59.566407 86.65625 28.878907 22.007813 88.046875zm-116.417969-138.328125c.425782-35.6875 9.429688-70.753906 26.25-102.230469l12.976563 55.199219zm174.175782 74.984375-21.222656-84.976562 70.976562-56.777344 70.992188 56.800781-21.238282 84.953125zm234.457031-122.046875 12.976563-55.199219c16.820312 31.476563 25.824218 66.539063 26.25 102.230469zm-114.519531-162.632813-70.183594 28.070313-70.558594-27.941406c45.671875-15.222657 95.042969-15.265625 140.742188-.128907zm-162.566406 8.679688 84.382812 33.441406v86.71875l-73.601562 58.871094-87.628907-29.207031-16.632812-70.703125c23.261719-34.496094 55.613281-61.878906 93.480469-79.121094zm-81.449219 345.070312 65.03125 10.273438 39.328125 61.601562c-40.960938-13.453124-77.1875-38.402343-104.359375-71.875zm127.296875 78.035157-47.738282-74.738281 42.273438-56.367188h104l42.878906 56.640625-41.597656 72.902344c-32.722656 8.058593-66.84375 8.605469-99.808594 1.601562zm122.039062-8.234375 34.097656-59.671875 64.261719-10.136719c-25.816406 31.792969-59.828125 55.929688-98.359375 69.808594zm0 0";

const BOOT_FILL_PATHS = [
  "m57.955 23.255-2.42-2.88-2.111 1.776 2.419 2.877a.189.189 0 0 0 .267.024l1.822-1.531a.183.183 0 0 0 .068-.127.186.186 0 0 0 -.045-.139z",
  "m18.055 41.461a60.693 60.693 0 0 0 12.126-25.807 30.531 30.531 0 0 1 -6.536.082c-.1-.009-.2-.013-.292-.013a2.991 2.991 0 0 0 -2.848 1.966c-.246.716-.5 1.416-.761 2.115a10.908 10.908 0 0 1 3.235 1.337 1 1 0 0 1 -1.039 1.709 8.828 8.828 0 0 0 -2.917-1.158q-.6 1.544-1.236 3.028a10.769 10.769 0 0 1 3.082 1.3 1 1 0 1 1 -1.046 1.7 8.583 8.583 0 0 0 -2.856-1.143q-.688 1.529-1.4 2.988a10.841 10.841 0 0 1 3.189 1.333 1 1 0 1 1 -1.046 1.705 8.61 8.61 0 0 0 -3.07-1.185c-.517 1.008-1.037 1.995-1.562 2.948a10.693 10.693 0 0 1 3.563 1.414 1 1 0 1 1 -1.041 1.72 8.348 8.348 0 0 0 -3.579-1.25c-.639 1.106-1.279 2.166-1.918 3.189a18.218 18.218 0 0 1 6.154 2.244 1.409 1.409 0 0 0 1.798-.222z",
  "m16.936 57.957 1.822-1.53a.216.216 0 0 0 .023-.268l-1.654-1.969-1.051.882a12.682 12.682 0 0 1 -1.115.83l1.707 2.032a.218.218 0 0 0 .268.023z",
  "m4.741 55.679a10.9 10.9 0 0 0 10.048-2.138l9.9-8.309a52.206 52.206 0 0 1 9.534-11.1 39.775 39.775 0 0 1 9.077-6.074l11.735-9.872a2.6 2.6 0 0 0 .747-2.975 29.115 29.115 0 0 0 -4.871-7.735 15.3 15.3 0 0 0 -8.598-5.476.161.161 0 0 0 -.155.055.163.163 0 0 0 -.031.173c1.355 3.848.657 7.183-1.969 9.385a18.007 18.007 0 0 1 -7.875 3.687 62.849 62.849 0 0 1 -12.734 27.5 3.348 3.348 0 0 1 -2.508 1.1 3.528 3.528 0 0 1 -1.813-.5 16.515 16.515 0 0 0 -6.3-2.118c-2.155 3.3-4.247 6.116-6.088 8.4a3.779 3.779 0 0 0 1.9 6z",
  "m47.91 31.939 1.822-1.53a.191.191 0 0 0 .024-.268l-2.414-2.873-2.112 1.776 2.414 2.872a.213.213 0 0 0 .266.023z",
  "m25.136 51.069 1.821-1.53a.185.185 0 0 0 .067-.128.187.187 0 0 0 -.044-.139l-1.652-1.966-2.113 1.774 1.652 1.967a.189.189 0 0 0 .269.022z",
];

const BOOT_OUTLINE_PATH =
  "m54.312 26.314a2.189 2.189 0 0 0 3.084.27l1.821-1.53a2.189 2.189 0 0 0 .269-3.086l-2.492-2.968a4.587 4.587 0 0 0 .644-4.539 31.246 31.246 0 0 0 -5.2-8.277 17.28 17.28 0 0 0 -9.728-6.141 2.169 2.169 0 0 0 -2.472 2.848c.75 2.13 1.122 5.106-1.365 7.192-4.731 3.97-11.455 4-15.043 3.661a5.009 5.009 0 0 0 -5.213 3.287 106.83 106.83 0 0 1 -17.339 31.393 5.779 5.779 0 0 0 2.908 9.176 12.9 12.9 0 0 0 9.008-.692l1.943 2.313a2.179 2.179 0 0 0 1.487.771c.065.005.129.008.194.008a2.168 2.168 0 0 0 1.4-.512l1.822-1.53a2.192 2.192 0 0 0 .268-3.086l-1.649-1.972 3.024-2.538 1.653 1.968a2.2 2.2 0 0 0 3.086.268l1.82-1.531a2.188 2.188 0 0 0 .27-3.086l-1.821-2.166a50.555 50.555 0 0 1 8.816-10.161 41.9 41.9 0 0 1 8.039-5.508l2.566 3.054a2.183 2.183 0 0 0 1.488.773c.064.005.129.008.193.008a2.168 2.168 0 0 0 1.4-.513l1.827-1.528a2.2 2.2 0 0 0 .267-3.086l-2.415-2.874 3.022-2.542zm3.643-3.059a.186.186 0 0 1 .044.139.183.183 0 0 1 -.067.127l-1.822 1.531a.189.189 0 0 1 -.267-.024l-2.419-2.877 2.111-1.776zm-45.936 12.991a8.348 8.348 0 0 1 3.581 1.254 1 1 0 1 0 1.043-1.707 10.693 10.693 0 0 0 -3.563-1.414c.525-.953 1.045-1.94 1.562-2.948a8.61 8.61 0 0 1 3.07 1.185 1 1 0 0 0 1.046-1.705 10.841 10.841 0 0 0 -3.189-1.333q.713-1.457 1.4-2.988a8.583 8.583 0 0 1 2.856 1.143 1 1 0 1 0 1.046-1.7 10.769 10.769 0 0 0 -3.082-1.3q.633-1.482 1.236-3.028a8.828 8.828 0 0 1 2.915 1.145 1 1 0 1 0 1.039-1.709 10.908 10.908 0 0 0 -3.235-1.341c.258-.7.515-1.4.761-2.115a2.991 2.991 0 0 1 2.848-1.966c.1 0 .194 0 .292.013a30.531 30.531 0 0 0 6.536-.082 60.693 60.693 0 0 1 -12.126 25.811 1.409 1.409 0 0 1 -1.8.218 18.218 18.218 0 0 0 -6.155-2.244c.64-1.023 1.28-2.083 1.919-3.189zm6.762 19.913a.216.216 0 0 1 -.023.268l-1.822 1.53a.218.218 0 0 1 -.268-.023l-1.707-2.034a12.682 12.682 0 0 0 1.115-.83l1.051-.882zm8.2-6.887a.187.187 0 0 1 .044.139.185.185 0 0 1 -.067.128l-1.821 1.53a.189.189 0 0 1 -.269-.022l-1.653-1.967 2.113-1.774zm22.775-19.131a.191.191 0 0 1 -.024.268l-1.822 1.53a.213.213 0 0 1 -.266-.023l-2.414-2.872 2.112-1.776zm-6.456-2.083a39.775 39.775 0 0 0 -9.075 6.069 52.206 52.206 0 0 0 -9.534 11.1l-9.9 8.309a10.9 10.9 0 0 1 -10.05 2.143 3.779 3.779 0 0 1 -1.9-6c1.841-2.284 3.933-5.1 6.088-8.4a16.515 16.515 0 0 1 6.3 2.118 3.528 3.528 0 0 0 1.813.5 3.348 3.348 0 0 0 2.508-1.109 62.849 62.849 0 0 0 12.733-27.488 18.007 18.007 0 0 0 7.875-3.679c2.626-2.2 3.324-5.537 1.969-9.385a.163.163 0 0 1 .031-.173.161.161 0 0 1 .155-.063 15.3 15.3 0 0 1 8.6 5.47 29.115 29.115 0 0 1 4.871 7.735 2.6 2.6 0 0 1 -.747 2.975z";

type AssetIconProps = {
  /** Edge length of the icon's bounding box (square). Centred on (0, 0). */
  size: number;
  /** Fill colour for filled variants. */
  color: string;
  /** Stroke colour drawn around the path for contrast against the marker. */
  strokeColor: string;
  /** Stroke width in target user units. Tuned per-icon for legibility. */
  strokeWidth: number;
  /** Optional `data-testid` for assertions. */
  testId?: string;
};

/**
 * Football icon (filled). Used for the goal slot — one footyball per
 * goal scored. Renders inside a nested `<svg>` so the asset's source
 * viewBox is preserved without manual translate/scale arithmetic.
 */
export function FootballFillIcon({
  size,
  color,
  strokeColor,
  strokeWidth,
  testId = "formation-goal",
}: AssetIconProps): ReactElement {
  return (
    <svg
      data-testid={testId}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      viewBox={FOOTBALL_VIEWBOX}
      overflow="visible"
    >
      <path
        d={FOOTBALL_FILL_PATH}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

/**
 * Football icon (outline). Alternative to the filled variant — used
 * when callers want a thinner-weighted goal indicator that doesn't
 * dominate next to filled assist boots.
 */
export function FootballOutlineIcon({
  size,
  color,
  strokeColor,
  strokeWidth,
  testId = "formation-goal",
}: AssetIconProps): ReactElement {
  return (
    <svg
      data-testid={testId}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      viewBox={FOOTBALL_OUTLINE_VIEWBOX}
      overflow="visible"
    >
      <path
        d={FOOTBALL_OUTLINE_PATH}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

/**
 * Boot icon (filled). Used for the assist slot — one boot per assist.
 * The boot SVG is composed of multiple subpaths (boot body, sock,
 * laces, etc); they all render with the same fill so they read as a
 * single silhouette at small scales.
 */
export function BootFillIcon({
  size,
  color,
  strokeColor,
  strokeWidth,
  testId = "formation-assist",
}: AssetIconProps): ReactElement {
  return (
    <svg
      data-testid={testId}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      viewBox={BOOT_VIEWBOX}
      overflow="visible"
    >
      <g fill={color} stroke={strokeColor} strokeWidth={strokeWidth}>
        {BOOT_FILL_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * Boot icon (outline). Alternative outlined variant of the assist
 * indicator. Composed from a single path with multiple subpaths
 * inside — see the asset file for the source.
 */
export function BootOutlineIcon({
  size,
  color,
  strokeColor,
  strokeWidth,
  testId = "formation-assist",
}: AssetIconProps): ReactElement {
  return (
    <svg
      data-testid={testId}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      viewBox={BOOT_VIEWBOX}
      overflow="visible"
    >
      <path
        d={BOOT_OUTLINE_PATH}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}

/**
 * Arrow down icon. Used for sub-off indicators (player substituted out).
 * Path lifted from assets/arrow-down.svg (viewBox 0 0 512 512).
 */
export function ArrowDownIcon({
  size,
  color,
  strokeColor,
  strokeWidth,
  testId = "formation-arrow-down",
}: AssetIconProps): ReactElement {
  return (
    <svg
      data-testid={testId}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      viewBox={ARROW_DOWN_VIEWBOX}
      overflow="visible"
    >
      <path
        d={ARROW_DOWN_PATH}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fillRule="evenodd"
      />
    </svg>
  );
}

/**
 * Arrow up icon. Used for sub-on indicators (player coming on from bench).
 * Two-path composition (triangle head + shaft) from assets/arrow-up.svg
 * (viewBox 0 0 64 64).
 */
export function ArrowUpIcon({
  size,
  color,
  strokeColor,
  strokeWidth,
  testId = "formation-arrow-up",
}: AssetIconProps): ReactElement {
  return (
    <svg
      data-testid={testId}
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      viewBox={ARROW_UP_VIEWBOX}
      overflow="visible"
    >
      <g fill={color} stroke={strokeColor} strokeWidth={strokeWidth}>
        {ARROW_UP_PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
