# terramatch-microservices
Repository for the Microservices API backend of the TerraMatch service

# Requirements:
 * Node v20.4.0. Using [NVM](https://github.com/nvm-sh/nvm?tab=readme-ov-file) is recommended.
 * [Docker](https://www.docker.com/)
 * [CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) (install globally)
 * [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

# Using the API Gateway
 * In the api-gateway directory, run `npm run start`. This will:
   * Build the local proxy Lambda function 
   * Build the Gateway stack with CDK
   * Start the Gateway running with SAM.
 * In `.env` in your `wri-terramatch-website` repository, set your BE connection URL correctly:
   * `NEXT_PUBLIC_API_BASE_URL='http://localhost:4000'`
 * Note: the first time this runs, it will take quite awhile. It'll be faster on subsequent starts.
