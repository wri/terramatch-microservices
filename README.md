# terramatch-microservices
Repository for the Microservices API backend of the TerraMatch service

# Requirements:
 * Node v20.11.1. Using [NVM](https://github.com/nvm-sh/nvm?tab=readme-ov-file) is recommended.
 * [Docker](https://www.docker.com/)
 * [CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) (install globally)
 * [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
 * [NX](https://nx.dev/getting-started/installation#installing-nx-globally) (install globally)

# Building and starting the apps
 * The ApiGateway does not hot-reload and needs to be re-built when there are changes:
   * `nx build api-gateway` or `nx run-many -t build` (to build all apps)
   * This will build the local proxy Lambda function and the CDK Stack
 * To run all services:
   * `nx run-many -t serve`
   * Note: the first time this runs, the gateway will take quite awhile to start. It'll be faster on subsequent starts.
   * For now, this starts up the ApiGateway and the User service
 * In `.env` in your `wri-terramatch-website` repository, set your BE connection URL correctly:
   * `NEXT_PUBLIC_API_BASE_URL='http://localhost:4000'`

# Deploying
TBD. The ApiGateway has been tested to be at least functional on AWS. Tooling around deployment will be
handled in a future ticket.
