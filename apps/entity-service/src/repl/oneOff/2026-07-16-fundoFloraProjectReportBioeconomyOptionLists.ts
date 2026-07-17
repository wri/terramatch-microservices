import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FormOptionList, FormOptionListOption } from "@terramatch-microservices/database/entities";
import { CreationAttributes } from "sequelize";

/**
 * One-off (REPL): seed FormOptionLists referenced by Fundo Flora project report linked fields.
 * Form sections/questions are added via the admin form editor after this runs.
 *
 * Run: > await oneOff.fundoFloraProjectReportBioeconomyOptionLists(localizationService)
 */

type OptionRow = { slug: string; label: string };

const OPTION_LISTS: Record<string, OptionRow[]> = {
  "bioeconomy-product-list": [
    { slug: "acai", label: "Açaí" },
    { slug: "andiroba", label: "Andiroba" },
    { slug: "cacau", label: "Cacau" },
    { slug: "castanha-do-para", label: "Castanha-do-Pará" },
    { slug: "copaiba", label: "Copaíba" },
    { slug: "cupuacu", label: "Cupuaçu" },
    { slug: "bacuri", label: "Bacuri" },
    { slug: "babacu", label: "Babaçu" },
    { slug: "borracha-de-seringueira", label: "Borracha de seringueira" },
    { slug: "buriti", label: "Buriti" },
    { slug: "urucum", label: "Urucum" },
    { slug: "guarana", label: "Guaraná" },
    { slug: "pupunha", label: "Pupunha" },
    { slug: "umbu", label: "Umbu" },
    { slug: "tucum", label: "Tucum" },
    { slug: "tucuma", label: "Tucumã" },
    { slug: "bacaba", label: "Bacaba" },
    { slug: "murumuru", label: "Murumuru" },
    { slug: "camu-camu", label: "Camu-camu" },
    { slug: "palmito", label: "Palmito" },
    { slug: "dende", label: "Dendê" },
    { slug: "mel-de-abelha-nativa", label: "Mel de abelha nativa" },
    { slug: "extracao-de-latex-de-seringueira", label: "Extração de látex de seringueira" },
    { slug: "carnauba", label: "Carnaúba" },
    { slug: "cumaru", label: "Cumaru" },
    { slug: "murici", label: "Murici" },
    { slug: "licuri", label: "Licuri" },
    { slug: "jambu", label: "Jambu" },
    { slug: "ucuuba", label: "Ucuúba" },
    { slug: "macauba", label: "Macaúba" },
    { slug: "butia", label: "Butiá" },
    { slug: "biriba", label: "Biribá" },
    { slug: "tabereba", label: "Taberebá" },
    { slug: "piquia", label: "Piquiá" },
    { slug: "uxi", label: "Uxi" },
    { slug: "inga", label: "Ingá" },
    { slug: "cajarana", label: "Cajarana" },
    { slug: "pirarucu", label: "Pirarucu" },
    { slug: "pacu", label: "Pacu" },
    { slug: "tambaqui", label: "Tambaqui" },
    { slug: "tambacu", label: "Tambacu" },
    { slug: "tucunare", label: "Tucunaré" },
    { slug: "tambatinga", label: "Tambatinga" },
    { slug: "paxinga", label: "Paxinga" },
    { slug: "matrinxa", label: "Matrinxã" },
    { slug: "curimata", label: "Curimatã" },
    { slug: "nao-se-aplica", label: "Não se aplica" }
  ],
  "bioeconomy-quality-certifications": [
    { slug: "certificacao-de-produto-organico", label: "Certificação de produto orgânico" },
    { slug: "forest-stewardship-council-fsc", label: "Forest Stewardship Council (FSC)" },
    { slug: "comercio-justo", label: "Comércio Justo" },
    { slug: "selo-origens-brasil", label: "Selo Origens Brasil" },
    { slug: "nao-tenho-certificacao", label: "Não tenho certificação" }
  ],
  "bioeconomy-buyers": [
    { slug: "paa", label: "PAA" },
    { slug: "pnae", label: "PNAE" },
    { slug: "cooperativas", label: "Cooperativas" },
    { slug: "super-mercados", label: "Super mercados" },
    { slug: "feiras", label: "Feiras" },
    { slug: "atravesadores", label: "Atravesadores" },
    { slug: "empresas", label: "Empresas" },
    { slug: "venda-direta", label: "Venda direta" },
    { slug: "nao-se-aplica", label: "Não se aplica" }
  ]
};

export const fundoFloraProjectReportBioeconomyOptionLists = withoutSqlLogs(
  async (localizationService: LocalizationService) => {
    let createdFormOptionLists = 0;
    let createdFormOptionListOptions = 0;

    for (const [listKey, options] of Object.entries(OPTION_LISTS)) {
      const [formOptionList, createdList] = await FormOptionList.findOrCreate({
        where: { key: listKey },
        defaults: { key: listKey } as CreationAttributes<FormOptionList>
      });
      if (createdList) createdFormOptionLists++;

      const existing = await FormOptionListOption.findAll({ where: { formOptionListId: formOptionList.id } });
      const existingSlugs = new Set(existing.map(({ slug }) => slug).filter((slug): slug is string => slug != null));

      for (const { slug, label } of options) {
        if (existingSlugs.has(slug)) continue;

        const row = new FormOptionListOption();
        row.formOptionListId = formOptionList.id;
        row.slug = slug;
        row.label = label;
        row.labelId = await localizationService.generateI18nId(label, null);
        row.imageUrl = null;
        row.altValue = null;
        await row.save();
        existingSlugs.add(slug);
        createdFormOptionListOptions++;
      }
    }

    const summary = { createdFormOptionLists, createdFormOptionListOptions };
    console.log("fundoFloraProjectReportBioeconomyOptionLists:", JSON.stringify(summary));
    return summary;
  }
);
