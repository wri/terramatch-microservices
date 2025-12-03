import { CollectorTestHarness } from "./linked-answer-collector.spec";
import {
  FinancialReportFactory,
  MediaFactory,
  NurseryFactory,
  SiteFactory
} from "@terramatch-microservices/database/factories";
import { Media } from "@terramatch-microservices/database/entities";
import { EmbeddedMediaDto } from "../../dto/media.dto";
import { LinkedFile } from "@terramatch-microservices/database/constants/linked-fields";
import { ResourceCollector } from "./index";

describe("FileCollector", () => {
  let harness: CollectorTestHarness;
  let collector: ResourceCollector<LinkedFile>;

  beforeEach(() => {
    harness = new CollectorTestHarness();
    collector = harness.collector.files;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws if a model is not a media owner", async () => {
    collector.addField({ collection: "media", label: "", inputType: "file" }, "financialReports", "one");
    await expect(harness.getAnswers({ financialReports: await FinancialReportFactory.create() })).rejects.toThrow(
      "Entity is not a media owner: financialReports"
    );
  });

  it("throws if the configuration is not found", async () => {
    collector.addField({ collection: "dancingLlamas", label: "", inputType: "file" }, "sites", "one");
    await expect(harness.getAnswers({ sites: await SiteFactory.create() })).rejects.toThrow(
      "Media configuration not found: [sites, dancingLlamas]"
    );
  });

  it("collects files", async () => {
    collector.addField({ collection: "media", label: "", inputType: "file" }, "sites", "one");
    // should overwrite the first field
    collector.addField({ collection: "media", label: "", inputType: "file" }, "sites", "two");
    collector.addField({ collection: "media", label: "", inputType: "file" }, "nurseries", "three");
    collector.addField({ collection: "file", label: "", inputType: "file" }, "nurseries", "four");
    collector.addField({ collection: "photos", label: "", inputType: "file" }, "sites", "five");
    collector.addField(
      { collection: "stratification_for_heterogeneity", label: "", inputType: "file" },
      "sites",
      "six"
    );

    harness.mediaService.getUrl.mockReturnValue("");
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
    await harness.expectAnswers(
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
