import axios from "axios";

describe("GET /api", () => {
  it("should return a message", async () => {
    const res = await axios.get(`/api`);

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ message: "Hello API" });
  });
});

describe("Site Polygon Validation Status Filter", () => {
  it("should filter site polygons by validation status", async () => {
    const res = await axios.get(`/research/v3/sitePolygons?validationStatus[]=approved&validationStatus[]=pending`);

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("data");
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it("should filter for not checked (null) validation status", async () => {
    const res = await axios.get(`/research/v3/sitePolygons?validationStatus[]=not_checked`);

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("data");
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it("should filter for both not checked and specific statuses", async () => {
    const res = await axios.get(`/research/v3/sitePolygons?validationStatus[]=not_checked&validationStatus[]=approved`);

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("data");
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it("should handle empty validation status filter", async () => {
    const res = await axios.get(`/research/v3/sitePolygons?validationStatus[]=`);

    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("data");
  });
});
