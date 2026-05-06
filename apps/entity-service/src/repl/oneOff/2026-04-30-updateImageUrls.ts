import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { FormOptionListOption, FormQuestionOption } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { Dictionary } from "lodash";

const PATH_MAPPING: Dictionary<string> = {
  "land-tenures/public.png": "land-tenures/public-land.png",
  "land-tenures/private.png": "land-tenures/private-land.png",
  "land-tenures/indigenous.png": "land-tenures/indigenous-land.png",
  "land-tenures/indigenous-protected-area.png": "land-tenures/indigenous-land.png",
  "land-tenures/communal.png": "land-tenures/communal-land.png",
  "land-tenures/national-protected-area.png": "land-tenures/national-protected-area.png",
  "restoration-systems/peatland.png": "land-use-systems/peatland.png",
  "restoration-systems/riparian-area-or-wetland.png": "land-use-systems/riparian-area-or-wetland.png",
  "restoration-systems/woodlot-or-plantation.png": "land-use-systems/woodlot-or-plantation.png",
  "restoration-systems/agroforest.png": "land-use-systems/agroforest.png",
  "restoration-systems/grassland.png": "land-use-systems/grassland.png",
  "restoration-systems/natural-forest.png": "land-use-systems/natural-forest.png",
  "restoration-systems/mangrove.png": "land-use-systems/mangrove.png",
  "restoration-systems/silvopasture.png": "land-use-systems/silvopasture.png",
  "restoration-systems/urban-forest.png": "land-use-systems/urban-forest.png",
  "restoration-practices/tree-planting.png": "restoration-strategies/tree-planting.png",
  "restoration-practices/assisted-natural-regeneration.png": "restoration-strategies/assisted-natural-regeneration.png",
  "restoration-practices/direct-seeding.png": "restoration-strategies/direct-seeding.png"
};

const REMOVE_IMAGE: string[] = [
  "land-tenures-brazil/indigenous-land.png",
  "land-tenures-brazil/extractive-reserve-resex.png",
  "land-tenures-brazil/sustainable-development-reserve-rds.png",
  "land-tenures-brazil/national-forest-flona.png",
  "land-tenures-brazil/environmental-protection-area-apa.png",
  "land-tenures-brazil/rural-settlements-pae-paex-or-pds.png",
  "land-tenures-brazil/quilombola-land.png",
  "land-tenures-brazil/public-land.png",
  "land-tenures-brazil/private-land.png",
  "anr-practices/fire-protection-and-fighting.png",
  "anr-practices/livestock-management.png",
  "anr-practices/isolating-the-area.png",
  "anr-practices/control-of-invasive-andor-exotic-species.png",
  "anr-practices/maintenance-of-regenerating-individuals.png",
  "anr-practices/ant-control.png",
  "siting-strategies/concentrated.png",
  "siting-strategies/distributed.png",
  "siting-strategies/hybrid.png",
  "project-barriers/financial-or-economic-barriers.png",
  "project-barriers/harmful-cultural-norms.png",
  "project-barriers/inequities-in-land-and-tenure-rights.png"
];

export const updateImageUrls = withoutSqlLogs(async () => {
  await normalizePaths(
    "FromQuestionOption",
    new PaginatedQueryBuilder(FormQuestionOption, 10).where({ imageUrl: { [Op.not]: null } })
  );
  await normalizePaths(
    "FormOptionListOption",
    new PaginatedQueryBuilder(FormOptionListOption, 10).where({ imageUrl: { [Op.not]: null } })
  );

  console.log("\nRemoving unused image paths...");
  const removeImagePaths = REMOVE_IMAGE.map(path => `/images/options/${path}`);
  await FormQuestionOption.update({ imageUrl: null }, { where: { imageUrl: removeImagePaths } });
  await FormOptionListOption.update({ imageUrl: null }, { where: { imageUrl: removeImagePaths } });

  console.log("\nUpdating image paths...");
  for (const [from, to] of Object.entries(PATH_MAPPING)) {
    console.log(`Updating image paths ${from} -> ${to}`);
    await FormQuestionOption.update(
      { imageUrl: `/images/options/${to}` },
      { where: { imageUrl: `/images/options/${from}` } }
    );
    await FormOptionListOption.update(
      { imageUrl: `/images/options/${to}` },
      { where: { imageUrl: `/images/options/${from}` } }
    );
  }
});

const normalizePaths = async (
  type: string,
  builder: PaginatedQueryBuilder<FormQuestionOption | FormOptionListOption>
) => {
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Updating ${total} ${type} imageUrls [:bar] :percent :etas`, { total, width: 40 });
  for await (const page of batchFindAll(builder)) {
    for (const option of page) {
      option.imageUrl = option.imageUrl?.replace(/.*images\/V2\//, "/images/options/") ?? null;
      await option.save();
      bar.tick();
    }
  }
};
