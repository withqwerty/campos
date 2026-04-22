export type SharedPitchScale = {
  sizeDomain?: readonly [number, number];
  colorDomain?: readonly [number, number];
  widthDomain?: readonly [number, number];
  radiusDomain?: readonly [number, number];
  opacityDomain?: readonly [number, number];
  meta?: Record<string, readonly [number, number]>;
};

type SharedPitchScaleAccessorValue = number | readonly number[] | null | undefined;

type SharedPitchScaleAccessor<T> = (
  item: T,
  index: number,
) => SharedPitchScaleAccessorValue;

export type SharedPitchScaleAccessors<T> = {
  size?: SharedPitchScaleAccessor<T>;
  color?: SharedPitchScaleAccessor<T>;
  width?: SharedPitchScaleAccessor<T>;
  radius?: SharedPitchScaleAccessor<T>;
  opacity?: SharedPitchScaleAccessor<T>;
  meta?: Record<string, SharedPitchScaleAccessor<T>>;
};

type Domain = [number, number];

const DOMAIN_KEYS = [
  ["size", "sizeDomain"],
  ["color", "colorDomain"],
  ["width", "widthDomain"],
  ["radius", "radiusDomain"],
  ["opacity", "opacityDomain"],
] as const;

function assertFiniteValue(
  label: string,
  value: unknown,
  index: number,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `[computeSharedPitchScale] accessor "${label}" returned a non-finite value for item at index ${index}.`,
    );
  }
}

function collectDomain<T>(
  items: ReadonlyArray<T>,
  label: string,
  accessor: SharedPitchScaleAccessor<T> | undefined,
): Domain | undefined {
  if (accessor == null) {
    return undefined;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  items.forEach((item, index) => {
    const result = accessor(item, index);
    if (result == null) {
      return;
    }

    const values = Array.isArray(result) ? result : [result];
    values.forEach((value) => {
      assertFiniteValue(label, value, index);
      min = Math.min(min, value);
      max = Math.max(max, value);
    });
  });

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined;
  }

  return [min, max];
}

export function computeSharedPitchScale<T>(
  items: ReadonlyArray<T> | null | undefined,
  accessors: SharedPitchScaleAccessors<T>,
): SharedPitchScale {
  const safeItems = items ?? [];
  if (safeItems.length === 0) {
    return {};
  }

  const sharedScale: SharedPitchScale = {};

  DOMAIN_KEYS.forEach(([accessorKey, domainKey]) => {
    const domain = collectDomain(safeItems, accessorKey, accessors[accessorKey]);
    if (domain != null) {
      sharedScale[domainKey] = domain;
    }
  });

  if (accessors.meta != null) {
    const metaDomains = Object.entries(accessors.meta).reduce<Record<string, Domain>>(
      (acc, [metaKey, accessor]) => {
        const domain = collectDomain(safeItems, `meta.${metaKey}`, accessor);
        if (domain != null) {
          acc[metaKey] = domain;
        }
        return acc;
      },
      {},
    );

    if (Object.keys(metaDomains).length > 0) {
      sharedScale.meta = metaDomains;
    }
  }

  return sharedScale;
}
