import { DateTime } from "luxon";
import { Valid } from "luxon/src/_util";

// A collection of assertions for use in REPL scripts.
// Note: These should not be used in normal service / library code!

export class AssertionError extends Error {}

export const assert = (condition: boolean, message: string) => {
  if (!condition) throw new AssertionError(message);
};

export const assertNotNull = <T>(value: T | null | undefined, message: string): T => {
  assert(value != null, message);
  return value as T;
};

export const assertNumber = (value: string | null, message: string) => {
  const stringValue = assertNotNull(value, message);
  assert(!isNaN(Number(stringValue)), message);
  return Number(stringValue);
};

export const assertDate = (value: string | null, message: string, format = "M/d/yy") => {
  const stringValue = assertNotNull(value, message);
  const result = DateTime.fromFormat(stringValue, format);
  assert(result.isValid, message);
  return result as DateTime<Valid>;
};

export const assertMember = <T>(value: T | null | undefined, set: readonly T[], message: string) => {
  assert(set.includes(assertNotNull(value, message)), message);
  return value as T;
};
