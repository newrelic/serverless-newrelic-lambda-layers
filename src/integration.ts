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
  private licenseKey: string;

  constructor({ config, awsProvider, serverless, region, licenseKey }: any) {
    this.config = config;
    this.awsProvider = awsProvider;
    this.serverless = serverless;
    this.region = region;
    this.licenseKey = licenseKey;
  }

  public async check() {
    const {
      accountId,
      enableIntegration,
      apiKey,
      nrRegion,
      proxy
    } = this.config;
    const {
      linkedAccount = `New Relic Lambda Integration - ${accountId}`
    } = this.config;

    const integrationData = await nerdgraphFetch(
      apiKey,
      nrRegion,
      fetchLinkedAccounts(accountId),
      proxy,
      {
        caller: "check integration for linked accounts",
        serverless: this.serverless
      }
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
        account.nrAccountId === parseInt(accountId, 10)
      );
    });

    if (match.length < 1) {
      this.serverless.cli.log(
        "No New Relic AWS Lambda integration found for this New Relic linked account and aws account."
      );

      if (enableIntegration) {
        this.enable(externalId);
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
  }

  public async checkForManagedSecretPolicy() {
    const thisRegionPolicy = `NewRelic-ViewLicenseKey-${this.region}`;
    const regionFilter = policy => policy.PolicyName.match(thisRegionPolicy);

    try {
      const params = {
        Scope: `Local`
      };

      const results = await this.awsProvider.request(
        "IAM",
        "listPolicies",
        params
      );
      const currentRegionPolicy = results.Policies.filter(regionFilter);
      return {
        currentRegionPolicy,
        secretExists: currentRegionPolicy.length > 0
      };
    } catch (err) {
      this.serverless.cli.log(
        `Problem getting list of current policies. ${JSON.stringify(err)}`
      );
    }
  }

  public async createManagedSecret() {
    const stackName = `NewRelicLicenseKeySecret`;
    const policyName = `NewRelic-ViewLicenseKey`;
    const externalId = await this.getCallerIdentity();
    const policyArn = `arn:aws:iam::${externalId}:policy/${policyName}-${this.region}`;

    try {
      const policy = await fetchPolicy("nr-license-key-secret.yaml");
      const params = {
        Capabilities: ["CAPABILITY_NAMED_IAM"],
        Parameters: [
          {
            ParameterKey: "LicenseKey",
            ParameterValue: this.licenseKey
          },
          {
            ParameterKey: "Region",
            ParameterValue: this.region
          },
          {
            ParameterKey: "PolicyName",
            ParameterValue: policyName
          }
        ],
        StackName: stackName,
        TemplateBody: policy
      };

      const { StackId } = await this.awsProvider.request(
        "CloudFormation",
        "createStack",
        params
      );

      return { stackId: StackId, stackName, policyName, policyArn };
    } catch (err) {
      // If the secret already exists, we'll see an error, but we populate
      // a return value anyway to avoid falling back to the env var.
      if (
        `${err}`.indexOf("NewRelicLicenseKeySecret") > -1 &&
        `${err}`.indexOf("already exists") > -1
      ) {
        this.serverless.cli.log(JSON.stringify(err));

        return { stackId: "already created", stackName, policyName };
      }
      this.serverless.cli.log(
        `Something went wrong while creating NewRelicLicenseKeySecret: ${err}`
      );
    }
    return false;
  }

  private async enable(externalId: string) {
    try {
      const roleArn = await this.checkAwsIntegrationRole(externalId);

      if (!roleArn) {
        return;
      }

      const { accountId, apiKey, nrRegion, proxy } = this.config;
      const {
        linkedAccount = `New Relic Lambda Integration - ${accountId}`
      } = this.config;

      this.serverless.cli.log(
        `Enabling New Relic integration for linked account: ${linkedAccount} and aws account: ${externalId}.`
      );

      const res = await nerdgraphFetch(
        apiKey,
        nrRegion,
        cloudLinkAccountMutation(accountId, roleArn, linkedAccount),
        proxy,
        {
          caller: "enable integration, cloudLinkAccountMutation",
          serverless: this.serverless
        }
      );

      const { linkedAccounts, errors } = _.get(res, "data.cloudLinkAccount", {
        errors: ["data.cloudLinkAccount missing in response"]
      });

      if (errors && errors.length) {
        throw new Error(JSON.stringify(errors));
      }

      const linkedAccountId = _.get(linkedAccounts, "[0].id");
      const integrationRes = await nerdgraphFetch(
        apiKey,
        nrRegion,
        cloudServiceIntegrationMutation(
          accountId,
          "aws",
          "lambda",
          linkedAccountId
        ),
        proxy,
        {
          caller: "enable integration, cloudServiceIntegrationMutation",
          serverless: this.serverless
        }
      );

      const { errors: integrationErrors } = _.get(
        integrationRes,
        "data.cloudConfigureIntegration",
        {
          errors: ["data.cloudConfigureIntegration missing in response"]
        }
      );

      if (integrationErrors && integrationErrors.length) {
        throw new Error(JSON.stringify(integrationErrors));
      }

      this.serverless.cli.log(
        `New Relic AWS Lambda cloud integration created successfully.`
      );
    } catch (err) {
      this.serverless.cli.log(
        `Error while creating the New Relic AWS Lambda cloud integration: ${err}.`
      );
    }
  }

  private async getCallerIdentity() {
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
  }

  private async checkAwsIntegrationRole(externalId: string) {
    const { accountId } = this.config;
    if (!accountId) {
      this.serverless.cli.log(
        "No New Relic Account ID specified; Cannot check for required NewRelicLambdaIntegrationRole."
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
          callbackMethod: () => this.enable(externalId),
          methodParams: {
            StackName: stackId
          },
          statusPath: "Stacks[0].StackStatus"
        },
        this
      );
    }
  }

  private async createCFStack(accountId: string) {
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
        `Something went wrong while creating NewRelicLambdaIntegrationRole: ${JSON.stringify(
          err
        )}`
      );
    }
  }
}
