import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FUNDO_FLORA, FUNDO_FLORA_1 } from "@terramatch-microservices/database/constants";
import { InputType } from "@terramatch-microservices/database/constants/linked-fields";
import {
  Form,
  FormQuestion,
  FormQuestionOption,
  FormSection,
  ProjectReport
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";

/**
 * One-off (REPL): seed Fundo Flora project report bioeconomy questions + select options.
 * Run: > await oneOff.fundoFloraProjectReportBioeconomyQuestions(localizationService)
 */

type OptionRow = { slug: string; label: string };

type QuestionSeed = {
  linkedFieldKey: string;
  label: string;
  inputType: InputType;
  options?: OptionRow[];
};

const BIOECONOMY_PRODUCT_OPTIONS: OptionRow[] = [
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
];

const BIOECONOMY_QUALITY_CERTIFICATION_OPTIONS: OptionRow[] = [
  { slug: "certificacao-de-produto-organico", label: "Certificação de produto orgânico" },
  { slug: "forest-stewardship-council-fsc", label: "Forest Stewardship Council (FSC)" },
  { slug: "comercio-justo", label: "Comércio Justo" },
  { slug: "selo-origens-brasil", label: "Selo Origens Brasil" },
  { slug: "nao-tenho-certificacao", label: "Não tenho certificação" }
];

const BIOECONOMY_BUYERS_OPTIONS: OptionRow[] = [
  { slug: "paa", label: "PAA" },
  { slug: "pnae", label: "PNAE" },
  { slug: "cooperativas", label: "Cooperativas" },
  { slug: "super-mercados", label: "Super mercados" },
  { slug: "feiras", label: "Feiras" },
  { slug: "atravesadores", label: "Atravesadores" },
  { slug: "empresas", label: "Empresas" },
  { slug: "venda-direta", label: "Venda direta" },
  { slug: "nao-se-aplica", label: "Não se aplica" }
];

const QUESTION_SEEDS: QuestionSeed[] = [
  {
    linkedFieldKey: "pro-rep-bioeconomy-product-list",
    label: "Bioeconomy product list (Project Report)",
    inputType: "select",
    options: BIOECONOMY_PRODUCT_OPTIONS
  },
  {
    linkedFieldKey: "pro-rep-bioeconomy-product-benefit",
    label: "Bioeconomy product benefit (Project Report)",
    inputType: "select",
    options: BIOECONOMY_PRODUCT_OPTIONS
  },
  {
    linkedFieldKey: "pro-rep-bioeconomy-product-sold",
    label: "Bioeconomy product sold (Project Report)",
    inputType: "select",
    options: BIOECONOMY_PRODUCT_OPTIONS
  },
  {
    linkedFieldKey: "pro-rep-bioeconomy-quality-certifications",
    label: "Bioeconomy quality certifications (Project Report)",
    inputType: "select",
    options: BIOECONOMY_QUALITY_CERTIFICATION_OPTIONS
  },
  {
    linkedFieldKey: "pro-rep-bioeconomy-other-certifications",
    label: "Bioeconomy other certifications (Project Report)",
    inputType: "text"
  },
  {
    linkedFieldKey: "pro-rep-bioeconomy-buyers",
    label: "Bioeconomy buyers (Project Report)",
    inputType: "select",
    options: BIOECONOMY_BUYERS_OPTIONS
  },
  {
    linkedFieldKey: "pro-rep-women-governance",
    label: "Women in Governance or Leadership",
    inputType: "text"
  }
];

const SECTION_TITLE = "Bioeconomy";

async function findOrCreateSection(form: Form): Promise<FormSection> {
  const sections = await FormSection.findAll({
    where: { formId: form.uuid },
    order: [["order", "ASC"]]
  });

  const existing = sections.find(({ title }) => title === SECTION_TITLE);
  if (existing != null) return existing;

  const maxOrder = sections.reduce((max, section) => Math.max(max, section.order), -1);
  return FormSection.create({
    formId: form.uuid,
    order: maxOrder + 1,
    title: SECTION_TITLE
  } as FormSection);
}

async function seedQuestionOptions(
  localizationService: LocalizationService,
  question: FormQuestion,
  options: OptionRow[]
): Promise<number> {
  const existing = await FormQuestionOption.findAll({ where: { formQuestionId: question.id } });
  const existingSlugs = new Set(existing.map(({ slug }) => slug).filter((slug): slug is string => slug != null));
  let maxOrder = existing.reduce((max, option) => Math.max(max, option.order), -1);
  let created = 0;

  for (const option of options) {
    if (existingSlugs.has(option.slug)) continue;

    maxOrder += 1;
    const row = new FormQuestionOption();
    row.formQuestionId = question.id;
    row.order = maxOrder;
    row.slug = option.slug;
    row.label = option.label;
    row.labelId = await localizationService.generateI18nId(option.label, null);
    row.imageUrl = null;
    row.formOptionListOptionId = null;
    await row.save();
    existingSlugs.add(option.slug);
    created += 1;
  }

  return created;
}

async function ensureQuestion(
  localizationService: LocalizationService,
  section: FormSection,
  seed: QuestionSeed,
  order: number
): Promise<{ created: boolean; optionsCreated: number }> {
  const existingQuestions = await FormQuestion.findAll({
    where: {
      formSectionId: section.id,
      linkedFieldKey: seed.linkedFieldKey
    }
  });

  let question = existingQuestions[0];
  let created = false;

  if (question == null) {
    question = new FormQuestion();
    question.formSectionId = section.id;
    question.order = order;
    question.linkedFieldKey = seed.linkedFieldKey;
    question.inputType = seed.inputType;
    question.label = seed.label;
    question.labelId = await localizationService.generateI18nId(seed.label, null);
    question.multiChoice = false;
    question.optionsList = null;
    await question.save();
    created = true;
  }

  const optionsCreated =
    seed.options == null ? 0 : await seedQuestionOptions(localizationService, question, seed.options);

  return { created, optionsCreated };
}

export const fundoFloraProjectReportBioeconomyQuestions = withoutSqlLogs(
  async (localizationService: LocalizationService) => {
    const forms = await Form.findAll({
      where: {
        type: "project-report",
        frameworkKey: { [Op.in]: [FUNDO_FLORA, FUNDO_FLORA_1] },
        model: ProjectReport.LARAVEL_TYPE
      }
    });

    if (forms.length === 0) {
      throw new Error("No Fundo Flora project report forms found");
    }

    let sectionsProcessed = 0;
    let questionsCreated = 0;
    let optionsCreated = 0;

    for (const form of forms) {
      const section = await findOrCreateSection(form);
      sectionsProcessed += 1;

      const existingCount = await FormQuestion.count({ where: { formSectionId: section.id } });
      let nextOrder = existingCount;

      for (const seed of QUESTION_SEEDS) {
        const result = await ensureQuestion(localizationService, section, seed, nextOrder);
        if (result.created) {
          questionsCreated += 1;
          nextOrder += 1;
        }
        optionsCreated += result.optionsCreated;
      }
    }

    const summary = {
      formsProcessed: forms.length,
      sectionsProcessed,
      questionsCreated,
      optionsCreated
    };
    console.log("fundoFloraProjectReportBioeconomyQuestions:", JSON.stringify(summary));
    return summary;
  }
);
