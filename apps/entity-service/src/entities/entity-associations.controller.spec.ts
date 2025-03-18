import { Demographic, ProjectReport } from "@terramatch-microservices/database/entities";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "./entities.service";
import { PolicyService } from "@terramatch-microservices/common";
import { Test } from "@nestjs/testing";
import { EntityAssociationsController } from "./entity-associations.controller";
import { AssociationProcessor } from "./processors/association-processor";
import { DemographicDto } from "./dto/demographic.dto";
import { DemographicFactory, ProjectReportFactory } from "@terramatch-microservices/database/factories";
import { EntityAssociationIndexParamsDto } from "./dto/entity-association-index-params.dto";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

class StubProcessor extends AssociationProcessor<Demographic, DemographicDto> {
  DTO = DemographicDto;

  addDtos = jest.fn(() => Promise.resolve());
  getAssociations = jest.fn(() => Promise.resolve([] as Demographic[]));
}

describe("EntityAssociationsController", () => {
  let controller: EntityAssociationsController;
  let entitiesService: DeepMocked<EntitiesService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [EntityAssociationsController],
      providers: [
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) },
        {
          provide: PolicyService,
          useValue: (policyService = createMock<PolicyService>({ userId: 123 }))
        }
      ]
    })
      .setLogger(new TMLogger())
      .compile();

    controller = module.get(EntityAssociationsController);
    // @ts-expect-error union type complexity
    entitiesService.createAssociationProcessor.mockImplementation((entity, uuid) => {
      return new StubProcessor(entity, uuid, ProjectReport);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("associationIndex", () => {
    it("should call getBaseEntity", async () => {
      policyService.getPermissions.mockResolvedValue(["view-dashboard"]);
      const pr = await ProjectReportFactory.create();
      const processor = new StubProcessor("projectReports", pr.uuid, ProjectReport);
      // @ts-expect-error union type complexity
      entitiesService.createAssociationProcessor.mockImplementation(() => processor);
      const spy = jest.spyOn(processor, "getBaseEntity");
      await controller.associationIndex({
        entity: "projectReports",
        uuid: pr.uuid,
        association: "demographics"
      } as EntityAssociationIndexParamsDto);
      expect(spy).toHaveBeenCalled();
    });

    it("should throw if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      const pr = await ProjectReportFactory.create();
      await expect(
        controller.associationIndex({
          entity: "projectReports",
          uuid: pr.uuid,
          association: "demographics"
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw if the base entity is not found", async () => {
      policyService.getPermissions.mockResolvedValue(["view-dashboard"]);
      await expect(
        controller.associationIndex({
          entity: "projectReports",
          uuid: "fake uuid",
          association: "demographics"
        })
      ).rejects.toThrow(NotFoundException);
    });

    it("should add all DTOs to the document", async () => {
      const pr = await ProjectReportFactory.create();
      await DemographicFactory.forProjectReportWorkday.create({ demographicalId: pr.id });
      await DemographicFactory.forProjectReportJobs.create({ demographicalId: pr.id });
      const result = await controller.associationIndex({
        entity: "projectReports",
        uuid: pr.uuid,
        association: "demographics"
      });

      const processor = entitiesService.createAssociationProcessor.mock.results[0].value;
      expect(processor.addDtos).toHaveBeenCalled();
      expect(result.meta.resourceType).toBe("demographics");
    });
  });
});
