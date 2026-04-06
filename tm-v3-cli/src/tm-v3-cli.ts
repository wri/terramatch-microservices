#! /usr/bin/env node
import { Command, Option } from "commander";
import { replCommand } from "./commands/repl";
import { printVerboseHook } from "./utils";
import { migrateCommand } from "./commands/migrate";

const program = new Command();
program.name("TerraMatch v3 CLI");

program.addCommand(replCommand());
program.addCommand(migrateCommand());

program.addOption(new Option("-v, --verbose", "output debug logs").default(false));
program.hook("preAction", printVerboseHook);

program.parse(process.argv);
