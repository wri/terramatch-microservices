import { Command } from "commander";
import { sequelize, umzug } from "./umzug";

export function migrationsCommand(): Command {
  const command = new Command("migrations");

  command
    .command("up")
    .description("Run all pending database migrations using Umzug")
    .action(async () => {
      try {
        await umzug.up();
      } finally {
        await sequelize.close();
      }
    });

  command
    .command("status")
    .description("Show pending and executed migrations")
    .action(async () => {
      const pending = await umzug.pending();
      const executed = await umzug.executed();

      // eslint-disable-next-line no-console
      console.log(
        "Executed migrations:",
        executed.map(m => m.name)
      );
      // eslint-disable-next-line no-console
      console.log(
        "Pending migrations:",
        pending.map(m => m.name)
      );

      await sequelize.close();
    });

  return command;
}
