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

# REPL (local and in the cloud)

We utilize the [Nest JS REPL](https://docs.nestjs.com/recipes/repl) to be able to access the code running in a given AWS
environment, and use the same tools for local development.

To run the REPL locally (use any service name, minus the -service suffix):

- `npm run repl --service=entity`

To run the REPL in an AWS Env:

- Make sure you're logged in to your WRI AWS account
- Make sure you have the [AWS Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) extension installed
- Build and make executable the TM v3 CLI: `nx executable tm-v3-cli`
- If you haven't done it before, link it: `cd dist/tm-v3-cli; npm link`
- Run it: `npx tm-v3-cli remote-repl entity-service staging`
  - This will run the Entity Service REPL in the staging env. Pass a `-v` flag (`npx tm-v3-cli -v ...`) for debug output.

As you will note on the NestJS documentation above, the REPL gives you access to all services exposed by your AppModule.
In addition, the CommonModule (which all services use) exposes a `REPL` service to make getting at some things a bit easier.
As of this writing, it exposes two things:

- All of lodash accessible through `$(REPL)._`
- All database models quickly accessible through the models getter like so: `$(REPL).models.User`;

# Deployment

Deployment is handled via manual trigger of GitHub actions. There is one for services, and one for the ApiGateway. The
ApiGateway only needs to be redeployed if its code changes; it does not need to be redeployed for updates to individual services
to take effect.

Once this project is live in production, we can explore continuous deployment to at least staging and prod envs on the staging
and main branches.

# Creating a new service

- In the root directory: `nx g @nx/nest:app apps/foo-service`
- Set up the new `main.ts` similarly to existing services.
  - Make sure swagger docs and the `/health` endpoint are implemented
  - Pick a default local port that is unique from other services
  - Make sure the top of `main.ts` has these two lines:
  ```
  // eslint-disable-next-line @nx/enforce-module-boundaries
  import "../../../instrument-sentry";
  ```
  - Add the `SentryModule` and `SentryGlobalFilter` to your main `app.module.ts`. See an existing service for an example.
- Set up REPL access:
  - Copy `repl.ts` from an existing service (and modify to specify the new service's name)
  - Add the `build-repl` target to `project.json`, copying from an existing service.
- In your `.env` and `.env.local.sample`, add `_PORT` for the new service
- In `api-gateway-stack.ts`, add the new service and namespace to `V3_SERVICES`
- In your local web repo, follow directions in `README.md` for setting up a new service.
  - This step can be skipped for services that will not be used by the FE website.
- For deployment to AWS:
  - Add the new service name to the "service" workflow input options in `deploy-service.yml`
  - Add a new job to `deploy-services.yml` to include the new services in the "all" service deployment workflow.
    - Make sure to update the `check-services` step and follow the pattern for the `if` conditions on the individual service deploy jobs.
  - In AWS:
    - Add ECR repositories for each env (follow the naming scheme from user-service, e.g. `terramatch-microservices/foo-service-staging`, etc)
      - Set the repo to Immutable
      - After creation, set a Lifecycle Policy. In lower envs, we retain the most recent 2 images, and in prod it's set to 5
    - In CloudWatch, create a log group for each env (follow the naming scheme from user-service, e.g. `ecs/foo-service-staging`, etc).
      - TODO: the log groups could be created as part of the stack. The ECR repository is needed before the stack runs, so that will
        need to remain a manual process.

# Database work

For now, Laravel is the source of truth for all things related to the DB schema. As such, TypeORM is not allowed to modify the
schema, and is expected to interface with exactly the schema that is managed by Laravel. This note is included in user.entity.ts,
and should hold true for all models created in this codebase until this codebase can take over as the source of truth for DB
schema:

```
// Note: this has some additional typing information (like width: 1 on bools and type: timestamps on
//   CreateDateColumn) to make the types generated here match what is generated by Laravel exactly.
//   At this time, we want TypeORM to expect exactly the same types that PHP uses by default. Tested
//   by checking what schema gets generated in the test database against the real DB during unit
//   test runs (the only time we let TypeORM modify the DB schema).
```

This codebase connects to the database running in the `wri-terramatch-api` docker container. The docker-compose
file included in this repo is used only for setting up the database needed for running unit tests in Github Actions.

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
