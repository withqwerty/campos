import { XMLParser } from "fast-xml-parser";

// processEntities:false blocks in-memory entity expansion (billion-laughs);
// parseAttributeValue:false keeps identifiers like `MatchId="00001"` as strings
// so downstream readString/readOptionalString never sees a silent numeric
// coercion when an XML payload happens to use all-digits ids.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  processEntities: false,
  trimValues: true,
});

export function parseXmlDocument(xml: string): unknown {
  return parser.parse(xml) as unknown;
}

export function asArray<T>(value: T | readonly T[] | null | undefined): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [value as T];
}
