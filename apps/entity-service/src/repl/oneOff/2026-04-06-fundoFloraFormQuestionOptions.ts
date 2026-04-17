import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import {
  FormOptionList,
  FormOptionListOption,
  FormQuestion,
  FormQuestionOption,
  Media
} from "@terramatch-microservices/database/entities";

/**
 * Keys match ProjectConfiguration / SiteConfiguration / ProjectPitchConfiguration (linkedFields).
 * Option slug/label rows are DB seed data for form_question_options, not linked-field schema — keep them here with the one-off.
 */
const LAND_TENURE_PITCH_SOURCE_KEY = "pro-pit-land-tenure-proj-area";
const LAND_TENURE_PROJECT_KEY = "pro-land-tenure-proj-area";
const LAND_TENURE_SITE_KEY = "site-land-tenures";
const LANDOWNER_AGREEMENT_KEY = "pro-landowner-agreement";
const LANDOWNER_COLLECTION_LIST_KEY = "landowner-collection";

const LANDOWNER_AGREEMENT_OPTION_ROWS: { slug: string; label: string }[] = [
  {
    slug: "yes-the-organization-has-a-document-that-proves-authorization",
    label: "Yes, the organization has a document that proves authorization"
  },
  {
    slug: "yes-the-organization-has-a-verbal-agreement",
    label: "Yes, the organization has a verbal agreement"
  },
  {
    slug: "no-the-organization-has-not-yet-secured-a-prior-agreement-andor-a-document-proving-authorization",
    label: "No, the organization has not yet secured a prior agreement and/or a document proving authorization"
  },
  {
    slug: "not-applicable-the-organization-is-the-legal-occupant-of-the-land",
    label: "Not applicable – the organization is the legal occupant of the land"
  },
  {
    slug: "not-applicable-i-represent-an-organizationassociationcommunity-that-is-the-legal-occupant-or-landowner",
    label: "Not applicable – I represent an organization/association/community that is the legal occupant or landowner"
  }
];

async function pickSourceLandTenureOptions(): Promise<FormQuestionOption[]> {
  const sourceQuestions = await FormQuestion.findAll({
    where: { linkedFieldKey: LAND_TENURE_PITCH_SOURCE_KEY }
  });
  if (sourceQuestions.length === 0) {
    throw new Error(`No form_questions found with linked_field_key=${LAND_TENURE_PITCH_SOURCE_KEY}`);
  }

  let best: FormQuestionOption[] = [];
  for (const q of sourceQuestions) {
    const opts = await FormQuestionOption.findAll({
      where: { formQuestionId: q.id },
      order: [["order", "ASC"]]
    });
    if (opts.length > best.length) best = opts;
  }

  if (best.length === 0) {
    throw new Error(`No form_question_options found for ${LAND_TENURE_PITCH_SOURCE_KEY} questions`);
  }

  return best;
}

async function replicateLandTenureOptions(
  mediaService: MediaService,
  sourceOptions: FormQuestionOption[],
  targetLinkedFieldKey: string
): Promise<{ questionsProcessed: number; optionsCreated: number }> {
  const targets = await FormQuestion.findAll({ where: { linkedFieldKey: targetLinkedFieldKey } });
  let optionsCreated = 0;

  for (const question of targets) {
    const existing = await FormQuestionOption.findAll({ where: { formQuestionId: question.id } });
    const existingSlugs = new Set(existing.map(o => o.slug).filter((s): s is string => s != null));
    let maxOrder = existing.reduce((m, o) => Math.max(m, o.order), -1);

    for (const src of sourceOptions) {
      if (src.slug == null || existingSlugs.has(src.slug)) continue;

      maxOrder += 1;
      const row = new FormQuestionOption();
      row.formQuestionId = question.id;
      row.order = maxOrder;
      row.slug = src.slug;
      row.label = src.label;
      row.labelId = src.labelId;
      row.imageUrl = src.imageUrl;
      row.formOptionListOptionId = null;
      await row.save();
      existingSlugs.add(src.slug);
      optionsCreated += 1;

      const sourceMedia = await Media.findAll({
        where: { modelType: FormQuestionOption.LARAVEL_TYPE, modelId: src.id }
      });
      for (const m of sourceMedia) {
        await mediaService.duplicateMedia(m, row);
      }
    }
  }

  return { questionsProcessed: targets.length, optionsCreated };
}

async function appendLandownerAgreementOptions(
  localizationService: LocalizationService
): Promise<{ questionsProcessed: number; optionsCreated: number }> {
  const targets = await FormQuestion.findAll({
    where: { linkedFieldKey: LANDOWNER_AGREEMENT_KEY }
  });
  let optionsCreated = 0;

  for (const question of targets) {
    const existing = await FormQuestionOption.findAll({ where: { formQuestionId: question.id } });
    const existingSlugs = new Set(existing.map(o => o.slug).filter((s): s is string => s != null));
    const maxOrder = existing.reduce((m, o) => Math.max(m, o.order), -1);
    let nextOrder = maxOrder + 1;

    for (const def of LANDOWNER_AGREEMENT_OPTION_ROWS) {
      if (existingSlugs.has(def.slug)) continue;

      const row = new FormQuestionOption();
      row.formQuestionId = question.id;
      row.order = nextOrder;
      nextOrder += 1;
      row.slug = def.slug;
      row.label = def.label;
      row.labelId = await localizationService.generateI18nId(def.label, null);
      row.imageUrl = null;
      row.formOptionListOptionId = null;
      await row.save();
      existingSlugs.add(def.slug);
      optionsCreated += 1;
    }
  }

  return { questionsProcessed: targets.length, optionsCreated };
}

async function appendLandownerAgreementOptionList(
  localizationService: LocalizationService
): Promise<{ listCreated: boolean; optionsCreated: number }> {
  let optionList = await FormOptionList.findOne({ where: { key: LANDOWNER_COLLECTION_LIST_KEY } });
  const listCreated = optionList == null;
  if (optionList == null) {
    optionList = new FormOptionList();
    optionList.key = LANDOWNER_COLLECTION_LIST_KEY;
    await optionList.save();
  }

  const existing = await FormOptionListOption.findAll({ where: { formOptionListId: optionList.id } });
  const existingSlugs = new Set(existing.map(o => o.slug).filter((s): s is string => s != null));
  let optionsCreated = 0;

  for (const def of LANDOWNER_AGREEMENT_OPTION_ROWS) {
    if (existingSlugs.has(def.slug)) continue;

    const row = new FormOptionListOption();
    row.formOptionListId = optionList.id;
    row.slug = def.slug;
    row.label = def.label;
    row.labelId = await localizationService.generateI18nId(def.label, null);
    row.imageUrl = null;
    row.altValue = null;
    await row.save();
    existingSlugs.add(def.slug);
    optionsCreated += 1;
  }

  return { listCreated, optionsCreated };
}

export const fundoFloraFormQuestionOptions = withoutSqlLogs(
  async (mediaService: MediaService, localizationService: LocalizationService) => {
    const sourceOptions = await pickSourceLandTenureOptions();
    const landProject = await replicateLandTenureOptions(mediaService, sourceOptions, LAND_TENURE_PROJECT_KEY);
    const landSite = await replicateLandTenureOptions(mediaService, sourceOptions, LAND_TENURE_SITE_KEY);
    const agreement = await appendLandownerAgreementOptions(localizationService);
    const agreementList = await appendLandownerAgreementOptionList(localizationService);

    console.log("Land tenure (project):", landProject);
    console.log("Land tenure (site):", landSite);
    console.log("Landowner agreement:", agreement);
    console.log("Landowner agreement option list:", agreementList);
  }
);
