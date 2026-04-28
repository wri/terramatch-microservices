import { DateTime } from "luxon";

export const timestampFileName = (prefix: string, extension = ".csv") => {
  return normalizedFileName(`${prefix} - ${DateTime.now().toFormat("yyyy-MM-dd HH:mm:ss")}`, extension);
};

export const normalizedFileName = (prefix: string, extension = ".csv") => {
  return `${prefix}${extension}`.replace(/\/\\/g, "-");
};
