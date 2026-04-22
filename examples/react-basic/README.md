# React Basic Example

Minimal Campos flow:

```tsx
import { fromOpta } from "@withqwerty/campos-adapters";
import { ShotMap } from "@withqwerty/campos-react";

const shots = fromOpta.shots(rawEvents, matchContext);

export function Example() {
  return <ShotMap shots={shots} />;
}
```

Use this pattern when wiring raw Opta event data into the default React primitive.
