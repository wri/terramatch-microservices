import {
  parsePolygonAffectedUuids,
  POLYGON_AFFECTED_ENTRY_NAME,
  PRE_APPROVAL_DISTURBANCE_REPORT_STATUSES
} from "./disturbance-report-entries";

describe("parsePolygonAffectedUuids", () => {
  it("returns an empty array for missing or invalid JSON", () => {
    expect(parsePolygonAffectedUuids(null)).toEqual([]);
    expect(parsePolygonAffectedUuids("")).toEqual([]);
    expect(parsePolygonAffectedUuids("not-json")).toEqual([]);
    expect(parsePolygonAffectedUuids("{}")).toEqual([]);
  });

  it("extracts polyUuids from nested site groups", () => {
    expect(
      parsePolygonAffectedUuids(
        JSON.stringify([
          [{ polyUuid: "poly-1", polyName: "A", siteUuid: "site-1" }],
          [
            { polyUuid: "poly-2", polyName: "B", siteUuid: "site-2" },
            { polyUuid: "poly-3", polyName: "C", siteUuid: "site-2" }
          ]
        ])
      )
    ).toEqual(["poly-1", "poly-2", "poly-3"]);
  });

  it("exports the entry name used in reports", () => {
    expect(POLYGON_AFFECTED_ENTRY_NAME).toBe("polygon-affected");
  });

  it("treats pending-approval and information-required as submitted pre-approval statuses", () => {
    expect(PRE_APPROVAL_DISTURBANCE_REPORT_STATUSES).toEqual(["pending-approval", "information-required"]);
  });
});
