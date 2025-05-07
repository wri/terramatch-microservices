import { Test } from "@nestjs/testing";
import { ProjectPitchService } from "./project-pitch.service";
import { ProjectsPitchesParamDto } from "./dto/projects-pitches-param.dto";
import { ProjectPitch, User } from "@terramatch-microservices/database/entities";
import { OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";

describe("ProjectPitchService", () => {
  let service: ProjectPitchService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ProjectPitchService]
    }).compile();

    service = module.get(ProjectPitchService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Get ProjectsPitches", () => {
    it("throws an error if the user is not found", async () => {
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));

      await expect(service.getProjectPitches(-1, new ProjectsPitchesParamDto())).rejects.toThrow("User not found");
    });

    it("returns paginated project pitches for a valid user", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
      const projectPitches = [
        new ProjectPitch({ uuid: "pitch1", projectName: "Project 1" }),
        new ProjectPitch({ uuid: "pitch2", projectName: "Project 2" })
      ];
      jest.spyOn(ProjectPitch, "findAll").mockImplementation(() => Promise.resolve(projectPitches));

      const params = new ProjectsPitchesParamDto();
      params.pageNumber = 1;
      params.pageSize = 2;

      const result = await service.getProjectPitches(user.id, params);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].uuid).toBe("pitch1");
      expect(result.data[1].uuid).toBe("pitch2");
      expect(result.pageNumber).toBe(1);
    });

    /*
    it("applies search filters correctly", async () => {
      const userModel = module.get("UserModel");
      const projectPitchModel = module.get("ProjectPitchModel");

      userModel.findOne.mockResolvedValue({
        id: "validUserId",
        organisations: [{ uuid: "org1" }]
      });

      projectPitchModel.findAll.mockResolvedValue([{ uuid: "pitch1", projectName: "Filtered Project" }]);

      const params = new ProjectsPitchesParamDto();
      params.search = "Filtered";

      const result = await service.getProjectPitches("validUserId", params);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].projectName).toContain("Filtered");
    });*/
  });
});
