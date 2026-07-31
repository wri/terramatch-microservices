import { getTrackingEntryConfigLabels } from "./tracking-entry-config-i18n";

describe("getTrackingEntryConfigLabels", () => {
  it("returns empty for missing or invalid props", () => {
    expect(getTrackingEntryConfigLabels(null)).toEqual([]);
    expect(getTrackingEntryConfigLabels({})).toEqual([]);
    expect(getTrackingEntryConfigLabels({ entryConfigs: null })).toEqual([]);
  });

  it("collects only strings stored in entryConfigs", () => {
    expect(
      getTrackingEntryConfigLabels({
        entryConfigs: [
          {
            type: "gender",
            title: "Custom Gender",
            displayTrackingType: "People",
            addNameLabel: "Add Ethnic Group",
            subTypes: [
              { subtype: "male", label: "Male" },
              { subtype: "female", label: "Female" }
            ]
          }
        ]
      })
    ).toEqual(["Custom Gender", "People", "Add Ethnic Group", "Male", "Female"]);
  });
});
