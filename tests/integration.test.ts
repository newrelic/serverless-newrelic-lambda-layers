export {};
const log = { error: console.error, warning: console.warn, notice: console.log };
const Integration = require("../src/integration").default;

class MockService {
  service: string = "mock-service";
  provider: any = { name: "aws", region: "us-east-1" };
  functions: Record<string, any> = {};
  custom: any = {};
  plugins: any[] = [];
  getAllFunctions() { return Object.keys(this.functions || {}); }
  getFunction(name: string) { return (this.functions || {})[name]; }
}
class MockServerless {
  service: MockService = new MockService();
  cli: any = null;
  config: any = { servicePath: "/tmp" };
  private _providers: Record<string, any> = {};
  constructor(_config?: any) {}
  setProvider(name: string, provider: any) { this._providers[name] = provider; }
  getProvider(name: string) { return this._providers[name]; }
  getVersion() { return "3.0.0"; }
}
class MockAwsProvider {
  serverless: any;
  options: any;
  request: (...args: any[]) => any;
  constructor(serverless: any, options?: any) {
    this.serverless = serverless;
    this.options = options || {};
    this.request = () => Promise.resolve({});
  }
}
const Serverless = MockServerless;
const AwsProvider = MockAwsProvider;

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
const returnNonPaginatedAwsRequest = (service, method) => {
  const { fixture } = setRequestEnv(service, method)
  return fixture.nonPaginated;
};
const returnNonPaginatedNoMatchAwsRequest = (service, method) => {
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
