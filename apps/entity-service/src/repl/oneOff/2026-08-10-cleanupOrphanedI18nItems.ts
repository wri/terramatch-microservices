import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { I18nItem, I18nTranslation, LocalizationKey } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

/**
 * Deletes i18n_items (and their i18n_translations) that are no longer referenced.
 * After form/about/link/funding-programme *_id columns were removed, only
 * localization_keys.value_id still references i18n_items.
 *
 * Run: > await oneOff.cleanupOrphanedI18nItems()
 * Dry: > await oneOff.cleanupOrphanedI18nItems({ dryRun: true })
 */

type CleanupOptions = {
  dryRun?: boolean;
};

const collectReferencedI18nIds = async () => {
  const ids = new Set<number>();
  const keys = await LocalizationKey.findAll({ attributes: ["valueId"] });
  for (const { valueId } of keys) {
    if (valueId != null) ids.add(valueId);
  }
  return [...ids];
};

export const cleanupOrphanedI18nItems = withoutSqlLogs(async (opts: CleanupOptions = {}) => {
  const { dryRun = false } = opts;
  const keepIds = await collectReferencedI18nIds();

  if (keepIds.length === 0) {
    throw new Error("Refusing to delete: no referenced i18n item IDs found. Aborting to avoid wiping all rows.");
  }

  const orphanWhere = { id: { [Op.notIn]: keepIds } };
  const orphanTranslationWhere = { i18nItemId: { [Op.notIn]: keepIds } };

  const [itemsTotal, translationsTotal, orphanItems, orphanTranslations] = await Promise.all([
    I18nItem.count(),
    I18nTranslation.count(),
    I18nItem.count({ where: orphanWhere }),
    I18nTranslation.count({ where: orphanTranslationWhere })
  ]);

  let itemsDeleted = 0;
  let translationsDeleted = 0;

  if (!dryRun) {
    translationsDeleted = await I18nTranslation.destroy({ where: orphanTranslationWhere });
    itemsDeleted = await I18nItem.destroy({ where: orphanWhere });
  }

  const summary = {
    dryRun,
    keepIds: keepIds.length,
    itemsTotal,
    translationsTotal,
    orphanItems,
    orphanTranslations,
    itemsDeleted: dryRun ? 0 : itemsDeleted,
    translationsDeleted: dryRun ? 0 : translationsDeleted
  };

  console.log("cleanupOrphanedI18nItems:", JSON.stringify(summary));
  return summary;
});
