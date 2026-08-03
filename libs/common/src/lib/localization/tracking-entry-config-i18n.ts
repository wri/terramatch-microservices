import { isNotNull } from "@terramatch-microservices/database/types/array";

type TrackingEntryConfig = {
  title?: string | null;
  displayTrackingType?: string | null;
  addNameLabel?: string | null;
  subTypes?: Array<{ label?: string | null }> | null;
};

const trimLabel = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** Collect user-facing strings from entryConfigs for TFX push (incl. FE composed keys). */
export const getTrackingEntryConfigLabels = (additionalProps: unknown): string[] => {
  if (additionalProps == null || typeof additionalProps !== "object") return [];
  const entryConfigs = (additionalProps as { entryConfigs?: TrackingEntryConfig[] | null }).entryConfigs;
  if (!Array.isArray(entryConfigs)) return [];

  return entryConfigs
    .flatMap(config => {
      const title = trimLabel(config?.title);
      const displayTrackingType = trimLabel(config?.displayTrackingType);

      return [
        title,
        displayTrackingType,
        trimLabel(config?.addNameLabel),
        ...(config?.subTypes ?? []).map(subType => trimLabel(subType?.label)),
        // FE: t(`By: ${title}`), t(`${title} Definition`), t(`Number of ${displayTrackingType}`)
        title == null ? null : `By: ${title}`,
        title == null ? null : `${title} Definition`,
        displayTrackingType == null ? null : `Number of ${displayTrackingType}`
      ];
    })
    .filter(isNotNull);
};
