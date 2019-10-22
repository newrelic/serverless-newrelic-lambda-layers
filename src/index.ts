import * as fs from "fs-extra";
import * as path from "path";
import * as util from "util";

import * as _ from "lodash";
import * as request from "request";
import * as semver from "semver";
import * as Serverless from "serverless";

// shim for testing when we don't have layer-arn server yet
const layerArns = {
  "nodejs10.x": "arn:aws:lambda:us-east-1:554407330061:layer:MainlandLayer:9",
  "nodejs8.10": "arn:aws:lambda:us-east-1:554407330061:layer:MainlandLayer:9"
};

export default class NewRelicLayerPlugin {
  public serverless: Serverless;
  public options: Serverless.Options;
  public hooks: {
    [event: string]: Promise<any>;
  };

  constructor(serverless: Serverless, options: Serverless.Options) {
    this.serverless = serverless;
    this.options = options;
    this.hooks = {
      "after:deploy:function:packageFunction": this.cleanup.bind(this),
      "after:package:createDeploymentArtifacts": this.cleanup.bind(this),
      "before:deploy:function:packageFunction": this.run.bind(this),
      "before:package:createDeploymentArtifacts": this.run.bind(this)
    };
  }

  get config() {
    return _.get(this.serverless, "service.custom.newRelic", {});
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

    const plugins = _.get(this.serverless, "service.plugins", []);
    this.serverless.cli.log(`Plugins: ${JSON.stringify(plugins)}`);
    if (
      plugins.indexOf("serverless-webpack") >
      plugins.indexOf("serverless-newrelic-layers")
    ) {
      this.serverless.cli.log(
        "serverless-newrelic-layers plugin must come after serverless-webpack in serverless.yml; skipping."
      );
      return;
    }

    const funcs = this.functions;
    Object.keys(funcs).forEach(async funcName => {
      const funcDef = funcs[funcName];
      await this.addLayer(funcName, funcDef);
    });
  }

  public cleanup() {
    // any artifacts can be removed here
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
      environment = {},
      handler,
      runtime = _.get(this.serverless.service, "provider.runtime"),
      layers = [],
      package: pkg = {}
    } = funcDef;

    if (!this.config.licenseKey && !environment.NEW_RELIC_LICENSE_KEY) {
      this.serverless.cli.log(
        `No New Relic license key specified for "${funcName}"; skipping.`
      );
      return;
    }

    if (
      typeof runtime !== "string" ||
      [
        "nodejs12.x",
        "nodejs10.x",
        "nodejs8.10",
        "python2.7",
        "python3.6",
        "python3.7"
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

    const layerArn = this.config.layer_arn
      ? this.config.layer_arn
      : await this.getLayerArn(runtime, region);

    const newRelicLayers = layers.filter(
      layer => typeof layer === "string" && layer.match(layerArn)
    );

    if (newRelicLayers.length) {
      this.serverless.cli.log(
        `Function "${funcName}" already specifies an NewRelic layer; skipping.`
      );
    } else {
      if (typeof this.config.prepend === "boolean" && this.config.prepend) {
        layers.unshift(layerArn);
      } else {
        layers.push(layerArn);
      }

      funcDef.layers = layers;
    }

    environment.NEWRELIC_HANDLER = handler;
    environment.NEW_RELIC_LOG_LEVEL = environment.NEW_RELIC_LOG_LEVEL
      ? environment.NEW_RELIC_LOG_LEVEL
      : this.config.debug
      ? "debug"
      : "info";
    environment.NEW_RELIC_LICENSE_KEY = environment.NEW_RELIC_LICENSE_KEY
      ? environment.NEW_RELIC_LICENSE_KEY
      : this.config.licenseKey;
    funcDef.environment = environment;

    funcDef.handler = this.getHandlerWrapper(runtime, handler);
    funcDef.package = this.updatePackageExcludes(runtime, pkg);
  }

  private async getLayerArn(runtime: string, region: string) {
    return util
      .promisify(request)(
        `https://${region}.nrlayers.iopipe.com/get-layers?CompatibleRuntime=${runtime}`
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
    if (
      runtime === "nodejs8.10" ||
      (runtime === "nodejs10.x" &&
        _.get(this.serverless, "enterpriseEnabled", false))
    ) {
      this.addNodeHelper();
      return "newrelic-lambda-wrapper-helper.handler";
    }

    if (runtime === "nodejs10.x") {
      return "/opt/nodejs/node_modules/newrelic-lambda-wrapper.handler";
    }

    if (runtime.match("python")) {
      return "newrelic_lambda_wrapper.handler";
    }

    return handler;
  }

  get nodeHlperPath() {
    return path.join(
      this.serverless.config.servicePath,
      "newrelic-lambda-wrapper-helper.js"
    );
  }

  private addNodeHelper() {
    if (!fs.existsSync(this.nodeHelperPath)) {
      fs.writeFileSync(
        this.nodeHelperPath,
        "module.exports = require('newrelic-lambda-wrapper');"
      );
    }
  }

  private removeNodeHelper() {
    if (fs.existsSync(this.nodeHelperPath)) {
      fs.removeSync(this.nodeHelperPath);
    }
  }

  private updatePackageExcludes(runtime: string, pkg: any) {
    if (!runtime.match("nodejs")) {
      return pkg;
    }

    const { exclude = [] } = pkg;
    exclude.push("!newrelic-lambda-wrapper-helper.js");
    pkg.exclude = exclude;
    return pkg;
  }
}

module.exports = NewRelicLayerPlugin;
