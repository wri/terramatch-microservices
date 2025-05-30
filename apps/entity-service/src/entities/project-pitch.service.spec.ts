import { Test } from "@nestjs/testing";
import { ProjectPitchService } from "./project-pitch.service";
import { Organisation, ProjectPitch, User } from "@terramatch-microservices/database/entities";
import { OrganisationFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { NumberPage } from "@terramatch-microservices/common/dto/page.dto";
import { OrganisationUserFactory } from "@terramatch-microservices/database/factories/organisation-user.factory";
import { ProjectPitchQueryDto } from "./dto/project-pitch-query.dto";

async function getUserWithOrganisation() {
  const user = await UserFactory.create();
  const org = await OrganisationFactory.create();
  const orgUser = await OrganisationUserFactory.create({
    organisationId: org.id,
    userId: user.id,
    status: "approved"
  });
  user.organisations = [{ ...orgUser, ...org } as unknown as Organisation & { OrganisationUser: typeof orgUser }];
  return user;
}

function getDefaultPagination() {
  const params = new ProjectPitchQueryDto();
  params.page = new NumberPage();
  params.page.number = 1;
  params.page.size = 10;
  return params;
}

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

  describe("Get ProjectPitch by UUID", () => {
    it("returns a project pitch for a valid UUID", async () => {
      const mockProjectPitch = new ProjectPitch({ uuid: "uuid", projectName: "Test Project" } as ProjectPitch);
      jest.spyOn(ProjectPitch, "findOne").mockImplementation(() => Promise.resolve(mockProjectPitch));

      const result = await service.getProjectPitch("uuid");

      expect(result).toBeDefined();
      expect(result.uuid).toBe("uuid");
      expect(result.projectName).toBe("Test Project");
    });

    it("throws an error if no project pitch not found for the given UUID", async () => {
      jest.spyOn(ProjectPitch, "findOne").mockImplementation(() => Promise.resolve(null));
      await expect(service.getProjectPitch("invalid-uuid")).rejects.toThrow("ProjectPitch not found");
    });
  });

  describe("Get ProjectsPitches", () => {
    it("returns paginated project pitches", async () => {
      const user = await getUserWithOrganisation();
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
      const projectPitches = [
        new ProjectPitch({ uuid: "pitch y", projectName: "Project y" } as ProjectPitch),
        new ProjectPitch({ uuid: "pitch x", projectName: "Project x" } as ProjectPitch)
      ];
      jest.spyOn(ProjectPitch, "findAll").mockImplementation(() => Promise.resolve(projectPitches));

      const params = getDefaultPagination();

      const result = await service.getProjectPitches(params);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].uuid).toBe("pitch y");
      expect(result.data[1].uuid).toBe("pitch x");
      expect(result.pageNumber).toBe(1);
    });

    it("applies search correctly", async () => {
      const user = await getUserWithOrganisation();
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
      const projectPitches = [new ProjectPitch({ uuid: "pitch x", projectName: "Filtered" } as ProjectPitch)];
      jest.spyOn(ProjectPitch, "findAll").mockImplementation(() => Promise.resolve(projectPitches));

      const params = getDefaultPagination();
      params.search = "filtered";

      const result = await service.getProjectPitches(params);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].projectName).toContain("Filtered");
    });

    it("deny filters", async () => {
      const user = await getUserWithOrganisation();
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
      const projectPitches = [new ProjectPitch({ uuid: "pitch x", projectName: "Filtered" } as ProjectPitch)];
      jest.spyOn(ProjectPitch, "findAll").mockImplementation(() => Promise.resolve(projectPitches));

      const params = getDefaultPagination();
      params.filter = { invalid_filter: "foo" };

      await expect(service.getProjectPitches(params)).rejects.toThrow("Invalid filter key: invalid_filter");
    });

    it("applies filters correctly", async () => {
      const user = await getUserWithOrganisation();
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
      const projectPitches = [new ProjectPitch({ uuid: "pitch x", projectName: "Filtered" } as ProjectPitch)];
      jest.spyOn(ProjectPitch, "findAll").mockImplementation(() => Promise.resolve(projectPitches));

      const params = getDefaultPagination();
      params.filter = { restorationInterventionTypes: "foo" };

      const result = await service.getProjectPitches(params);
      expect(result.data).toHaveLength(1);
    });

    it("deny orders fields", async () => {
      const user = await getUserWithOrganisation();
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
      const projectPitches = [new ProjectPitch({ uuid: "pitch x", projectName: "Filtered" } as ProjectPitch)];
      jest.spyOn(ProjectPitch, "findAll").mockImplementation(() => Promise.resolve(projectPitches));

      const params = getDefaultPagination();
      params.sort = { field: "no_exist_column", direction: "ASC" };

      await expect(service.getProjectPitches(params)).rejects.toThrow("Invalid sort field: no_exist_column");
    });

    it("applies order correctly", async () => {
      const user = await getUserWithOrganisation();
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
      const projectPitches = [new ProjectPitch({ uuid: "pitch x", projectName: "Filtered" } as ProjectPitch)];
      jest.spyOn(ProjectPitch, "findAll").mockImplementation(() => Promise.resolve(projectPitches));

      const params = getDefaultPagination();
      params.sort = { field: "organisationId", direction: "ASC" };

      const result = await service.getProjectPitches(params);
      expect(result.data).toHaveLength(1);
    });
  });
});
