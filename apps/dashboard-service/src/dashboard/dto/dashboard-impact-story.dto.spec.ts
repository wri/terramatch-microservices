import { DashboardImpactStoryLightDto } from "./dashboard-impact-story.dto";
import { ImpactStory } from "@terramatch-microservices/database/entities";

describe("DashboardImpactStoryLightDto", () => {
  it("should create DTO from impact story", () => {
    const mockImpactStory = {
      uuid: "6c6ee6d2-22e4-49d5-900d-53218867bf48",
      title: "Restoring Land, Empowering Farmers",
      date: "2025-02-21",
      category: ["livelihoods-strengthening", "business-dev-fund", "gender-equity"],
      thumbnail: "https://s3-eu-west-1.amazonaws.com/wri-terramatch-prod/96203/FarmLife_Kenya.jpg",
      status: "published"
    } as unknown as ImpactStory;

    const dto = new DashboardImpactStoryLightDto(mockImpactStory);

    expect(dto.uuid).toBe("6c6ee6d2-22e4-49d5-900d-53218867bf48");
    expect(dto.title).toBe("Restoring Land, Empowering Farmers");
    expect(dto.date).toBe("2025-02-21");
    expect(dto.category).toEqual(["livelihoods-strengthening", "business-dev-fund", "gender-equity"]);
    expect(dto.thumbnail).toBe("https://s3-eu-west-1.amazonaws.com/wri-terramatch-prod/96203/FarmLife_Kenya.jpg");
    expect(dto.status).toBe("published");
    expect(dto.organization).toBeNull();
  });

  it("should handle missing optional fields", () => {
    const mockImpactStory = {
      uuid: "6c6ee6d2-22e4-49d5-900d-53218867bf48",
      title: "Restoring Land, Empowering Farmers",
      date: "2025-02-21",
      category: null,
      thumbnail: null,
      status: "draft"
    } as unknown as ImpactStory;

    const dto = new DashboardImpactStoryLightDto(mockImpactStory);

    expect(dto.uuid).toBe("6c6ee6d2-22e4-49d5-900d-53218867bf48");
    expect(dto.title).toBe("Restoring Land, Empowering Farmers");
    expect(dto.date).toBe("2025-02-21");
    expect(dto.category).toBeNull();
    expect(dto.thumbnail).toBeNull();
    expect(dto.status).toBe("draft");
    expect(dto.organization).toBeNull();
  });

  it("should handle string category", () => {
    const mockImpactStory = {
      uuid: "6c6ee6d2-22e4-49d5-900d-53218867bf48",
      title: "Restoring Land, Empowering Farmers",
      date: "2025-02-21",
      category: ["livelihoods-strengthening"],
      thumbnail: null,
      status: "published"
    } as unknown as ImpactStory;

    const dto = new DashboardImpactStoryLightDto(mockImpactStory);

    expect(dto.category).toEqual(["livelihoods-strengthening"]);
  });
});
