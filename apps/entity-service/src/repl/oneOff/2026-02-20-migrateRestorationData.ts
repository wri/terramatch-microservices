import { withoutSqlLogs } from "@terramatch-microservices/common/util/without-sql-logs";
import {
  Organisation,
  Project,
  ProjectPitch,
  Tracking,
  TrackingEntry
} from "@terramatch-microservices/database/entities";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { flattenDeep, isNumber, sumBy, uniq } from "lodash";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import ProgressBar from "progress";
import { ModelCtor, Model } from "sequelize-typescript";
import { Attributes, CreationAttributes } from "sequelize";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { TrackingType } from "@terramatch-microservices/database/types/tracking";

type RestorationMapping<M extends Model> = {
  attributes: (keyof Attributes<M>)[];
  type: TrackingType;
  collection: string;
  entries: {
    type: string;
    subtype: string;
    // If undefined is returned, the entry is not created. If no entries are created for a given
    // tracking, the tracking itself is not created.
    amount: (model: M, entries: CreationAttributes<TrackingEntry>[]) => number | undefined;
  }[];
};

const columnValue =
  <M extends Model>(column: keyof Attributes<M>) =>
  (model: M) => {
    if (!isNumber(model[column])) return undefined;
    const value = Math.round(model[column] as number);
    return value <= 0 ? undefined : value;
  };

const entryTypeTotal = (type: string, entries: CreationAttributes<TrackingEntry>[]) => {
  const filtered = entries.filter(entry => entry.type === type);
  return filtered.length === 0 ? undefined : sumBy(filtered, "amount");
};

const ORGS_RESTORATION: RestorationMapping<Organisation>[] = [
  {
    attributes: ["haRestored3Year", "haRestoredTotal"],
    type: "hectares-historical",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "3-year",
        amount: columnValue("haRestored3Year")
      },
      {
        type: "years",
        subtype: "older",
        amount: ({ haRestoredTotal, haRestored3Year }) => {
          const amount = Math.max(0, Math.round(haRestoredTotal ?? 0)) - Math.max(0, Math.round(haRestored3Year ?? 0));
          return amount <= 0 ? undefined : amount;
        }
      }
    ]
  },
  {
    attributes: ["treesNaturallyRegenerated3Year", "treesNaturallyRegeneratedTotal"],
    type: "trees-historical",
    collection: "regenerated",
    entries: [
      {
        type: "years",
        subtype: "3-year",
        amount: columnValue("treesNaturallyRegenerated3Year")
      },
      {
        type: "years",
        subtype: "older",
        amount: ({ treesNaturallyRegeneratedTotal, treesNaturallyRegenerated3Year }) => {
          const amount =
            Math.max(0, Math.round(treesNaturallyRegeneratedTotal ?? 0)) -
            Math.max(0, Math.round(treesNaturallyRegenerated3Year ?? 0));
          return amount <= 0 ? undefined : amount;
        }
      }
    ]
  },
  {
    attributes: ["treesGrown3Year", "treesGrownTotal"],
    type: "trees-historical",
    collection: "grown",
    entries: [
      {
        type: "years",
        subtype: "3-year",
        amount: columnValue("treesGrown3Year")
      },
      {
        type: "years",
        subtype: "older",
        amount: ({ treesGrownTotal, treesGrown3Year }) => {
          const amount = Math.max(0, Math.round(treesGrownTotal ?? 0)) - Math.max(0, Math.round(treesGrown3Year ?? 0));
          return amount <= 0 ? undefined : amount;
        }
      }
    ]
  }
];

const PITCHES_RESTORATION: RestorationMapping<ProjectPitch>[] = [
  {
    attributes: [
      "totalTreesFirstYr",
      "totalTreeSecondYr",
      "goalTreesRestoredAnr",
      "goalTreesRestoredDirectSeeding",
      "goalTreesRestoredPlanting",
      "totalTrees"
    ],
    type: "trees-goal",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "1-year",
        amount: columnValue("totalTreesFirstYr")
      },
      {
        type: "years",
        subtype: "2-year",
        amount: columnValue("totalTreeSecondYr")
      },
      {
        type: "years",
        subtype: "unknown",
        amount: ({ totalTrees }, entries) => {
          const total = Math.max(0, Math.round(totalTrees ?? 0));
          const years = entryTypeTotal("years", entries) ?? 0;
          return total > years ? total - years : undefined;
        }
      },
      {
        type: "strategy",
        subtype: "anr",
        amount: columnValue("goalTreesRestoredAnr")
      },
      {
        type: "strategy",
        subtype: "direct-seeding",
        amount: columnValue("goalTreesRestoredDirectSeeding")
      },
      {
        type: "strategy",
        subtype: "planting",
        amount: columnValue("goalTreesRestoredPlanting")
      }
    ]
  },
  {
    attributes: ["hectaresFirstYr", "totalHectares"],
    type: "hectares-goal",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "1-year",
        amount: columnValue("hectaresFirstYr")
      },
      {
        type: "years",
        subtype: "unknown",
        amount: ({ totalHectares }, entries) => {
          const years = entryTypeTotal("years", entries) ?? 0;
          if (totalHectares == null) return undefined;
          const total = Math.round(totalHectares);
          return total <= years ? undefined : total - years;
        }
      },
      {
        type: "strategy",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("years", entries)
      },
      {
        type: "land-use",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("years", entries)
      }
    ]
  }
];

const PROJECTS_RESTORATION: RestorationMapping<Project>[] = [
  {
    attributes: [
      "goalTreesRestoredAnr",
      "goalTreesRestoredDirectSeeding",
      "goalTreesRestoredPlanting",
      "treesGrownGoal"
    ],
    type: "trees-goal",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "unknown",
        amount: columnValue("treesGrownGoal")
      },
      {
        type: "strategy",
        subtype: "anr",
        amount: columnValue("goalTreesRestoredAnr")
      },
      {
        type: "strategy",
        subtype: "direct-seeding",
        amount: columnValue("goalTreesRestoredDirectSeeding")
      },
      {
        type: "strategy",
        subtype: "planting",
        amount: columnValue("goalTreesRestoredPlanting")
      }
    ]
  },
  {
    attributes: ["totalHectaresRestoredGoal"],
    type: "hectares-goal",
    collection: "all",
    entries: [
      {
        type: "years",
        subtype: "unknown",
        amount: columnValue("totalHectaresRestoredGoal")
      },
      {
        type: "strategy",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("years", entries)
      },
      {
        type: "land-use",
        subtype: "unknown",
        amount: (_, entries) => entryTypeTotal("years", entries)
      }
    ]
  }
];

// maximum value of an int(11) signed column. Any value larger than this is clearly bogus testing
// data and may be ignored.
const MAX_AMOUNT = 2147483647;
const processRestorationMapping = async <M extends Model>(model: M, mappings: RestorationMapping<M>[]) => {
  for (const mapping of mappings) {
    const entries: CreationAttributes<TrackingEntry>[] = [];
    for (const entry of mapping.entries) {
      const amount = entry.amount(model, entries);
      if (amount != null && amount < MAX_AMOUNT) {
        // the real tracking ID will be filled in below before the entries are created.
        entries.push({ trackingId: -1, type: entry.type, subtype: entry.subtype, amount });
      }
    }
    if (entries.length > 0) {
      const tracking = await Tracking.create({
        domain: "restoration",
        type: mapping.type,
        collection: mapping.collection,
        trackableType: laravelType(model),
        trackableId: model.id
      });
      for (const entry of entries) entry.trackingId = tracking.id;
      await TrackingEntry.bulkCreate(entries);
    }
  }
};

const processRestorationModel = async <M extends Model>(
  label: string,
  ctor: ModelCtor<M>,
  mappings: RestorationMapping<M>[]
) => {
  const builder = new PaginatedQueryBuilder(ctor, 100);
  builder.attributes(uniq(flattenDeep(["id", mappings.map(({ attributes }) => attributes)])));
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} ${label} [:bar] :percent :etas`, { width: 40, total });
  for await (const page of batchFindAll(builder)) {
    for (const instance of page) {
      await processRestorationMapping(instance, mappings);
      bar.tick();
    }
  }
};

export const migrateRestorationData = withoutSqlLogs(async () => {
  await processRestorationModel("Organisations", Organisation, ORGS_RESTORATION);
  await processRestorationModel("Project Pitches", ProjectPitch, PITCHES_RESTORATION);
  await processRestorationModel("Projects", Project, PROJECTS_RESTORATION);
});
