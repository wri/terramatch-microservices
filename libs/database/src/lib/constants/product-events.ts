export const EVENT_CATEGORIES = ["project-reporting", "financial-reporting", "applications", "polygons"] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
