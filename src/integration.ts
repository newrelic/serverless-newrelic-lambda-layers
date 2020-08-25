import * as _ from "lodash";
import {
  cloudLinkAccountMutation,
  cloudServiceIntegrationMutation,
  fetchLinkedAccounts,
  nerdgraphFetch
} from "./api";
import { fetchPolicy, waitForStatus } from "./utils";

export default class Integration {
  public config: any;
  public awsProvider: any;
  public serverless: any;
  public region: string;

  constructor({ config, awsProvider, serverless, region }: any) {
    this.config = config;
    this.awsProvider = awsProvider;
    this.serverless = serverless;
    this.region = region;
  }

  public checkNRIntegration = async () => {
    const {
      accountId,
      linkedAccount,
      enableIntegration,
      newRelicApiKey
    } = this.config;

    const integrationData = await nerdgraphFetch(
      newRelicApiKey,
      this.region,
      fetchLinkedAccounts(accountId)
    );

    const linkedAccounts = _.get(
      integrationData,
      "data.actor.account.cloud.linkedAccounts",
      []
    );
    const externalId = await this.getCallerIdentity();

    const match = linkedAccounts.filter(account => {
      return (
        account.name === linkedAccount &&
        account.externalId === externalId &&
        account.nrAccountId === accountId
      );
    });

    if (match.length < 1) {
      this.serverless.cli.log(
        "No New Relic integration found for this New Relic linked account and aws account."
      );
      if (enableIntegration) {
        this.enableNRIntegration(externalId);
        return;
      }
      this.serverless.cli.log(
        "Please enable the configuration manually or add the 'enableIntegration' config var to your serverless.yaml file."
      );
      return;
    }

    this.serverless.cli.log(
      "Existing New Relic integration found for this linked account and aws account, skipping creation."
    );
  };

  private enableNRIntegration = async (externalId: string) => {
    try {
      const roleArn = await this.checkAwsIntegrationRole(externalId);
      if (!roleArn) {
        return;
      }

      const { linkedAccount, accountId, newRelicApiKey } = this.config;
      this.serverless.cli.log(
        `Enabling New Relic integration for linked account: ${linkedAccount} and aws account: ${externalId}.`
      );

      const res = await nerdgraphFetch(
        newRelicApiKey,
        this.region,
        cloudLinkAccountMutation(accountId, roleArn, linkedAccount)
      );

      const { linkedAccounts, errors } = _.get(
        res,
        "data.cloudLinkAccount",
        {}
      );
      if (errors.length > 0) {
        throw new Error(errors);
      }

      const linkedAccountId = _.get(linkedAccounts, "[0].id");
      const integrationRes = await nerdgraphFetch(
        newRelicApiKey,
        this.region,
        cloudServiceIntegrationMutation(
          accountId,
          "aws",
          "lambda",
          linkedAccountId
        )
      );
      const { errors: integrationErrors } = _.get(
        integrationRes,
        "data.cloudConfigureIntegration",
        {}
      );
      if (integrationErrors.length > 0) {
        throw new Error(integrationErrors);
      }

      this.serverless.cli.log(
        `New Relic cloud ingegration successfully created.`
      );
    } catch (err) {
      this.serverless.cli.log(
        `Something went wrong while completing the New Relic cloud integration: ${err}.`
      );
    }
  };

  private getCallerIdentity = async () => {
    try {
      const { Account } = await this.awsProvider.request(
        "STS",
        "getCallerIdentity",
        {}
      );
      return Account;
    } catch (err) {
      this.serverless.cli.log(
        "No AWS config found, please configure a default AWS config."
      );
    }
  };

  private checkAwsIntegrationRole = async (externalId: string) => {
    const { accountId } = this.config;
    if (!accountId) {
      this.serverless.cli.log(
        "No newRelic accountId specified; Cannot check for required NewRelicLambdaIntegrationRole."
      );
      return;
    }

    try {
      const params = {
        RoleName: `NewRelicLambdaIntegrationRole_${accountId}`
      };
      const {
        Role: { Arn }
      } = await this.awsProvider.request("IAM", "getRole", params);
      return Arn;
    } catch (err) {
      this.serverless.cli.log(
        "The required NewRelicLambdaIntegrationRole cannot be found; Creating Stack with NewRelicLambdaIntegrationRole."
      );

      const stackId = await this.createCFStack(accountId);
      waitForStatus(
        {
          awsMethod: "describeStacks",
          callbackMethod: () => this.enableNRIntegration(externalId),
          methodParams: {
            StackName: stackId
          },
          statusPath: "Stacks[0].StackStatus"
        },
        this
      );
    }
  };

  private createCFStack = async (accountId: string) => {
    const stackName = `NewRelicLambdaIntegrationRole-${accountId}`;
    const { customRolePolicy = "" } = this.config;

    try {
      const policy = await fetchPolicy("nr-lambda-integration-role.yaml");
      const params = {
        Capabilities: ["CAPABILITY_NAMED_IAM"],
        Parameters: [
          {
            ParameterKey: "NewRelicAccountNumber",
            ParameterValue: accountId.toString()
          },
          { ParameterKey: "PolicyName", ParameterValue: customRolePolicy }
        ],
        StackName: stackName,
        TemplateBody: policy
      };

      const { StackId } = await this.awsProvider.request(
        "CloudFormation",
        "createStack",
        params
      );
      return StackId;
    } catch (err) {
      this.serverless.cli.log(
        `Something went wrong while creating NewRelicLambdaIntegrationRole: ${err}`
      );
    }
  };
}
