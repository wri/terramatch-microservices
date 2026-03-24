import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import {
  LocalizationKey,
  ModelHasRole,
  Organisation,
  OrganisationInvite,
  PasswordReset,
  ProjectInvite,
  ProjectUser,
  Role,
  User,
  Verification
} from "@terramatch-microservices/database/entities";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { UserCreationService } from "./user-creation.service";
import { UserCreateAttributes } from "./dto/user-create.dto";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import {
  RoleFactory,
  UserFactory,
  ProjectFactory,
  FrameworkFactory
} from "@terramatch-microservices/database/factories";
import { LocalizationKeyFactory } from "@terramatch-microservices/database/factories/localization-key.factory";
import { TemplateService } from "@terramatch-microservices/common/templates/template.service";
import { AdminUserCreateAttributes } from "./dto/admin-user-create.dto";

describe("UserCreationService", () => {
  let service: UserCreationService;
  let emailService: DeepMocked<EmailService>;
  let localizationService: DeepMocked<LocalizationService>;
  let templateService: DeepMocked<TemplateService>;

  const getRequest = (email: string, role: string) => {
    const userNewRequest = new UserCreateAttributes();
    userNewRequest.emailAddress = email;
    userNewRequest.password = "secret";
    userNewRequest.firstName = "firstName";
    userNewRequest.lastName = "lastName";
    userNewRequest.role = role;
    userNewRequest.jobRole = "developer";
    userNewRequest.phoneNumber = "1234567890";
    userNewRequest.program = "";
    userNewRequest.callbackUrl = "https://localhost:3000";
    return userNewRequest;
  };

  async function getLocalizationBody() {
    return await LocalizationKeyFactory.create({
      key: "user-verification.body",
      value: "Follow the below link to verify your email address."
    });
  }

  async function getLocalizationSubject() {
    return await LocalizationKeyFactory.create({
      key: "user-verification.subject",
      value: "Verify Your Email Address"
    });
  }

  async function getLocalizationTitle() {
    return await LocalizationKeyFactory.create({
      key: "user-verification.title",
      value: "VERIFY YOUR EMAIL ADDRESS"
    });
  }

  async function getLocalizationCta() {
    return await LocalizationKeyFactory.create({
      key: "user-verification.cta",
      value: "VERIFY EMAIL ADDRESS"
    });
  }

  async function getUser() {
    return await UserFactory.create();
  }

  beforeAll(async () => {
    await LocalizationKey.truncate();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserCreationService,
        {
          provide: EmailService,
          useValue: (emailService = createMock<EmailService>())
        },
        {
          provide: LocalizationService,
          useValue: (localizationService = createMock<LocalizationService>())
        },
        {
          provide: TemplateService,
          useValue: (templateService = createMock<TemplateService>())
        }
      ]
    }).compile();

    service = module.get<UserCreationService>(UserCreationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a new user", async () => {
    const user = await UserFactory.create();
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const role = RoleFactory.create({ name: userNewRequest.role });

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    jest.spyOn(User, "count").mockImplementation(() => Promise.resolve(0));
    jest.spyOn(Role, "findOne").mockImplementation(() => Promise.resolve(role));
    jest.spyOn(User, "create").mockImplementation(() => Promise.resolve(user));
    // @ts-expect-error bogus mock value
    jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue(null);

    const reloadSpy = jest.spyOn(user, "reload").mockResolvedValue(user);

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    emailService.sendI18nTemplateEmail.mockReturnValue(Promise.resolve());
    templateService.render.mockReturnValue("rendered template");

    const result = await service.createNewUser(false, userNewRequest);
    expect(reloadSpy).toHaveBeenCalled();
    expect(emailService.sendI18nTemplateEmail).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("should generate a error because user already exist", async () => {
    const user = await UserFactory.create();
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    await expect(service.createNewUser(false, userNewRequest)).rejects.toThrow(
      new UnprocessableEntityException("User already exists")
    );
  });

  it("should generate a error because role not exist", async () => {
    const user = await UserFactory.create();
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));
    jest.spyOn(Role, "findOne").mockImplementation(() => Promise.resolve(null));
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    await expect(service.createNewUser(false, userNewRequest)).rejects.toThrow(new NotFoundException("Role not found"));
  });

  it("should generate a error when create user in DB", async () => {
    const user = await getUser();
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const role = RoleFactory.create({ name: userNewRequest.role });

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    jest.spyOn(User, "count").mockImplementation(() => Promise.resolve(0));
    jest.spyOn(Role, "findOne").mockImplementation(() => Promise.resolve(role));
    jest.spyOn(User, "create").mockImplementation(() => Promise.reject());

    await expect(service.createNewUser(false, userNewRequest)).rejects.toThrow(InternalServerErrorException);
  });

  it("should generate a error when save token verification in DB", async () => {
    const user = await getUser();
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const role = RoleFactory.create({ name: userNewRequest.role });

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    jest.spyOn(User, "count").mockImplementation(() => Promise.resolve(0));
    jest.spyOn(Role, "findOne").mockImplementation(() => Promise.resolve(role));
    jest.spyOn(User, "create").mockImplementation(() => Promise.resolve(user));
    // @ts-expect-error bogus mock value
    jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue(null);

    jest.spyOn(Verification, "findOrCreate").mockImplementation(() => Promise.reject());
    await expect(service.createNewUser(false, userNewRequest)).rejects.toThrow(InternalServerErrorException);
  });

  it("should generate a error when send email verification", async () => {
    const user = await UserFactory.create();
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const role = RoleFactory.create({ name: userNewRequest.role });

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    jest.spyOn(User, "count").mockImplementation(() => Promise.resolve(0));
    jest.spyOn(Role, "findOne").mockImplementation(() => Promise.resolve(role));
    jest.spyOn(User, "create").mockImplementation(() => Promise.resolve(user));
    // @ts-expect-error bogus mock value
    jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue(null);

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    emailService.sendI18nTemplateEmail.mockRejectedValue(null);
    await expect(service.createNewUser(false, userNewRequest)).rejects.toThrow(InternalServerErrorException);
  });

  it("should return an error when User.create fails", async () => {
    const user = await UserFactory.create();
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const role = RoleFactory.create({ name: userNewRequest.role });

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    jest.spyOn(User, "count").mockImplementation(() => Promise.resolve(0));
    jest.spyOn(Role, "findOne").mockImplementation(() => Promise.resolve(role));
    jest.spyOn(User, "create").mockRejectedValue(new Error("User creation failed"));

    await expect(service.createNewUser(false, userNewRequest)).rejects.toThrow(InternalServerErrorException);
  });

  it("should return an error when ModelHasRole.findOrCreate fails", async () => {
    const user = await UserFactory.create();
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const role = RoleFactory.create({ name: userNewRequest.role });

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    jest.spyOn(User, "count").mockImplementation(() => Promise.resolve(0));
    jest.spyOn(Role, "findOne").mockImplementation(() => Promise.resolve(role));
    jest.spyOn(User, "create").mockImplementation(() => Promise.resolve(user));
    jest.spyOn(ModelHasRole, "findOrCreate").mockRejectedValue(new Error("ModelHasRole creation failed"));

    await expect(service.createNewUser(false, userNewRequest)).rejects.toThrow(InternalServerErrorException);
  });

  it("should return an error when Verification.findOrCreate fails", async () => {
    const user = await UserFactory.create();
    const userNewRequest = getRequest(user.emailAddress, "project-developer");

    const role = RoleFactory.create({ name: userNewRequest.role });

    const localizationBody = await getLocalizationBody();
    const localizationSubject = await getLocalizationSubject();
    const localizationTitle = await getLocalizationTitle();
    const localizationCta = await getLocalizationCta();

    localizationService.getLocalizationKeys.mockReturnValue(
      Promise.resolve([localizationBody, localizationSubject, localizationTitle, localizationCta])
    );

    jest.spyOn(User, "count").mockImplementation(() => Promise.resolve(0));
    jest.spyOn(Role, "findOne").mockImplementation(() => Promise.resolve(role));
    jest.spyOn(User, "create").mockImplementation(() => Promise.resolve(user));
    // @ts-expect-error bogus mock value
    jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue(null);

    jest.spyOn(Verification, "findOrCreate").mockRejectedValue(new Error("Verification creation failed"));

    await expect(service.createNewUser(false, userNewRequest)).rejects.toThrow(InternalServerErrorException);
  });

  describe("invite-based signup completion", () => {
    const getInviteRequest = (email: string, token: string) => {
      const request = getRequest(email, "project-developer");
      request.token = token;
      return request;
    };

    it("should throw NotFoundException when token is invalid", async () => {
      const request = getInviteRequest("test@example.com", "invalid-token");
      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(null);

      await expect(service.createNewUser(false, request)).rejects.toThrow(NotFoundException);
    });

    it("should complete invite signup with organisation invite", async () => {
      const user = await UserFactory.create();
      const request = getInviteRequest("new@example.com", "valid-token");
      const passwordReset = {
        user,
        destroy: jest.fn().mockResolvedValue(undefined)
      } as unknown as PasswordReset;
      const organisationInvite = {
        emailAddress: user.emailAddress,
        acceptedAt: null,
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as OrganisationInvite;
      const role = RoleFactory.create({ name: "project-developer" });

      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(passwordReset as PasswordReset);
      jest.spyOn(OrganisationInvite, "findAll").mockResolvedValue([organisationInvite] as OrganisationInvite[]);
      jest.spyOn(Role, "findOne").mockResolvedValue(role);
      jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue([{} as ModelHasRole, true]);
      jest.spyOn(user, "save").mockResolvedValue(user);

      const result = await service.createNewUser(false, request);

      expect(organisationInvite.emailAddress).toBe(request.emailAddress);
      expect(organisationInvite.acceptedAt).not.toBeNull();
      expect(user.emailAddress).toBe(request.emailAddress);
      expect(passwordReset.destroy).toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it("should complete invite signup with project invites", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      const request = getInviteRequest("new@example.com", "valid-token");
      const passwordReset = {
        user,
        destroy: jest.fn().mockResolvedValue(undefined)
      } as unknown as PasswordReset;
      const projectInvite = {
        emailAddress: user.emailAddress,
        project,
        acceptedAt: null,
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as ProjectInvite;
      const role = RoleFactory.create({ name: "project-developer" });
      const projectUser = { save: jest.fn() } as unknown as ProjectUser;

      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(passwordReset as PasswordReset);
      jest.spyOn(OrganisationInvite, "findAll").mockResolvedValue([]);
      jest.spyOn(ProjectInvite, "findAll").mockResolvedValue([projectInvite] as ProjectInvite[]);
      jest.spyOn(ProjectUser, "findOrCreate").mockResolvedValue([projectUser, true]);
      jest.spyOn(Role, "findOne").mockResolvedValue(role);
      jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue([{} as ModelHasRole, true]);
      jest.spyOn(user, "save").mockResolvedValue(user);

      const result = await service.createNewUser(false, request);

      expect(projectInvite.emailAddress).toBe(request.emailAddress);
      expect(projectInvite.acceptedAt).not.toBeNull();
      expect(ProjectUser.findOrCreate).toHaveBeenCalled();
      expect(passwordReset.destroy).toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it("should assign project-developer role regardless of request role", async () => {
      const user = await UserFactory.create();
      const request = getInviteRequest("new@example.com", "valid-token");
      request.role = "funder";
      const passwordReset = {
        user,
        destroy: jest.fn().mockResolvedValue(undefined)
      } as unknown as PasswordReset;
      const role = RoleFactory.create({ name: "project-developer" });

      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(passwordReset as PasswordReset);
      jest.spyOn(OrganisationInvite, "findAll").mockResolvedValue([]);
      jest.spyOn(ProjectInvite, "findAll").mockResolvedValue([]);
      jest.spyOn(Role, "findOne").mockResolvedValue(role);
      jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue([{} as ModelHasRole, true]);
      jest.spyOn(user, "save").mockResolvedValue(user);

      await service.createNewUser(false, request);

      expect(Role.findOne).toHaveBeenCalledWith({ where: { name: "project-developer" } });
    });

    it("should update existing project-user relation if already present", async () => {
      const user = await UserFactory.create();
      const project = await ProjectFactory.create();
      const request = getInviteRequest("new@example.com", "valid-token");
      const passwordReset = {
        user,
        destroy: jest.fn().mockResolvedValue(undefined)
      } as unknown as PasswordReset;
      const projectInvite = {
        emailAddress: user.emailAddress,
        project,
        acceptedAt: null,
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as ProjectInvite;
      const role = RoleFactory.create({ name: "project-developer" });
      const projectUser = {
        isMonitoring: false,
        status: "inactive",
        save: jest.fn().mockResolvedValue(undefined)
      } as unknown as ProjectUser;

      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(passwordReset);
      jest.spyOn(OrganisationInvite, "findAll").mockResolvedValue([]);
      jest.spyOn(ProjectInvite, "findAll").mockResolvedValue([projectInvite]);
      jest.spyOn(ProjectUser, "findOrCreate").mockResolvedValue([projectUser, false]);
      jest.spyOn(Role, "findOne").mockResolvedValue(role);
      jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue([{} as ModelHasRole, true]);
      jest.spyOn(user, "save").mockResolvedValue(user);

      await service.createNewUser(false, request);

      expect(projectUser.isMonitoring).toBe(true);
      expect(projectUser.status).toBe("active");
      expect(projectUser.save).toHaveBeenCalled();
    });
  });

  describe("authenticated/admin user creation", () => {
    const getAdminRequest = (email: string, role: string) => {
      const frameworkSlug = "ppc";
      RoleFactory.create({ name: role });
      FrameworkFactory.create({ slug: frameworkSlug });
      const request = new AdminUserCreateAttributes();
      request.emailAddress = email;
      request.firstName = "firstName";
      request.lastName = "lastName";
      request.jobRole = "developer";
      request.phoneNumber = "1234567890";
      request.role = role;
      request.organisationUuid = "org-uuid";
      request.directFrameworks = [frameworkSlug];
      return request;
    };

    it("should create user for authenticated request", async () => {
      const request = getAdminRequest("admin-created@example.com", "project-manager");
      const role = RoleFactory.create({ name: request.role });
      const createdUser = await UserFactory.create();
      const organisation = { id: 999 } as Organisation;

      jest.spyOn(Organisation, "findOne").mockResolvedValue(organisation);
      jest.spyOn(User, "count").mockResolvedValue(0);
      jest.spyOn(User, "create").mockResolvedValue(createdUser);
      jest.spyOn(Role, "findOne").mockResolvedValue(role);
      jest.spyOn(ModelHasRole, "findOrCreate").mockResolvedValue([{} as ModelHasRole, true]);

      const result = await service.createNewUser(true, request);

      expect(Organisation.findOne).toHaveBeenCalledWith({
        where: { uuid: request.organisationUuid },
        attributes: ["id"]
      });
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ organisationId: organisation.id }));
      expect(result).toBe(createdUser);
    });

    it("should fail when organisation does not exist", async () => {
      const request = getAdminRequest("admin-created@example.com", "project-manager");

      jest.spyOn(Organisation, "findOne").mockResolvedValue(null);

      await expect(service.createNewUser(true, request)).rejects.toThrow(
        new NotFoundException("Organisation not found")
      );
    });

    it("should fail when admin role does not exist", async () => {
      const request = getAdminRequest("admin-created@example.com", "project-manager");
      const createdUser = await UserFactory.create();
      const organisation = { id: 888 } as Organisation;

      jest.spyOn(Organisation, "findOne").mockResolvedValue(organisation);
      jest.spyOn(User, "count").mockResolvedValue(0);
      jest.spyOn(User, "create").mockResolvedValue(createdUser);
      jest.spyOn(Role, "findOne").mockResolvedValue(null);

      await expect(service.createNewUser(true, request)).rejects.toThrow(
        new InternalServerErrorException("User creation failed")
      );
    });

    it("should fail validation for malformed admin payload", async () => {
      const request = getAdminRequest("invalid-email", "project-manager");
      request.organisationUuid = "";
      // @ts-expect-error test invalid payload
      request.phoneNumber = null;

      await expect(service.createNewUser(true, request)).rejects.toThrow(BadRequestException);
    });
  });
});
