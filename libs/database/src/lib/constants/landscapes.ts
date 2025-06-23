export const LANDSCAPE_TYPES = ["gcb", "grv", "ikr"] as const;
export type LandscapeType = (typeof LANDSCAPE_TYPES)[number];

export const LANDSCAPE_CODE_TO_NAME_MAP = {
  gcb: "Ghana Cocoa Belt",
  grv: "Greater Rift Valley of Kenya",
  ikr: "Lake Kivu & Rusizi River Basin"
} as const;

export function mapLandscapeCodesToNames(codes: string[]): string[] {
  return codes.map(code => LANDSCAPE_CODE_TO_NAME_MAP[code as LandscapeType] ?? code);
}
