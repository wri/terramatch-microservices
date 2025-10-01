import { LinkedFieldsConfiguration } from "./index";

describe("LinkedFieldsConfiguration", () => {
  it("should have unique keys across all configurations field / fileCollections / relations sets", () => {
    const configurations = Object.values(LinkedFieldsConfiguration);
    const keys = configurations.flatMap(c => [
      ...Object.keys(c.fields),
      ...Object.keys(c.fileCollections),
      ...Object.keys(c.relations)
    ]);
    expect(keys.sort()).toEqual([...new Set(keys).values()].sort());
  });
});
