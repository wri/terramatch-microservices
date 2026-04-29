# terramatch-microservices

Repository for the Microservices API backend of the TerraMatch service

# Requirements:

- Node v20.11.1. Using [NVM](https://github.com/nvm-sh/nvm?tab=readme-ov-file) is recommended.
- [Docker](https://www.docker.com/)
- [CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) (install globally)
- [NX](https://nx.dev/getting-started/installation#installing-nx-globally) (install globally)
- [NestJS](https://docs.nestjs.com/) (install globally, useful for development)

# Building and starting the apps

- Copy `.env.local.sample` to `.env`
  - On Linux systems, the DOCKER_HOST value should be `unix:///var/run/docker.sock` instead of what's in the sample.
- Run the local docker container, which is responsible for hosting the development database and running some mocked cloud services:
  - `docker compose up -d`
  - This repository does not include useful seeders. Instead, we currently rely on copies of a database from a cloud environment for realistic data. Ask a team member if you need access to a recent copy of one of these databases.
    ```
    $ docker compose exec -T mariadb mysql -u root -proot wri_restoration_marketplace_api < 2026-04-02-staging.sql
    ```
  - Command line SQL access is available as well
    ```
    $ docker compose exec mariadb mysql -u wri -pwri wri_restoration_marketplace_api < 2026-04-02-staging.sql
    ```
- To set up MinIO (local S3 proxy) using creds from the example env (`.env.local.sample`):

  - This sets up correct local bucket in the correct region for the node services to access
    ```
    $ docker compose exec minio bash
    ... once in the container
    $ mc alias set local http://localhost:9000 AKIABUVWH1HUD7YQZQAR PVMlDMep3/jLSz9GxPV3mTvH4JZynkf2BFeTu+i8
    $ mc mb local/wri
    ```

- To build and start a single service:
  - `nx serve user-service`
  - The service will be available at `http://localhost:3306`
- To run all services:
  - `nx run-many -t serve`
  - The default maximum number of services it can run in parallel is 3. To run all of the services at once, use something like
    `nx run-many --parallel=100 -t serve`, or you can cherry-pick which services you want to run instead with
    `nx run-many -t serve --projects user-service job-service`.
- Some useful targets have been added to the root `package.json` for service sets. For instance, to run just the services needed
  by the TM React front end, use `npm run fe-services`, or to run all use `npm run all`.
- In `.env` in your `wri-terramatch-website` repository, set your BE connection URL correctly by noting the config
  in `.env.local.sample` for local development.
  - The `NEXT_PUBLIC_API_BASE_URL` still points at the PHP BE directly
  - New `NEXT_PUBLIC_<SERVICE>_URL` values are needed for each service you're running locally. This will typically match
    the services defined in `V3_NAMESPACES` in `src/generated/v3/utils.ts`.

# CLI

We have a CLI app in this repo. Currently it's responsible for building and launching REPL processes locally and in the cloud.

To build the CLI and make it executable:

- `nx executable tm-v3-cli`
- `(cd dist/tm-v3-cli; npm link)`

The CLI may then be invoked as a direct shell command:

- `tm-v3-cli -h`

The verbose flag will put extra debugging output in the console:

- `tm-v3-cli -v <command and args>`

Development:

- If you're working on active development of the CLI, you can run a build watcher:
  - `nx build tm-v3-cli --watch --no-cloud`
  - Note: starting this process will regenerate the `dist/tm-v3-cli` directory, which may remove the executable flag on the script.
    If that happens, you can re-enable by running `nx exectuable tm-v3-cli` while the build watch command above is running.

# REPL (local and in the cloud)

We utilize the [Nest JS REPL](https://docs.nestjs.com/recipes/repl) to be able to access the code running in a given AWS
environment, and use the same tools for local development.

Start by following the steps above in the CLI section to get the CLI built and running locally.

The command for running the REPL is simply `repl`:

- `tm-v3-cli repl -h`

The service name is required. The environment name is optional and will default to building and running the local REPL for that given service.

If connecting to a remote REPL environment, the [AWS Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)
is required to be installed on your machine.

As you will note on the NestJS documentation above, the REPL gives you access to all services exposed by your AppModule.
In addition, the `boostrap-repl.ts` utility that is used by all services exposes a couple of things to make life a bit
easier in the REPL env:

- All of lodash accessible through `lodash` (e.g. `lodash.join([1, 2])`)
- All database models are made accessible in the global context (e.g. `await User.findOne({ emailAddress: "foo@bar.org" })`)

# Database work

While we do maintain column definitions in our Sequelize models, [Umzug](https://github.com/sequelize/umzug) is used for migrations.

Requirements:

- All steps below require the REPL (see above) to be functional on your local system.

To check for what migrations are ready to run:

- `$ ./bin/migrate.ts pending`

To run migrations locally:

- `$ ./bin/migrate.ts up`

For more sophisticated migration management, enter the REPL and access the `umzug` object that
is provided there:

```
$ tm-v3-cli repl user-service
> await umzug.pending()
> await umzug.down()
... etc
```

## Creating a new migration

Migrations are stored in `libs/database/src/lib/migrations`.

- Create a file that starts with a date/time stamp, e.g. `202604071412-create-foo-table.ts`
- Export a `RunnableMigration` (see examples in that directory):
  - It's important to take care with the name - migrations are run in alphabetical order, and we
    typically want them to run in the order they were created, so make sure that the date / time stamp
    is accurate so that it runs in order. The name should match the file name.

```
export const createFooTable: RunnableMigration<QueryInterface> = {
  name: "202604071412-create-foo-table",

  async up({ context }) {
    await context.createTable(...);
  }

  async down({ context }) {
    await context.dropTable(...);
  }
}
```

- Add the migration to the `migrations` array in `index.ts` in that directory

## Migrations in the cloud

There is a Github Action ("Run Database Migrations" - defined in `run-migrations.yml`) that is
responsible for running migrations in AWS. It always uses the `user-service`, so it will always
use the latest code deployed to the user service.

When modifying the DB schema and writing migrations, it's generally a good idea to deploy all
services anyway so that all services have an up to date copy of the `database` lib installed. When
running the "Service Deploy (all)" Github Action, the DB migrations are run automatically as soon
as the user service finishes deploying.

# AWS RDS (MariaDB) Access

The [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html) and
[AWS Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)
are required for direct access to the databases hosted in AWS.

Update your SSH config (typically under `~/.ssh/config` on Mac or Linux systems) to include
an entry for connecting to EC2 instances through the session manager.

```
Host i-*
    IdentityFile <path to wri-terramatch-new.pem>
    ProxyCommand sh -c "aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters 'portNumber=%p'"
```

If you do not have `wri-terramatch-new.pem`, please ask a member of the development team for it.

- To get the current instance ID of the bastion host, run `./bin/bastion-instance-id.sh` in this repository
- To get the current address of the RDS instance you wish to connect to, run `./bin/rds-address.sh <DB name>` in this repository
  - DB name is one of `prod`, `staging`, `test` or `dev`.

Note: neither of these changes often, so if you want to save the values and use them again in the future, that
will work fine.

To open a port forwarding connection to the RDS instance through the bastion host:

```
> ssh -N ubuntu@<bastion host> -L 3311:<rds address>:3306
```

Alternatively, there is a handy script in this repository with some options for simply connecting the forwarded port, or to open
the local MySQL client pointing to the forwarded port.

```
// Get usage info
> ./bin/db-connect.sh -h
Port forward an AWS RDS DB connection through the bastion host.

Usage: ./bin/db-connect.sh [-p <local port>] [-f] [-t] env
  -p: Local port to forward the RDS connection to. Default is 3311
  -f: Forward the port only. The default behavior launches the MySQL client to connect to the DB.
  -t: Tabbed output when piping in an SQL script. By default, if a query is being piped in, the results will display in a table
  env: Environment to connect to. Options are: dev test staging prod

// Get an interactive MySQL client terminal
> ./bin/db-connect.sh staging

// Simply connect the port forwarding and wait for ctrl-c to end it
> ./bin/db-connect.sh -f staging

// Pass in a prepared query (Use -t to get tab-delineated output instead of the table)
❯ echo "select created_at, email_address from users order by created_at DESC limit 1;" | ./bin/db-connect.sh staging
Connecting to RDS instance wri-terramatch-staging.ckjgcaidltop.eu-west-1.rds.amazonaws.com through bastion host i-0af3d687c74681361
Connection to localhost port 3311 [tcp/mcns-tel-ret] succeeded!
+---------------------+----------------------------+
| created_at          | email_address              |
+---------------------+----------------------------+
| 2026-03-12 19:30:16 | marco.antonio@vizonomy.com |
+---------------------+----------------------------+

// Or send in a more complicated saved query
> cat complicated_query.sql | ./bin/db-connect.sh -t staging > query_results.tsv
```

# Deployment

Deployment is handled via manual trigger of GitHub actions. There is one for services, and one for the ApiGateway. The
ApiGateway only needs to be redeployed if its code changes; it does not need to be redeployed for updates to individual services
to take effect.

Once this project is live in production, we can explore continuous deployment to at least staging and prod envs on the staging
and main branches.

# Environment

The Environment for a given service deployment is configured in Github Actions secrets / variables. Some are repo-wide, and
some apply only to a given environment. During the build process, the contents of the variables applied to .env are visible
to the general public, so we need to be very careful about what is included there. Nothing sensitive (passwords, email
addresses, API tokens, etc) may be included in Variables, and must instead be in Secrets

- If you need to update a _non-secret_ ENV variable, add / update it in the given environment's ENV variable
- If you need to add a _secret_ ENV variable, create the secret in Github actions, and then add a line to `deploy-service.yml`
  to append that secret to the generated `.env` variable.
- The current value of secrets in GitHub actions may not be read by anyone, including repository admins. If you need to
  inspect the current value of a configured secret, the recommended approach is to access that deployed service's REPL, and
  pull the value using the `ConfigService`:

```
> $(ConfigService).get("SUPER_SECRETE_ENV_VALUE");
```

# Creating a new service

- In the root directory: `nx g @nx/nest:app apps/foo-service`
- Set up the new `main.ts` similarly to existing services.
  - Make sure swagger docs are implemented
  - Pick a default local port that is unique from other services
  - Make sure the top of `main.ts` has these two lines:
  ```
  // eslint-disable-next-line @nx/enforce-module-boundaries
  import "../../../instrument-sentry";
  ```
  - Add the `SentryModule` and `SentryGlobalFilter` to your main `app.module.ts`. See an existing service for an example.
  - Add the `HealthModule` to your main `app.module.ts`. You will likely need `CommonModule` as well.
- Set up REPL access:
  - Copy `repl.ts` from an existing service (and modify to specify the new service's name)
  - Add the `build-repl` target to `project.json`, which an empty definition.
- In your `.env` and `.env.local.sample`, add `_PORT` for the new service
- In `api-gateway-stack.ts`, add the new service and namespace to `V3_SERVICES`
- In your local web repo, follow directions in `README.md` for setting up a new service.
  - This step can be skipped for services that will not be used by the FE website.
- For deployment to AWS:
  - Add the new service name to the "service" workflow input options in `deploy-service.yml`
  - Add a new job to `deploy-services.yml` to include the new services in the "all" service deployment workflow.
    - Make sure to update the `check-services` step and follow the pattern for the `if` conditions on the individual service deploy jobs.
  - Make sure this service is covered in `stop-env.yml` by adding a line to both the `Stop Deployed Services` step and the `Wait for Service Stack Deletion step`.
  - In AWS:
    - Add ECR repositories for each env (follow the naming scheme from user-service, e.g. `terramatch-microservices/foo-service-staging`, etc)
      - Set the repo to Immutable
      - After creation, set a Lifecycle Policy. In lower envs, we retain the most recent 2 images, and in prod it's set to 5
    - In CloudWatch, create a log group for each env (follow the naming scheme from user-service, e.g. `ecs/foo-service-staging`, etc).
      - TODO: the log groups could be created as part of the stack. The ECR repository is needed before the stack runs, so that will
        need to remain a manual process.

# Testing

To set up the local testing database, run the `./bin/setup-test-database.sh` script. This script assumes that the
`wri-terramatch-api` project is checked out in the same parent directory as this one. The script may be run
again at any time to clear out the test database records and schema.

`setup-jest.ts` is responsible for creating the Sequelize connection for all tests.

`sync-sequelize.ts` creates database tables according to the schema declared in the `entity.ts` files in this codebase. Care should be
taken to make sure that the schema is set up in this codebase such that the database tables are created with the same
types and indices as in the primary database controlled by the Laravel backend. This hook is only run for the database
test.

Factories may be used to create entries in the database for testing. See `user.factory.ts`, and uses of `UserFactory` for
an example.

To run the tests for a single app/library:

- `nx test user-service` or `nx test common`

To run the tests for the whole codebase:

- `nx run-many -t test --passWithNoTests`

For checking coverage, simply pass the `--coverage` flag:

- `nx test user-service --coverage` or `nx run-many -t test --passWithNoTests --coverage`

For apps/libraries that have tests defined, the coverage thresholds are set for the whole project in `jest.preset.js`
