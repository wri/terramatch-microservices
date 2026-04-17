import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FormOptionList, FormOptionListOption, I18nItem } from "@terramatch-microservices/database/entities";
import { CreationAttributes } from "sequelize";

/**
 * One-off (REPL): seed `currencies` form_option_list + options, then backfill label_id on all
 * form_option_list_options. Run: > await oneOff.addOptionsListToNewField()
 */

type ListOption = { label: string; slug: string };

/** Matches getCurrencyOptions: title -> label, value -> slug (lowercase). */
const COLLECTIONS: Record<string, ListOption[]> = {
  currencies: [
    { label: "USD - US Dollar", slug: "usd" },
    { label: "EUR - Euro", slug: "eur" },
    { label: "GBP - British Pound", slug: "gbp" },
    { label: "RWF Rwandan Franc", slug: "rwf" },
    { label: "KES - Kenyan Shilling", slug: "kes" },
    { label: "GHS - Ghanaian Cedi", slug: "ghs" },
    { label: "CDF - Congolese Fran", slug: "cdf" },
    { label: "BIF - Burundian Franc", slug: "bif" },
    { label: "BRL - Brazilian Real", slug: "brl" },
    { label: "INR - Indian Rupee", slug: "inr" },
    { label: "XOF - West African CFA Franc", slug: "xof" },
    { label: "XAF - Central African CFA Franc", slug: "xaf" },
    { label: "SZL - Swazi Lilangeni", slug: "szl" },
    { label: "ZAF - South African Rand", slug: "zaf" },
    { label: "ETB - Ethiopian Birr", slug: "etb" },
    { label: "GNF - Guinean Franc", slug: "gnf" },
    { label: "LSL - Lesotho Loti", slug: "lsl" },
    { label: "LRD - Liberian Dollar", slug: "lrd" },
    { label: "MGA - Malagasy Ariary", slug: "mga" },
    { label: "MWK - Malawian Kwacha", slug: "mwk" },
    { label: "MZN - Mozambican Metical", slug: "mzn" },
    { label: "NAD - Namibian Dollar", slug: "nad" },
    { label: "NGN - Nigerian Naira", slug: "ngn" },
    { label: "SLE - Sierra Leonean Leone", slug: "sle" },
    { label: "SOS - Somali Shilling", slug: "sos" },
    { label: "SDG - Sudanese Pound", slug: "sdg" },
    { label: "TZS - Tanzanian Shilling", slug: "tzs" },
    { label: "UGX - Ugandan Shilling", slug: "ugx" },
    { label: "ZMW - Zambian Kwacha", slug: "zmw" },
    { label: "ZWL - Zimbabwean Dollar", slug: "zwl" }
  ],
  "months-by-number": [
    { label: "January", slug: "1" },
    { label: "February", slug: "2" },
    { label: "March", slug: "3" },
    { label: "April", slug: "4" },
    { label: "May", slug: "5" },
    { label: "June", slug: "6" },
    { label: "July", slug: "7" },
    { label: "August", slug: "8" },
    { label: "September", slug: "9" },
    { label: "October", slug: "10" },
    { label: "November", slug: "11" },
    { label: "December", slug: "12" }
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

  for (const [listKey, options] of Object.entries(COLLECTIONS)) {
    const [formOptionList, createdList] = await FormOptionList.findOrCreate({
      where: { key: listKey },
      defaults: { key: listKey } as CreationAttributes<FormOptionList>
    });
    if (createdList) createdFormOptionLists++;

    for (const { label, slug } of options) {
      const [, createdOption] = await FormOptionListOption.findOrCreate({
        where: {
          formOptionListId: formOptionList.id,
          label,
          slug
        }
      });
      if (createdOption) createdFormOptionListOptions++;
    }
  }

  const allListOptions = await FormOptionListOption.findAll({ attributes: ["id", "label", "labelId"] });
  for (const option of allListOptions) {
    const labelId = await generateMissingLabelI18nItem(option);
    if (labelId !== option.labelId) {
      option.labelId = labelId ?? null;
      await option.save();
      updatedLabelIds++;
    }
  }

  const summary = {
    createdFormOptionLists,
    createdFormOptionListOptions,
    updatedLabelIds
  };
  console.log(`addOptionsListToNewField: ${JSON.stringify(summary)}`);
  return summary;
});
