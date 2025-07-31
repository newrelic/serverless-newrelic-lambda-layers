const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  compose,
  split,
  head,
  nth,
  groupBy,
  map,
  reduce,
  omit,
} = require("ramda");
const { getInstalledPathSync } = require("get-installed-path");
const NewRelicLambdaLayerPlugin = require("../src/index");
const log = require("@serverless/utils/log");

const serverlessPath = getInstalledPathSync("serverless", { local: true });
const AwsProvider = require(`${serverlessPath}/lib/plugins/aws/provider`);
const CLI = require(`${serverlessPath}/lib/classes/cli`);
const Serverless = require(`${serverlessPath}/lib/serverless`);
const fixturesPath = path.resolve(__dirname, "fixtures");

const buildTestCases = () => {
  const testCaseFiles = fs.readdirSync(fixturesPath);
  const testCaseFileType = compose(nth(1), split("."));
  const testCaseContentsFromFiles = reduce((acc: object, fileName: string) => {
    const contents = JSON.parse(
      fs.readFileSync(path.resolve(fixturesPath, fileName))
    );
    const fileType = testCaseFileType(fileName);
    return { ...acc, [fileType]: contents };
  }, {});

  const testCaseFilesByName = groupBy(compose(head, split(".")))(testCaseFiles);
  return map((caseName: string) => {
    const testCaseContents = testCaseContentsFromFiles(
      testCaseFilesByName[caseName]
    );

    return { ...testCaseContents, caseName };
  }, Object.keys(testCaseFilesByName));
};

describe("NewRelicLambdaLayerPlugin", () => {
  const stage = "dev";
  // const commands = [{ lifecycleEvents: ['init', 'run'] }];
  const commands = [];
  const config = { commands, options: { stage }, log };

  describe("run", () => {
    buildTestCases().forEach(({ caseName, input, output }) => {
      it(`generates the correct service configuration: test case ${caseName}`, async () => {
        const serverless = new Serverless(config);
        Object.assign(serverless.service, input);
        serverless.cli = new CLI(serverless);
        serverless.config.servicePath = os.tmpdir();
        serverless.setProvider("aws", new AwsProvider(serverless, config));
        const plugin = new NewRelicLambdaLayerPlugin(serverless, config);

        // mock API-calling methods that would cause timeout...
        plugin.checkForSecretPolicy = jest.fn(() => {});
        plugin.regionPolicyValid = jest.fn(() => true);
        plugin.configureLicenseForExtension = jest.fn(() => {});

        try {
          await plugin.hooks["before:deploy:function:packageFunction"]();
        } catch (err) {}

        expect(
          omit(
            [
              "serverless",
              "package",
              "pluginsData",
              "resources",
              "serviceObject",
            ],
            serverless.service
          )
        ).toEqual(output);
      });
    });
  });
  describe("ingest key functionality", () => {
    it("should use ingest key as license key when provided", async () => {
      const serverless = new Serverless(config);
      Object.assign(serverless.service, {
        service: "test-service",
        custom: {
          newRelic: {
            ingestKey: "test-ingest-key",
            accountId: "12345"
          }
        },
        functions: {
          testFunction: {
            handler: "index.handler",
            runtime: "nodejs18.x"
          }
        }
      });
      serverless.cli = new CLI(serverless);
      serverless.config.servicePath = os.tmpdir();
      serverless.setProvider("aws", new AwsProvider(serverless, config));
      
      const plugin = new NewRelicLambdaLayerPlugin(serverless, config);
      plugin.checkForSecretPolicy = jest.fn(() => {});
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.retrieveLicenseKey = jest.fn(() => "fallback-license-key");

      await plugin.configureLicenseForExtension();

      expect(plugin.licenseKey).toBe("test-ingest-key");
      expect(plugin.retrieveLicenseKey).not.toHaveBeenCalled();
    });

    it("should fallback to retrieveLicenseKey when no ingest key provided", async () => {
      const serverless = new Serverless(config);
      Object.assign(serverless.service, {
        service: "test-service",
        custom: {
          newRelic: {
            accountId: "12345"
          }
        },
        functions: {
          testFunction: {
            handler: "index.handler",
            runtime: "nodejs18.x"
          }
        }
      });
      serverless.cli = new CLI(serverless);
      serverless.config.servicePath = os.tmpdir();
      serverless.setProvider("aws", new AwsProvider(serverless, config));
      
      const plugin = new NewRelicLambdaLayerPlugin(serverless, config);
      plugin.checkForSecretPolicy = jest.fn(() => {});
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.retrieveLicenseKey = jest.fn(() => "retrieved-license-key");

      await plugin.configureLicenseForExtension();

      expect(plugin.retrieveLicenseKey).toHaveBeenCalled();
      expect(plugin.licenseKey).toBe("retrieved-license-key");
    });
  });

  describe("API key validation", () => {
    it("should not error when ingestKey is provided but apiKey is missing", async () => {
      const serverless = new Serverless(config);
      Object.assign(serverless.service, {
        service: "test-service",
        custom: {
          newRelic: {
            ingestKey: "test-ingest-key",
            accountId: "12345"
          }
        },
        functions: {
          testFunction: {
            handler: "index.handler",
            runtime: "nodejs18.x"
          }
        }
      });
      serverless.cli = new CLI(serverless);
      serverless.config.servicePath = os.tmpdir();
      serverless.setProvider("aws", new AwsProvider(serverless, config));
      
      const plugin = new NewRelicLambdaLayerPlugin(serverless, config);
      plugin.checkForSecretPolicy = jest.fn(() => {});
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.configureLicenseForExtension = jest.fn(() => {});

      await expect(plugin.hooks["before:deploy:function:packageFunction"]()).resolves.not.toThrow();
    });

    it("should error when neither apiKey nor ingestKey is provided", async () => {
      const serverless = new Serverless(config);
      Object.assign(serverless.service, {
        service: "test-service",
        custom: {
          newRelic: {
            accountId: "12345"
          }
        },
        functions: {
          testFunction: {
            handler: "index.handler",
            runtime: "nodejs18.x"
          }
        }
      });
      serverless.cli = new CLI(serverless);
      serverless.config.servicePath = os.tmpdir();
      serverless.setProvider("aws", new AwsProvider(serverless, config));
      
      const plugin = new NewRelicLambdaLayerPlugin(serverless, config);
      plugin.checkForSecretPolicy = jest.fn(() => {});
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.configureLicenseForExtension = jest.fn(() => {});

      const logErrorSpy = jest.spyOn(plugin.log, 'error');

      await plugin.hooks["before:deploy:function:packageFunction"]();

      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Please use a valid New Relic API key")
      );
    });
  });

  describe("APM Lambda Mode", () => {
    it("should set NEW_RELIC_APM_LAMBDA_MODE when apm is true (boolean)", async () => {
      const serverless = new Serverless(config);
      Object.assign(serverless.service, {
        service: "test-service",
        custom: {
          newRelic: {
            apiKey: "test-api-key",
            accountId: "12345",
            apm: true
          }
        },
        functions: {
          testFunction: {
            handler: "index.handler",
            runtime: "nodejs18.x"
          }
        }
      });
      serverless.cli = new CLI(serverless);
      serverless.config.servicePath = os.tmpdir();
      serverless.setProvider("aws", new AwsProvider(serverless, config));
      
      const plugin = new NewRelicLambdaLayerPlugin(serverless, config);
      plugin.checkForSecretPolicy = jest.fn(() => {});
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.configureLicenseForExtension = jest.fn(() => {});

      await plugin.hooks["before:deploy:function:packageFunction"]();

      expect(serverless.service.functions.testFunction.environment?.NEW_RELIC_APM_LAMBDA_MODE).toBe("true");
    });

    it("should set NEW_RELIC_APM_LAMBDA_MODE when apm is 'true' (string)", async () => {
      const serverless = new Serverless(config);
      Object.assign(serverless.service, {
        service: "test-service",
        custom: {
          newRelic: {
            apiKey: "test-api-key",
            accountId: "12345",
            apm: "true"
          }
        },
        functions: {
          testFunction: {
            handler: "index.handler",
            runtime: "nodejs18.x"
          }
        }
      });
      serverless.cli = new CLI(serverless);
      serverless.config.servicePath = os.tmpdir();
      serverless.setProvider("aws", new AwsProvider(serverless, config));
      
      const plugin = new NewRelicLambdaLayerPlugin(serverless, config);
      plugin.checkForSecretPolicy = jest.fn(() => {});
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.configureLicenseForExtension = jest.fn(() => {});

      await plugin.hooks["before:deploy:function:packageFunction"]();

      expect(serverless.service.functions.testFunction.environment?.NEW_RELIC_APM_LAMBDA_MODE).toBe("true");
    });

    it("should not set NEW_RELIC_APM_LAMBDA_MODE when apm is false", async () => {
      const serverless = new Serverless(config);
      Object.assign(serverless.service, {
        service: "test-service",
        custom: {
          newRelic: {
            apiKey: "test-api-key",
            accountId: "12345",
            apm: false
          }
        },
        functions: {
          testFunction: {
            handler: "index.handler",
            runtime: "nodejs18.x"
          }
        }
      });
      serverless.cli = new CLI(serverless);
      serverless.config.servicePath = os.tmpdir();
      serverless.setProvider("aws", new AwsProvider(serverless, config));
      
      const plugin = new NewRelicLambdaLayerPlugin(serverless, config);
      plugin.checkForSecretPolicy = jest.fn(() => {});
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.configureLicenseForExtension = jest.fn(() => {});

      await plugin.hooks["before:deploy:function:packageFunction"]();

      expect(serverless.service.functions.testFunction.environment?.NEW_RELIC_APM_LAMBDA_MODE).toBeUndefined();
    });
  });
});