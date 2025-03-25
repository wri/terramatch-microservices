import { NurseryReport } from "@terramatch-microservices/database/entities";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock } from "@golevelup/ts-jest";
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
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { DateTime } from "luxon";
import { NurseryReportProcessor } from "./nursery-report.processor";
import { NurseryReportFullDto, NurseryReportLightDto } from "../dto/nursery-report.dto";

describe("NurseryReportProcessor", () => {
  let processor: NurseryReportProcessor;
  let userId: number;

  beforeAll(async () => {
    userId = (await UserFactory.create()).id;
  });

  beforeEach(async () => {
    await NurseryReport.truncate();

    const module = await Test.createTestingModule({
      providers: [{ provide: MediaService, useValue: createMock<MediaService>() }, EntitiesService]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("nurseryReports") as NurseryReportProcessor;
  });

  describe("should return a list of nursery reports when findMany is called with valid parameters", () => {
    async function expectNurseryReports(
      expected: NurseryReport[],
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

    it("should returns nursery reports", async () => {
      const project = await ProjectFactory.create();
      const nursery = await NurseryFactory.create({ projectId: project.id });
      await ProjectUserFactory.create({ userId, projectId: project.id });
      const managedNurseryReports = await NurseryReportFactory.createMany(3, { nurseryId: nursery.id });
      await NurseryReportFactory.createMany(5);
      await expectNurseryReports(managedNurseryReports, {}, { permissions: ["manage-own"] });
    });

    it("should returns managed nursery reports", async () => {
      const project = await ProjectFactory.create();
      await ProjectUserFactory.create({ userId, projectId: project.id, isMonitoring: false, isManaging: true });
      await ProjectFactory.create();
      const nursery = await NurseryFactory.create({ projectId: project.id });
      const nurseryReports = await NurseryReportFactory.createMany(3, { nurseryId: nursery.id });
      await NurseryReportFactory.createMany(5);
      await expectNurseryReports(nurseryReports, {}, { permissions: ["projects-manage"] });
    });

    it("should returns framework nursery reports", async () => {
      const nurseryReports = await NurseryReportFactory.createMany(3, { frameworkKey: "hbf" });
      await NurseryReportFactory.createMany(3, { frameworkKey: "ppc" });
      for (const p of await NurseryReportFactory.createMany(3, { frameworkKey: "terrafund" })) {
        nurseryReports.push(p);
      }

      await expectNurseryReports(nurseryReports, {}, { permissions: ["framework-hbf", "framework-terrafund"] });
    });

    it("should return nursery reports that match the search term", async () => {
      const org1 = await OrganisationFactory.create({ name: "A Org" });
      const org2 = await OrganisationFactory.create({ name: "B Org" });
      const project1 = await ProjectFactory.create({ name: "Foo Bar", organisationId: org1.id });
      const project2 = await ProjectFactory.create({ name: "Baz Foo", organisationId: org2.id });
      const nursery1 = await NurseryFactory.create({ projectId: project1.id });
      const nursery2 = await NurseryFactory.create({ projectId: project2.id });
      nursery1.project = await nursery1.$get("project");
      nursery2.project = await nursery2.$get("project");
      project1.organisation = await project1.$get("organisation");
      project2.organisation = await project2.$get("organisation");
      const nurseryReport1 = await NurseryReportFactory.create({ nurseryId: nursery1.id });
      const nurseryReport2 = await NurseryReportFactory.create({ nurseryId: nursery2.id });
      nurseryReport1.nursery = await nurseryReport1.$get("nursery");
      nurseryReport2.nursery = await nurseryReport2.$get("nursery");
      await NurseryReportFactory.createMany(3);

      await expectNurseryReports([nurseryReport1, nurseryReport2], { search: "foo" });

      await expectNurseryReports([nurseryReport1, nurseryReport2], { search: "org" });
    });

    it("should return nursery reports filtered by the status, update request status, nursery, country, organisation", async () => {
      const org1 = await OrganisationFactory.create();
      const org2 = await OrganisationFactory.create();
      const p1 = await ProjectFactory.create({ country: "MX", organisationId: org1.id });
      const p2 = await ProjectFactory.create({ country: "CA", organisationId: org2.id });
      await ProjectUserFactory.create({ userId, projectId: p1.id });
      await ProjectUserFactory.create({ userId, projectId: p2.id });
      const n1 = await NurseryFactory.create({ projectId: p1.id });
      const n2 = await NurseryFactory.create({ projectId: p2.id });
      // n1.project = await n1.$get("project");
      // n2.project = await n2.$get("project");
      // n1.project.organisation = await n1.project.$get("organisation");
      // n2.project.organisation = await n2.project.$get("organisation");
      const first = await NurseryReportFactory.create({
        title: "first nursery report",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        nurseryId: n1.id
      });
      const second = await NurseryReportFactory.create({
        title: "second project report",
        status: "started",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        nurseryId: n1.id
      });
      const third = await NurseryReportFactory.create({
        title: "third project report",
        status: "approved",
        updateRequestStatus: "awaiting-approval",
        frameworkKey: "ppc",
        nurseryId: n1.id
      });
      const fourth = await NurseryReportFactory.create({
        title: "fourth project report",
        status: "approved",
        updateRequestStatus: "approved",
        frameworkKey: "terrafund",
        nurseryId: n2.id
      });

      first.nursery = await first.$get("nursery");
      second.nursery = await second.$get("nursery");
      third.nursery = await third.$get("nursery");
      fourth.nursery = await fourth.$get("nursery");

      await expectNurseryReports([first, second, third], { updateRequestStatus: "awaiting-approval" });

      await expectNurseryReports([first, third, fourth], { status: "approved" });

      await expectNurseryReports([fourth], { projectUuid: p2.uuid });

      await expectNurseryReports([first, second, third], { country: "MX" });

      await expectNurseryReports([first, second, third], { nurseryUuid: n1.uuid });

      await expectNurseryReports([second], { status: "started", updateRequestStatus: "awaiting-approval" });

      await expectNurseryReports([first], { projectUuid: p1.uuid });
    });

    it("should throw an error if the project uuid is not found", async () => {
      await expect(processor.findMany({ projectUuid: "123" })).rejects.toThrow(BadRequestException);
    });

    it("should throw an error if the nursery uuid is not found", async () => {
      await expect(processor.findMany({ nurseryUuid: "123" })).rejects.toThrow(BadRequestException);
    });

    it("should sort nursery reports by project name", async () => {
      const projectA = await ProjectFactory.create({ name: "A Project" });
      const projectB = await ProjectFactory.create({ name: "B Project" });
      const projectC = await ProjectFactory.create({ name: "C Project" });
      const nurseryA = await NurseryFactory.create({ projectId: projectA.id });
      const nurseryB = await NurseryFactory.create({ projectId: projectB.id });
      const nurseryC = await NurseryFactory.create({ projectId: projectC.id });
      const nurseryReportA = await NurseryReportFactory.create({ nurseryId: nurseryA.id });
      const nurseryReportB = await NurseryReportFactory.create({ nurseryId: nurseryB.id });
      const nurseryReportC = await NurseryReportFactory.create({ nurseryId: nurseryC.id });
      await expectNurseryReports(
        [nurseryReportA, nurseryReportB, nurseryReportC],
        { sort: { field: "projectName" } },
        { sortField: "projectName" }
      );
      await expectNurseryReports(
        [nurseryReportC, nurseryReportB, nurseryReportA],
        { sort: { field: "projectName", direction: "DESC" } },
        { sortField: "projectName" }
      );
    });

    it("should sort nursery reports by organisation name", async () => {
      const org1 = await OrganisationFactory.create({ name: "A Org" });
      const org2 = await OrganisationFactory.create({ name: "B Org" });
      const org3 = await OrganisationFactory.create({ name: "C Org" });
      const projectA = await ProjectFactory.create({ organisationId: org1.id });
      const projectB = await ProjectFactory.create({ organisationId: org2.id });
      const projectC = await ProjectFactory.create({ organisationId: org3.id });
      const nurseryA = await NurseryFactory.create({ projectId: projectA.id });
      const nurseryB = await NurseryFactory.create({ projectId: projectB.id });
      const nurseryC = await NurseryFactory.create({ projectId: projectC.id });
      projectA.organisation = await projectA.$get("organisation");
      projectB.organisation = await projectB.$get("organisation");
      projectC.organisation = await projectC.$get("organisation");

      const nurseryReports = [
        await NurseryReportFactory.create({
          nurseryId: nurseryA.id
        })
      ];
      nurseryReports.push(
        await NurseryReportFactory.create({
          nurseryId: nurseryB.id
        })
      );
      nurseryReports.push(
        await NurseryReportFactory.create({
          nurseryId: nurseryC.id
        })
      );
      for (const n of nurseryReports) {
        n.nursery = await n.$get("nursery");
      }

      await expectNurseryReports(
        nurseryReports,
        { sort: { field: "organisationName" } },
        { sortField: "organisationName" }
      );
      await expectNurseryReports(
        nurseryReports,
        { sort: { field: "organisationName", direction: "DESC" } },
        { sortField: "organisationName", sortUp: false }
      );
    });

    it("should sort nursery reports by due date", async () => {
      const nurseryReportA = await NurseryReportFactory.create({ dueAt: DateTime.now().minus({ days: 1 }).toJSDate() });
      const nurseryReportB = await NurseryReportFactory.create({
        dueAt: DateTime.now().minus({ days: 10 }).toJSDate()
      });
      const nurseryReportC = await NurseryReportFactory.create({ dueAt: DateTime.now().minus({ days: 5 }).toJSDate() });
      await expectNurseryReports(
        [nurseryReportA, nurseryReportC, nurseryReportB],
        { sort: { field: "dueAt", direction: "DESC" } },
        { sortField: "dueAt", sortUp: false }
      );
      await expectNurseryReports(
        [nurseryReportB, nurseryReportC, nurseryReportA],
        { sort: { field: "dueAt", direction: "ASC" } },
        { sortField: "dueAt", sortUp: true }
      );
    });

    it("should sort nursery reports by submitted at", async () => {
      const now = DateTime.now();
      const nurseryReportA = await NurseryReportFactory.create({
        submittedAt: now.minus({ minutes: 1 }).toJSDate()
      });
      const nurseryReportB = await NurseryReportFactory.create({
        submittedAt: now.minus({ minutes: 10 }).toJSDate()
      });
      const nurseryReportC = await NurseryReportFactory.create({
        submittedAt: now.minus({ minutes: 5 }).toJSDate()
      });
      await expectNurseryReports(
        [nurseryReportA, nurseryReportC, nurseryReportB],
        { sort: { field: "submittedAt", direction: "DESC" } },
        { sortField: "submittedAt", sortUp: false }
      );
      await expectNurseryReports(
        [nurseryReportB, nurseryReportC, nurseryReportA],
        { sort: { field: "submittedAt", direction: "ASC" } },
        { sortField: "submittedAt", sortUp: true }
      );
    });

    it("should sort nursery reports by updated at", async () => {
      const nurseryReportA = await NurseryReportFactory.create();
      nurseryReportA.updatedAt = DateTime.now().minus({ days: 1 }).toJSDate();

      await expectNurseryReports([nurseryReportA], { sort: { field: "updatedAt" } }, { sortField: "updatedAt" });
      await expectNurseryReports(
        [nurseryReportA],
        { sort: { field: "updatedAt", direction: "DESC" } },
        { sortField: "updatedAt", sortUp: false }
      );
    });

    it("should sort nursery reports by update request status", async () => {
      const nurseryReportA = await NurseryReportFactory.create({ updateRequestStatus: "awaiting-approval" });
      const nurseryReportB = await NurseryReportFactory.create({ updateRequestStatus: "awaiting-approval" });
      const nurseryReportC = await NurseryReportFactory.create({ updateRequestStatus: "awaiting-approval" });
      await expectNurseryReports(
        [nurseryReportA, nurseryReportB, nurseryReportC],
        { sort: { field: "updateRequestStatus" } },
        { sortField: "updateRequestStatus" }
      );
      await expectNurseryReports(
        [nurseryReportA, nurseryReportB, nurseryReportC],
        { sort: { field: "updateRequestStatus", direction: "ASC" } },
        { sortField: "updateRequestStatus" }
      );
      await expectNurseryReports(
        [nurseryReportC, nurseryReportB, nurseryReportA],
        { sort: { field: "updateRequestStatus", direction: "DESC" } },
        { sortField: "updateRequestStatus", sortUp: false }
      );
    });

    it("should sort nursery reports by status", async () => {
      const nurseryReportA = await NurseryReportFactory.create({ status: "started" });
      const nurseryReportB = await NurseryReportFactory.create({ status: "approved" });
      const nurseryReportC = await NurseryReportFactory.create({ status: "approved" });
      await expectNurseryReports(
        [nurseryReportA, nurseryReportB, nurseryReportC],
        { sort: { field: "status" } },
        { sortField: "status" }
      );
      await expectNurseryReports(
        [nurseryReportA, nurseryReportB, nurseryReportC],
        { sort: { field: "status", direction: "ASC" } },
        { sortField: "status" }
      );
      await expectNurseryReports(
        [nurseryReportC, nurseryReportB, nurseryReportA],
        { sort: { field: "status", direction: "DESC" } },
        { sortField: "status", sortUp: false }
      );
    });

    it("should return an empty list when there are no matches in the search", async () => {
      await NurseryReportFactory.createMany(3, { title: "foo" });
      await expectNurseryReports([], { search: "test" });
    });

    it("should paginate nursery reports", async () => {
      const nurseryReports = sortBy(await NurseryReportFactory.createMany(25), "id");
      await expectNurseryReports(nurseryReports.slice(0, 10), { page: { size: 10 } }, { total: nurseryReports.length });
      await expectNurseryReports(
        nurseryReports.slice(10, 20),
        { page: { size: 10, number: 2 } },
        { total: nurseryReports.length }
      );
      await expectNurseryReports(
        nurseryReports.slice(20),
        { page: { size: 10, number: 3 } },
        { total: nurseryReports.length }
      );
    });
  });

  describe("should return a requested nursery report when findOne is called with a valid uuid", () => {
    it("should return a requested nursery report", async () => {
      const nurseryReport = await NurseryReportFactory.create();
      const result = await processor.findOne(nurseryReport.uuid);
      expect(result.id).toBe(nurseryReport.id);
    });
  });

  describe("should properly map the nursery report data into its respective DTOs", () => {
    it("should serialize a Nursery Report as a light resource (NurseryReportLightDto)", async () => {
      const { uuid } = await NurseryReportFactory.create();
      const nurseryReport = await processor.findOne(uuid);
      const document = buildJsonApi(NurseryReportLightDto, { forceDataArray: true });
      await processor.addLightDto(document, nurseryReport);
      const attributes = document.serialize().data[0].attributes as NurseryReportLightDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: true
      });
    });

    it("should include calculated fields in NurseryReportFullDto", async () => {
      const project = await ProjectFactory.create();
      const nursery = await NurseryFactory.create({ projectId: project.id });

      const { uuid } = await NurseryReportFactory.create({
        nurseryId: nursery.id
      });

      const nurseryReport = await processor.findOne(uuid);
      const document = buildJsonApi(NurseryReportFullDto, { forceDataArray: true });
      await processor.addFullDto(document, nurseryReport);
      const attributes = document.serialize().data[0].attributes as NurseryReportFullDto;
      expect(attributes).toMatchObject({
        uuid,
        lightResource: false,
        projectUuid: project.uuid,
        nurseryUuid: nursery.uuid
      });
    });
  });
});
