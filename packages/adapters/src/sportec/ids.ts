/**
 * Maps Sportec string event ids onto stable numeric ids for the Opta
 * intermediate representation, and preserves the originals so rebrand can
 * restore them on canonical outputs. Substitution player-on events use a
 * synthetic key `${eventId}:in` to keep their numeric id distinct from the
 * organic neighbour at `base.id + 1`.
 */
export type SportecIdAllocator = {
  allocate(key: string): number;
  resolve(numericId: number): string | undefined;
};

export function makeSportecIdAllocator(): SportecIdAllocator {
  const byKey = new Map<string, number>();
  const byNumeric = new Map<number, string>();
  let counter = 0;
  return {
    allocate(key: string): number {
      const existing = byKey.get(key);
      if (existing != null) return existing;
      counter += 1;
      byKey.set(key, counter);
      byNumeric.set(counter, key);
      return counter;
    },
    resolve(numericId: number): string | undefined {
      return byNumeric.get(numericId);
    },
  };
}
