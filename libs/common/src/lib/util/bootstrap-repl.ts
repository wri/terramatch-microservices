import { DynamicModule, Type } from "@nestjs/common";
import { TMLogger } from "./tm-logger";
import * as lodash from "lodash";
import { repl } from "@nestjs/core";
import { Sequelize } from "sequelize-typescript";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const logger = new TMLogger("REPL");

export async function bootstrapRepl(serviceName: string, module: Type | DynamicModule) {
  logger.log(`Starting REPL for ${serviceName}`);

  const replServer = await repl(module);

  // Makes all lodash functions available via the global `lodash` accessor in the REPL
  replServer.context["lodash"] = lodash;
  // Makes all Sequelize models easily accessible via the `db` accessor in the REPL
  replServer.context["db"] = replServer.context["get"](Sequelize).models;

  const cacheDirectory = join("node_modules", ".cache");
  if (!existsSync(cacheDirectory)) mkdirSync(cacheDirectory);

  replServer.setupHistory(join(cacheDirectory, ".nestjs_repl_history"), error => {
    if (error) logger.error(error);
  });
}
