import * as fs from "fs-extra";
import * as path from "path";
import * as util from "util";

import * as _ from "lodash";
import * as request from "request";
import * as semver from "semver";
import * as Serverless from "serverless";

const layerArns = {
  "nodejs8.10": "arn:aws:lambda:us-east-1:554407330061:layer:MainlandLayer:9",
  "nodejs10.x": "arn:aws:lambda:us-east-1:554407330061:layer:MainlandLayer:9"
};

export default class MainlandLayerPlugin {
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
    this.serverless.cli.log('getting config')
    return _.get(this.serverless, "service.custom.mainland", {});
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
this.serverless.cli.log('in plugin run')
    if (semver.lt(version, "1.34.0")) {
      this.serverless.cli.log(
        `Serverless ${version} does not support layers. Please upgrade to >=1.34.0.`
      );
      return;
    }

    const plugins = _.get(this.serverless, "service.plugins", []);

    this.serverless.cli.log(`Plugins: ${JSON.stringify(plugins)}`);

    if (
      plugins.indexOf("serverless-webpack") > plugins.indexOf("mainland-layer")
    ) {
      this.serverless.cli.log(
        "mainland-layers plugin must come after serverless-webpack in serverless.yml; skipping."
      );
      return;
    }

    const funcs = this.functions;
this.serverless.cli.log(`in plugin! functions!, ${JSON.stringify(funcs)}`)
    Object.keys(funcs).forEach(async funcName => {
      const funcDef = funcs[funcName];
      this.serverless.cli.log(`KEYS ${funcName}`)
      await this.addLayer(funcName, funcDef);
    });
  }

  public cleanup() {
    this.removeNodeHelper();
  }

  private async addLayer(funcName: string, funcDef: any) {
    this.serverless.cli.log(`Adding Mainland layer to ${funcName}`);

    const region = _.get(this.serverless.service, "provider.region");
    if (!region) {
      this.serverless.cli.log(
        "No AWS region specified for Mainland layer; skipping."
      );
      return;
    }
    this.serverless.cli.log(`PLUGIN funcdef, ${JSON.stringify(funcDef)}`);
    const {
      environment = {},
      handler,
      runtime = _.get(this.serverless.service, "provider.runtime"),
      layers = [],
      package: pkg = {}
    } = funcDef;

    // should be able to operate without requiring env vars/tokens
    if (
      typeof runtime !== "string" ||
      [
        "nodejs12.x",
        "nodejs10.x",
        "nodejs6.10",
        "nodejs8.10",
        "python2.7",
        "python3.6",
        "python3.7"
      ].indexOf(runtime) === -1
    ) {
      this.serverless.cli.log(
        `Unsupported runtime "${runtime}" for Mainland layer; skipping.`
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
this.serverless.cli.log(`LAYER ARN ${layerArn}`);
    const mainlandLayers = layers.filter(
      layer => typeof layer === "string" && layer.match(layerArn)
    );

    if (mainlandLayers.length) {
      this.serverless.cli.log(
        `Function "${funcName}" already specifies an Mainland layer; skipping.`
      );
    } else {
      if (typeof this.config.prepend === "boolean" && this.config.prepend) {
        layers.unshift(layerArn);
      } else {
        layers.push(layerArn);
      }
      funcDef.layers = layers;
    }

    environment.MAINLAND_HANDLER = handler;
    environment.MAINLAND_DEBUG =
      typeof environment.MAINLAND_DEBUG !== "undefined"
        ? environment.MAINLAND_DEBUG
        : this.config.debug || false;
    funcDef.environment = environment;

    this.serverless.cli.log(`getwrap? ${this.getHandlerWrapper(runtime, handler)}`)
//Serverless: getwrap? /opt/nodejs/node_modules/newrelic/handler.wrapper
    //funcDef.handler = this.getHandlerWrapper(runtime, handler);
    funcDef.handler = handler; // avoiding rewrapping?
    funcDef.package = this.updatePackageExcludes(runtime, pkg);
  }

  private async getLayerArn(runtime: string, region: string) {
    if (!layerArns[runtime]) {
      return false;
    }
    return layerArns[runtime];
    // return util
    //   .promisify(request)(
    //     `https://${region}.layers.iopipe.com/get-layers?CompatibleRuntime=${runtime}`
    //   )
    //   .then(response => {
    //     const awsResp = JSON.parse(response.body);
    //     return _.get(
    //       awsResp,
    //       "Layers[0].LatestMatchingVersion.LayerVersionArn"
    //     );
    //   });
  }

  private getHandlerWrapper(runtime: string, handler: string) {

    // return handler?
    return handler

    if (
      ["nodejs6.10", "nodejs8.10"].indexOf(runtime) !== -1 ||
      (runtime === "nodejs10.x" &&
        _.get(this.serverless, "enterpriseEnabled", false)) ||
      (runtime === "nodejs12.x" &&
        _.get(this.serverless, "enterpriseEnabled", false))
    ) {
      // this.addNodeHelper();
      this.serverless.cli.log(`gethandlerwrapper 6/8 ${runtime}, ${handler}`)
      return "newrelic/handler.wrapper";
    }

    if (runtime === "nodejs10.x" || runtime === "nodejs12.x") {
      this.serverless.cli.log(`gethandlerwrapper 10/12 ${runtime}, ${handler}`)

      return "/opt/nodejs/node_modules/newrelic/handler.wrapper";
    }

    if (runtime.match("python")) {
      return "newrelic.handler.wrapper";
    }

    return handler;
  }

  private addNodeHelper() {
    const helperPath = path.join(
      this.serverless.config.servicePath,
      "newrelic/handler.js"
    );
    if (!fs.existsSync(helperPath)) {
      fs.writeFileSync(helperPath, "module.exports = require('newrelic');");
    }
  }

  private removeNodeHelper() {
    const helperPath = path.join(
      this.serverless.config.servicePath,
        "newrelic/handler.js"
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
    exclude.push("!newrelic/handler.js");
    pkg.exclude = exclude;

    return pkg;
  }
}

module.exports = MainlandLayerPlugin;
