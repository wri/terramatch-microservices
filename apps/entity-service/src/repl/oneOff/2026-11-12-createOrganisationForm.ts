import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { getLinkedFieldConfig } from "@terramatch-microservices/common/linkedFields";
import { isField, isRelation } from "@terramatch-microservices/database/constants/linked-fields";
import { Form, FormOptionList, FormOptionListOption } from "@terramatch-microservices/database/entities";
import { FormsService } from "../../forms/forms.service";
import { StoreFormQuestionAttributes } from "../../forms/dto/form-question.dto";
import { StoreFormSectionAttributes } from "../../forms/dto/form-section.dto";

type QuestionSeed = Omit<StoreFormQuestionAttributes, "inputType" | "label" | "children"> & {
  linkedFieldKey?: string;
  inputType?: StoreFormQuestionAttributes["inputType"];
  label: string;
  required?: boolean;
  children?: QuestionSeed[];
};
type SectionSeed = { title: string; description?: string; questions: QuestionSeed[] };

const REQUIRED = { required: true };
const ORG_DETAILS_DESCRIPTION =
  "Please provide some basic details about your organization, including your organization's name and address, " +
  "and let us know whether you are looking to fund or develop restoration projects. Please note, once submitted, " +
  "you will not be able to amend your organization name or account type.";
const LARGE_NUMBER = { min: 0, max: 9999999999999 };
const EMPLOYEE_COUNT = { min: 0, max: 999999 };

const employeeCount = (linkedFieldKey: string, label: string): QuestionSeed => ({
  linkedFieldKey,
  label,
  placeholder: "Enter a Value",
  validation: EMPLOYEE_COUNT
});

// Mirrors the hand-built organisation edit form in the website (getEditOrganisationSteps.ts), which
// is a superset of the organisation creation form (getCreateOrganisationSteps.ts).
const SECTIONS: SectionSeed[] = [
  {
    title: "Organization Details",
    description: ORG_DETAILS_DESCRIPTION,
    questions: [
      {
        linkedFieldKey: "org-type",
        label: "Organization Type",
        placeholder: "Select Organization Type",
        required: true
      },
      {
        linkedFieldKey: "org-name",
        label: "Organization Legal Name",
        placeholder: "Organization Legal Name",
        required: true
      },
      {
        linkedFieldKey: "org-hq-st1",
        label: "Headquarters Street address",
        placeholder: "Add Headquarters Street address",
        required: true
      },
      {
        linkedFieldKey: "org-hq-st2",
        label: "Headquarters Street address 2",
        placeholder: "Add Headquarters Street address 2"
      },
      {
        linkedFieldKey: "org-hq-city",
        label: "Headquarters address City",
        placeholder: "Add Headquarters address City",
        required: true
      },
      {
        linkedFieldKey: "org-hq-state",
        label: "Headquarters address State/Province",
        placeholder: "Headquarters address State/Province",
        required: true
      },
      {
        linkedFieldKey: "org-hq-zip",
        label: "Headquarters address Zipcode",
        placeholder: "Add Headquarters address Zipcode"
      },
      {
        linkedFieldKey: "org-hq-country",
        label: "Headquarters address Country",
        placeholder: "Add Headquarters address Country",
        required: true
      },
      {
        linkedFieldKey: "org-phone",
        label: "Organization WhatsApp Enabled Phone Number",
        placeholder: "Add Phone Number",
        required: true
      },
      {
        linkedFieldKey: "org-fcol-additional",
        label: "Other additional documents",
        placeholder: "Add additional documents",
        additionalProps: { max: 10 }
      }
    ]
  },
  {
    title: "Organizational Governance",
    questions: [
      {
        linkedFieldKey: "org-countries",
        label: "In what countries is your organisation legally registered?",
        placeholder: "Select Country",
        description: "Please select the relevant countries where your organization is legally registered to operate.",
        required: true
      },
      {
        linkedFieldKey: "org-fcol-lgl-reg",
        label: "Proof of local legal registration, incorporation, or right to operate",
        placeholder: "Add Registration Files",
        additionalProps: { max: 5 }
      },
      {
        linkedFieldKey: "org-description",
        label: "Organization Description",
        placeholder: "Add Organization Description"
      },
      { linkedFieldKey: "org-fdg-dte", label: "Date Organization Founded" },
      {
        linkedFieldKey: "org-languages",
        label: "Organizational Languages",
        placeholder: "Organizational Languages"
      },
      {
        linkedFieldKey: "org-fcol-ref",
        label: "Reference Letters",
        placeholder: "Add Reference Letters",
        additionalProps: { max: 5 }
      },
      {
        linkedFieldKey: "org-leadership-team",
        label: "Leadership team (providing your senior leaders by position, gender, and age)",
        description: "Please list the members of your organization’s board of directors."
      },
      {
        linkedFieldKey: "org-ownership-stake",
        label: "Ownership participation (providing your senior leaders by position)",
        description: "Please list the ownership of your organization’s."
      },
      {
        inputType: "tableInput",
        label: "Your employees",
        tableHeaders: ["Employee Type", "Employee Count"],
        children: [
          employeeCount("org-ft-perm-employees", "Number of full-time permanent employees"),
          employeeCount("org-pt-perm-employees", "Number of part-time permanent employees"),
          employeeCount("org-temp-employees", "Number of temporary employees"),
          employeeCount("org-female-employees", "Number of female employees"),
          employeeCount("org-male-employees", "Number of male employees"),
          employeeCount("org-young-employees", "Number of employees between and including ages 18 and 35"),
          employeeCount("org-over-35-employees", "Number of employees older than 35 years of age")
        ]
      }
    ]
  },
  {
    title: "Social Media Presence",
    description:
      "If your organization has a website or any social media accounts, please share them below. Seeing your " +
      "online presence helps us understand more about the history and purpose of your organization, but it is " +
      "not a requirement.",
    questions: [
      {
        linkedFieldKey: "org-web-url",
        inputType: "url",
        label: "Organization Website URL",
        placeholder: "Website URL"
      },
      {
        linkedFieldKey: "org-fb-url",
        inputType: "url",
        label: "Organization Facebook URL",
        placeholder: "Add Organization Facebook URL"
      },
      {
        linkedFieldKey: "org-twi-url",
        inputType: "url",
        label: "Organization Twitter URL",
        placeholder: "Add Organization Twitter URL"
      },
      {
        linkedFieldKey: "org-inst-url",
        inputType: "url",
        label: "Organization Instagram URL",
        placeholder: "Add Organization Instagram URL"
      },
      {
        linkedFieldKey: "org-lnkn-url",
        inputType: "url",
        label: "Organization Linkedin URL",
        placeholder: "Add Organization Linkedin URL"
      }
    ]
  },
  {
    title: "Organization Profile",
    questions: [
      {
        linkedFieldKey: "org-fcol-logo",
        label: "Upload your organization logo",
        placeholder: "Add your organization logo",
        additionalProps: { max: 3 }
      },
      {
        linkedFieldKey: "org-fcol-cover",
        label: "Upload a cover photo",
        placeholder: "Add a cover photo",
        additionalProps: { max: 20 }
      }
    ]
  },
  {
    title: "Financial Scope of Work (Historic)",
    questions: [
      { linkedFieldKey: "org-fin_start_month", label: "Start of financial year (month)" },
      {
        linkedFieldKey: "org-fcol-bank-statments",
        label: "Upload your organization's bank statements",
        placeholder: "Upload bank statements",
        additionalProps: { max: 5 }
      },
      {
        linkedFieldKey: "org-funding-types",
        label: "Breakdown of Recent (past 4 years) Funding History by Funding Type and Amount"
      },
      {
        linkedFieldKey: "org-add-fund-details",
        label: "Additional details about funding structure, organisational support, etc."
      }
    ]
  },
  {
    title: "Past Community Engagement Experience",
    questions: [
      { linkedFieldKey: "org-engagement-farmers", label: "Engagement: Farmers" },
      { linkedFieldKey: "org-engagement-women", label: "Engagement: Women" },
      { linkedFieldKey: "org-engagement-youth", label: "Engagement: Youth" },
      { linkedFieldKey: "org-community-experience", label: "Community Engagement Experience/Approach" },
      { linkedFieldKey: "org-tot-eng-comty-mbrs-3yr", label: "Community Engagement Numbers" }
    ]
  },
  {
    title: "Past Restoration Experience",
    questions: [
      {
        linkedFieldKey: "org-rel-exp-years",
        label: "Years of relevant restoration experience",
        validation: { min: 0, max: 150 }
      },
      {
        linkedFieldKey: "org-ha-res-tot",
        label: "Total Hectares Restored",
        placeholder: "Total Hectares Restored",
        validation: LARGE_NUMBER
      },
      { linkedFieldKey: "org-ha-res-3yr", label: "Hectares Restored in the last 3 years", validation: LARGE_NUMBER },
      {
        linkedFieldKey: "org-tre-gro-tot",
        label: "Total Trees Grown",
        placeholder: "Total Trees Grown",
        validation: LARGE_NUMBER
      },
      {
        linkedFieldKey: "org-tre-gro-3yr",
        label: "Trees Grown in the last 3 years",
        placeholder: "Trees Grown in the last 3 years",
        validation: LARGE_NUMBER
      },
      { linkedFieldKey: "org-tree-species", label: "Tree Species Grown", additionalProps: { with_numbers: false } },
      {
        linkedFieldKey: "org-avg-tree-survival-rate",
        label: "Average Tree Survival Rate",
        validation: { min: 0, max: 100 }
      },
      {
        linkedFieldKey: "org-restoration-types-implemented",
        label: "Restoration Intervention Types Implemented",
        options: [
          { slug: "agroforestry", label: "Agroforestry" },
          { slug: "applied-nucleation", label: "Applied Nucleation" },
          { slug: "assisted-natural-regeneration", label: "Assisted Natural Regeneration" },
          { slug: "direct-seeding", label: "Direct Seeding" },
          { slug: "enrichment-planting", label: "Enrichment Planting" },
          { slug: "mangrove-restoration", label: "Mangrove Restoration" },
          { slug: "reforestation", label: "Reforestation" },
          { slug: "riparian-restoration", label: "Riparian Restoration" },
          { slug: "silvopasture", label: "Silvopasture" }
        ]
      },
      { linkedFieldKey: "org-tree-maint-aftercare-aprch", label: "Tree Maintenance & After Care Approach" },
      { linkedFieldKey: "org-restored-areas-desc", label: "Description of areas restored" },
      { linkedFieldKey: "org-mon-eval-exp", label: "Monitoring and evaluation experience" },
      {
        linkedFieldKey: "org-fcol-prev-annual-rpts",
        label: "Previous Annual Reports for Monitored Restoration Projects",
        description:
          "You can upload up to 5 examples of previous monitoring reports that you have produced for past " +
          "restoration projects. Reports that you submitted to funders, government agencies, or technical " +
          "partners are especially welcome.",
        additionalProps: { max: 10 }
      },
      {
        linkedFieldKey: "org-fcol-hst-rest",
        label: "Photos of past restoration work",
        description:
          "Please upload as many photos of your past restoration work as possible. Planting photos, " +
          "before-and-after images, community engagement pictures, geotagged photos, and aerial images are " +
          "especially valuable.",
        additionalProps: { max: 25 }
      }
    ]
  }
];

const loadListOptions = async (key: string) => {
  const list = await FormOptionList.findOne({ where: { key }, attributes: ["id"] });
  if (list == null) return undefined;

  const options = await FormOptionListOption.findAll({
    where: { formOptionListId: list.id },
    attributes: ["slug", "label", "imageUrl"]
  });
  return options.map(({ slug, label, imageUrl }) => ({ slug: slug ?? "", label: label ?? "", imageUrl }));
};

const buildQuestion = async ({ required, children, ...seed }: QuestionSeed): Promise<StoreFormQuestionAttributes> => {
  const question = { ...seed } as StoreFormQuestionAttributes;
  if (required === true) question.validation = { ...seed.validation, ...REQUIRED };
  if (children != null) question.children = await Promise.all(children.map(buildQuestion));
  if (seed.linkedFieldKey == null) return question;

  const config = getLinkedFieldConfig(seed.linkedFieldKey);
  if (config == null || config.model !== "organisations") {
    throw new Error(`Invalid organisation linked field key: ${seed.linkedFieldKey}`);
  }

  const { field } = config;
  question.inputType ??= field.inputType;
  if (!isRelation(field)) question.multiChoice = field.multiChoice ?? false;
  if ("collection" in field) question.collection = field.collection ?? null;
  if (isField(field) && field.optionListKey != null && question.options == null) {
    question.optionsList = field.optionListKey;
    // Some lists (e.g. gadm-level-0) are resolved by key on the FE and have no stored options.
    question.options = await loadListOptions(field.optionListKey);
  }

  return question;
};

/**
 * Creates the wizard form used for organisation creation and editing. This form is not attached to a
 * framework; it applies to all organisations.
 *
 * Run in entity-service REPL:
 *   await oneOff.createOrganisationForm()
 *
 * Safe to re-run: does nothing if an organisation form already exists.
 */
export const createOrganisationForm = withoutSqlLogs(async () => {
  const existing = await Form.findOne({ where: { type: "organisation" }, attributes: ["uuid"] });
  if (existing != null) {
    console.log(`Organisation form already exists [${existing.uuid}]`);
    return;
  }

  const sections: StoreFormSectionAttributes[] = await Promise.all(
    SECTIONS.map(async ({ title, description, questions }) => ({
      title,
      description: description ?? null,
      questions: await Promise.all(questions.map(buildQuestion))
    }))
  );

  const form = await getService(FormsService).store({
    title: "Organization Profile",
    type: "organisation",
    submissionMessage: "Thank you for setting up your organizational profile on TerraMatch.",
    sections
  });
  console.log(`Created organisation form [${form.uuid}]`);
});
