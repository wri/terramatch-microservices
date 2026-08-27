import { Response } from "express";
import {
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Seeding,
  Site,
  SiteReport,
  Task,
  TreeSpecies,
  TreeSpeciesResearch
} from "@terramatch-microservices/database/entities";
import { Attributes, col, CreationAttributes, fn, Includeable, Op, WhereOptions } from "sequelize";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Dictionary, filter, flatten, flattenDeep, groupBy, isEmpty, omit, orderBy, uniq, uniqBy } from "lodash";
import { EntityType, REPORT_TYPES, ReportType } from "@terramatch-microservices/database/constants/entities";
import { FRAMEWORK_KEYS_TF, FrameworkKeyTF, PPC } from "@terramatch-microservices/database/constants/framework";
import { PlantingCountDto, PlantingCountMap } from "./dto/planting-count.dto";
import { SpeciesDto } from "./dto/species.dto";
import { isoForFilename, normalizedFileName } from "@terramatch-microservices/common/util/fileNames";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { UserContext } from "@terramatch-microservices/common/contexts/user.context";
import { CsvExportService } from "@terramatch-microservices/common/export/csv-export.service";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { COMPLETE_REPORT_STATUSES, DRAFT, DUE } from "@terramatch-microservices/database/constants/status";
import { BulkUploadWarning } from "./dto/tree-bulk-upload.dto";
import { parseCsvStream } from "@terramatch-microservices/common/file/file.service";
import { Readable } from "stream";
import { TranslatableException } from "@terramatch-microservices/common/exceptions/translatable.exception";

export const ESTABLISHMENT_ENTITIES = ["sites", "nurseries", ...REPORT_TYPES] as const;
export type EstablishmentEntity = (typeof ESTABLISHMENT_ENTITIES)[number];

export const REPORT_COUNT_ENTITIES = ["projects", "projectReports", "sites", "nurseries"] as const;
export type ReportCountEntity = (typeof REPORT_COUNT_ENTITIES)[number];

export const isEstablishmentEntity = (entity: EntityType): entity is EstablishmentEntity =>
  ESTABLISHMENT_ENTITIES.includes(entity as EstablishmentEntity);
export const isReportCountEntity = (entity: EntityType): entity is ReportCountEntity =>
  REPORT_COUNT_ENTITIES.includes(entity as ReportCountEntity);

type TreeReportModelType = typeof ProjectReport | typeof SiteReport | typeof NurseryReport;
type TreeModelType = TreeReportModelType | typeof Project | typeof Site | typeof Nursery;

const isReport = (type: EstablishmentEntity): type is ReportType => type.endsWith("Reports");

const treeAssociations = (model: TreeModelType, attributes: string[], where?: WhereOptions) =>
  model.TREE_ASSOCIATIONS.map(association => ({
    required: false,
    association,
    attributes,
    where: { ...where, hidden: false }
  }));

const uniqueTreeNames = (trees: Dictionary<TreeSpecies[] | Seeding[]>): Dictionary<SpeciesDto[]> =>
  Object.keys(trees).reduce(
    (dict, collection) => ({
      ...dict,
      [collection]: uniqBy(
        filter(
          trees[collection].map(({ name, taxonId }) => (isEmpty(name) ? null : { name, taxonId }))
        ) as SpeciesDto[],
        "name"
      )
    }),
    {} as Dictionary<SpeciesDto[]>
  );

const countPlants = (trees: TreeSpecies[] | Seeding[]): Dictionary<PlantingCountDto> =>
  trees.reduce(
    (counts, { name, taxonId, amount }) => ({
      ...counts,
      ...(name == null
        ? {}
        : {
            [name]: {
              taxonId: counts[name]?.taxonId ?? taxonId ?? undefined,
              amount: (counts[name]?.amount ?? 0) + (amount ?? 0)
            }
          })
    }),
    {} as Dictionary<PlantingCountDto>
  );

const countTreeCollection = (trees: Dictionary<TreeSpecies[]>) =>
  Object.keys(trees).reduce(
    (map, collection) => ({ ...map, [collection]: countPlants(trees[collection]) }),
    {} as PlantingCountMap
  );

const taxonIdsByName = async (trees: string[], warnings: BulkUploadWarning[]) => {
  // map of tree name to taxon ID.
  const taxonIds = (
    await TreeSpeciesResearch.findAll({
      where: { scientificName: { [Op.in]: trees } },
      attributes: ["taxonId", "scientificName"]
    })
  ).reduce(
    (acc, { taxonId, scientificName }) => ({
      ...acc,
      [scientificName]: taxonId
    }),
    {} as Dictionary<string>
  );

  // Check for any missing taxon IDs, and add a warning for the rows that are missing it.
  for (const [index, treeName] of trees.entries()) {
    if (taxonIds[treeName] == null) {
      warnings.push({
        row: index + 2,
        message: `Scientific name not found for tree species: ${treeName}`,
        code: "TAXON_ID_MISSING",
        variables: { treeName }
      });
    }
  }

  return taxonIds;
};

const siteReportIdsByName = async (task: Task, sites: string[], warnings: BulkUploadWarning[]) => {
  // map of site name to site report ID.
  const siteIds = (
    await task.$get("siteReports", {
      attributes: ["id"],
      where: { "$site.name$": { [Op.in]: sites }, status: { [Op.notIn]: COMPLETE_REPORT_STATUSES } },
      include: [{ association: "site", attributes: ["name"], required: true }]
    })
  ).reduce(
    (acc, { id, site }) => ({
      ...acc,
      [site?.name as string]: id
    }),
    {} as Dictionary<number>
  );

  // check for any missing sites and add a warning
  for (const site of sites) {
    if (siteIds[site] == null) {
      warnings.push({
        message: `Site not found or report not editable: ${site}`,
        code: "SITE_NOT_FOUND",
        variables: { site }
      });
    }
  }

  return siteIds;
};

@Injectable()
export class TreeService {
  constructor(
    private readonly localizationService: LocalizationService,
    private readonly csvExportService: CsvExportService
  ) {}

  async searchScientificNames(search: string) {
    return (
      await TreeSpeciesResearch.findAll({
        where: {
          [Op.or]: [
            // By checking these two, we're limiting the search term to only occurrences at the
            // beginning of a word in the scientific name, which tends to lead to better results.
            { scientificName: { [Op.like]: `${search}%` } },
            { scientificName: { [Op.like]: `% ${search}%` } }
          ]
        },
        attributes: ["taxonId", "scientificName"],
        order: [
          [fn("length", col("scientificName")), "ASC"],
          ["scientificName", "ASC"]
        ],
        limit: 10
      })
    ).map(({ taxonId, scientificName }) => ({ taxonId, scientificName }));
  }

  async getEstablishmentTrees(entity: EstablishmentEntity, uuid: string): Promise<Dictionary<SpeciesDto[]>> {
    if (entity === "siteReports" || entity === "nurseryReports") {
      // For site and nursery reports, we fetch both the establishment species on the parent entity
      // and on the Project
      const parentModel = entity === "siteReports" ? Site : Nursery;
      const include = {
        model: parentModel,
        // This id isn't necessary for the data we want to fetch, but sequelize requires it for
        // the nested includes
        attributes: ["id"],
        include: [
          ...treeAssociations(parentModel, ["name", "collection", "taxonId"]),
          {
            model: Project,
            // This id isn't necessary for the data we want to fetch, but sequelize requires it for
            // the nested includes
            attributes: ["id"],
            include: treeAssociations(Project, ["name", "collection", "taxonId"])
          }
        ]
      };

      if (entity === "siteReports") {
        include.include.push({
          required: false,
          association: "seedsPlanted",
          attributes: ["name", "taxonId"],
          where: { hidden: false }
        });
      }

      const whereOptions = {
        where: { uuid },
        attributes: [],
        include: [include]
      };

      const report = await (entity === "siteReports"
        ? SiteReport.findOne(whereOptions)
        : NurseryReport.findOne(whereOptions));
      if (report == null) throw new NotFoundException();

      const parent = report instanceof SiteReport ? report.site : report.nursery;
      const trees = groupBy(
        flattenDeep([
          parentModel.TREE_ASSOCIATIONS.map(
            association =>
              (parent as unknown as undefined | { [association]: TreeSpecies[] | null })?.[association] ?? []
          ),
          Project.TREE_ASSOCIATIONS.map(
            association =>
              (parent?.project as unknown as undefined | { [association]: TreeSpecies[] | null })?.[association] ?? []
          )
        ]),
        "collection"
      ) as Dictionary<TreeSpecies[]>;

      const treeNames = uniqueTreeNames(trees);
      if (entity === "siteReports") {
        treeNames["seeds"] = uniq(
          ((parent as Site).seedsPlanted ?? []).map(({ name, taxonId }) => ({ name: name ?? "", taxonId }))
        );
      }
      return treeNames;
    } else if (["sites", "nurseries", "projectReports"].includes(entity)) {
      const include = [
        {
          model: Project,
          // This id isn't necessary for the data we want to fetch, but sequelize requires it for
          // the nested includes
          attributes: ["id"],
          include: treeAssociations(Project, ["name", "taxonId", "collection"])
        }
      ] as Includeable[];

      if (entity === "sites") {
        include.push({
          required: false,
          association: "seedsPlanted",
          attributes: ["name", "taxonId"],
          where: { hidden: false }
        });
      }

      const whereOptions = {
        where: { uuid },
        attributes: ["frameworkKey"],
        include
      };

      const entityModel = await (entity === "sites"
        ? Site.findOne(whereOptions)
        : entity === "nurseries"
          ? Nursery.findOne(whereOptions)
          : ProjectReport.findOne(whereOptions));
      if (entityModel == null) throw new NotFoundException();

      const uniqueTrees = uniqueTreeNames(
        groupBy(
          flatten(
            Project.TREE_ASSOCIATIONS.map(
              association =>
                (entityModel.project as unknown as undefined | { [association]: TreeSpecies[] | null })?.[
                  association
                ] ?? []
            )
          ),
          "collection"
        )
      );
      if (entity === "projectReports" && entityModel.frameworkKey === "ppc") {
        // For PPC Project reports, we have to pretend the establishment species are "nursery-seedling" because
        // that's the collection used at the report level, but "tree-planted" is used at the establishment level.
        // The FE depends on the collection returned here to match what's being used in the tree species input
        // or view table.
        return {
          ...omit(uniqueTrees, ["tree-planted"]),
          ["nursery-seedling"]: uniqueTrees["tree-planted"]
        };
      }

      if (entity === "sites") {
        uniqueTrees["seeds"] = uniq(
          ((entityModel as Site).seedsPlanted ?? []).map(({ name, taxonId }) => ({ name: name ?? "", taxonId }))
        );
      }

      return uniqueTrees;
    } else {
      throw new BadRequestException(`Entity type not supported: [${entity}]`);
    }
  }

  async getPreviousPlanting(entity: EstablishmentEntity, uuid: string): Promise<PlantingCountMap | undefined> {
    if (!isReport(entity)) return undefined;

    let model: TreeReportModelType;
    switch (entity) {
      case "projectReports":
        model = ProjectReport;
        break;

      case "siteReports":
        model = SiteReport;
        break;

      case "nurseryReports":
        model = NurseryReport;
        break;

      default:
        throw new BadRequestException();
    }

    // @ts-expect-error Can't narrow the union TreeReportModelType automatically
    const report: InstanceType<TreeReportModelType> = await model.findOne({
      where: { uuid },
      attributes: ["dueAt", model.PARENT_ID]
    });
    if (report == null) throw new NotFoundException();

    const modelIncludes: Includeable[] = treeAssociations(model, ["taxonId", "name", "collection", "amount"], {
      amount: { [Op.gt]: 0 }
    });
    if (entity === "siteReports") {
      modelIncludes.push({
        required: false,
        association: "seedsPlanted",
        attributes: ["name", "taxonId", "amount"],
        where: { hidden: false, amount: { [Op.gt]: 0 } }
      });
    }

    // @ts-expect-error Can't narrow the union TreeReportModelType automatically
    const records: InstanceType<TreeReportModelType>[] = await model.findAll({
      attributes: [],
      where: {
        [model.PARENT_ID]: report[model.PARENT_ID as keyof Attributes<typeof report>],
        dueAt: { [Op.lt]: report.dueAt }
      },
      include: modelIncludes
    });

    const trees = groupBy(
      flattenDeep(
        records.map(record =>
          model.TREE_ASSOCIATIONS.map(
            association => (record as unknown as { [association]: TreeSpecies[] })[association]
          )
        )
      ),
      "collection"
    );

    const planting = countTreeCollection(trees);
    if (entity === "siteReports") {
      planting["seeds"] = countPlants(
        filter(flatten((records as SiteReport[]).map(({ seedsPlanted }) => seedsPlanted))) as Seeding[]
      );
    }

    return planting;
  }

  async getAssociatedReportCounts(entity: ReportCountEntity, uuid: string): Promise<PlantingCountMap> {
    const { TS, reportIds } = await this.getAssociatedReportTreeSpecies(entity, uuid);
    if (TS == null) return {};

    const planting = countTreeCollection(
      groupBy(
        await TS.findAll({
          raw: true,
          attributes: ["uuid", "name", "taxonId", "collection", [fn("SUM", col("amount")), "amount"]],
          group: ["taxonId", "name", "collection"]
        }),
        "collection"
      )
    );

    if (entity !== "nurseries") {
      planting["seeds"] = countPlants(await Seeding.visible().siteReports(reportIds).findAll());
    }

    if (entity === "projects") {
      const nurserySeedlings = await this.getProjectNurserySeedlingPlanting(uuid);
      if (!isEmpty(nurserySeedlings)) {
        planting["nursery-seedling"] = nurserySeedlings;
      }
    }

    return planting;
  }

  async getBulkImportCsv(task: Task, response: Response) {
    const project = await task.$get("project", { attributes: ["id", "name"] });
    if (project == null) throw new BadRequestException("Task has no project");

    const fileName = normalizedFileName(
      await this.localizationService.localizeText(
        `Bulk Tree Import for {project} - reporting task due {dueAt}`,
        UserContext.userLocale ?? "en-US",
        { project: project.name, dueAt: task.dueAt == null ? null : isoForFilename(task.dueAt, true) }
      )
    );

    // map from site report id to site name so that if we have existing data to prefill, it's
    // mapped by a report ID.
    const siteReports = await task.$get("siteReports", {
      where: { status: { [Op.in]: [DRAFT, DUE] } },
      attributes: ["id"],
      include: [{ association: "site", attributes: ["name"], required: true }]
    });
    const columns = siteReports.reduce(
      (columns, report) =>
        report.site?.name == null
          ? columns
          : {
              ...columns,
              [`report${report.id}`]: report.site.name
            },
      { treeSpecies: "Tree Species" } as Dictionary<string>
    );
    console.log("columns", JSON.stringify(columns, null, 2));

    const existingReportTrees = groupBy(
      await TreeSpecies.visible()
        .for(siteReports)
        .findAll({ attributes: ["speciesableId", "name", "amount"] }),
      "speciesableId"
    );
    const trees = uniqBy(
      [
        ...(await TreeSpecies.for(project)
          .collection("tree-planted")
          .findAll({ attributes: ["name"] })),
        ...(await TreeSpecies.for(siteReports.map(({ site }) => site).filter(isNotNull))
          .collection("tree-planted")
          .findAll({ attributes: ["name"] })),
        ...Object.values(existingReportTrees).flat()
      ],
      "name"
    );

    await this.csvExportService.writeCsv(fileName, response, columns, async addRow => {
      for (const { name } of trees) {
        const row: Dictionary<string | number | null> = { treeSpecies: name };
        for (const { id } of siteReports) {
          row[`report${id}`] = existingReportTrees[id]?.find(tree => tree.name === name)?.amount ?? null;
        }
        addRow(row);
      }
    });
  }

  async bulkImportTreeCsv(task: Task, csv: Express.Multer.File) {
    const warnings: BulkUploadWarning[] = [];

    if (csv.mimetype !== "text/csv") {
      throw new TranslatableException("Uploaded file must be a CSV", "CSV_REQUIRED");
    }

    // Map of site name to trees to create
    const treesToCreate: Dictionary<{ name: string; amount: number }[]> = {};
    // List of tree species name by row
    const trees: string[] = [];
    let currentRow = 1; // starting at 1 to account for the header row.
    await parseCsvStream(Readable.from(csv.buffer), async row => {
      currentRow++;

      const treeSpeciesName = row["Tree Species"];
      if (treeSpeciesName == null) {
        throw new TranslatableException("Tree Species column missing", "MISSING_CSV_COLUMN", {
          column: "Tree Species"
        });
      }

      trees.push(treeSpeciesName);

      if (treeSpeciesName === "") {
        warnings.push(new BulkUploadWarning("Tree Species name missing", "TREE_NAME_MISSING", { row: currentRow }));
        return;
      }

      for (const [siteName, amountString] of Object.entries(row)) {
        if (siteName === "Tree Species" || isEmpty(amountString)) continue;

        if (isEmpty(siteName)) {
          warnings.push(new BulkUploadWarning("Site name missing", "SITE_NAME_MISSING", { row: currentRow }));
          continue;
        }

        const amount = Number.parseInt(amountString);
        // Checking against the amount string catches decimal values because Number.parseInt("1.2") yields 1.
        if (isNaN(amount) || amount < 0 || `${amount}` !== amountString) {
          warnings.push(
            new BulkUploadWarning(`Amount value not supported: ${amountString}`, "AMOUNT_UNSUPPORTED", {
              row: currentRow,
              variables: { amountString }
            })
          );
          continue;
        }

        (treesToCreate[siteName] ??= []).push({ name: treeSpeciesName, amount });
      }
    });

    const taxonIds = await taxonIdsByName(trees, warnings);
    const siteReportIds = await siteReportIdsByName(task, Object.keys(treesToCreate), warnings);

    const existingTrees = groupBy(
      await TreeSpecies.siteReports(Object.values(siteReportIds)).findAll(),
      "speciesableId"
    );
    const bulkTrees: CreationAttributes<TreeSpecies>[] = [];
    const updatePromises: Promise<TreeSpecies>[] = [];
    for (const [siteName, pendingTrees] of Object.entries(treesToCreate)) {
      const speciesableId = siteReportIds[siteName];
      if (speciesableId == null) continue; // skip creation if report not found

      for (const { name, amount } of pendingTrees) {
        const taxonId = taxonIds[name];
        const existingTree = existingTrees[speciesableId]?.find(existingTree =>
          taxonId == null ? name === existingTree.name : taxonId === existingTree.taxonId
        );

        if (existingTree == null) {
          bulkTrees.push({
            speciesableId,
            speciesableType: SiteReport.LARAVEL_TYPE,
            name,
            taxonId,
            amount,
            collection: "tree-planted"
          });
        } else {
          if (amount !== existingTree.amount || existingTree.hidden) {
            updatePromises.push(existingTree.update({ amount, hidden: false }));
          }
        }
      }
    }

    await Promise.all(updatePromises);
    await TreeSpecies.bulkCreate(bulkTrees);

    // Make sure that none of the affected reports are in "due" status. Have to do it individually
    // so that the state machine processing happens.
    await Promise.all(
      (await task.$get("siteReports", { where: { status: DUE } })).map(report => report.update({ status: DRAFT }))
    );

    // Sort warnings by row - warnings with no row are usually higher priority and sort to the top.
    return orderBy(warnings, ({ row }) => (row == null ? -1 : row));
  }

  private async getProjectNurserySeedlingPlanting(projectUuid: string): Promise<Dictionary<PlantingCountDto>> {
    const project = await Project.findOne({ where: { uuid: projectUuid }, attributes: ["id", "frameworkKey"] });
    if (project == null) return {};

    const TS = TreeSpecies.visible().collection("nursery-seedling");
    const aggregateAttributes = ["name", "taxonId", [fn("SUM", col("amount")), "amount"]] as const;

    if (project.frameworkKey === PPC) {
      const reportIds = ProjectReport.approvedIdsSubquery(project.id);
      return countPlants(
        (await TS.projectReports(reportIds).findAll({
          raw: true,
          attributes: [...aggregateAttributes],
          group: ["taxonId", "name"]
        })) as TreeSpecies[]
      );
    }

    if (FRAMEWORK_KEYS_TF.includes(project.frameworkKey as FrameworkKeyTF)) {
      const nurseryIds = Nursery.approvedIdsSubquery(project.id);
      const reportIds = NurseryReport.approvedIdsSubquery(nurseryIds);
      return countPlants(
        (await TS.nurseryReports(reportIds).findAll({
          raw: true,
          attributes: [...aggregateAttributes],
          group: ["taxonId", "name"]
        })) as TreeSpecies[]
      );
    }

    return {};
  }

  private async getAssociatedReportTreeSpecies(entity: ReportCountEntity, uuid: string) {
    const TS = TreeSpecies.visible();
    if (entity === "projects") {
      const project = await Project.findOne({ where: { uuid }, attributes: ["id"] });
      if (project == null) return {};
      const reportIds = SiteReport.approvedIdsSubquery(Site.approvedIdsSubquery(project.id));
      return { TS: TS.siteReports(reportIds), reportIds };
    } else if (entity === "sites") {
      const site = await Site.findOne({ where: { uuid }, attributes: ["id"] });
      if (site == null) return {};
      const reportIds = SiteReport.approvedIdsSubquery([site.id]);
      return { TS: TS.siteReports(reportIds), reportIds };
    } else if (entity === "projectReports") {
      const projectReport = await ProjectReport.findOne({ where: { uuid }, attributes: ["taskId"] });
      if (projectReport?.taskId == null) return {};

      const reportIds = SiteReport.approvedIdsForTaskSubquery(projectReport.taskId);
      return { TS: TS.siteReports(reportIds), reportIds };
    } else if (entity === "nurseries") {
      const nursery = await Nursery.findOne({ where: { uuid }, attributes: ["id"] });
      if (nursery == null) return {};
      const reportIds = NurseryReport.approvedIdsSubquery([nursery.id]);
      return { TS: TS.nurseryReports(reportIds), reportIds };
    } else {
      throw new BadRequestException(`Invalid entity type [${entity}]`);
    }
  }
}
