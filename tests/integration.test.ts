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
const policiesFixture = require("./paginatedPoliciesList.json");
const functionsFixture = require("./paginatedFunctionsList.json");

const setRequestEnv = (service, method) => {
  let fixture = policiesFixture
  if (service === 'Lambda' || method === 'listFunctions') {
    fixture = functionsFixture
  }
  return { fixture }
}

const returnPaginatedAwsRequest = (service, method, params) => {
  const { fixture } = setRequestEnv(service, method)
  if (!params.Marker) {
    return fixture.paginated.first;
  }
  return fixture.paginated[params.Marker];
};
const returnPaginatedNoMatchAwsRequest = (service, method, params) => {
  const { fixture } = setRequestEnv(service, method)
  if (!params.Marker) {
    return fixture.paginatedNoMatch.first;
  }
  return fixture.paginatedNoMatch[params.Marker];
};
const returnNonPaginatedAwsRequest = (service, method, params) => {
  const { fixture } = setRequestEnv(service, method)
  return fixture.nonPaginated;
};
const returnNonPaginatedNoMatchAwsRequest = (service, method, params) => {
  const { fixture } = setRequestEnv(service, method)
  return fixture.nonPaginatedNoMatch;
};

describe("Integration functions", () => {
  const stage = "dev";
  const commands = [];
  const config = { commands, options: { stage }, log };

  const serverless = new Serverless(config);

  serverless.setProvider("aws", new AwsProvider(serverless, config));
  const awsProvider = serverless.getProvider("aws");

  const pluginMock = {
    config,
    awsProvider: {},
    serverless,
    region: "us-east-1",
    licenseKey: "nr-license-key",
    log: logShim,
  };

  describe("checkForManagedSecretPolicy makes a ListPolicies request", () => {
    it("correctly finds match in multiple pages of results", async () => {
      awsProvider.request = jest.fn(returnPaginatedAwsRequest);
      pluginMock.awsProvider = { ...awsProvider };
      const slsIntegration = new Integration(pluginMock);
      const existingPolicy = await slsIntegration.checkForManagedSecretPolicy();
      expect(existingPolicy).toBeDefined();
      expect(existingPolicy).toHaveProperty([
        "currentRegionPolicy",
        0,
        "PolicyName",
      ]);
      expect(existingPolicy.currentRegionPolicy[0].PolicyName).toEqual(
          policiesFixture.paginated.fourth.Policies[0].PolicyName
      );
      expect(existingPolicy.secretExists).toBeTruthy();
    });
    it("correctly finds match in non-paginated results", async () => {
      awsProvider.request = jest.fn(returnNonPaginatedAwsRequest);
      pluginMock.awsProvider = { ...awsProvider };
      const slsIntegration = new Integration(pluginMock);
      const existingPolicy = await slsIntegration.checkForManagedSecretPolicy();
      expect(existingPolicy).toBeDefined();
      expect(existingPolicy).toHaveProperty([
        "currentRegionPolicy",
        0,
        "PolicyName",
      ]);
      expect(existingPolicy.currentRegionPolicy[0].PolicyName).toEqual(
          policiesFixture.paginated.fourth.Policies[0].PolicyName
      );
      expect(existingPolicy.secretExists).toBeTruthy();
    });
    it("correctly handles paginated results with no match", async () => {
      awsProvider.request = jest.fn(returnPaginatedNoMatchAwsRequest);
      pluginMock.awsProvider = { ...awsProvider };
      const slsIntegration = new Integration(pluginMock);
      const existingPolicy = await slsIntegration.checkForManagedSecretPolicy();
      expect(existingPolicy).toBeDefined();
      expect(existingPolicy).toHaveProperty("currentRegionPolicy");
      expect(existingPolicy.currentRegionPolicy).toHaveLength(0);
      expect(existingPolicy.secretExists).toBeFalsy();
    });
    it("correctly handles non-paginated results with no match", async () => {
      awsProvider.request = jest.fn(returnNonPaginatedNoMatchAwsRequest);
      pluginMock.awsProvider = { ...awsProvider };
      const slsIntegration = new Integration(pluginMock);
      const existingPolicy = await slsIntegration.checkForManagedSecretPolicy();
      expect(existingPolicy).toBeDefined();
      expect(existingPolicy).toHaveProperty("currentRegionPolicy");
      expect(existingPolicy.currentRegionPolicy).toHaveLength(0);
      expect(existingPolicy.secretExists).toBeFalsy();
    });
  });
  describe("search for existing log ingestion function", () => {
    it("correctly finds match in multiple pages of results", async () => {
      awsProvider.request = jest.fn(returnPaginatedAwsRequest);
      pluginMock.awsProvider = { ...awsProvider };
      const slsIntegration = new Integration(pluginMock);
      const existingIngestScript = await slsIntegration.getDestinationArn('newrelic-log-ingestion');
      expect(existingIngestScript).toBeDefined();
      expect(existingIngestScript).toEqual(
          functionsFixture.paginated.fourth.Functions[0].FunctionArn
      );
    });
    it("correctly finds match in non-paginated results", async () => {
      awsProvider.request = jest.fn(returnNonPaginatedAwsRequest);
      pluginMock.awsProvider = { ...awsProvider };
      const slsIntegration = new Integration(pluginMock);
      const existingIngestScript = await slsIntegration.getDestinationArn('newrelic-log-ingestion');
      expect(existingIngestScript).toBeDefined();
      expect(existingIngestScript).toEqual(
          functionsFixture.paginated.fourth.Functions[0].FunctionArn
      );
    });
    it("correctly handles paginated results with no match", async () => {
      awsProvider.request = jest.fn(returnPaginatedNoMatchAwsRequest);
      pluginMock.awsProvider = { ...awsProvider };
      const slsIntegration = new Integration(pluginMock);
      const existingIngestScript = await slsIntegration.getDestinationArn('newrelic-log-ingestion');
      expect(existingIngestScript).toBeFalsy();
    });
    it("correctly handles non-paginated results with no match", async () => {
      awsProvider.request = jest.fn(returnNonPaginatedNoMatchAwsRequest);
      pluginMock.awsProvider = { ...awsProvider };
      const slsIntegration = new Integration(pluginMock);
      const existingIngestScript = await slsIntegration.getDestinationArn('newrelic-log-ingestion');
      expect(existingIngestScript).toBeFalsy();
    });
  });
});
