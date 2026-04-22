/**
 * Backwards-compat re-exports for the consolidated contrast utility.
 * New code should import from `./colorContrast.js` directly — this file
 * exists so existing imports keep working through the v0.3-beta cycle.
 */
export { contrastColor, hexLuminance } from "./colorContrast.js";
