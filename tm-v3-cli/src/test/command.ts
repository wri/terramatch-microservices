import { Command } from "commander";
import { rootDebug } from "../utils";

const debug = rootDebug.extend("test");
const debugError = rootDebug.extend("test:error");

export const testCommand = () =>
  new Command("test").action(async () => {
    debug("Doing a thing");
  });
