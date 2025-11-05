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
describe("slim layer selection", () => {
    it("selects slim layer when slim=true and both slim & full exist", async () => {
      const stage = "dev";
      const commands: any[] = [];
      const config = { commands, options: { stage }, log };

      const serverless = new Serverless(config);
      Object.assign(serverless.service, {
        service: "test-service",
        plugins: ["serverless-newrelic-lambda-layers"],
        provider: { name: "aws", region: "us-east-1", architecture: "arm64" },
        custom: {
          newRelic: {
            apiKey: "test-api-key",
            accountId: "12345",
            slim: true,
            logLevel: "debug"
          }
        },
        functions: {
          slimFunc: {
            handler: "handler.handler",
            runtime: "nodejs20.x",
            package: { exclude: ["./**"], include: ["handler.js"] }
          }
        }
      });

      serverless.cli = new CLI(serverless);
      serverless.config.servicePath = os.tmpdir();
      serverless.setProvider("aws", new AwsProvider(serverless, config));
      const plugin = new NewRelicLambdaLayerPlugin(serverless, config);

      plugin.checkForSecretPolicy = jest.fn();
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.configureLicenseForExtension = jest.fn();

      const fullArn = "arn:aws:lambda:us-east-1:451483290750:layer:NewRelicNodeJS20X:999";
      const slimArn = "arn:aws:lambda:us-east-1:451483290750:layer:NewRelicNodeJS20X-slim:7";

      const noticeSpy = jest.spyOn(plugin.log, "notice");

      // Provide proper shape expected by getLayerArn (Layers -> LatestMatchingVersion)
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          Layers: [
            {
              LatestMatchingVersion: {
                LayerVersionArn: fullArn,
                CompatibleRuntimes: ["nodejs20.x"],
                CompatibleArchitectures: ["arm64"],
              },
            },
            {
              LatestMatchingVersion: {
                LayerVersionArn: slimArn,
                CompatibleRuntimes: ["nodejs20.x"],
                CompatibleArchitectures: ["arm64"],
              },
            },
          ],
        }),
      });

      await plugin.hooks["before:deploy:function:packageFunction"]();
      const chosenLayer =
        serverless.service.functions.slimFunc.layers?.[0] ||
        serverless.service.provider.layers?.[0];

      expect(chosenLayer).toBeDefined();
      expect(chosenLayer).toMatch(/NewRelicNodeJS20X.*-slim:/);
      expect(serverless.service.functions.slimFunc.handler).toBe("newrelic-lambda-wrapper.handler");
      expect(serverless.service.functions.slimFunc.environment.NEW_RELIC_LAMBDA_HANDLER).toBe("handler.handler");
      expect(
        noticeSpy.mock.calls.some(c =>
          /Using slim layer: arn:aws:lambda:[^:]+:\d+:layer:NewRelicNodeJS20X.*-slim:\d+/.test(String(c[0]))
        )
      ).toBe(true);

      // cleanup
      // @ts-ignore
      delete (global as any).fetch;
    });
  });

  // Focused retry coverage test (no changes to src/index.ts)
  describe("getLayerArn retry catch coverage", () => {
    it("fires warning and retries after first fetch failure", async () => {
      // We must mock the node-fetch module itself because src/index.ts captures its import locally.
      jest.resetModules();

      const fetchMock: any = jest.fn()
        .mockRejectedValueOnce(new Error("synthetic failure"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Layers: [
              {
                LatestMatchingVersion: {
                  LayerVersionArn: "arn:aws:lambda:us-east-1:451483290750:layer:NewRelicNodeJS20X:901",
                  CompatibleArchitectures: ["x86_64"],
                },
              },
            ],
          }),
        });

      // Mock node-fetch before re-requiring plugin
      jest.doMock("node-fetch", () => ({ __esModule: true, default: fetchMock }));

      const stage = "dev";
      const retryConfig = { options: { stage }, log };
      // Minimal fake serverless instance sufficient for getLayerArn
      const fakeServerless: any = {
        getVersion: () => "3.0.0",
        getProvider: () => ({}),
        service: {
          service: "retry-catch-test",
          custom: { newRelic: { accountId: "12345", apiKey: "abc" } },
          provider: { name: "aws", region: "us-east-1", runtime: "nodejs20.x" },
          functions: { tempFn: { handler: "handler.handler", runtime: "nodejs20.x" } },
          getAllFunctions: () => ["tempFn"],
          getFunction: (name: string) => fakeServerless.service.functions[name],
        },
      };
      const Plugin = require("../src/index");
      const plugin = new Plugin(fakeServerless, retryConfig);
      plugin.checkForSecretPolicy = jest.fn();
      plugin.regionPolicyValid = jest.fn(() => true);
      plugin.configureLicenseForExtension = jest.fn();

      const warnSpy = jest.spyOn(plugin.log, "warning");

      jest.useFakeTimers();
      const arnPromise = (plugin as any).getLayerArn("nodejs20.x");
      // Allow promise chain to enter catch and schedule retry timeout
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      const arn = await arnPromise;
      jest.useRealTimers();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledWith(
        "New Relic layers API request failed, retrying in 1 second..."
      );
      expect(arn).toBe(
        "arn:aws:lambda:us-east-1:451483290750:layer:NewRelicNodeJS20X:901"
      );

      // Cleanup mocks so other tests are unaffected
      jest.dontMock("node-fetch");
    });
  });