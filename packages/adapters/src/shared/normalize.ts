/**
 * Validate that a period value is a recognised football period (1–5)
 * and narrow its type. Throws with the provider name in the error message.
 */
export function validatePeriod(value: number, provider: string): 1 | 2 | 3 | 4 | 5 {
  if (value >= 1 && value <= 5 && Number.isInteger(value)) {
    return value as 1 | 2 | 3 | 4 | 5;
  }
  throw new Error(`Unsupported ${provider} period value: ${value}`);
}
