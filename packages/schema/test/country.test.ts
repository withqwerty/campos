import { describe, expect, it } from "vitest";

import {
  countryMapping,
  getCountryCode,
  getCountryCodeOrFallback,
  hasFlag,
} from "../src/country";

describe("getCountryCode", () => {
  it("resolves common FIFA member names to three-letter codes", () => {
    expect(getCountryCode("England")).toBe("ENG");
    expect(getCountryCode("Brazil")).toBe("BRA");
    expect(getCountryCode("Argentina")).toBe("ARG");
    expect(getCountryCode("United States")).toBe("USA");
  });

  it("is case-insensitive", () => {
    expect(getCountryCode("england")).toBe("ENG");
    expect(getCountryCode("ENGLAND")).toBe("ENG");
    expect(getCountryCode("EnGlAnD")).toBe("ENG");
  });

  it("preserves FIFA's home-nation split — England is ENG, not GBR", () => {
    expect(getCountryCode("England")).toBe("ENG");
    expect(getCountryCode("Scotland")).toBe("SCO");
    expect(getCountryCode("Wales")).toBe("WAL");
    expect(getCountryCode("Northern Ireland")).toBe("NIR");
  });

  it("routes 'Great Britain' (Olympic composite) to GBR", () => {
    expect(getCountryCode("Great Britain")).toBe("GBR");
    expect(getCountryCode("UK")).toBe("GBR");
  });

  it("resolves Côte d'Ivoire spellings via the alias table", () => {
    expect(getCountryCode("Ivory Coast")).toBe("CIV");
    expect(getCountryCode("Côte d'Ivoire")).toBe("CIV");
    expect(getCountryCode("Cote d'Ivoire")).toBe("CIV");
  });

  it("resolves provider-specific Korea names via aliases", () => {
    expect(getCountryCode("Korea Republic")).toBe("KOR");
    expect(getCountryCode("Republic of Korea")).toBe("KOR");
    expect(getCountryCode("Korea DPR")).toBe("PRK");
  });

  it("resolves Türkiye and legacy Turkey spellings to TUR", () => {
    expect(getCountryCode("Türkiye")).toBe("TUR");
    expect(getCountryCode("Turkiye")).toBe("TUR");
    expect(getCountryCode("Turkey")).toBe("TUR");
  });

  it("resolves common abbreviations to their FIFA codes", () => {
    expect(getCountryCode("USA")).toBe("USA");
    expect(getCountryCode("US")).toBe("USA");
    expect(getCountryCode("UAE")).toBe("ARE");
    expect(getCountryCode("KSA")).toBe("KSA");
    expect(getCountryCode("DRC")).toBe("COD");
    expect(getCountryCode("DR Congo")).toBe("COD");
  });

  it("returns undefined for unknown country names", () => {
    expect(getCountryCode("Neverland")).toBeUndefined();
    expect(getCountryCode("")).toBeUndefined();
    expect(getCountryCode("   ")).toBeUndefined();
  });

  it("accepts IR Iran (provider variant) and resolves to IRN", () => {
    expect(getCountryCode("IR Iran")).toBe("IRN");
    expect(getCountryCode("Iran")).toBe("IRN");
  });
});

describe("getCountryCodeOrFallback", () => {
  it("returns the FIFA code when the country is known", () => {
    expect(getCountryCodeOrFallback("England")).toBe("ENG");
  });

  it("returns the explicit fallback when the country is unknown", () => {
    expect(getCountryCodeOrFallback("Neverland", "UNK")).toBe("UNK");
  });

  it("returns the input name unchanged when no fallback is provided", () => {
    expect(getCountryCodeOrFallback("Neverland")).toBe("Neverland");
    expect(getCountryCodeOrFallback("Ruritania")).toBe("Ruritania");
  });

  it("ignores the fallback when a mapping exists", () => {
    expect(getCountryCodeOrFallback("Brazil", "UNK")).toBe("BRA");
  });
});

describe("hasFlag", () => {
  it("returns true for every code present in countryMapping.json", () => {
    for (const code of Object.values(countryMapping)) {
      expect(hasFlag(code), `missing hasFlag entry for ${code}`).toBe(true);
    }
  });

  it("returns true for FIFA home-nation codes", () => {
    expect(hasFlag("ENG")).toBe(true);
    expect(hasFlag("SCO")).toBe(true);
    expect(hasFlag("WAL")).toBe(true);
    expect(hasFlag("NIR")).toBe(true);
  });

  it("returns false for codes not present in the mapping", () => {
    expect(hasFlag("ZZZ")).toBe(false);
    expect(hasFlag("AAA")).toBe(false);
    expect(hasFlag("")).toBe(false);
  });

  it("is case-sensitive (mapping stores codes in uppercase)", () => {
    expect(hasFlag("eng")).toBe(false);
    expect(hasFlag("Eng")).toBe(false);
  });
});

describe("countryMapping invariants", () => {
  it("has at least 200 entries (covers all FIFA members plus territories)", () => {
    expect(Object.keys(countryMapping).length).toBeGreaterThanOrEqual(200);
  });

  it("stores every value as an uppercase A-Z code (3 letters, with NRCY as the documented 4-letter exception)", () => {
    const pattern = /^[A-Z]{3,4}$/;
    for (const [name, code] of Object.entries(countryMapping)) {
      expect(code, `invalid code for ${name}: ${code}`).toMatch(pattern);
    }
    // Tighten the exception list so a future drift (a second 4-letter code
    // sneaking in) is caught rather than silently absorbed by the pattern.
    const nonStandard = Object.values(countryMapping).filter((code) => code.length !== 3);
    expect(nonStandard).toEqual(["NRCY"]);
  });

  it("stores every key as a lowercase string (the lookup normalises inputs)", () => {
    for (const name of Object.keys(countryMapping)) {
      expect(name, `non-lowercase key: ${name}`).toBe(name.toLowerCase());
    }
  });
});
