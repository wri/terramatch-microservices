import { Demographic } from "../entities";

export type DemographicType = (typeof Demographic.VALID_TYPES)[number];
