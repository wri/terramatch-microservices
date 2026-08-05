// import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { AboutSection, I18nItem, Link } from "@terramatch-microservices/database/entities";
import { Model } from "sequelize-typescript";

/**
 * One-off (REPL): backfill new text columns on about_sections and links from their
 * corresponding i18n_items (*_id → shortValue ?? longValue ?? "").
 *
 * Run: > await oneOff.backfillAboutSectionAndLinkText()
 */

type IdTextPair<T> = {
  idKey: keyof T & string;
  textKey: keyof T & string;
};

const ABOUT_SECTION_FIELDS: IdTextPair<AboutSection>[] = [
  { idKey: "headerId", textKey: "header" },
  { idKey: "titleId", textKey: "title" },
  { idKey: "descriptionId", textKey: "description" },
  { idKey: "contactSupportMessageId", textKey: "contactSupportMessage" },
  { idKey: "contactSupportSubjectId", textKey: "contactSupportSubject" }
];

const LINK_FIELDS: IdTextPair<Link>[] = [{ idKey: "titleId", textKey: "title" }];

const i18nValue = (item: I18nItem | undefined) => item?.shortValue ?? item?.longValue ?? "";

const collectI18nIds = <T extends Model>(rows: T[], fields: IdTextPair<T>[]) => {
  const ids = new Set<number>();
  for (const row of rows) {
    for (const { idKey } of fields) {
      const id = row.get(idKey) as number | null | undefined;
      if (id != null) ids.add(id);
    }
  }
  return [...ids];
};

const loadI18nMap = async (ids: number[]) => {
  const map = new Map<number, I18nItem>();
  if (ids.length === 0) return map;

  const items = await I18nItem.findAll({ where: { id: ids } });
  for (const item of items) {
    map.set(item.id, item);
  }
  return map;
};

const backfillRows = async <T extends Model>(rows: T[], fields: IdTextPair<T>[], i18nMap: Map<number, I18nItem>) => {
  let updated = 0;
  for (const row of rows) {
    let changed = false;
    for (const { idKey, textKey } of fields) {
      const id = row.get(idKey) as number | null | undefined;
      if (id == null) continue;

      const value = i18nValue(i18nMap.get(id));
      if (row.get(textKey) !== value) {
        row.set(textKey, value);
        changed = true;
      }
    }
    if (changed) {
      await row.save();
      updated += 1;
    }
  }
  return updated;
};

export const backfillAboutSectionAndLinkText = async () => {
  const aboutSections = await AboutSection.findAll();
  const links = await Link.findAll();

  const i18nIds = [...collectI18nIds(aboutSections, ABOUT_SECTION_FIELDS), ...collectI18nIds(links, LINK_FIELDS)];
  const i18nMap = await loadI18nMap([...new Set(i18nIds)]);
  console.log("i18nMap:", i18nMap);

  const aboutSectionsUpdated = await backfillRows(aboutSections, ABOUT_SECTION_FIELDS, i18nMap);
  const linksUpdated = await backfillRows(links, LINK_FIELDS, i18nMap);

  const summary = {
    aboutSectionsProcessed: aboutSections.length,
    aboutSectionsUpdated,
    linksProcessed: links.length,
    linksUpdated,
    i18nItemsLoaded: i18nMap.size
  };
  console.log("backfillAboutSectionAndLinkText:", JSON.stringify(summary));
  return summary;
};
