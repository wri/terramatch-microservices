import Debug from "debug";

export const rootDebug = Debug("cli");

export const printVerboseHook = thisCommand => {
  const options = thisCommand.opts();

  if (options.verbose) {
    Debug.enable("cli*");
    rootDebug(`CLI arguments`);
    rootDebug(options);
  }
};
