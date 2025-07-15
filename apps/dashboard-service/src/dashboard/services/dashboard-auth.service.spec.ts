import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { DashboardAuthService } from "./dashboard-auth.service";
import { PolicyService } from "@terramatch-microservices/common";
import { User, Project } from "@terramatch-microservices/database/entities";
import { RequestContext } from "nestjs-request-context";

interface MockRequestContext {
  req: {
    authenticatedUserId: number | null;
  };
  res: Record<string, unknown>;
}

describe("DashboardAuthService", () => {
  let service: DashboardAuthService;
  let policyService: DeepMocked<PolicyService>;
  let mockRequestContext: MockRequestContext;

  beforeEach(async () => {
    mockRequestContext = {
      req: {
        authenticatedUserId: null
      },
      res: {}
    };

    jest.spyOn(RequestContext, "currentContext", "get").mockReturnValue(mockRequestContext);

    jest.spyOn(Project, "findOne").mockImplementation();

    policyService = createMock<PolicyService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardAuthService,
        {
          provide: PolicyService,
          useValue: policyService
        }
      ]
    }).compile();

    service = module.get<DashboardAuthService>(DashboardAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("checkUserProjectAccess", () => {
    const mockUser = {
      id: 1,
      uuid: "user-uuid",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as User;

    const mockProject = {
      id: 1,
      uuid: "project-uuid",
      name: "Test Project",
      createdAt: new Date(),
      updatedAt: new Date()
    } as unknown as Project;

    it("should return allowed: false when user is null", async () => {
      const result = await service.checkUserProjectAccess("project-uuid", null);

      expect(result).toEqual({ allowed: false });
      expect(Project.findOne).not.toHaveBeenCalled();
      expect(policyService.authorize).not.toHaveBeenCalled();
    });

    it("should return allowed: false when project is not found", async () => {
      (Project.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.checkUserProjectAccess("project-uuid", mockUser);

      expect(result).toEqual({ allowed: false });
      expect(Project.findOne).toHaveBeenCalledWith({ where: { uuid: "project-uuid" } });
      expect(policyService.authorize).not.toHaveBeenCalled();
    });

    it("should return allowed: true when user has access to project", async () => {
      (Project.findOne as jest.Mock).mockResolvedValue(mockProject);
      policyService.authorize.mockResolvedValue(undefined);

      const result = await service.checkUserProjectAccess("project-uuid", mockUser);

      expect(result).toEqual({ allowed: true });
      expect(Project.findOne).toHaveBeenCalledWith({ where: { uuid: "project-uuid" } });
      expect(mockRequestContext.req.authenticatedUserId).toBe(mockUser.id);
      expect(policyService.authorize).toHaveBeenCalledWith("read", mockProject);
    });

    it("should return allowed: false when policy service throws an error", async () => {
      (Project.findOne as jest.Mock).mockResolvedValue(mockProject);
      policyService.authorize.mockRejectedValue(new Error("Authorization failed"));

      const result = await service.checkUserProjectAccess("project-uuid", mockUser);

      expect(result).toEqual({ allowed: false });
      expect(Project.findOne).toHaveBeenCalledWith({ where: { uuid: "project-uuid" } });
      expect(mockRequestContext.req.authenticatedUserId).toBe(mockUser.id);
      expect(policyService.authorize).toHaveBeenCalledWith("read", mockProject);
    });

    it("should set authenticatedUserId in request context", async () => {
      (Project.findOne as jest.Mock).mockResolvedValue(mockProject);
      policyService.authorize.mockResolvedValue(undefined);

      await service.checkUserProjectAccess("project-uuid", mockUser);

      expect(mockRequestContext.req.authenticatedUserId).toBe(mockUser.id);
    });

    it("should handle different project UUIDs correctly", async () => {
      const differentProjectUuid = "different-project-uuid";
      (Project.findOne as jest.Mock).mockResolvedValue(mockProject);
      policyService.authorize.mockResolvedValue(undefined);

      await service.checkUserProjectAccess(differentProjectUuid, mockUser);

      expect(Project.findOne).toHaveBeenCalledWith({ where: { uuid: differentProjectUuid } });
    });

    it("should handle different users correctly", async () => {
      const differentUser = {
        id: 2,
        uuid: "different-user-uuid",
        email: "different@example.com",
        firstName: "Different",
        lastName: "User",
        createdAt: new Date(),
        updatedAt: new Date()
      } as unknown as User;

      (Project.findOne as jest.Mock).mockResolvedValue(mockProject);
      policyService.authorize.mockResolvedValue(undefined);

      await service.checkUserProjectAccess("project-uuid", differentUser);

      expect(mockRequestContext.req.authenticatedUserId).toBe(differentUser.id);
    });
  });
});
