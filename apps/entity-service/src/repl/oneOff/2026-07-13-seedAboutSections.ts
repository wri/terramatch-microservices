import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { AboutSection, AboutSectionType } from "@terramatch-microservices/database/entities/about-section.entity";
import { getService } from "@terramatch-microservices/common/util/bootstrap-repl";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { Link } from "@terramatch-microservices/database/entities";

type AboutSectionSeed = {
  type: AboutSectionType;
  frameworks?: FrameworkKey[];
  header: string;
  title?: string;
  description: string;
  contactSupportMessage: string;
  contactSupportSubject: string;
  links: LinkSeed[];
};

type LinkSeed = {
  title: string;
  url: string;
};

export const seedAboutSections = withoutSqlLogs(async () => {
  const localizationService = getService(LocalizationService);
  for (const seed of SEED_DATA) {
    const { type, frameworks, header } = seed;
    console.log(`Creating About Section [${type}, ${frameworks ?? "[default]"}, ${header}`);

    const aboutSection = await AboutSection.create({
      type: seed.type,
      frameworks: seed.frameworks,
      headerId: (await localizationService.generateI18nId(seed.header)) as number,
      titleId: await localizationService.generateI18nId(seed.title),
      descriptionId: (await localizationService.generateI18nId(seed.description)) as number,
      contactSupportMessageId: (await localizationService.generateI18nId(seed.contactSupportMessage)) as number,
      contactSupportSubjectId: (await localizationService.generateI18nId(seed.contactSupportSubject)) as number
    });

    await Link.bulkCreate(
      await Promise.all(
        seed.links.map(async link => ({
          titleId: (await localizationService.generateI18nId(link.title)) as number,
          url: link.url,
          linkableType: AboutSection.LARAVEL_TYPE,
          linkableId: aboutSection.id
        }))
      )
    );
  }
});

const PROJECT_LINKS: LinkSeed[] = [
  {
    title: "MRV Glossary",
    url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/21972136717979-Glossary-TerraFund-Monitoring-Reporting-Verification"
  },
  {
    title: "How to Complete Your Project Profile",
    url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/21995497152027-How-to-Create-Your-TerraMatch-Project-Profile"
  },
  {
    title: "How to Add Partners to Your Project",
    url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/22124468665243-How-to-Add-Partners-to-Your-Project"
  }
];

const DEFAULT_PROJECT_ONBOARDING: AboutSectionSeed = {
  type: "project",
  header: "Project Onboarding",
  title: "Monitoring, Reporting, and Verification (MRV)",
  description:
    "<ul><li><strong>Monitoring:</strong> The process of collecting and analyzing data and information to measure progress toward specific goals that the restoration effort aims to achieve.</li>" +
    "<li><strong>Reporting:</strong> The sharing of data collected by restoration champions through project, nursery, and site reports, which are submitted on the TerraMatch platform in a standardized format every six months.</li>" +
    "<li><strong>Verification:</strong> Periodically subjecting reported information to some form of review, analysis or independent assessment to establish completeness and reliability.</li></ul>",
  contactSupportMessage: "If you have challenges or need assistance, please reach out to your project manager or",
  contactSupportSubject: "Support Request for Project Profile",
  links: [
    {
      title: "MRV Framework",
      url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/21972136717979-Glossary-Monitoring-Reporting-Verification"
    },
    ...PROJECT_LINKS
  ]
};

const HBF_PROJECT_ONBOARDING: AboutSectionSeed = {
  ...DEFAULT_PROJECT_ONBOARDING,
  frameworks: ["hbf"],
  description:
    "<ul><li><strong>Monitoring:</strong> The process of collecting and analyzing data and information to measure progress toward specific goals that the restoration effort aims to achieve.</li>" +
    "<li><strong>Reporting:</strong> The sharing of data collected by restoration champions through project and site reports, which are submitted on the TerraMatch platform in a standardized format every six months.</li>" +
    "<li><strong>Verification:</strong> Periodically subjecting reported information to some form of review, analysis or independent assessment to establish completeness and reliability.</li>",
  links: [
    {
      title: "MRV Framework",
      url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/21178354112539-The-TerraFund-Monitoring-Reporting-and-Verification-Framework?brand_id=12511322362267"
    },
    ...PROJECT_LINKS
  ]
};

const PPC_PROJECT_ONBOARDING: AboutSectionSeed = {
  ...DEFAULT_PROJECT_ONBOARDING,
  frameworks: ["ppc"],
  description:
    "<ul><li><strong>Monitoring:</strong> refers to checking your project against a set of indicators (these can be ecological, like “Trees restored” or socioeconomic, like “Workdays created”) at pre-determined intervals (for example, Year 0, Year 2.5, and Year 5 of a project).</li>" +
    "<li><strong>Reporting:</strong> refers to your team’s work, filling out project, site, socioeconomic restoration partners, and disturbance reports on TerraMatch.</li>" +
    "<li><strong>Verification:</strong> refers to remote or field-based measurement of project progress.</li></ul>",
  links: [
    {
      title: "PPC Monitoring Framework",
      url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/13319985438363-What-is-the-Tree-Restoration-Monitoring-Framework"
    },
    {
      title: "How to Submit Your Quarterly Reports",
      url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/13322085147035-How-to-Submit-Your-Quarterly-Reports-PPC"
    },
    {
      title: "How to report (annually) on PPC Socioeconomic Restoration Partners",
      url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/13322399098267-How-to-report-annually-on-PPC-Socioeconomic-Restoration-Partners"
    },
    {
      title: "How to do Field Tree Monitoring",
      url: "https://terramatchsupport.zendesk.com/hc/en-us/articles/13384531523227-How-to-do-Field-Tree-Monitoring-for-the-PPC"
    }
  ]
};

const SEED_DATA: AboutSectionSeed[] = [DEFAULT_PROJECT_ONBOARDING, HBF_PROJECT_ONBOARDING, PPC_PROJECT_ONBOARDING];
