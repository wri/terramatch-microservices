import { faker } from "@faker-js/faker";
import { EntitiesService, ProcessableAssociation, ProcessableEntity } from "./entities.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException } from "@nestjs/common";
import { Media, Project } from "@terramatch-microservices/database/entities";
import {
  DisturbanceReportFactory,
  MediaFactory,
  NurseryFactory,
  NurseryReportFactory,
  ProjectFactory,
  ProjectReportFactory,
  ProjectUserFactory,
  SiteFactory,
  SiteReportFactory,
  SrpReportFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockUserContext, setMockedPermissions } from "@terramatch-microservices/common/util/testing";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { EntityType } from "@terramatch-microservices/database/constants/entities";
import { MediaOwnerType } from "@terramatch-microservices/database/constants/media-owners";
import { MediaOwnerProcessor } from "./processors/media-owner-processor";
import { ConfigService } from "@nestjs/config";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { mockEntityService } from "./processors/entity.processor.spec";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Archiver } from "archiver";
import { PassThrough } from "node:stream";

describe("EntitiesService", () => {
  let mediaService: DeepMocked<MediaService>;
  let csvExportService: DeepMocked<CsvExportService>;
  let service: EntitiesService;

  function expectMediaMatchesDto(dto: object, media: Media) {
    expect(dto).toMatchObject({
      ...pickApiProperties(media, MediaDto),
      url: service.fullUrl(media),
      thumbUrl: service.thumbnailUrl(media),
      createdAt: media.createdAt
    });
  }

  beforeEach(async () => {
    const module = await mockEntityService();
    service = module.get(EntitiesService);
    mediaService = module.get(MediaService);
    mediaService.getUrl.mockImplementation(
      ({ fileName }, conversion?: string) => `https://example.com/${conversion ?? ""}/${fileName}`
    );
    csvExportService = module.get(CsvExportService);
    const configService: DeepMocked<ConfigService> = module.get(ConfigService);
    configService.get.mockImplementation((key: string) => (key === "DEPLOY_ENV" ? "prod" : ""));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("isProd", () => {
    it("returns true for prod", () => {
      expect(service.isProd).toBe(true);
    });
  });

  describe("countReports", () => {
    const createReports = async (frameworkKey: FrameworkKey = "ppc", searchToken = faker.string.uuid()) => {
      const project = await ProjectFactory.create({ frameworkKey, name: `Project ${searchToken}` });
      const { id: siteId } = await SiteFactory.create({
        projectId: project.id,
        frameworkKey,
        name: `Site ${searchToken}`
      });
      const { id: nurseryId } = await NurseryFactory.create({
        projectId: project.id,
        frameworkKey,
        name: `Nursery ${searchToken}`
      });
      const projectId = project.id;
      await ProjectReportFactory.create({ projectId, frameworkKey, status: "due", dueAt: new Date("2025-03-15") });
      await SiteReportFactory.create({ siteId, frameworkKey, status: "draft", dueAt: new Date("2025-03-31T20:00Z") });
      await NurseryReportFactory.create({
        nurseryId,
        frameworkKey,
        status: "approved",
        dueAt: new Date("2025-04-01T12:00Z")
      });
      await DisturbanceReportFactory.create({
        projectId,
        frameworkKey,
        status: "draft",
        dueAt: new Date("2025-06-15")
      });
      await SrpReportFactory.create({ projectId, frameworkKey, status: "due", dueAt: new Date("2024-03-15") });
      return project;
    };

    it("counts all report types for a project", async () => {
      const { uuid: projectUuid } = await createReports();
      setMockedPermissions("framework-ppc");
      expect(await service.countReports({ projectUuid })).toBe(5);
    });

    it("applies the filters", async () => {
      const { uuid: projectUuid } = await createReports();
      setMockedPermissions("framework-ppc");

      expect(await service.countReports({ projectUuid, statuses: ["due", "approved"] })).toBe(3);
      expect(
        await service.countReports({ projectUuid, reportTypes: ["siteReports", "srpReports", "siteReports"] })
      ).toBe(2);
      expect(
        await service.countReports({
          projectUuid,
          dueDateFrom: "2025-03-15",
          dueDateTo: "2025-03-31"
        })
      ).toBe(2);
      expect(await service.countReports({ projectUuid, dueMonth: 3 })).toBe(3);
      expect(await service.countReports({ projectUuid, dueMonth: 3, dueYear: 2025 })).toBe(2);
      expect(
        await service.countReports({ projectUuid, dueYear: 2025, statuses: ["draft"], reportTypes: ["siteReports"] })
      ).toBe(1);
    });

    describe("reportingPeriods", () => {
      it("returns the distinct due month / year of matching reports, ignoring due date filters", async () => {
        const { uuid: projectUuid } = await createReports();
        setMockedPermissions("framework-ppc");

        const all = [
          { dueYear: 2025, dueMonth: 6 },
          { dueYear: 2025, dueMonth: 4 },
          { dueYear: 2025, dueMonth: 3 },
          { dueYear: 2024, dueMonth: 3 }
        ];
        expect(await service.reportingPeriods({ projectUuid })).toEqual(all);
        expect(await service.reportingPeriods({ projectUuid, dueYear: 2024, dueMonth: 3 })).toEqual(all);
        expect(await service.reportingPeriods({ projectUuid, reportTypes: ["siteReports"] })).toEqual([
          { dueYear: 2025, dueMonth: 3 }
        ]);
        expect(await service.reportingPeriods({ projectUuid, statuses: ["due"] })).toEqual([
          { dueYear: 2025, dueMonth: 3 },
          { dueYear: 2024, dueMonth: 3 }
        ]);
      });

      it("returns an empty list if the user has access to no projects", async () => {
        const { uuid: projectUuid } = await createReports();
        mockUserContext({ userId: (await UserFactory.create()).id, permissions: [] });
        expect(await service.reportingPeriods({ projectUuid })).toEqual([]);
      });
    });

    it("searches project, site and nursery names", async () => {
      const token = faker.string.uuid();
      await createReports("ppc", token);
      setMockedPermissions("framework-ppc");

      expect(await service.countReports({ search: `Project ${token}` })).toBe(5);
      expect(await service.countReports({ search: `Site ${token}` })).toBe(1);
      expect(await service.countReports({ search: `Nursery ${token}` })).toBe(1);
      expect(await service.countReports({ search: token, reportTypes: ["projectReports", "siteReports"] })).toBe(2);
    });

    it("only counts reports in the framework admin's frameworks", async () => {
      const { uuid: projectUuid } = await createReports("hbf");
      setMockedPermissions("framework-ppc");
      expect(await service.countReports({ projectUuid })).toBe(0);
    });

    it("only counts reports on projects the user manages", async () => {
      const user = await UserFactory.create();
      const project = await createReports();
      await createReports();
      await ProjectUserFactory.create({ userId: user.id, projectId: project.id, isManaging: true });

      mockUserContext({ userId: user.id, permissions: ["projects-manage"] });
      expect(await service.countReports({})).toBe(5);

      mockUserContext({ userId: user.id, permissions: ["manage-own"] });
      expect(await service.countReports({ reportTypes: ["projectReports"] })).toBe(1);
    });

    it("returns 0 if the user has access to no projects", async () => {
      const { uuid: projectUuid } = await createReports();
      const user = await UserFactory.create();

      mockUserContext({ userId: user.id, permissions: [] });
      expect(await service.countReports({ projectUuid })).toBe(0);

      mockUserContext({ userId: user.id, permissions: ["manage-own"] });
      expect(await service.countReports({ projectUuid })).toBe(0);
    });
  });

  describe("createProcessor", () => {
    it("throws with an unknown entity type", async () => {
      expect(() => service.createEntityProcessor("foo" as ProcessableEntity)).toThrow(BadRequestException);
    });
  });

  describe("createAssociationProcessor", () => {
    it("throws with an unknown association type", async () => {
      expect(() => service.createAssociationProcessor("projectReports", "", "bar" as ProcessableAssociation)).toThrow(
        BadRequestException
      );
    });

    it("throws with an unknown entity type", async () => {
      expect(() => service.createAssociationProcessor("foo" as EntityType, "", "trackings")).toThrow(
        BadRequestException
      );
    });
  });

  describe("createMediaOwnerProcessor", () => {
    it("throws with an unknown media owner type", async () => {
      expect(() => service.createMediaOwnerProcessor("foo" as MediaOwnerType, "bar")).toThrow(BadRequestException);
    });

    it("returns a MediaOwnerProcessor", async () => {
      const processor = service.createMediaOwnerProcessor("projects", "123");
      expect(processor).toBeInstanceOf(MediaOwnerProcessor);
    });
  });

  describe("buildQuery", () => {
    it("throws with invalid page info", async () => {
      await expect(service.buildQuery(Project, { page: { size: 10000 } } as EntityQueryDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.buildQuery(Project, { page: { size: 0 } } as EntityQueryDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.buildQuery(Project, { page: { number: 0 } } as EntityQueryDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("mediaMethods", () => {
    it("returns complete URLs", async () => {
      const media = { fileName: "foo.jpg" } as Media;
      expect(service.fullUrl(media)).toEqual("https://example.com//foo.jpg");
      expect(service.thumbnailUrl(media)).toEqual("https://example.com/thumbnail/foo.jpg");
    });

    it("delegates embeddedMediaDto to MediaService", () => {
      const media = { fileName: "foo.pdf" } as Media;
      const dto = { url: "https://example.com/foo.pdf" };
      mediaService.embeddedMediaDto.mockReturnValue(dto as ReturnType<EntitiesService["embeddedMediaDto"]>);

      expect(service.embeddedMediaDto(media)).toBe(dto);
      expect(mediaService.embeddedMediaDto).toHaveBeenCalledWith(media);
    });
  });

  describe("mapMediaCollection", () => {
    it("maps a MediaCollection to a dto mapping", async () => {
      const project = await ProjectFactory.create();
      const media = [
        await MediaFactory.project(project).create({
          collectionName: Project.MEDIA.otherAdditionalDocuments.dbCollection
        })
      ];
      media.push(
        await MediaFactory.project(project).create({
          collectionName: Project.MEDIA.detailedProjectBudget.dbCollection
        })
      );
      const result = service.mapMediaCollection(media, Project.MEDIA, "projects", project.uuid);
      expect(Object.keys(result)).toMatchObject(Object.keys(Project.MEDIA));
      // multi media
      expectMediaMatchesDto((result["otherAdditionalDocuments"] as MediaDto[])[0], media[0]);
      // non multi media
      expectMediaMatchesDto(result["detailedProjectBudget"] as MediaDto, media[1]);
    });
  });

  describe("entityExport", () => {
    it("returns early if the form is missing", async () => {
      await service.entityExport("projects", {}, {} as PaginatedQueryBuilder<Project>, {
        frameworkKey: "foo" as FrameworkKey
      });
      expect(csvExportService.writeCsv).not.toHaveBeenCalled();
    });
  });

  describe("exportMedia", () => {
    it("adds media to the archive", async () => {
      const append = jest.fn();
      const archive = { append } as unknown as Archiver;

      const projects = await ProjectFactory.createMany(2);
      const media = [
        ...(await MediaFactory.project(projects[0]).createMany(2)),
        ...(await MediaFactory.project(projects[1]).createMany(3))
      ];

      const generateFileName = (p: Project, m: Media) => `${p.uuid}-${m.uuid}.pdf`;
      const progressTick = jest.fn(async () => {
        /* empty */
      });

      // @ts-expect-error SdkStream type not available for casting
      mediaService.getMediaStream.mockResolvedValue(new PassThrough());

      await service.exportMedia(projects, archive, generateFileName, progressTick);

      expect(mediaService.getMediaStream).toHaveBeenCalledTimes(5);
      expect(append).toHaveBeenCalledTimes(5);
      expect(progressTick).toHaveBeenCalledTimes(5);
      for (const m of media) {
        expect(mediaService.getMediaStream).toHaveBeenCalledWith(expect.objectContaining({ uuid: m.uuid }));

        const project = projects.find(p => p.id === m.modelId) as Project;
        expect(append).toHaveBeenCalledWith(expect.any(PassThrough), { name: generateFileName(project, m) });
      }
    });

    it("does not throw if the process fails", async () => {
      const append = jest.fn(() => {
        throw new Error("fail");
      });
      const archive = { append } as unknown as Archiver;

      const project = await ProjectFactory.create();
      await MediaFactory.project(project).createMany(2);

      const generateFileName = (p: Project, m: Media) => `${p.uuid}-${m.uuid}.pdf`;
      const progressTick = jest.fn(async () => {
        /* empty */
      });

      // @ts-expect-error SdkStream type not available for casting
      mediaService.getMediaStream.mockResolvedValue(new PassThrough());

      await service.exportMedia([project], archive, generateFileName, progressTick);

      expect(mediaService.getMediaStream).toHaveBeenCalledTimes(2);
      expect(append).toHaveBeenCalledTimes(2);
      expect(progressTick).not.toHaveBeenCalled();
    });
  });
});
