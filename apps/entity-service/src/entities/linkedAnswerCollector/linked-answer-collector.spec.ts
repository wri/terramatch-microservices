import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FormModels, LinkedAnswerCollector } from "./index";
import {
  FinancialReportFactory,
  MediaFactory,
  NurseryFactory,
  POLYGON,
  ProjectPitchFactory,
  ProjectPolygonFactory,
  SiteFactory
} from "@terramatch-microservices/database/factories";
import { Dictionary } from "lodash";
import { Media } from "@terramatch-microservices/database/entities";
import { EmbeddedMediaDto } from "../dto/media.dto";

describe("LinkedAnswerCollector", () => {
  let mediaService: DeepMocked<MediaService>;
  let collector: LinkedAnswerCollector;

  beforeEach(() => {
    mediaService = createMock<MediaService>();
    collector = new LinkedAnswerCollector(mediaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const getAnswers = async (models: FormModels) => {
    const answers: Dictionary<unknown> = {};
    await collector.collect(answers, models);
    return answers;
  };

  const expectAnswers = async (models: FormModels, expected: Dictionary<unknown>) => {
    expect(await getAnswers(models)).toStrictEqual(expected);
  };

  describe("fieldCollector", () => {
    it("collects standard fields", async () => {
      collector.fields.addField({ property: "name", label: "", inputType: "text" }, "sites", "one");
      collector.fields.addField({ property: "name", label: "", inputType: "text" }, "nurseries", "two");
      // Should NOOP in collect().
      collector.fields.addField({ property: "name", label: "", inputType: "text" }, "projects", "three");

      const site = await SiteFactory.create();
      const nursery = await NurseryFactory.create();
      await expectAnswers({ sites: site, nurseries: nursery }, { one: site.name, two: nursery.name });
    });

    it("collections polygon fields", async () => {
      collector.fields.addField({ property: "boundary", label: "", inputType: "mapInput" }, "projectPitches", "one");
      // should overwrite the first field
      collector.fields.addField(
        { property: "proj_boundary", label: "", inputType: "mapInput" },
        "projectPitches",
        "two"
      );

      const pitch = await ProjectPitchFactory.create();
      await ProjectPolygonFactory.forPitch(pitch).create();
      await expectAnswers({ projectPitches: pitch }, { two: POLYGON });
    });
  });

  describe("fileCollector", () => {
    it("throws if a model is not a media owner", async () => {
      collector.files.addField({ collection: "media", label: "", inputType: "file" }, "financialReports", "one");
      await expect(getAnswers({ financialReports: await FinancialReportFactory.create() })).rejects.toThrow(
        "Entity is not a media owner: financialReports"
      );
    });

    it("throws if the configuration is not found", async () => {
      collector.files.addField({ collection: "dancingLlamas", label: "", inputType: "file" }, "sites", "one");
      await expect(getAnswers({ sites: await SiteFactory.create() })).rejects.toThrow(
        "Media configuration not found: [sites, dancingLlamas]"
      );
    });

    it("collects files", async () => {
      collector.files.addField({ collection: "media", label: "", inputType: "file" }, "sites", "one");
      // should overwrite the first field
      collector.files.addField({ collection: "media", label: "", inputType: "file" }, "sites", "two");
      collector.files.addField({ collection: "media", label: "", inputType: "file" }, "nurseries", "three");
      collector.files.addField({ collection: "file", label: "", inputType: "file" }, "nurseries", "four");
      collector.files.addField({ collection: "photos", label: "", inputType: "file" }, "sites", "five");
      collector.files.addField(
        { collection: "stratification_for_heterogeneity", label: "", inputType: "file" },
        "sites",
        "six"
      );

      mediaService.getUrl.mockReturnValue("");
      const createDto = (media: Media) => new EmbeddedMediaDto(media, { url: "", thumbUrl: "" });

      const site = await SiteFactory.create();
      const siteMedia = await Promise.all([
        MediaFactory.forSite(site).create({ collectionName: "media", orderColumn: 1 }),
        MediaFactory.forSite(site).create({ collectionName: "media", orderColumn: 2 })
      ]);
      // ignored by collect()
      await MediaFactory.forSite(site).create({ collectionName: "otherAdditionalDocuments" });
      // only the first file is collected
      const heterogeneity = await Promise.all([
        MediaFactory.forSite(site).create({ collectionName: "stratification_for_heterogeneity", orderColumn: 0 }),
        MediaFactory.forSite(site).create({ collectionName: "stratification_for_heterogeneity", orderColumn: 1 })
      ]);
      const nursery = await NurseryFactory.create();
      const nurseryMedia = await MediaFactory.forNursery(nursery).create({ collectionName: "media" });
      const nurseryFile = await MediaFactory.forNursery(nursery).create({ collectionName: "file" });
      // reload all the media so the DTOs match
      await Promise.all([...siteMedia, ...heterogeneity, nurseryMedia, nurseryFile].map(media => media.reload()));
      await expectAnswers(
        { sites: site, nurseries: nursery },
        {
          two: siteMedia.map(createDto),
          three: [createDto(nurseryMedia)],
          four: [createDto(nurseryFile)],
          five: undefined,
          six: createDto(heterogeneity[0])
        }
      );
    });
  });
});
