import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";
import * as request from "request";
import * as semver from "semver";
import * as Serverless from "serverless";
import * as util from "util";

export default class NewRelicLambdaLayerPlugin {
  public serverless: Serverless;
  public options: Serverless.Options;
  public awsProvider: any;
  public hooks: {
    [event: string]: Promise<any>;
  };

  constructor(serverless: Serverless, options: Serverless.Options) {
    this.serverless = serverless;
    this.options = options;
    this.awsProvider = this.serverless.getProvider("aws") as any;
    this.hooks = {
      "after:deploy:deploy": this.addLogSubscriptions.bind(this),
      "after:deploy:function:packageFunction": this.cleanup.bind(this),
      "after:package:createDeploymentArtifacts": this.cleanup.bind(this),
      "before:deploy:function:packageFunction": this.run.bind(this),
      "before:package:createDeploymentArtifacts": this.run.bind(this),
      "before:remove:remove": this.removeLogSubscriptions.bind(this)
    };
  }

  get config() {
    return _.get(this.serverless, "service.custom.newRelic", {});
  }

  get prependLayer() {
    return typeof this.config.prepend === "boolean" && this.config.prepend;
  }

  get autoSubscriptionDisabled() {
    return (
      typeof this.config.disableAutoSubscription === "boolean" &&
      this.config.disableAutoSubscription
    );
  }

  get functions() {
    return Object.assign.apply(
      null,
      this.serverless.service
        .getAllFunctions()
        .map(func => ({ [func]: this.serverless.service.getFunction(func) }))
    );
  }

  public async run() {
    const version = this.serverless.getVersion();
    if (semver.lt(version, "1.34.0")) {
      this.serverless.cli.log(
        `Serverless ${version} does not support layers. Please upgrade to >=1.34.0.`
      );
      return;
    }

    let plugins = _.get(this.serverless, "service.plugins", []);
    if (!_.isArray(plugins) && plugins.modules) {
      plugins = plugins.modules;
    }
    this.serverless.cli.log(`Plugins: ${JSON.stringify(plugins)}`);
    if (
      plugins.indexOf("serverless-webpack") >
      plugins.indexOf("serverless-newrelic-lambda-layers")
    ) {
      this.serverless.cli.log(
        "serverless-newrelic-lambda-layers plugin must come after serverless-webpack in serverless.yml; skipping."
      );
      return;
    }

    const funcs = this.functions;
    for (const funcName of Object.keys(funcs)) {
      const funcDef = funcs[funcName];
      await this.addLayer(funcName, funcDef);
    }
  }

  public cleanup() {
    this.removeNodeHelper();
  }

  public async addLogSubscriptions() {
    if (this.autoSubscriptionDisabled) {
      this.serverless.cli.log(
        "Skipping adding log subscription. Explicitly disabled"
      );
      return;
    }
    const funcs = this.functions;
    let { cloudWatchFilter = ["NR_LAMBDA_MONITORING"] } = this.config;

    let cloudWatchFilterString = "";
    if (
      typeof cloudWatchFilter === "object" &&
      cloudWatchFilter.indexOf("*") === -1
    ) {
      cloudWatchFilter = cloudWatchFilter.map(el => `?\"${el}\"`);
      cloudWatchFilterString = cloudWatchFilter.join(" ");
    } else if (cloudWatchFilter.indexOf("*") === -1) {
      cloudWatchFilterString = String(cloudWatchFilter);
    }

    this.serverless.cli.log(`log filter: ${cloudWatchFilterString}`);

    for (const funcName of Object.keys(funcs)) {
      const { exclude = [] } = this.config;
      if (_.isArray(exclude) && exclude.indexOf(funcName) !== -1) {
        return;
      }

      this.serverless.cli.log(
        `Configuring New Relic log subscription for ${funcName}`
      );

      const funcDef = funcs[funcName];
      await this.ensureLogSubscription(funcDef.name, cloudWatchFilterString);
    }
  }

  public async removeLogSubscriptions() {
    if (this.autoSubscriptionDisabled) {
      this.serverless.cli.log(
        "Skipping removing log subscription. Explicitly disabled"
      );
      return;
    }
    const funcs = this.functions;
    for (const funcName of Object.keys(funcs)) {
      const { name } = funcs[funcName];
      this.serverless.cli.log(
        `Removing New Relic log subscription for ${funcName}`
      );
      await this.removeSubscriptionFilter(name);
    }
  }

  private async addLayer(funcName: string, funcDef: any) {
    this.serverless.cli.log(`Adding NewRelic layer to ${funcName}`);

    const region = _.get(this.serverless.service, "provider.region");
    if (!region) {
      this.serverless.cli.log(
        "No AWS region specified for NewRelic layer; skipping."
      );
      return;
    }

    const {
      name,
      environment = {},
      handler,
      runtime = _.get(this.serverless.service, "provider.runtime"),
      layers = [],
      package: pkg = {}
    } = funcDef;

    if (!this.config.accountId && !environment.NEW_RELIC_ACCOUNT_ID) {
      this.serverless.cli.log(
        `No New Relic Account ID specified for "${funcName}"; skipping.`
      );
      return;
    }

    if (
      typeof runtime !== "string" ||
      [
        "nodejs10.x",
        "nodejs12.x",
        "nodejs8.10",
        "python2.7",
        "python3.6",
        "python3.7",
        "python3.8"
      ].indexOf(runtime) === -1
    ) {
      this.serverless.cli.log(
        `Unsupported runtime "${runtime}" for NewRelic layer; skipping.`
      );
      return;
    }

    const { exclude = [] } = this.config;
    if (_.isArray(exclude) && exclude.indexOf(funcName) !== -1) {
      this.serverless.cli.log(`Excluded function ${funcName}; skipping`);
      return;
    }

    const layerArn = this.config.layerArn
      ? this.config.layerArn
      : await this.getLayerArn(runtime, region);

    const newRelicLayers = layers.filter(
      layer => typeof layer === "string" && layer.match(layerArn)
    );

    if (newRelicLayers.length) {
      this.serverless.cli.log(
        `Function "${funcName}" already specifies an NewRelic layer; skipping.`
      );
    } else {
      if (this.prependLayer) {
        layers.unshift(layerArn);
      } else {
        layers.push(layerArn);
      }

      funcDef.layers = layers;
    }

    environment.NEW_RELIC_LAMBDA_HANDLER = handler;

    environment.NEW_RELIC_LOG = environment.NEW_RELIC_LOG
      ? environment.NEW_RELIC_LOG
      : "stdout";

    environment.NEW_RELIC_LOG_LEVEL = environment.NEW_RELIC_LOG_LEVEL
      ? environment.NEW_RELIC_LOG_LEVEL
      : this.config.debug
      ? "debug"
      : "info";

    environment.NEW_RELIC_NO_CONFIG_FILE = environment.NEW_RELIC_NO_CONFIG_FILE
      ? environment.NEW_RELIC_NO_CONFIG_FILE
      : "true";

    environment.NEW_RELIC_APP_NAME = environment.NEW_RELIC_APP_NAME
      ? environment.NEW_RELIC_APP_NAME
      : name || funcName;

    environment.NEW_RELIC_ACCOUNT_ID = environment.NEW_RELIC_ACCOUNT_ID
      ? environment.NEW_RELIC_ACCOUNT_ID
      : this.config.accountId;

    environment.NEW_RELIC_TRUSTED_ACCOUNT_KEY = environment.NEW_RELIC_TRUSTED_ACCOUNT_KEY
      ? environment.NEW_RELIC_TRUSTED_ACCOUNT_KEY
      : environment.NEW_RELIC_ACCOUNT_ID
      ? environment.NEW_RELIC_ACCOUNT_ID
      : this.config.trustedAccountKey;

    if (runtime.match("python")) {
      environment.NEW_RELIC_SERVERLESS_MODE_ENABLED = "true";
    }

    funcDef.environment = environment;
    funcDef.handler = this.getHandlerWrapper(runtime, handler);
    funcDef.package = this.updatePackageExcludes(runtime, pkg);
  }

  private async getLayerArn(runtime: string, region: string) {
    return util
      .promisify(request)(
        `https://${region}.nr-layers.iopipe.com/get-layers?CompatibleRuntime=${runtime}`
      )
      .then(response => {
        const awsResp = JSON.parse(response.body);
        return _.get(
          awsResp,
          "Layers[0].LatestMatchingVersion.LayerVersionArn"
        );
      });
  }

  private getHandlerWrapper(runtime: string, handler: string) {
    if (["nodejs10.x", "nodejs12.x"].indexOf(runtime) !== -1) {
      return "newrelic-lambda-wrapper.handler";
    }

    if (runtime === "nodejs8.10") {
      this.addNodeHelper();
      return "newrelic-wrapper-helper.handler";
    }

    if (runtime.match("python")) {
      return "newrelic_lambda_wrapper.handler";
    }

    return handler;
  }

  private addNodeHelper() {
    const helperPath = path.join(
      this.serverless.config.servicePath,
      "newrelic-wrapper-helper.js"
    );
    if (!fs.existsSync(helperPath)) {
      fs.writeFileSync(
        helperPath,
        "module.exports = require('newrelic-lambda-wrapper');"
      );
    }
  }

  private removeNodeHelper() {
    const helperPath = path.join(
      this.serverless.config.servicePath,
      "newrelic-wrapper-helper.js"
    );

    if (fs.existsSync(helperPath)) {
      fs.removeSync(helperPath);
    }
  }

  private updatePackageExcludes(runtime: string, pkg: any) {
    if (!runtime.match("nodejs")) {
      return pkg;
    }

    const { exclude = [] } = pkg;
    exclude.push("!newrelic-wrapper-helper.js");
    pkg.exclude = exclude;
    return pkg;
  }

  private async ensureLogSubscription(
    funcName: string,
    cloudWatchFilterString: string
  ) {
    try {
      await this.awsProvider.request("Lambda", "getFunction", {
        FunctionName: funcName
      });
    } catch (err) {
      if (err.providerError) {
        this.serverless.cli.log(err.providerError.message);
      }

      return;
    }

    let destinationArn;

    const { logIngestionFunctionName = "newrelic-log-ingestion" } = this.config;
    try {
      destinationArn = await this.getDestinationArn(logIngestionFunctionName);
    } catch (err) {
      this.serverless.cli.log(
        `Could not find a \`${logIngestionFunctionName}\` function installed.`
      );
      this.serverless.cli.log(
        "Please follow the setup instructions here: https://docs.newrelic.com/docs/serverless-function-monitoring/aws-lambda-monitoring/get-started/enable-new-relic-monitoring-aws-lambda#enable-process"
      );

      if (err.providerError) {
        this.serverless.cli.log(err.providerError.message);
      }

      return;
    }

    let subscriptionFilters;

    try {
      subscriptionFilters = await this.describeSubscriptionFilters(funcName);
    } catch (err) {
      if (err.providerError) {
        this.serverless.cli.log(err.providerError.message);
      }

      return;
    }

    const competingFilters = subscriptionFilters.filter(
      filter => filter.filterName !== "NewRelicLogStreaming"
    );

    if (competingFilters.length) {
      this.serverless.cli.log(
        "WARNING: Found a log subscription filter that was not installed by New Relic. This may prevent the New Relic log subscription filter from being installed. If you know you don't need this log subscription filter, you should first remove it and rerun this command. If your organization requires this log subscription filter, please contact New Relic at serverless@newrelic.com for assistance with getting the AWS log subscription filter limit increased."
      );
    }

    const existingFilters = subscriptionFilters.filter(
      filter => filter.filterName === "NewRelicLogStreaming"
    );

    if (existingFilters.length) {
      this.serverless.cli.log(
        `Found log subscription for ${funcName}, verifying configuration`
      );

      await Promise.all(
        existingFilters
          .filter(filter => filter.filterPattern !== cloudWatchFilterString)
          .map(async filter => this.removeSubscriptionFilter(funcName))
          .map(async filter =>
            this.addSubscriptionFilter(
              funcName,
              destinationArn,
              cloudWatchFilterString
            )
          )
      );
    } else {
      this.serverless.cli.log(
        `Adding New Relic log subscription to ${funcName}`
      );

      await this.addSubscriptionFilter(
        funcName,
        destinationArn,
        cloudWatchFilterString
      );
    }
  }

  private async getDestinationArn(logIngestionFunctionName: string) {
    return this.awsProvider
      .request("Lambda", "getFunction", {
        FunctionName: logIngestionFunctionName
      })
      .then(res => res.Configuration.FunctionArn);
  }

  private async describeSubscriptionFilters(funcName: string) {
    return this.awsProvider
      .request("CloudWatchLogs", "describeSubscriptionFilters", {
        logGroupName: `/aws/lambda/${funcName}`
      })
      .then(res => res.subscriptionFilters);
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
        logGroupName: `/aws/lambda/${funcName}`
      })
      .catch(err => {
        if (err.providerError) {
          this.serverless.cli.log(err.providerError.message);
        }
      });
  }

  private removeSubscriptionFilter(funcName: string) {
    return this.awsProvider
      .request("CloudWatchLogs", "DeleteSubscriptionFilter", {
        filterName: "NewRelicLogStreaming",
        logGroupName: `/aws/lambda/${funcName}`
      })
      .catch(err => {
        if (err.providerError) {
          this.serverless.cli.log(err.providerError.message);
        }
      });
  }
}

module.exports = NewRelicLambdaLayerPlugin;
