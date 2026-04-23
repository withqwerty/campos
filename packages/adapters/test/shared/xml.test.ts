import { describe, expect, it } from "vitest";

import { asArray, parseXmlDocument } from "../../src/shared/xml";

describe("parseXmlDocument", () => {
  it("parses a simple self-closing element with attributes", () => {
    const result = parseXmlDocument('<a foo="bar" />') as { a?: { foo?: string } };
    expect(result.a?.foo).toBe("bar");
  });

  it("keeps numeric-looking attributes as strings (no silent coercion)", () => {
    const result = parseXmlDocument('<a MatchId="00001" />') as {
      a?: { MatchId?: unknown };
    };
    expect(result.a?.MatchId).toBe("00001");
    expect(typeof result.a?.MatchId).toBe("string");
  });

  it("preserves nested element hierarchy", () => {
    const result = parseXmlDocument(
      '<root><child name="inner"><grand value="deep" /></child></root>',
    ) as {
      root?: { child?: { name?: string; grand?: { value?: string } } };
    };
    expect(result.root?.child?.name).toBe("inner");
    expect(result.root?.child?.grand?.value).toBe("deep");
  });

  it("returns an object even for an empty document root", () => {
    const result = parseXmlDocument("<root />");
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("blocks in-memory entity expansion (billion-laughs safety)", () => {
    // A billion-laughs payload: one 'lol' entity referencing itself N times.
    // With processEntities disabled the result should NOT contain any
    // expansion of the entity — no "lollollollol..." string in the payload.
    const payload =
      '<?xml version="1.0"?>' +
      "<!DOCTYPE r [" +
      '<!ENTITY lol "lol">' +
      '<!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">' +
      "]>" +
      "<r>&lol2;</r>";
    const serialised = JSON.stringify(parseXmlDocument(payload));
    expect(serialised).not.toMatch(/lollollol/);
  });

  it("trims whitespace around text values", () => {
    // trimValues:true is configured on the parser; ensure it applies.
    const result = parseXmlDocument("<root>   hello   </root>") as { root?: unknown };
    expect(result.root).toBe("hello");
  });
});

describe("asArray", () => {
  it("returns an empty array for null", () => {
    expect(asArray(null)).toEqual([]);
  });

  it("returns an empty array for undefined", () => {
    expect(asArray(undefined)).toEqual([]);
  });

  it("wraps a single value into a one-element array", () => {
    expect(asArray(42)).toEqual([42]);
    expect(asArray("hello")).toEqual(["hello"]);
    expect(asArray({ id: 1 })).toEqual([{ id: 1 }]);
  });

  it("passes an existing array through unchanged", () => {
    const source = [1, 2, 3];
    const out = asArray(source);
    expect(out).toEqual([1, 2, 3]);
  });

  it("widens a readonly array to a mutable array (return type)", () => {
    const source: readonly number[] = [1, 2, 3];
    const out = asArray(source);
    out.push(4);
    expect(out).toEqual([1, 2, 3, 4]);
  });

  it("treats an empty array as-is (does not wrap again)", () => {
    expect(asArray([])).toEqual([]);
  });
});
