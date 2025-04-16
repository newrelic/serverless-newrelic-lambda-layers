# Serverless NewRelic Dotnet Example

## Overview
This document serves as a guide for building, deploying, and running a simple Dotnet application through the NewRelic Serverless plugin. The example demonstrates an easy-to-follow workflow to deploy and instrument the application using the NewRelic Serverless plugin.

## Requirement
To work with this Serverless NewRelic Dotnet example project, ensure your environment meets the following requirements:
- **Dotnet SDK**: Version 6.0 or above
- **Command-Line Interface (CLI)**: Ability to run commands in Terminal or Command Prompt
- **AWS Account**: Required for deployment using Serverless framework
- **Serverless Framework**: Installed globally via npm

## Dependencies Install
To install the necessary dependencies, follow these steps:

1. **Node.js and npm Setup**:
   - Ensure Node.js and npm are installed from the [official Node.js website](https://nodejs.org/).

2. **Install Serverless and NewRelic Plugin**:
   - Navigate to the example directory `cd examples/dotnet` where `package.json` is located.
   - Run: `npm install`  
     This installs local dependencies, including the NewRelic serverless plugin.

## Build Dotnet Project
To build the Dotnet project, execute the following steps:

1. **Run the `build.sh` File**:
   - Make sure the Dotnet tools path is exported globally in your environment.
   - Run: `./build.sh`  
     This script will create a `newrelic-serverless-dotnet-example.zip` file, ready for deployment.

2. **Update NewRelic Configuration**:
   - Open the `serverless.yml` file.
   - Update the NewRelic configuration with your account details:
     ```yaml
     newRelic:
       accountId: your-nr-accountid
       apiKey: nr-api-key
     ```

## Deploy
Deploy the Dotnet function using Serverless framework and NewRelic instrumentation:

1. **Deploy Using Serverless CLI**:
   - In the terminal, ensure you are in the project's root directory.
   - Run: `sls deploy`  
     This command deploys the Dotnet function to AWS Lambda and sets up instrumentation with NewRelic.

2. **Verify Deployment**:
   - Upon successful deployment, observe your AWS console for the created Lambda function.
   - Check NewRelic dashboard for instrumentation data related to the deployed function.

For more information and troubleshooting, consult:
- [Serverless Framework Documentation](https://www.serverless.com/framework/docs/)
- [Newrelic Serverless Plugin Documentation](https://github.com/newrelic/serverless-newrelic-lambda-layers)
- [Newrelic Documentation](https://docs.newrelic.com/)
