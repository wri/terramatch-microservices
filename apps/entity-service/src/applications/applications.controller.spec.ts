import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { FormDataService } from "../entities/form-data.service";
import { PolicyService } from "@terramatch-microservices/common";
import { ApplicationsController } from "./applications.controller";
import { AuditStatusService } from "../entities/audit-status.service";
import { Application } from "@terramatch-microservices/database/entities";
import {
  ApplicationFactory,
  AuditFactory,
  AuditStatusFactory,
  FormSubmissionFactory,
  FundingProgrammeFactory,
  OrganisationFactory,
  OrganisationUserFactory,
  ProjectFactory,
  StageFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockUserId, serialize } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { sortBy } from "lodash";
import FakeTimers from "@sinonjs/fake-timers";
import { DateTime } from "luxon";

describe("ApplicationsController", () => {
  let controller: ApplicationsController;
  let formDataService: DeepMocked<FormDataService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: FormDataService, useValue: (formDataService = createMock<FormDataService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: AuditStatusService, useValue: (auditStatusService = createMock<AuditStatusService>()) }
      ]
    }).compile();

    controller = module.get(ApplicationsController);

    await Application.truncate();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("indexApplications", () => {
    it("returns all applications to admins", async () => {
      const apps = await ApplicationFactory.createMany(3);
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      const result = serialize(await controller.index({}));
      const dtos = (result.data as Resource[]).map(({ attributes }) => attributes);
      expect(dtos.length).toBe(3);
      expect(dtos).toMatchObject(
        sortBy(apps, "id").map(({ uuid, organisationUuid, fundingProgrammeUuid }) =>
          expect.objectContaining({ uuid, organisationUuid, fundingProgrammeUuid })
        )
      );
    });

    it("returns applications related to the user's orgs for PDs", async () => {
      const orgs = await OrganisationFactory.createMany(3);
      const user = await UserFactory.create({ organisationId: orgs[0].id });
      await OrganisationUserFactory.create({ organisationId: orgs[1].id, userId: user.id, status: "approved" });
      await OrganisationUserFactory.create({ organisationId: orgs[2].id, userId: user.id, status: "pending" });
      mockUserId(user.id);
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      const apps = await Promise.all(orgs.map(({ uuid }) => ApplicationFactory.create({ organisationUuid: uuid })));
      const userApps = apps.slice(0, 2); // the third is not a confirmed org association
      await ApplicationFactory.create();
      const result = serialize(await controller.index({}));
      const dtos = (result.data as Resource[]).map(({ attributes }) => attributes);
      expect(dtos.length).toBe(2);
      expect(dtos).toMatchObject(
        sortBy(userApps, "id").map(({ uuid, organisationUuid, fundingProgrammeUuid }) =>
          expect.objectContaining({ uuid, organisationUuid, fundingProgrammeUuid })
        )
      );
    });

    it("filters by submission status", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      const apps = await ApplicationFactory.createMany(2);
      const excluded = await ApplicationFactory.create();
      // included - only submission on this app
      await FormSubmissionFactory.create({ applicationId: apps[0].id, status: "awaiting-approval" });
      // included - latest submission is awaiting approval
      await FormSubmissionFactory.create({ applicationId: apps[1].id, status: "started" });
      await FormSubmissionFactory.create({ applicationId: apps[1].id, status: "awaiting-approval" });
      // excluded - latest submission is started
      await FormSubmissionFactory.create({ applicationId: excluded.id, status: "awaiting-approval" });
      await FormSubmissionFactory.create({ applicationId: excluded.id, status: "started" });
      const result = serialize(await controller.index({ currentSubmissionStatus: "awaiting-approval" }));
      const dtos = (result.data as Resource[]).map(({ attributes }) => attributes);
      expect(dtos.length).toBe(2);
      expect(dtos).toMatchObject(
        sortBy(apps, "id").map(({ uuid, organisationUuid, fundingProgrammeUuid }) =>
          expect.objectContaining({ uuid, organisationUuid, fundingProgrammeUuid })
        )
      );
    });

    it("filters on application fields", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      const apps = await ApplicationFactory.createMany(2);
      let result = serialize(await controller.index({ organisationUuid: apps[0].organisationUuid as string }));
      let dtos = (result.data as Resource[]).map(({ attributes }) => attributes);
      expect(dtos.length).toBe(1);
      expect(dtos[0].uuid).toBe(apps[0].uuid);

      result = serialize(await controller.index({ fundingProgrammeUuid: apps[1].fundingProgrammeUuid as string }));
      dtos = (result.data as Resource[]).map(({ attributes }) => attributes);
      expect(dtos.length).toBe(1);
      expect(dtos[0].uuid).toBe(apps[1].uuid);
    });

    it("throws with an invalid sort", async () => {
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      await expect(controller.index({ sort: { field: "foo" } })).rejects.toThrow("Invalid sort field: foo");
    });

    it("sorts", async () => {
      const now = DateTime.now();
      const clock = FakeTimers.install({ shouldAdvanceTime: true });
      try {
        // setting up app1 to have the older creation date and newer update date
        clock.setSystemTime(now.minus({ days: 10 }).toJSDate());
        const org1 = await OrganisationFactory.create({ name: "Omega" });
        const app1 = await ApplicationFactory.create({ organisationUuid: org1.uuid });
        clock.setSystemTime(now.minus({ days: 8 }).toJSDate());
        const org2 = await OrganisationFactory.create({ name: "Alpha" });
        const app2 = await ApplicationFactory.create({ organisationUuid: org2.uuid });
        clock.setSystemTime(now.minus({ days: 6 }).toJSDate());
        await app1.update({ updatedBy: 123 });

        policyService.getPermissions.mockResolvedValue(["framework-ppc"]);

        let result = serialize(await controller.index({ sort: { field: "createdAt" } }));
        let uuids = (result.data as Resource[]).map(({ id }) => id);
        expect(uuids).toEqual([app1.uuid, app2.uuid]);
        result = serialize(await controller.index({ sort: { field: "createdAt", direction: "DESC" } }));
        uuids = (result.data as Resource[]).map(({ id }) => id);
        expect(uuids).toEqual([app2.uuid, app1.uuid]);

        result = serialize(await controller.index({ sort: { field: "updatedAt" } }));
        uuids = (result.data as Resource[]).map(({ id }) => id);
        expect(uuids).toEqual([app2.uuid, app1.uuid]);
        result = serialize(await controller.index({ sort: { field: "updatedAt", direction: "DESC" } }));
        uuids = (result.data as Resource[]).map(({ id }) => id);
        expect(uuids).toEqual([app1.uuid, app2.uuid]);

        result = serialize(await controller.index({ sort: { field: "organisationName" } }));
        uuids = (result.data as Resource[]).map(({ id }) => id);
        expect(uuids).toEqual([app2.uuid, app1.uuid]);
        result = serialize(await controller.index({ sort: { field: "organisationName", direction: "DESC" } }));
        uuids = (result.data as Resource[]).map(({ id }) => id);
        expect(uuids).toEqual([app1.uuid, app2.uuid]);
      } finally {
        clock.uninstall();
      }
    });

    it("searches", async () => {
      const org1 = await OrganisationFactory.create({ name: "Test Trees" });
      const app1 = await ApplicationFactory.create({ organisationUuid: org1.uuid });
      const org2 = await OrganisationFactory.create({ name: "Test Farms" });
      const app2 = await ApplicationFactory.create({ organisationUuid: org2.uuid });
      const org3 = await OrganisationFactory.create({ name: "Crops" });
      await ApplicationFactory.create({ organisationUuid: org3.uuid });

      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);

      let result = serialize(await controller.index({ search: "Test" }));
      let uuids = (result.data as Resource[]).map(({ id }) => id);
      expect(uuids).toEqual([app1.uuid, app2.uuid]);

      result = serialize(await controller.index({ search: "Trees" }));
      uuids = (result.data as Resource[]).map(({ id }) => id);
      expect(uuids).toEqual([app1.uuid]);

      result = serialize(await controller.index({ search: "Foo" }));
      uuids = (result.data as Resource[]).map(({ id }) => id);
      expect(uuids).toEqual([]);
    });
  });

  describe("getApplication", () => {
    it("throws if the application is not found", async () => {
      await expect(controller.get({ uuid: "fake-uuid" }, {})).rejects.toThrow("Application not found");
    });

    it("returns the DTO", async () => {
      const app = await ApplicationFactory.create();
      const stage = await StageFactory.create({});
      const user = await UserFactory.create();
      const submission = await FormSubmissionFactory.create({
        applicationId: app.id,
        stageUuid: stage.uuid,
        userId: user.uuid
      });
      const project = await ProjectFactory.create({ applicationId: app.id });

      const result = serialize(await controller.get({ uuid: app.uuid }, {}));
      const dto = (result.data as Resource).attributes;
      expect(dto.uuid).toBe(app.uuid);
      expect(dto.organisationUuid).toBe(app.organisationUuid);
      expect(dto.fundingProgrammeUuid).toBe(app.fundingProgrammeUuid);
      expect(dto.projectUuid).toBe(project.uuid);
      expect(dto.submissions).toEqual([
        expect.objectContaining({
          uuid: submission.uuid,
          updatedByName: user.fullName,
          stageName: stage.name,
          status: submission.status
        })
      ]);
    });

    it("sideloads", async () => {
      const fundingProgramme = await FundingProgrammeFactory.create();
      const app = await ApplicationFactory.create({ fundingProgrammeUuid: fundingProgramme.uuid });
      const stage = await StageFactory.create({});
      const user = await UserFactory.create({ locale: "es-MX" });
      mockUserId(user.id);
      const submissions = [
        await FormSubmissionFactory.create({
          applicationId: app.id,
          stageUuid: (await StageFactory.create()).uuid,
          userId: user.uuid,
          status: "approved"
        }),
        await FormSubmissionFactory.create({
          applicationId: app.id,
          stageUuid: stage.uuid,
          userId: user.uuid,
          status: "started"
        })
      ];

      formDataService.getFullSubmission.mockResolvedValue(submissions[1]);

      await controller.get({ uuid: app.uuid }, { sideloads: ["currentSubmission", "fundingProgramme"] });
      expect(formDataService.getFullSubmission).toHaveBeenCalledWith(submissions[1].uuid);
      expect(formDataService.addSubmissionDto).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: submissions[1].id })
      );
      expect(formDataService.addFundingProgrammeDtos).toHaveBeenCalledWith(
        expect.anything(),
        [expect.objectContaining({ id: fundingProgramme.id })],
        "es-MX"
      );
    });
  });

  describe("deleteApplication", () => {
    it("throws if the application is not found", async () => {
      await expect(controller.delete({ uuid: "fake-uuid" })).rejects.toThrow("Application not found");
    });

    it("deletes the application and its submissions", async () => {
      const application = await ApplicationFactory.create();
      const submissions = await FormSubmissionFactory.createMany(2, { applicationId: application.id });

      const result = serialize(await controller.delete({ uuid: application.uuid }));
      expect(policyService.authorize).toHaveBeenCalledWith("delete", expect.objectContaining({ id: application.id }));
      expect(result.meta.resourceType).toBe("applications");
      expect(result.meta.resourceIds).toEqual([application.uuid]);
      expect(result.meta.deleted).toHaveLength(2);
      expect(result.meta.deleted).toContainEqual(
        expect.objectContaining({ resource: "submissions", id: submissions[0].uuid })
      );
      expect(result.meta.deleted).toContainEqual(
        expect.objectContaining({ resource: "submissions", id: submissions[1].uuid })
      );
      await Promise.all(submissions.map(sub => sub.reload({ paranoid: false })));
      expect(submissions[0].deletedAt).not.toBeNull();
      expect(submissions[1].deletedAt).not.toBeNull();
    });
  });

  describe("getApplicationHistory", () => {
    it("throws if the application is not found", async () => {
      await expect(controller.getHistory({ uuid: "fake-uuid" })).rejects.toThrow("Application not found");
    });

    it("assembles the application history from submission audits", async () => {
      const app = await ApplicationFactory.create();
      const sub1 = await FormSubmissionFactory.create({ applicationId: app.id, status: "approved" });
      const sub2 = await FormSubmissionFactory.create({ applicationId: app.id, status: "requires-more-information" });

      let time = DateTime.now().minus({ days: 30 });
      const clock = FakeTimers.install({ shouldAdvanceTime: true });
      const advanceHours = (hours: number) => {
        clock.setSystemTime((time = time.plus({ hours })).toJSDate());
      };

      try {
        clock.setSystemTime(time.toJSDate());
        await AuditFactory.formSubmission(sub1).create({ event: "created", newValues: { status: "started" } });
        // ignored; update too soon
        advanceHours(6);
        await AuditFactory.formSubmission(sub1).create({ event: "updated" });
        advanceHours(12);
        const sub1Update = time.set({ millisecond: 0 }).toJSDate();
        await AuditFactory.formSubmission(sub1).create({ event: "updated" });
        advanceHours(1);
        await AuditFactory.formSubmission(sub1).create({
          event: "updated",
          newValues: { status: "awaiting-approval" }
        });
        advanceHours(1);
        await AuditFactory.formSubmission(sub1).create({
          event: "updated",
          newValues: { status: "approved", feedback: "Approval Feedback" }
        });
        advanceHours(6);
        await AuditFactory.formSubmission(sub2).create({ event: "created", newValues: { status: "started" } });
        advanceHours(6);
        await AuditFactory.formSubmission(sub2).create({ event: "updated" });
        advanceHours(7);
        const sub2Update = time.set({ millisecond: 0 }).toJSDate();
        await AuditStatusFactory.formSubmission(sub2).create({ type: "updated", status: "started" });
        advanceHours(1);
        await AuditStatusFactory.formSubmission(sub2).create({ type: "status", status: "awaiting-approval" });
        advanceHours(1);
        await AuditStatusFactory.formSubmission(sub2).create({
          type: "status",
          status: "requires-more-information",
          comment: "Requires More Feedback"
        });

        const result = serialize(await controller.getHistory({ uuid: app.uuid }));
        const dto = (result.data as Resource).attributes;
        // result is in reverse chronological order
        expect(dto.entries).toEqual([
          expect.objectContaining({
            eventType: "status",
            status: "requires-more-information",
            comment: "Requires More Feedback"
          }),
          expect.objectContaining({ eventType: "status", status: "awaiting-approval" }),
          expect.objectContaining({ eventType: "updated", status: "started", date: sub2Update }),
          expect.objectContaining({ eventType: "status", status: "started" }),
          expect.objectContaining({ eventType: "status", status: "approved", comment: "Approval Feedback" }),
          expect.objectContaining({ eventType: "status", status: "awaiting-approval" }),
          expect.objectContaining({ eventType: "updated", date: sub1Update }),
          expect.objectContaining({ eventType: "status", status: "started" })
        ]);
      } finally {
        clock.uninstall();
      }
    });
  });
});
