import Debug from "debug";

export const rootDebug = Debug("tm-v3-cli");

export const printVerboseHook = thisCommand => {
  const options = thisCommand.opts();

  if (options.verbose as boolean) {
    Debug.enable("tm-v3-cli*");
    rootDebug(`TerraMatch v3 CLI arguments`);
    rootDebug(options);
  }
};
