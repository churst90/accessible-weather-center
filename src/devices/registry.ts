/**
 * Device list without the type re-exports.
 *
 * `devices/types.ts` imports `ProductEra` from the audio manifests, and
 * `sceneSegments.ts` needs the device list — importing `devices/index.ts`
 * from there would close a cycle. This module carries only the data.
 */
import { WS3000 } from "./profiles/ws3000";
import { WSJR } from "./profiles/wsjr";
import { WS4000_V1 } from "./profiles/ws4000-v1";
import { WS4000_V2 } from "./profiles/ws4000-v2";
import { WEATHERSTAR_XL } from "./profiles/weatherstarxl";
import { WEATHERSCAN_LOCAL } from "./profiles/weatherscan-local";
import { WEATHERSCAN_V1 } from "./profiles/weatherscan-v1";
import { WEATHERSCAN_V2 } from "./profiles/weatherscan-v2";
import { INTELLISTAR1 } from "./profiles/intellistar1";
import { INTELLISTAR2 } from "./profiles/intellistar2";

export const DEVICES = [
  WS3000, WSJR, WS4000_V1, WS4000_V2, WEATHERSTAR_XL,
  WEATHERSCAN_LOCAL, WEATHERSCAN_V1, WEATHERSCAN_V2, INTELLISTAR1, INTELLISTAR2
];
