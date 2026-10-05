import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { mockUserContext, serialize, setMockedPermissions } from "@terramatch-microservices/common/util/testing";
import { Resource } from "@terramatch-microservices/common/util";
import { Media, Site } from "@terramatch-microservices/database/entities";
import { MediaFactory, SiteFactory } from "@terramatch-microservices/database/factories";
import { EntitiesService } from "./entities.service";
import { MediaMapIndexController } from "./media-map-index.controller";
import { MediaProcessor } from "./processors/media.processor";
import { MediaMapIndexDto } from "./dto/media-map-index.dto";

describe("MediaMapIndexController", () => {
  let controller: MediaMapIndexController;
  let entitiesService: DeepMocked<EntitiesService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MediaMapIndexController],
      providers: [
        PolicyService,
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) }
      ]
    }).compile();

    controller = module.get(MediaMapIndexController);
    entitiesService.createAssociationProcessor.mockImplementation(
      (entity, uuid) => new MediaProcessor(entity, uuid, Site, entitiesService)
    );
    entitiesService.thumbnailUrl.mockReturnValue(null);

    mockUserContext({ userId: 123 });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await Media.truncate();
  });

  it("returns every geotagged media for the site", async () => {
    setMockedPermissions("projects-read");
    const site = await SiteFactory.create();
    const geotagged = await MediaFactory.site(site).createMany(3, { lat: 1, lng: 2 });
    await MediaFactory.site(site).create();

    const result = serialize(await controller.mediaMapIndex({ entity: "sites", uuid: site.uuid }));

    expect(result.data).toMatchObject({ type: "mediaMapIndexes", id: `sites|${site.uuid}` });
    const { media, total } = (result.data as Resource).attributes as unknown as MediaMapIndexDto;
    expect(total).toBe(3);
    expect(media.map(({ uuid }) => uuid).sort()).toEqual(geotagged.map(({ uuid }) => uuid).sort());
  });

  it("throws if the user cannot read the base entity", async () => {
    setMockedPermissions();
    const site = await SiteFactory.create();
    await MediaFactory.site(site).create({ lat: 1, lng: 2 });

    await expect(controller.mediaMapIndex({ entity: "sites", uuid: site.uuid })).rejects.toThrow(UnauthorizedException);
  });

  it("throws if the base entity is not found", async () => {
    setMockedPermissions("projects-read");

    await expect(
      controller.mediaMapIndex({ entity: "sites", uuid: "00000000-0000-4000-8000-000000000000" })
    ).rejects.toThrow(NotFoundException);
  });
});
