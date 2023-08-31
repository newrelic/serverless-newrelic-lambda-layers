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
});
