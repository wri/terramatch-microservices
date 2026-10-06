import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FormOptionList, FormOptionListOption } from "@terramatch-microservices/database/entities";

const LIST_KEY = "gli-components";

const GLI_COMPONENTS = [
  { slug: "restoration-of-degraded-landscapes", label: "Restoration of Degraded Landscapes" },
  {
    slug: "conservation-and-sustainable-management-of-natural-forest",
    label: "Conservation and Sustainable Management of Natural Forest"
  },
  {
    slug: "management-of-plantation-forests-value-addition-and-import-substitution",
    label: "Management of Plantation Forests, Value Addition, and Import Substitution"
  },
  {
    slug: "innovation-technology-generation-adoption-and-dissemination",
    label: "Innovation, Technology Generation, Adoption and Dissemination"
  },
  {
    slug: "capacity-development-and-institutional-strengthening",
    label: "Capacity Development and Institutional Strengthening"
  },
  { slug: "knowledge-management-and-monitoring-system", label: "Knowledge Management and Monitoring System" }
] as const;

/**
 * Creates the option list backing the GLI Components linked fields on project pitches and projects.
 *
 * Run in entity-service REPL:
 *   await oneOff.createGliComponentsOptionList()
 *   await oneOff.createGliComponentsOptionList({ dryRun: false })
 *
 * Safe to re-run: only missing options are created.
 */
export const createGliComponentsOptionList = withoutSqlLogs(async (options?: { dryRun?: boolean }) => {
  const dryRun = options?.dryRun !== false;

  const list = await FormOptionList.findOne({ where: { key: LIST_KEY }, attributes: ["id"] });
  const existingSlugs =
    list == null
      ? new Set<string | null>()
      : new Set(
          (await FormOptionListOption.findAll({ where: { formOptionListId: list.id }, attributes: ["slug"] })).map(
            ({ slug }) => slug
          )
        );
  const missing = GLI_COMPONENTS.filter(({ slug }) => !existingSlugs.has(slug));

  if (!dryRun && missing.length > 0) {
    // These entities use the legacy Model<T> typing, which requires every attribute on create.
    const listId = list?.id ?? (await FormOptionList.create({ key: LIST_KEY } as FormOptionList)).id;
    await FormOptionListOption.bulkCreate(
      missing.map(({ slug, label }) => ({ formOptionListId: listId, slug, label }) as FormOptionListOption)
    );
  }

  return { dryRun, listCreated: list == null, optionsCreated: missing.map(({ slug }) => slug) };
});
