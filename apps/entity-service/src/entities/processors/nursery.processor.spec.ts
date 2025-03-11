import { Nursery } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { reverse, sortBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import {
  NurseryFactory,
  OrganisationFactory,
  ProjectFactory,
  ProjectUserFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { NurseryProcessor } from "./nursery.processor";
import { NurseryFullDto, NurseryLightDto } from "../dto/nursery.dto";
import { DateTime } from "luxon";

describe("NuseryProcessor", () => {
  let processor: NurseryProcessor;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await Nursery.truncate();

    const module = await Test.createTestingModule({
      providers: [{ provide: MediaService, useValue: createMock<MediaService>() }, EntitiesService]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("nurseries") as NurseryProcessor;
  });

  describe("findMany", () => {
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
      const { models, paginationTotal } = await processor.findMany(query as EntityQueryDto, userId, permissions);
      expect(models.length).toBe(expected.length);
      expect(paginationTotal).toBe(total);

      const sorted = sortBy(expected, sortField);
      if (!sortUp) reverse(sorted);
      expect(models.map(({ id }) => id)).toEqual(sorted.map(({ id }) => id));
    }
    it("returns nurseries", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id });
      const managedNurseries = await NurseryFactory.createMany(3, { projectId: project.id });
      await NurseryFactory.createMany(5);
      await expectNurseries(managedNurseries, {}, { permissions: ["manage-own"] });
    });

    it("returns managed nurseries", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id, isMonitoring: false, isManaging: true });
      await ProjectFactory.create();
      const nurseries = await NurseryFactory.createMany(3, { projectId: project.id });
      await NurseryFactory.createMany(5);
      await expectNurseries(nurseries, {}, { permissions: ["projects-manage"] });
    });

    it("returns framework nurseries", async () => {
      const nurseries = await NurseryFactory.createMany(3, { frameworkKey: "hbf" });
      await NurseryFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await NurseryFactory.createMany(3, { frameworkKey: "terrafund" })) {
        nurseries.push(p);
      }

      await expectNurseries(nurseries, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("searches", async () => {
      const n1 = await NurseryFactory.create({ name: "Foo Bar" });
      const n2 = await NurseryFactory.create({ name: "Baz Foo" });
      await NurseryFactory.createMany(3);

      await expectNurseries([n1, n2], { search: "foo" });
    });

    it("filters", async () => {
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

    it("sorts by name", async () => {
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

    it("sorts by project name", async () => {
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

    it("sorts by startDate", async () => {
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

    it("sorts by createdAt", async () => {
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

    it("sort by status", async () => {
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

    it("sort by updateRequestStatus", async () => {
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

    it("sorts by organisation name", async () => {
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

    it("paginates", async () => {
      const nurseries = sortBy(await NurseryFactory.createMany(25), "id");
      await expectNurseries(nurseries.slice(0, 10), { page: { size: 10 } }, { total: nurseries.length });
      await expectNurseries(nurseries.slice(10, 20), { page: { size: 10, number: 2 } }, { total: nurseries.length });
      await expectNurseries(nurseries.slice(20), { page: { size: 10, number: 3 } }, { total: nurseries.length });
    });
  });

  describe("findOne", () => {
    it("returns the requested nursery", async () => {
      const nursery = await NurseryFactory.create();
      const result = await processor.findOne(nursery.uuid);
      expect(result.id).toBe(nursery.id);
    });
    
    it('should throw an error when uuid does not exist', async () => {
      const uuid = 'non-existing-uuid';
      expect((await processor.findOne(uuid)).id).rejects.toThrow(BadRequestException);
    });
  });

  describe("DTOs", () => {
    it("NurseryLightDto is a light resource", async () => {
      const { uuid } = await NurseryFactory.create();
      const nursery = await processor.findOne(uuid);
      const document = buildJsonApi(NurseryLightDto, { forceDataArray: true });
      await processor.addLightDto(document, nursery);
      const attributes = document.serialize().data[0].attributes as NurseryLightDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: true
      });
    });
    it("includes calculated fields in NurseryFullDto", async () => {
      const project = await ProjectFactory.create();

      const { uuid } = await NurseryFactory.create({
        projectId: project.id
      });

      const nursery = await processor.findOne(uuid);
      const document = buildJsonApi(NurseryFullDto, { forceDataArray: true });
      await processor.addFullDto(document, nursery);
      const attributes = document.serialize().data[0].attributes as NurseryFullDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid
      });
    });
  });
});
