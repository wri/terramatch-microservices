import { Argument, Command, Option } from "commander";
import { CLUSTER, Environment, ENVIRONMENTS, Service, SERVICES } from "../consts";
import { spawn } from "child_process";
import { getTaskId, rootDebug } from "../utils";
import { ECSClient, ExecuteCommandCommand } from "@aws-sdk/client-ecs";
import { ssm } from "ssm-session";
import { WebSocket } from "ws";
import { TextDecoder } from "util";

const MIGRATION_COMMANDS = ["up", "down", "pending"] as const;
type MigrationCommand = (typeof MIGRATION_COMMANDS)[number];

const debug = rootDebug.extend("migration");
const debugError = rootDebug.extend("migration:error");

const TERM_OPTIONS = { rows: 34, cols: 197 };

const runLocalMigration = async (service: Service, command: MigrationCommand) => {
  debug(`Building REPL for ${service}`);
  await new Promise<void>(resolve => {
    const build = spawn("nx", ["build-repl", service, "--no-cloud"], { stdio: "inherit" });
    build.on("close", code => {
      if (code === 0) {
        debug(`REPL build complete for ${service}`);
        resolve();
      } else {
        debugError(`REPL build for ${service} failed with code: ${code}`);
        process.exit(code);
      }
    });
  });

  debug(`Running migration command ${command} in process for ${service}`);
  const repl = spawn("node", ["dist/apps/${service}-repl"], {
    env: { ...process.env, NODE_ENV: "development", REPL: "true" }
  });

  repl.stdout.pipe(process.stdout);
  repl.stdin.write(`await umzug.${command}()\n`);
  repl.stdin.end();
};

const runRemoteMigration = async (taskId: string, service: Service, command: MigrationCommand) => {
  const client = new ECSClient();
  const executionCommand = new ExecuteCommandCommand({
    cluster: CLUSTER,
    task: taskId,
    interactive: true,
    command: `sh -c 'echo -e "await umzug.${command}();\nprocess.exit()" | REPL=true node dist/apps/${service}-repl'`
  });
  const sessionResponse = await client.send(executionCommand);
  if (sessionResponse?.session?.streamUrl == null) {
    debugError("Failed to start remote session");
    process.exit(1);
  }
  const {
    session: { streamUrl, tokenValue }
  } = sessionResponse;

  const textDecoder = new TextDecoder();

  debug("Starting ECS Exec stream connection");
  const connection = new WebSocket(streamUrl);

  connection.onopen = () => {
    ssm.init(connection, { token: tokenValue, termOptions: TERM_OPTIONS });
  };

  connection.onmessage = event => {
    const agentMessage = ssm.decode(event.data);
    ssm.sendACK(connection, agentMessage);
    if (agentMessage.payloadType === 1) {
      process.stdout.write(textDecoder.decode(agentMessage.payload));
    } else if (agentMessage.payloadType === 17) {
      ssm.sendInitMessage(connection, TERM_OPTIONS);
    }
  };

  connection.onerror = error => {
    debugError(`ECS Exec stream error: ${error}`);
    process.exit(1);
  };

  connection.onclose = () => {
    debug("ECS Exec stream closed");
    process.exit(0);
  };
};

export const migrateCommand = () =>
  new Command("migrate")
    .description("Runs or checks on current status of database migrations.")
    .addArgument(new Argument("command", "The command to run").choices(MIGRATION_COMMANDS).default("up").argOptional())
    .addOption(
      new Option("-e, --environment <environment>", "The environment to run migrations on")
        .choices(ENVIRONMENTS)
        .default("local")
    )
    .addOption(
      new Option("-s, --service <service>", "The v3 service to run migrations on")
        .choices(SERVICES)
        .default("entity-service")
    )
    .action(
      async (command: MigrationCommand, { environment, service }: { environment: Environment; service: Service }) => {
        console.log("Migration command", { environment, command, service });

        if (environment === "local") {
          await runLocalMigration(service, command);
        } else {
          const taskId = await getTaskId(service, environment, debug, debugError);
          if (taskId == null) return;
          debug(`Found task id: ${taskId}`);

          await runRemoteMigration(taskId, service, command);
        }
      }
    );
