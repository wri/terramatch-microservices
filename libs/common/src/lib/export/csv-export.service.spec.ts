import { Test } from "@nestjs/testing";
import { CsvExportService } from "./csv-export.service";

describe("CsvExportService", () => {
  let service: CsvExportService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CsvExportService]
    }).compile();
    service = module.get(CsvExportService);
  });

  it("stringifies rows with headers from column map", () => {
    const csv = service.stringify([{ a: 1, b: "x" }], { a: "Col A", b: "Col B" });
    expect(csv).toContain("Col A");
    expect(csv).toContain("Col B");
    expect(csv).toContain("1");
    expect(csv).toContain("x");
  });

  it("serializes null, dates, and arrays", () => {
    const csv = service.stringify(
      [
        {
          d: new Date("2024-06-15T12:00:00.000Z"),
          n: null,
          arr: ["a", "b"]
        }
      ],
      { d: "D", n: "N", arr: "Arr" }
    );
    expect(csv).toContain("2024-06-15");
    expect(csv).toContain("a; b");
    const dataLine = csv.trim().split("\n")[1] ?? "";
    expect(dataLine.split(",").length).toBeGreaterThanOrEqual(3);
  });
});
