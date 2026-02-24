import { DynamicModule, Type } from "@nestjs/common";
import { TMLogger } from "./tm-logger";
import * as lodash from "lodash";
import { Dictionary } from "lodash";
import { repl } from "@nestjs/core";
import { Sequelize } from "sequelize-typescript";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { buildJsonApi } from "./json-api-builder";
import { Op } from "sequelize";
import { DateTime } from "luxon";
import { v4 as uuidv4 } from "uuid";

const logger = new TMLogger("REPL");

/**
 * Starts up the NestJS REPL for the given app module.
 * @param serviceName The name of the service (for logging)
 * @param module The app module
 * @param context Any additional parameters that should be included in the global context for this REPL runtime
 */
export async function bootstrapRepl(serviceName: string, module: Type | DynamicModule, context?: Dictionary<unknown>) {
  logger.log(`Starting REPL for ${serviceName}`);

  const replServer = await repl(module);

  // By default, we make lodash, luxon, the JSON API Builder, and the Sequelize models available
  context = {
    lodash,
    uuidv4,
    DateTime,
    buildJsonApi,
    Op,
    Reflect,
    ...replServer.context["get"](Sequelize).models,
    ...context
  };

  for (const [name, model] of Object.entries(context as Dictionary<unknown>)) {
    // For in REPL auto-complete functionality
    Object.defineProperty(replServer.context, name, {
      value: model,
      configurable: false,
      enumerable: true
    });
  }

  const cacheDirectory = join("node_modules", ".cache");
  if (!existsSync(cacheDirectory)) mkdirSync(cacheDirectory);

  replServer.setupHistory(join(cacheDirectory, ".nestjs_repl_history"), error => {
    if (error != null) logger.error(error);
  });
}
