import { DateTime } from "luxon";

export const isoForFilename = (date: Date | DateTime = DateTime.now(), dateOnly = false) => {
  if (date instanceof Date) date = DateTime.fromJSDate(date);
  return date.toFormat(`yyyy-MM-dd${dateOnly ? "" : " HH_mm_ss"}`);
};

export const timestampFileName = (prefix: string, extension = ".csv") =>
  normalizedFileName(`${prefix} - ${isoForFilename()}`, extension);

export const normalizedFileName = (prefix: string, extension = ".csv") => `${prefix}${extension}`.replace(/\/\\/g, "-");
