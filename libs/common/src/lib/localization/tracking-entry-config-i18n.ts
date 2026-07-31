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

/** Collect user-facing strings stored in entryConfigs for TFX push. */
export const getTrackingEntryConfigLabels = (additionalProps: unknown): string[] => {
  if (additionalProps == null || typeof additionalProps !== "object") return [];
  const entryConfigs = (additionalProps as { entryConfigs?: TrackingEntryConfig[] | null }).entryConfigs;
  if (!Array.isArray(entryConfigs)) return [];

  return entryConfigs
    .flatMap(config => [
      trimLabel(config?.title),
      trimLabel(config?.displayTrackingType),
      trimLabel(config?.addNameLabel),
      ...(config?.subTypes ?? []).map(subType => trimLabel(subType?.label))
    ])
    .filter(isNotNull);
};
