import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FormOptionList, FormOptionListOption, I18nItem } from "@terramatch-microservices/database/entities";
import { CreationAttributes } from "sequelize";

/**
 * One-off (REPL): seed `currencies` form_option_list + options, then backfill label_id on all
 * form_option_list_options. Run: > await oneOff.addOptionsListToNewField()
 */

type ListOption = { label: string; slug: string };

const normalizeSlug = (slug: string | null | undefined) => slug?.trim().toUpperCase() ?? null;

/** Matches getCurrencyOptions: title -> label, value -> slug (lowercase). */
const COLLECTIONS: Record<string, ListOption[]> = {
  currencies: [
    { label: "USD - US Dollar", slug: "USD" },
    { label: "EUR - Euro", slug: "EUR" },
    { label: "GBP - British Pound", slug: "GBP" },
    { label: "RWF Rwandan Franc", slug: "RWF" },
    { label: "KES - Kenyan Shilling", slug: "KES" },
    { label: "GHS - Ghanaian Cedi", slug: "GHS" },
    { label: "CDF - Congolese Fran", slug: "CDF" },
    { label: "BIF - Burundian Franc", slug: "BIF" },
    { label: "BRL - Brazilian Real", slug: "BRL" },
    { label: "INR - Indian Rupee", slug: "INR" },
    { label: "XOF - West African CFA Franc", slug: "XOF" },
    { label: "XAF - Central African CFA Franc", slug: "XAF" },
    { label: "SZL - Swazi Lilangeni", slug: "SZL" },
    { label: "ZAF - South African Rand", slug: "ZAF" },
    { label: "ETB - Ethiopian Birr", slug: "ETB" },
    { label: "GNF - Guinean Franc", slug: "GNF" },
    { label: "LSL - Lesotho Loti", slug: "LSL" },
    { label: "LRD - Liberian Dollar", slug: "LRD" },
    { label: "MGA - Malagasy Ariary", slug: "MGA" },
    { label: "MWK - Malawian Kwacha", slug: "MWK" },
    { label: "MZN - Mozambican Metical", slug: "MZN" },
    { label: "NAD - Namibian Dollar", slug: "NAD" },
    { label: "NGN - Nigerian Naira", slug: "NGN" },
    { label: "SLE - Sierra Leonean Leone", slug: "SLE" },
    { label: "SOS - Somali Shilling", slug: "SOS" },
    { label: "SDG - Sudanese Pound", slug: "SDG" },
    { label: "TZS - Tanzanian Shilling", slug: "TZS" },
    { label: "UGX - Ugandan Shilling", slug: "UGX" },
    { label: "ZMW - Zambian Kwacha", slug: "ZMW" },
    { label: "ZWL - Zimbabwean Dollar", slug: "ZWL" }
  ]
};

const generateMissingLabelI18nItem = async (option: FormOptionListOption) => {
  const value = option.label?.trim() ?? "";
  if (value === "" || option.labelId != null) return option.labelId;

  const isShort = value.length <= 256;
  const i18nItem = await I18nItem.create({
    type: isShort ? "short" : "long",
    status: "draft",
    shortValue: isShort ? value : null,
    longValue: isShort ? null : value
  } as CreationAttributes<I18nItem>);
  return i18nItem.id;
};

export const addOptionsListToNewField = withoutSqlLogs(async () => {
  let createdFormOptionLists = 0;
  let createdFormOptionListOptions = 0;
  let updatedLabelIds = 0;
  let normalizedSlugs = 0;
  const targetFormOptionListIds = new Set<number>();

  for (const [listKey, options] of Object.entries(COLLECTIONS)) {
    const [formOptionList, createdList] = await FormOptionList.findOrCreate({
      where: { key: listKey },
      defaults: { key: listKey } as CreationAttributes<FormOptionList>
    });
    targetFormOptionListIds.add(formOptionList.id);
    if (createdList) createdFormOptionLists++;

    for (const { label, slug } of options) {
      const normalizedSlug = normalizeSlug(slug);
      const [formOptionListOption, createdOption] = await FormOptionListOption.findOrCreate({
        where: {
          formOptionListId: formOptionList.id,
          label
        },
        defaults: {
          formOptionListId: formOptionList.id,
          label,
          slug: normalizedSlug
        } as CreationAttributes<FormOptionListOption>
      });
      if (createdOption) createdFormOptionListOptions++;
      if (!createdOption && formOptionListOption.slug !== normalizedSlug) {
        formOptionListOption.slug = normalizedSlug;
        await formOptionListOption.save();
        normalizedSlugs++;
      }
    }
  }

  const allListOptions = await FormOptionListOption.findAll({
    where: { formOptionListId: [...targetFormOptionListIds] },
    attributes: ["id", "label", "labelId", "slug"]
  });
  for (const option of allListOptions) {
    let shouldSave = false;
    const normalizedOptionSlug = normalizeSlug(option.slug);
    if (option.slug !== normalizedOptionSlug) {
      option.slug = normalizedOptionSlug;
      normalizedSlugs++;
      shouldSave = true;
    }

    const labelId = await generateMissingLabelI18nItem(option);
    if (labelId !== option.labelId) {
      option.labelId = labelId ?? null;
      updatedLabelIds++;
      shouldSave = true;
    }

    if (shouldSave) {
      await option.save();
    }
  }

  const summary = {
    createdFormOptionLists,
    createdFormOptionListOptions,
    updatedLabelIds,
    normalizedSlugs
  };
  console.log(`addOptionsListToNewField: ${JSON.stringify(summary)}`);
  return summary;
});
