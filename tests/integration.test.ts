const { getInstalledPathSync } = require("get-installed-path");
const log = require("@serverless/utils/log");

const serverlessPath = getInstalledPathSync("serverless", { local: true });
const AwsProvider = require(`${serverlessPath}/lib/plugins/aws/provider`);
const Serverless = require(`${serverlessPath}/lib/serverless`);
const Integration = require("../src/integration").default;

const logShim = {
    error: console.error, // tslint:disable-line
    warning: console.log, // tslint:disable-line
    notice: console.log, // tslint:disable-line
};

// for simulating AWS ListPolicies, just one per page in this test
const paginatedResults = require("./paginatedResults.json");

const returnPaginatedAwsRequest = (service, method, params) => {
  if (!params.Marker) {
    return paginatedResults.first;
  }
  return paginatedResults[params.Marker];
};

describe("Integration functions", () => {
  const stage = "dev";
  const commands = [];
  const config = { commands, options: { stage }, log };

  const serverless = new Serverless(config);

  serverless.setProvider("aws", new AwsProvider(serverless, config));
  const awsProvider = serverless.getProvider("aws");
  awsProvider.request = jest.fn(returnPaginatedAwsRequest);

  const pluginMock = {
    config,
    awsProvider,
    serverless,
    region: "us-east-1",
    licenseKey: "nr-license-key",
    log: logShim,
  };

  const slsIntegration = new Integration(pluginMock);

  describe("checkForManagedSecretPolicy makes a ListPolicies request", () => {
    it("makes a ListPolicies request, iterating through multiple pages of results", async () => {
      const existingPolicy = await slsIntegration.checkForManagedSecretPolicy();
      expect(existingPolicy).toBeDefined();
      expect(existingPolicy).toHaveProperty([
        "currentRegionPolicy",
        0,
        "PolicyName",
      ]);
      expect(existingPolicy.currentRegionPolicy[0].PolicyName).toEqual(
        paginatedResults.fourth.Policies[0].PolicyName
      );
      expect(existingPolicy.secretExists).toBeTruthy();
    });
  });
});
