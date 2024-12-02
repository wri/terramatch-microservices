import { FactoryGirl } from "factory-girl-ts";
import { PolygonGeometry } from "../entities";
import { UserFactory } from "./user.factory";

// The shortest polygon defined in the prod DB as of the writing of this test.
export const POLYGON = {
  type: "Polygon",
  coordinates: [
    [
      [104.14293058113105, 13.749724096039358],
      [104.68941630988292, 13.586722290863463],
      [104.40664352872176, 13.993692766531538],
      [104.14293058113105, 13.749724096039358]
    ]
  ]
};

export const PolygonGeometryFactory = FactoryGirl.define(PolygonGeometry, async () => ({
  uuid: crypto.randomUUID(),
  polygon: POLYGON,
  createdBy: UserFactory.associate("id")
}));
