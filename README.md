# terramatch-microservices
Repository for the Microservices API backend of the TerraMatch service

# Requirements:
 * Node v20.11.1. Using [NVM](https://github.com/nvm-sh/nvm?tab=readme-ov-file) is recommended.
 * [Docker](https://www.docker.com/)
 * [CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) (install globally)
 * [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
 * [NX](https://nx.dev/getting-started/installation#installing-nx-globally) (install globally)
 * [NestJS](https://docs.nestjs.com/) (install globally, useful for development)

# Building and starting the apps
 * Copy `.env.local.sample` to `.env`
 * The ApiGateway does not hot-reload and needs to be re-built when there are changes:
   * `(cd apps/api-gateway; npm i)` to install packages for the api gateway stack
   * `(cd apps/api-gateway/lambda; npm i)` to install packages for the local lambda function that acts as a proxy for local dev only.
   * `nx build api-gateway` or `nx run-many -t build` (to build all apps)
   * This will build the local proxy Lambda function and the CDK Stack
   * Note: The architecture for the local lambda proxy defaults to ARM_64. This will be the fastest options on ARM-based Macs 
     (M1, etc), but will be much slower on X86 (AMD/Intel) based machine. If you're on an X86 machine, pass the architecture in
     an environment variable when building the api gateway: `ARCH=X86 nx build api-gateway`.
 * To run all services:
   * `nx run-many -t serve`
   * Note: the first time this runs, the gateway will take quite awhile to start. It'll be faster on subsequent starts.
   * This starts the ApiGateway and all registered NX apps. 
     * The apps will hot reload if their code, or any of their dependent code in libs changes.
     * The ApiGateway does _not_ hot reload when changes are made, so you must kill the NX serve process and re-run 
       `nx build api-gateway` after making changes.
 * In `.env` in your `wri-terramatch-website` repository, set your BE connection URL correctly:
   * `NEXT_PUBLIC_API_BASE_URL='http://localhost:4000'`

# Deployment
Deployment is handled via manual trigger of GitHub actions. There is one for services, and one for the ApiGateway. The 
ApiGateway only needs to be redeployed if its code changes; it does not need to be redeployed for updates to individual services
to take effect.

Once this project is live in production, we can explore continuous deployment to at least staging and prod envs on the staging
and main branches.

# Creating a new service
 * In the root directory: `nx g @nx/nest:app apps/foo-service`
 * Set up the new `main.ts` similarly to existing services.
   * Make sure swagger docs and the `/health` endpoint are implemented
   * Pick a default local port that is unique from other services
 * In your `.env` and `.env.local.sample`, add `_PROXY_PORT` and `_PROXY_TARGET` for the new service
 * In `api-gateway-stack.ts`, add the new service and namespace to `V3_SERVICES`
   * Make sure to kill your NX `serve` process and run `nx build api-gateway` before restarting it.
 * For deployment to AWS:
   * Add a Dockerfile in the new app directory. A simple copy and modify from user-service is sufficient
   * In AWS:
     * Add ECR repositories for each env (follow the naming scheme from user-service, e.g. `terramatch-microservices/foo-service-staging`, etc)
       * Set the repo to Immutable
       * After creation, set a Lifecycle Policy. In lower envs, we retain the most recent 2 images, and in prod it's set to 5
     * In CloudWatch, create a log group for each env (follow the naming scheme from user-service, e.g. `ecs/foo-service-staging`, etc).
       * TODO: the log groups could be created as part of the stack. The ECR repository is needed before the stack runs, so that will
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

`setup-jest.ts` is responsible for creating the Sequelize connection for all tests. Via the `sync` command, it also
creates database tables according to the schema declared in the `entity.ts` files in this codebase. Care should be
taken to make sure that the schema is set up in this codebase such that the database tables are created with the same
types and indices as in the primary database controlled by the Laravel backend. 

Factories may be used to create entries in the database for testing. See `user.factory.ts`, and uses of `UserFactory` for 
an example.

To run the tests for a single app/library:
* `nx test user-service` or `nx test common`

To run the tests for the whole codebase:
* `nx run-many -t test --passWithNoTests`

For checking coverage, simply pass the `--coverage` flag:
* `nx test user-service --coverage` or `nx run-many -t test --passWithNoTests --coverage`

For apps/libraries that have tests defined, the coverage thresholds are set for the whole project in `jest.preset.js`
