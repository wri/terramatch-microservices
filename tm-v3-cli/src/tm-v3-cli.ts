#! /usr/bin/env node
import { Command, Option } from "commander";
import { remoteReplCommand } from "./remote-repl/command";
import { printVerboseHook } from "./utils";

const program = new Command();
program.name("TerraMatch v3 CLI");

program.addCommand(remoteReplCommand());

program.addOption(new Option("-v, --verbose", "output debug logs").default(false));
program.hook("preAction", printVerboseHook);

program.parse(process.argv);
