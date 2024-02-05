import * as _ from "lodash";
import {
  cloudLinkAccountMutation,
  cloudServiceIntegrationMutation,
  fetchLinkedAccounts,
  nerdgraphFetch,
} from "./api";
import { fetchPolicy, waitForStatus } from "./utils";

const DEFAULT_FILTER_PATTERNS = [
  "REPORT",
  "NR_LAMBDA_MONITORING",
  "Task timed out",
  "RequestId",
];

export default class Integration {
  public config: any;
  public awsProvider: any;
  public serverless: any;
  public log: any;
  public region: string;
  public functions: any;
  public autoSubscriptionDisabled: boolean;
  public shouldSkipFunction: any;
  public extFellBackToCW: boolean;
  public extFallbackMessage: string;
  private licenseKey: string;
  private retrieveLicenseKey: any;

  constructor({
    config,
    awsProvider,
    serverless,
    region,
    licenseKey,
    log,
    functions,
    autoSubscriptionDisabled,
    shouldSkipFunction,
    extFellBackToCW,
    extFallbackMessage,
    retrieveLicenseKey,
  }: any) {
    this.config = config;
    this.log = log;
    this.awsProvider = awsProvider;
    this.serverless = serverless;
    this.region = region;
    this.licenseKey = licenseKey;
    this.region = region;
    this.functions = functions;
    this.autoSubscriptionDisabled = autoSubscriptionDisabled;
    this.shouldSkipFunction = shouldSkipFunction;
    this.extFellBackToCW = extFellBackToCW;
    this.extFallbackMessage = extFallbackMessage;
    this.retrieveLicenseKey = retrieveLicenseKey;
  }

  public async check() {
    const { accountId, enableIntegration, apiKey, nrRegion, proxy } =
      this.config;

    const integrationData = await nerdgraphFetch(
      apiKey,
      nrRegion,
      fetchLinkedAccounts(accountId),
      proxy,
      {
        caller: "check integration for linked accounts",
        serverless: this.serverless,
      }
    );

    const linkedAccounts = _.get(
      integrationData,
      "data.actor.account.cloud.linkedAccounts",
      []
    );

    const externalId = await this.getCallerIdentity();

    const match = linkedAccounts.filter((account) => {
      return (
        account &&
        account.externalId === externalId &&
        account.nrAccountId === parseInt(accountId, 10)
      );
    });

    if (match.length < 1) {
      this.log.warning(
        "No New Relic AWS Lambda integration found for this New Relic linked account and aws account."
      );

      if (
        enableIntegration &&
        (enableIntegration !== "false" || enableIntegration !== false)
      ) {
        this.enable(externalId);
        return;
      }

      this.log.notice(
        "Please enable the configuration manually or add the 'enableIntegration' config var to your serverless.yaml file."
      );
      return;
    }

    this.log.notice(
      "Existing New Relic integration found for this linked account and aws account, skipping creation."
    );
  }

  public async makePaginatedRequest(params, regionFilter) {
    const results = await this.awsProvider.request(
      "IAM",
      "listPolicies",
      params
    );
    const currentRegionPolicy = results?.Policies?.filter(regionFilter);

    if (
      results.IsTruncated &&
      (!currentRegionPolicy || currentRegionPolicy.length === 0)
    ) {
      params.Marker = results.Marker;
      return this.makePaginatedRequest(params, regionFilter);
    }
    return currentRegionPolicy;
  }

  public async checkForManagedSecretPolicy() {
    const thisRegionPolicy = `NewRelic-ViewLicenseKey-${this.region}`;
    const regionFilter = (policy) => policy.PolicyName.match(thisRegionPolicy);
    const params = {
      Scope: `Local`,
    };

    try {
      const currentRegionPolicy = await this.makePaginatedRequest(
        params,
        regionFilter
      );
      return {
        currentRegionPolicy,
        secretExists: currentRegionPolicy?.length > 0,
      };
    } catch (err) {
      this.log.error(
        `Problem getting list of current policies. ${JSON.stringify(err)}`
      );
      return {};
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
            ParameterValue: this.licenseKey,
          },
          {
            ParameterKey: "Region",
            ParameterValue: this.region,
          },
          {
            ParameterKey: "PolicyName",
            ParameterValue: policyName,
          },
        ],
        StackName: stackName,
        TemplateBody: policy,
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
        this.log.error(JSON.stringify(err));

        return { stackId: "already created", stackName, policyName };
      }
      this.log.error(
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
      const { linkedAccount = `New Relic Lambda Integration - ${accountId}` } =
        this.config;

      this.log.notice(
        `Enabling New Relic integration for linked account: ${linkedAccount} and aws account: ${externalId}.`
      );

      const res = await nerdgraphFetch(
        apiKey,
        nrRegion,
        cloudLinkAccountMutation(accountId, roleArn, linkedAccount),
        proxy,
        {
          caller: "enable integration, cloudLinkAccountMutation",
          serverless: this.serverless,
        }
      );

      const { linkedAccounts, errors } = _.get(res, "data.cloudLinkAccount", {
        errors: ["data.cloudLinkAccount missing in response"],
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
          serverless: this.serverless,
        }
      );

      const { errors: integrationErrors } = _.get(
        integrationRes,
        "data.cloudConfigureIntegration",
        {
          errors: ["data.cloudConfigureIntegration missing in response"],
        }
      );

      if (integrationErrors && integrationErrors.length) {
        throw new Error(JSON.stringify(integrationErrors));
      }

      this.log.notice(
        `New Relic AWS Lambda cloud integration created successfully.`
      );
    } catch (err) {
      this.log.error(
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
      this.log.error(
        "No AWS config found, please configure a default AWS config."
      );
    }
  }

  private async requestRoleArn(RoleName: string) {
    const params = {
      RoleName,
    };

    try {
      const response = await this.awsProvider.request("IAM", "getRole", params);
      const {
        Role: { Arn },
      } = response;

      return Arn;
    } catch (e) {
      if (e.code && e.code === "AWS_I_A_M_GET_ROLE_NO_SUCH_ENTITY") {
        return null;
      } else {
        // some other error; attempting creation will fail
        this.log.warning(e);
        return false;
      }
    }
  }

  private async checkAwsIntegrationRole(externalId: string) {
    const { accountId } = this.config;
    if (!accountId) {
      this.log.error(
        "No New Relic Account ID specified; Cannot check for required NewRelicLambdaIntegrationRole."
      );
      return;
    }

    let roleArn = await this.requestRoleArn(
      `NewRelicLambdaIntegrationRole_${accountId}`
    );

    if (roleArn || roleArn === false) {
      return roleArn;
    }

    this.log.warning(
      `NewRelicLambdaIntegrationRole_${accountId} not found. Creating Stack with NewRelicLambdaIntegrationRole.`
    );
    const stackId = await this.createCFStack(accountId);
    waitForStatus(
      {
        awsMethod: "describeStacks",
        callbackMethod: () => this.enable(externalId),
        methodParams: {
          StackName: stackId,
        },
        statusPath: "Stacks[0].StackStatus",
      },
      this
    );
    try {
      roleArn = await this.requestRoleArn(
        `NewRelicLambdaIntegrationRole_${accountId}`
      );
    } catch (e) {
      this.log.error("Unable to create integration role", e);
    }
    return roleArn;
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
            ParameterValue: accountId.toString(),
          },
          { ParameterKey: "PolicyName", ParameterValue: customRolePolicy },
        ],
        StackName: stackName,
        TemplateBody: policy,
      };

      const { StackId } = await this.awsProvider.request(
        "CloudFormation",
        "createStack",
        params
      );
      return StackId;
    } catch (err) {
      this.log.error(
        `Something went wrong while creating NewRelicLambdaIntegrationRole: ${JSON.stringify(
          err
        )}`
      );
    }
  }

  public async addLogSubscriptions() {
    if (this.autoSubscriptionDisabled) {
      this.log.notice("Skipping adding log subscription. Explicitly disabled");
      return;
    }

    const funcs = this.functions;
    let { cloudWatchFilter = [...DEFAULT_FILTER_PATTERNS] } = this.config;

    let cloudWatchFilterString = "";
    if (
      typeof cloudWatchFilter === "object" &&
      cloudWatchFilter.indexOf("*") === -1
    ) {
      cloudWatchFilter = cloudWatchFilter.map((el) => `?\"${el}\"`);
      cloudWatchFilterString = cloudWatchFilter.join(" ");
    } else if (cloudWatchFilter.indexOf("*") === -1) {
      cloudWatchFilterString = String(cloudWatchFilter);
    }

    this.log.notice(`log filter: ${cloudWatchFilterString}`);

    const promises = [];

    for (const funcName of Object.keys(funcs)) {
      if (this.shouldSkipFunction(funcName)) {
        return;
      }

      this.log.notice(`Configuring New Relic log subscription for ${funcName}`);

      const funcDef = funcs[funcName];
      promises.push(
        this.ensureLogSubscription(funcDef.name, cloudWatchFilterString)
      );
    }

    await Promise.all(promises);

    if (this.extFellBackToCW) {
      this.log.notice(this.extFallbackMessage);
    }
  }

  public async removeLogSubscriptions() {
    if (this.autoSubscriptionDisabled) {
      this.log.notice(
        "Skipping removing log subscription. Explicitly disabled"
      );
      return;
    }
    const funcs = this.functions;
    const promises = [];

    for (const funcName of Object.keys(funcs)) {
      const { name } = funcs[funcName];
      this.log.notice(`Removing New Relic log subscription for ${funcName}`);
      promises.push(this.removeSubscriptionFilter(name));
    }

    await Promise.all(promises);
  }

  private async paginatedListFunctions(params, ingestionFnFilter) {
    const results = await this.awsProvider.request(
      "Lambda",
      "listFunctions",
      params
    );

    const existingIngestionFnResults =
      results?.Functions?.filter(ingestionFnFilter);
    if (
      results.NextMarker &&
      (!existingIngestionFnResults || existingIngestionFnResults.length === 0)
    ) {
      params.Marker = results.NextMarker;
      return this.paginatedListFunctions(params, ingestionFnFilter);
    }
    return existingIngestionFnResults;
  }

  public async getDestinationArn(logIngestionFunctionName: string) {
    const ingestionFnFilter = (fnData) =>
      fnData.FunctionName.match(logIngestionFunctionName);
    try {
      const result = await this.paginatedListFunctions(
        { MaxItems: 50 },
        ingestionFnFilter
      );
      return result[0]?.FunctionArn;
    } catch (e) {
      this.log.error(`Error getting ingestion function destination ARN.`);
      this.log.error(e);
    }
  }

  private async describeSubscriptionFilters(funcName: string) {
    return this.awsProvider
      .request("CloudWatchLogs", "describeSubscriptionFilters", {
        logGroupName: `/aws/lambda/${funcName}`,
      })
      .then((res) => res.subscriptionFilters);
  }

  private async addSubscriptionFilter(
    funcName: string,
    destinationArn: string,
    cloudWatchFilterString: string
  ) {
    return this.awsProvider
      .request("CloudWatchLogs", "putSubscriptionFilter", {
        destinationArn,
        filterName: "NewRelicLogStreaming",
        filterPattern: cloudWatchFilterString,
        logGroupName: `/aws/lambda/${funcName}`,
      })
      .catch((err) => {
        if (err.providerError) {
          this.log.error(err.providerError.message);
        }
      });
  }

  private removeSubscriptionFilter(funcName: string) {
    return this.awsProvider
      .request("CloudWatchLogs", "DeleteSubscriptionFilter", {
        filterName: "NewRelicLogStreaming",
        logGroupName: `/aws/lambda/${funcName}`,
      })
      .catch((err) => {
        if (err.providerError) {
          this.log.error(err.providerError.message);
        }
      });
  }

  private async ensureLogSubscription(
    funcName: string,
    cloudWatchFilterString: string
  ) {
    try {
      await this.awsProvider.request("Lambda", "getFunction", {
        FunctionName: funcName,
      });
    } catch (err) {
      if (err.providerError) {
        this.log.error(err.providerError.message);
      }
      return;
    }

    let destinationArn;

    const { logIngestionFunctionName = "newrelic-log-ingestion", apiKey } =
      this.config;

    try {
      destinationArn = await this.getDestinationArn(logIngestionFunctionName);
    } catch (err) {
      this.log.error(
        `Could not find a \`${logIngestionFunctionName}\` function installed.`
      );
      this.log.warning(
        "Details about setup requirements are available here: https://docs.newrelic.com/docs/serverless-function-monitoring/aws-lambda-monitoring/get-started/enable-new-relic-monitoring-aws-lambda#enable-process"
      );
      if (err.providerError) {
        this.log.error(err.providerError.message);
      }
      if (!apiKey) {
        this.log.error(
          "Unable to create newrelic-log-ingestion because New Relic API key not configured."
        );
        return;
      }

      this.log.notice(
        `creating required newrelic-log-ingestion function in region ${this.region}`
      );
      await this.addLogIngestionFunction();
      return;
    }

    let subscriptionFilters;

    try {
      subscriptionFilters = await this.describeSubscriptionFilters(funcName);
    } catch (err) {
      if (err.providerError) {
        this.log.error(err.providerError.message);
      }
      return;
    }

    const competingFilters = subscriptionFilters.filter(
      (filter) => filter.filterName !== "NewRelicLogStreaming"
    );

    if (competingFilters.length) {
      this.log.warning(
        "WARNING: Found a log subscription filter that was not installed by New Relic. This may prevent the New Relic log subscription filter from being installed. If you know you don't need this log subscription filter, you should first remove it and rerun this command. If your organization requires this log subscription filter, please contact New Relic at serverless@newrelic.com for assistance with getting the AWS log subscription filter limit increased."
      );
    }

    const existingFilters = subscriptionFilters.filter(
      (filter) => filter.filterName === "NewRelicLogStreaming"
    );

    if (existingFilters.length) {
      this.log.notice(
        `Found log subscription for ${funcName}, verifying configuration`
      );

      await Promise.all(
        existingFilters
          .filter((filter) => filter.filterPattern !== cloudWatchFilterString)
          .map(async (filter) => this.removeSubscriptionFilter(funcName))
          .map(async (filter) =>
            this.addSubscriptionFilter(
              funcName,
              destinationArn,
              cloudWatchFilterString
            )
          )
      );
    } else {
      this.log.notice(`Adding New Relic log subscription to ${funcName}`);

      await this.addSubscriptionFilter(
        funcName,
        destinationArn,
        cloudWatchFilterString
      );
    }
  }

  private async addLogIngestionFunction() {
    const templateUrl = await this.getSarTemplate();
    if (!templateUrl) {
      this.log.error(
        "Unable to create newRelic-log-ingestion without sar template."
      );
      return;
    }

    try {
      const mode = "CREATE";
      const stackName = "NewRelicLogIngestion";
      const changeSetName = `${stackName}-${mode}-${Date.now()}`;
      const parameters = await this.formatFunctionVariables();

      const params = {
        Capabilities: ["CAPABILITY_IAM"],
        ChangeSetName: changeSetName,
        ChangeSetType: mode,
        Parameters: parameters,
        StackName: stackName,
        TemplateURL: templateUrl,
      };

      let cfResponse;
      try {
        cfResponse = await this.awsProvider.request(
          "CloudFormation",
          "createChangeSet",
          params
        );
      } catch (e) {
        this.log.error(`Unable to get stack information.`);
        this.log.error(e);
      }
      const { Id, StackId } = cfResponse;

      this.log.notice(
        "Waiting for change set creation to complete, this may take a minute..."
      );

      await waitForStatus(
        {
          awsMethod: "describeChangeSet",
          callbackMethod: () => this.executeChangeSet(Id, StackId),
          methodParams: { ChangeSetName: Id },
          statusPath: "Status",
        },
        this
      );
    } catch (err) {
      this.log.warning(
        "Unable to create newrelic-log-ingestion function. Please verify that required environment variables have been set."
      );
    }
  }

  private async formatFunctionVariables() {
    const { logEnabled } = this.config;
    const licenseKey = this.licenseKey
      ? this.licenseKey
      : await this.retrieveLicenseKey();
    const loggingVar = logEnabled ? "True" : "False";

    return [
      {
        ParameterKey: "NRLoggingEnabled",
        ParameterValue: `${loggingVar}`,
      },
      {
        ParameterKey: "NRLicenseKey",
        ParameterValue: `${licenseKey}`,
      },
    ];
  }

  private async getSarTemplate() {
    try {
      const data = await this.awsProvider.request(
        "ServerlessApplicationRepository",
        "createCloudFormationTemplate",
        {
          ApplicationId:
            "arn:aws:serverlessrepo:us-east-1:463657938898:applications/NewRelic-log-ingestion",
        }
      );

      const { TemplateUrl } = data;
      return TemplateUrl;
    } catch (err) {
      this.log.error(
        `Something went wrong while fetching the sar template: ${err}`
      );
    }
  }

  private async executeChangeSet(changeSetName: string, stackId: string) {
    try {
      await this.awsProvider.request("CloudFormation", "executeChangeSet", {
        ChangeSetName: changeSetName,
      });
      this.log.notice(
        "Waiting for newrelic-log-ingestion install to complete, this may take a minute..."
      );

      await waitForStatus(
        {
          awsMethod: "describeStacks",
          callbackMethod: () => this.addLogSubscriptions(),
          methodParams: { StackName: stackId },
          statusPath: "Stacks[0].StackStatus",
        },
        this
      );
    } catch (changeSetErr) {
      this.log.error(
        `Something went wrong while executing the change set: ${changeSetErr}`
      );
    }
  }
}
