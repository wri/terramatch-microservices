import { VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { extraInfoNeedsBackfill, transformCriteriaSiteExtraInfo } from "./backfill-extra-info-camel-case.util";

describe("transformCriteriaSiteExtraInfo", () => {
  it("camelCases nested keys for overlapping criteria", () => {
    const input = [
      {
        poly_uuid: "abc",
        poly_name: "Poly A",
        site_name: "Site A",
        percentage: 1.5,
        intersect_smaller: true,
        intersection_area: 0.01
      }
    ];

    expect(transformCriteriaSiteExtraInfo(input, VALIDATION_CRITERIA_IDS.OVERLAPPING)).toEqual([
      {
        polyUuid: "abc",
        polyName: "Poly A",
        siteName: "Site A",
        percentage: 1.5,
        intersectSmaller: true,
        intersectionArea: 0.01
      }
    ]);
  });

  it("is idempotent for already-camelCase overlapping payloads", () => {
    const input = [
      {
        polyUuid: "abc",
        polyName: "Poly A",
        siteName: "Site A",
        percentage: 1.5,
        intersectSmaller: true,
        intersectionArea: 0.01
      }
    ];

    const once = transformCriteriaSiteExtraInfo(input, VALIDATION_CRITERIA_IDS.OVERLAPPING);
    expect(transformCriteriaSiteExtraInfo(once, VALIDATION_CRITERIA_IDS.OVERLAPPING)).toEqual(once);
    expect(extraInfoNeedsBackfill(input, VALIDATION_CRITERIA_IDS.OVERLAPPING)).toBe(false);
  });

  it("maps DATA_COMPLETENESS field values and drops obsolete plantend entries", () => {
    const input = [
      { field: "num_trees", error: null, exists: false },
      { field: "poly_name", error: null, exists: false },
      { field: "plantstart", error: null, exists: false },
      { field: "plantend", error: null, exists: false },
      { field: "target_sys", error: "bad", exists: true },
      { field: "planting_status", error: null, exists: false }
    ];

    expect(transformCriteriaSiteExtraInfo(input, VALIDATION_CRITERIA_IDS.DATA_COMPLETENESS)).toEqual([
      { field: "numTrees", error: null, exists: false },
      { field: "polyName", error: null, exists: false },
      { field: "plantStart", error: null, exists: false },
      { field: "targetSys", error: "bad", exists: true },
      { field: "plantingStatus", error: null, exists: false }
    ]);
  });

  it("is idempotent for DATA_COMPLETENESS after field value normalization", () => {
    const input = [
      { field: "num_trees", error: null, exists: false },
      { field: "plantstart", error: null, exists: false }
    ];

    const once = transformCriteriaSiteExtraInfo(input, VALIDATION_CRITERIA_IDS.DATA_COMPLETENESS);
    expect(transformCriteriaSiteExtraInfo(once, VALIDATION_CRITERIA_IDS.DATA_COMPLETENESS)).toEqual(once);
    expect(extraInfoNeedsBackfill(once, VALIDATION_CRITERIA_IDS.DATA_COMPLETENESS)).toBe(false);
    expect(extraInfoNeedsBackfill(input, VALIDATION_CRITERIA_IDS.DATA_COMPLETENESS)).toBe(true);
  });

  it("camelCases DUPLICATE_GEOMETRY keys without reshaping fields", () => {
    const input = [
      {
        poly_uuid: "geom-1",
        poly_name: "Duplicate Polygon",
        site_name: "Test Site"
      }
    ];

    expect(transformCriteriaSiteExtraInfo(input, VALIDATION_CRITERIA_IDS.DUPLICATE_GEOMETRY)).toEqual([
      {
        polyUuid: "geom-1",
        polyName: "Duplicate Polygon",
        siteName: "Test Site"
      }
    ]);
  });

  it("camelCases plant start date and estimated area payloads", () => {
    expect(
      transformCriteriaSiteExtraInfo(
        { error_type: "MISSING_VALUE", polygon_uuid: "p1", site_name: "S1" },
        VALIDATION_CRITERIA_IDS.PLANT_START_DATE
      )
    ).toEqual({ errorType: "MISSING_VALUE", polygonUuid: "p1", siteName: "S1" });

    expect(transformCriteriaSiteExtraInfo({ area_hectares: 1.25 }, VALIDATION_CRITERIA_IDS.POLYGON_SIZE)).toEqual({
      areaHectares: 1.25
    });

    expect(transformCriteriaSiteExtraInfo({ spike_count: 2, spikes: [] }, VALIDATION_CRITERIA_IDS.SPIKES)).toEqual({
      spikeCount: 2,
      spikes: []
    });

    expect(
      transformCriteriaSiteExtraInfo(
        { inside_percentage: 80, country_name: "Ghana" },
        VALIDATION_CRITERIA_IDS.WITHIN_COUNTRY
      )
    ).toEqual({ insidePercentage: 80, countryName: "Ghana" });

    expect(
      transformCriteriaSiteExtraInfo(
        {
          polygon_status: "approved",
          sum_area_site_approved: 10,
          percentage_site_approved: 50
        },
        VALIDATION_CRITERIA_IDS.ESTIMATED_AREA
      )
    ).toEqual({
      polygonStatus: "approved",
      sumAreaSiteApproved: 10,
      percentageSiteApproved: 50
    });
  });
});
