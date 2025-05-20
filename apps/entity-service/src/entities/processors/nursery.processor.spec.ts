/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Nursery } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  NurseryFactory,
  NurseryReportFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { NurseryProcessor } from "./nursery.processor";
import { DateTime } from "luxon";
import { PolicyService } from "@terramatch-microservices/common";
import { NotAcceptableException } from "@nestjs/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

describe("NurseryProcessor", () => {
  let processor: NurseryProcessor;
  let policyService: DeepMocked<PolicyService>;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await Nursery.truncate();

    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>({ userId })) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("nurseries") as NurseryProcessor;
  });

  describe("should return a list of nurseries when findMany is called with valid parameters", () => {
    async function expectNurseries(
      expected: Nursery[],
      query: Omit<EntityQueryDto, "field" | "direction" | "size" | "number">,
      {
        permissions = [],
        sortField = "id",
        sortUp = true,
        total = expected.length
      }: { permissions?: string[]; sortField?: string; sortUp?: boolean; total?: number } = {}
    ) {
      policyService.getPermissions.mockResolvedValue(permissions);
      const { models, paginationTotal } = await processor.findMany(query);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }

    it("should return nurseries the user is allowed to manage", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id });
      const managedNurseries = await NurseryFactory.createMany(3, { projectId: project.id });
      await NurseryFactory.createMany(5);
      await expectNurseries(managedNurseries, {}, { permissions: ["manage-own"] });
    });

    it("should return nurseries managed by the user for the project", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id, isMonitoring: false, isManaging: true });
      await ProjectFactory.create();
      const nurseries = await NurseryFactory.createMany(3, { projectId: project.id });
      await NurseryFactory.createMany(5);
      await expectNurseries(nurseries, {}, { permissions: ["projects-manage"] });
    });

    it("should return nurseries associated with specific frameworks", async () => {
      const nurseries = await NurseryFactory.createMany(3, { frameworkKey: "hbf" });
      await NurseryFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await NurseryFactory.createMany(3, { frameworkKey: "terrafund" })) {
        nurseries.push(p);
      }

      await expectNurseries(nurseries, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("should return nurseries that match the search term", async () => {
      const n1 = await NurseryFactory.create({ name: "Foo Bar" });
      const n2 = await NurseryFactory.create({ name: "Baz Foo" });
      await NurseryFactory.createMany(3);

      await expectNurseries([n1, n2], { search: "foo" });
    });

    it("should return nurseries filtered by the update request status or project", async () => {
      const p1 = await ProjectFactory.create();
      const p2 = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: p1.id });
      await ProjectUserFactory.create({ userId, projectId: p2.id });

      const first = await NurseryFactory.create({
        name: "first nursery",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const second = await NurseryFactory.create({
        name: "second nursery",
        status: "started",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const third = await NurseryFactory.create({
        name: "third nursery",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        projectId: p1.id
      });
      const fourth = await NurseryFactory.create({
        name: "fourth nursery",
        status: "approved",
        updateRequestStatus: "approved",
        projectId: p2.id
      });

      await expectNurseries([first, second, third], { updateRequestStatus: "awaiting-approval" });

      await expectNurseries([fourth], { projectUuid: p2.uuid });
    });

    it("should throw an error if the project uuid is not found", async () => {
      await expect(processor.findMany({ projectUuid: "123" })).rejects.toThrow(BadRequestException);
    });

    it("should sort nurseries by name in ascending and descending order", async () => {
      const nurseryA = await NurseryFactory.create({ name: "A Nursery" });
      const nurseryB = await NurseryFactory.create({ name: "B Nursery" });
      const nurseryC = await NurseryFactory.create({ name: "C Nursery" });
      await expectNurseries([nurseryA, nurseryB, nurseryC], { sort: { field: "name" } }, { sortField: "name" });
      await expectNurseries(
        [nurseryA, nurseryB, nurseryC],
        { sort: { field: "name", direction: "ASC" } },
        { sortField: "name" }
      );
      await expectNurseries(
        [nurseryC, nurseryB, nurseryA],
        { sort: { field: "name", direction: "DESC" } },
        { sortField: "name", sortUp: false }
      );
    });

    it("should sort nurseries by project name in ascending and descending order", async () => {
      const projectA = await ProjectFactory.create({ name: "A Project" });
      const projectB = await ProjectFactory.create({ name: "B Project" });
      const projectC = await ProjectFactory.create({ name: "C Project" });
      const nurseryA = await NurseryFactory.create({ projectId: projectA.id });
      const nurseryB = await NurseryFactory.create({ projectId: projectB.id });
      const nurseryC = await NurseryFactory.create({ projectId: projectC.id });
      await expectNurseries(
        [nurseryA, nurseryB, nurseryC],
        { sort: { field: "projectName" } },
        { sortField: "projectName" }
      );
      await expectNurseries(
        [nurseryC, nurseryB, nurseryA],
        { sort: { field: "projectName", direction: "DESC" } },
        { sortField: "projectName" }
      );
    });

    it("should sort nurseries by start date in ascending and descending order", async () => {
      const nurseryA = await NurseryFactory.create({ startDate: DateTime.now().minus({ days: 1 }).toJSDate() });
      const nurseryB = await NurseryFactory.create({ startDate: DateTime.now().minus({ days: 10 }).toJSDate() });
      const nurseryC = await NurseryFactory.create({ startDate: DateTime.now().minus({ days: 5 }).toJSDate() });
      await expectNurseries(
        [nurseryA, nurseryC, nurseryB],
        { sort: { field: "startDate", direction: "DESC" } },
        { sortField: "startDate", sortUp: false }
      );
      await expectNurseries(
        [nurseryB, nurseryC, nurseryA],
        { sort: { field: "startDate", direction: "ASC" } },
        { sortField: "startDate", sortUp: true }
      );
    });

    it("should sort nurseries by created date in ascending and descending order", async () => {
      const now = DateTime.now();
      const nurseryA = await NurseryFactory.create({
        startDate: now.minus({ days: 1 }).toJSDate(),
        createdAt: now.minus({ minutes: 1 }).toJSDate()
      });
      const nurseryB = await NurseryFactory.create({
        startDate: now.minus({ days: 10 }).toJSDate(),
        createdAt: now.minus({ minutes: 10 }).toJSDate()
      });
      const nurseryC = await NurseryFactory.create({
        startDate: now.minus({ days: 5 }).toJSDate(),
        createdAt: now.minus({ minutes: 5 }).toJSDate()
      });
      await expectNurseries(
        [nurseryA, nurseryC, nurseryB],
        { sort: { field: "createdAt", direction: "DESC" } },
        { sortField: "createdAt", sortUp: false }
      );
      await expectNurseries(
        [nurseryB, nurseryC, nurseryA],
        { sort: { field: "createdAt", direction: "ASC" } },
        { sortField: "createdAt", sortUp: true }
      );
    });

    it("should sort nurseries by status in ascending and descending order", async () => {
      const nurseryA = await NurseryFactory.create({ status: "started" });
      const nurseryB = await NurseryFactory.create({ status: "approved" });
      const nurseryC = await NurseryFactory.create({ status: "approved" });
      await expectNurseries([nurseryA, nurseryB, nurseryC], { sort: { field: "status" } }, { sortField: "status" });
      await expectNurseries(
        [nurseryA, nurseryB, nurseryC],
        { sort: { field: "status", direction: "ASC" } },
        { sortField: "status" }
      );
      await expectNurseries(
        [nurseryC, nurseryB, nurseryA],
        { sort: { field: "status", direction: "DESC" } },
        { sortField: "status", sortUp: false }
      );
    });

    it("should sort nurseries by update request status in ascending and descending order", async () => {
      const nurseryA = await NurseryFactory.create({ updateRequestStatus: "awaiting-approval" });
      const nurseryB = await NurseryFactory.create({ updateRequestStatus: "approved" });
      const nurseryC = await NurseryFactory.create({ updateRequestStatus: "approved" });
      await expectNurseries(
        [nurseryA, nurseryB, nurseryC],
        { sort: { field: "updateRequestStatus" } },
        { sortField: "updateRequestStatus" }
      );
      await expectNurseries(
        [nurseryA, nurseryB, nurseryC],
        { sort: { field: "updateRequestStatus", direction: "ASC" } },
        { sortField: "updateRequestStatus" }
      );
      await expectNurseries(
        [nurseryC, nurseryB, nurseryA],
        { sort: { field: "updateRequestStatus", direction: "DESC" } },
        { sortField: "updateRequestStatus", sortUp: false }
      );
    });

    it("should sort nurseries by organisation name in ascending and descending order", async () => {
      const org1 = await OrganisationFactory.create({ name: "A Org" });
      const org2 = await OrganisationFactory.create({ name: "B Org" });
      const org3 = await OrganisationFactory.create({ name: "C Org" });
      const projectA = await ProjectFactory.create({ organisationId: org1.id });
      const projectB = await ProjectFactory.create({ organisationId: org2.id });
      const projectC = await ProjectFactory.create({ organisationId: org3.id });
      projectA.organisation = await projectA.$get("organisation");
      projectB.organisation = await projectB.$get("organisation");
      projectC.organisation = await projectC.$get("organisation");

      const nurseries = [
        await NurseryFactory.create({
          projectId: projectA.id
        })
      ];
      nurseries.push(
        await NurseryFactory.create({
          projectId: projectB.id
        })
      );
      nurseries.push(
        await NurseryFactory.create({
          projectId: projectC.id
        })
      );
      for (const n of nurseries) {
        n.project = await n.$get("project");
      }

      await expectNurseries(nurseries, { sort: { field: "organisationName" } }, { sortField: "organisationName" });
      await expectNurseries(
        nurseries,
        { sort: { field: "organisationName", direction: "DESC" } },
        { sortField: "organisationName", sortUp: false }
      );
    });

    it("should throw an error when sorts by a field that does not exist", async () => {
      await expect(processor.findMany({ sort: { field: "non-existing-field" } })).rejects.toThrow(BadRequestException);
    });

    it("paginates", async () => {
      const nurseries = sortBy(await NurseryFactory.createMany(25), "id");
      await expectNurseries(nurseries.slice(0, 10), { page: { size: 10 } }, { total: nurseries.length });
      await expectNurseries(nurseries.slice(10, 20), { page: { size: 10, number: 2 } }, { total: nurseries.length });
      await expectNurseries(nurseries.slice(20), { page: { size: 10, number: 3 } }, { total: nurseries.length });
    });
  });

  describe("Should return a single nursery when searching by UUID", () => {
    it("should return the nursery with the specified UUID", async () => {
      const nursery = await NurseryFactory.create();
      const result = await processor.findOne(nursery.uuid);
      expect(result?.id).toBe(nursery.id);
    });

    it("should return null when uuid does not exist", async () => {
      const uuid = "non-existing-uuid";
      const result = await processor.findOne(uuid);
      expect(result).toBeNull();
    });
  });

  describe("Should properly map the nursery data into its respective DTOs", () => {
    it("should return a light resource representation of the nursery in NurseryLightDto", async () => {
      const { uuid } = await NurseryFactory.create();
      const nursery = await processor.findOne(uuid);
      const { id, dto } = await processor.getLightDto(nursery!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: true
      });
    });
    it("should include the projectUuid and lightResource flag as calculated fields in the full NurseryFullDto representation", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await NurseryFactory.create({
        projectId: project.id
      });

      const nursery = await processor.findOne(uuid);
      nursery!.project = await nursery!.$get("project");
      const { id, dto } = await processor.getFullDto(nursery!);
      expect(id).toEqual(uuid);
      expect(dto).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid
      });
    });
  });

  describe("delete", () => {
    it("should allow an admin to delete a nursery", async () => {
      const nursery = await NurseryFactory.create();
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      await processor.delete(nursery);
      expect(nursery.deletedAt).not.toBeNull();
    });

    it("should not allow a non-admin to delete a nursery if it has reports", async () => {
      const nursery = await NurseryFactory.create();
      await NurseryReportFactory.create({ nurseryId: nursery.id });
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      await expect(processor.delete(nursery)).rejects.toThrow(NotAcceptableException);
    });

    it("should allow a non-admin to delete a nursery if it has no reports", async () => {
      const nursery = await NurseryFactory.create();
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      await processor.delete(nursery);
      expect(nursery.deletedAt).not.toBeNull();
    });
  });
});
