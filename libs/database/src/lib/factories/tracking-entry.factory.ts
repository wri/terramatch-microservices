import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { Tracking, TrackingEntry } from "../entities";
import { TrackingFactory } from "./tracking.factory";

const TYPES = ["gender", "age", "ethnicity", "caste"] as const;
const SUBTYPES: Record<string, (null | string)[]> = {
  gender: ["male", "female", "non-binary"],
  age: ["youth", "adult", "elder"],
  ethnicity: ["indigenous", "unknown", "other"],
  caste: ["marginalized"]
};
const NAMES: Record<string, (null | string)[]> = {
  gender: [null],
  age: [null],
  ethnicity: ["Cuyono", "Tupiniquim", "Visaya"],
  caste: [null]
};

const defaultAttributesFactory = async (type?: string, subtype?: string, name?: string) => {
  type ??= faker.helpers.arrayElement(TYPES);
  return {
    type,
    subtype: subtype ?? faker.helpers.arrayElement(SUBTYPES[type] ?? [null]),
    name: name ?? faker.helpers.arrayElement(NAMES[type] ?? [null]),
    amount: faker.number.int({ min: 10, max: 100 })
  };
};

export const TrackingEntryFactory = {
  any: (tracking?: Tracking) =>
    FactoryGirl.define(TrackingEntry, async () => ({
      ...(await defaultAttributesFactory()),
      trackingId: (tracking?.id as number) ?? TrackingFactory.projectReportWorkday().associate("id")
    })),

  gender: (tracking?: Tracking, subtype?: string) =>
    FactoryGirl.define(TrackingEntry, async () => ({
      ...(await defaultAttributesFactory("gender", subtype)),
      trackingId: (tracking?.id as number) ?? TrackingFactory.projectReportWorkday().associate("id")
    })),

  age: (tracking?: Tracking, subtype?: string) =>
    FactoryGirl.define(TrackingEntry, async () => ({
      ...(await defaultAttributesFactory("age", subtype)),
      trackingId: (tracking?.id as number) ?? TrackingFactory.projectReportWorkday().associate("id")
    })),

  ethnicity: (tracking?: Tracking, subtype?: string, name?: string) =>
    FactoryGirl.define(TrackingEntry, async () => ({
      ...(await defaultAttributesFactory("ethnicity", subtype, name)),
      trackingId: (tracking?.id as number) ?? TrackingFactory.projectReportWorkday().associate("id")
    })),

  caste: (tracking?: Tracking, subtype?: string, name?: string) =>
    FactoryGirl.define(TrackingEntry, async () => ({
      ...(await defaultAttributesFactory("caste", subtype, name)),
      trackingId: (tracking?.id as number) ?? TrackingFactory.projectReportWorkday().associate("id")
    })),

  years: (tracking?: Tracking, subtype?: string, name?: string) =>
    FactoryGirl.define(TrackingEntry, async () => ({
      ...(await defaultAttributesFactory("years", subtype, name)),
      trackingId: (tracking?.id as number) ?? TrackingFactory.projectReportWorkday().associate("id")
    })),

  strategy: (tracking?: Tracking, subtype?: string, name?: string) =>
    FactoryGirl.define(TrackingEntry, async () => ({
      ...(await defaultAttributesFactory("strategy", subtype, name)),
      trackingId: (tracking?.id as number) ?? TrackingFactory.projectReportWorkday().associate("id")
    }))
};
