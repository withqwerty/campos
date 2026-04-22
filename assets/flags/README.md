# Flag assets

260 country flag SVGs named by **FIFA three-letter country code** (e.g. `ENG.svg`, `BRA.svg`, `USA.svg`).

## Why FIFA codes?

In football, England, Scotland, Wales, and Northern Ireland are separate entities — not subdivisions of "GBR" as in ISO 3166. FIFA codes are the standard identifier in football data and match how providers like StatsBomb, Opta, and Transfermarkt refer to nationalities.

## Lookup utility

Use `getCountryCode()` from `@withqwerty/campos-schema` to resolve messy provider names to FIFA codes:

```ts
import { getCountryCode } from "@withqwerty/campos-schema";

getCountryCode("England"); // "ENG"
getCountryCode("Ivory Coast"); // "CIV"
getCountryCode("Côte d'Ivoire"); // "CIV"
getCountryCode("Korea Republic"); // "KOR"
```

The mapping lives in `packages/schema/src/countryMapping.json` (270 entries). To add a new alias, either add it to the JSON or to the `ALIASES` table in `packages/schema/src/country.ts`.

## Sources

FIFA codes validated against:

- [Wikipedia — List of FIFA country codes](https://en.wikipedia.org/wiki/List_of_FIFA_country_codes)
- [RSSSF — FIFA Codes](https://www.rsssf.org/miscellaneous/fifa-codes.html)
- [Wikimedia country-codes dataset](https://github.com/wikimedia/limn-data)

## Coverage

- 211 FIFA member associations
- ~50 territories and non-FIFA entities (Basque Country, Gibraltar, Guernsey, etc.)
- Historical codes (Czechoslovakia, Soviet Union, Yugoslavia)
