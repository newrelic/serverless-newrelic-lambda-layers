// osls v4 removed provider.request() (the bundled AWS SDK v2 surface) and
// exposes provider.getAwsSdkV3Config() instead. This helper builds the
// matching AWS SDK v3 client when that is available, and otherwise falls back
// to provider.request(), so serverless v3/v4 keep their existing behavior.

// Loaded lazily so the SDK v3 clients are only required on the v3 path.
const services: {
  [service: string]: { load: () => any; clientName: string };
} = {
  CloudFormation: {
    clientName: "CloudFormationClient",
    load: () => require("@aws-sdk/client-cloudformation"),
  },
  CloudWatchLogs: {
    clientName: "CloudWatchLogsClient",
    load: () => require("@aws-sdk/client-cloudwatch-logs"),
  },
  IAM: {
    clientName: "IAMClient",
    load: () => require("@aws-sdk/client-iam"),
  },
  Lambda: {
    clientName: "LambdaClient",
    load: () => require("@aws-sdk/client-lambda"),
  },
  STS: {
    clientName: "STSClient",
    load: () => require("@aws-sdk/client-sts"),
  },
  ServerlessApplicationRepository: {
    clientName: "ServerlessApplicationRepositoryClient",
    load: () => require("@aws-sdk/client-serverlessapplicationrepository"),
  },
};

const clientCache = new WeakMap<
  object,
  Map<string, { sdk: any; client: Promise<any> }>
>();

const getClient = (awsProvider: any, service: string) => {
  let clients = clientCache.get(awsProvider);
  if (!clients) {
    clients = new Map();
    clientCache.set(awsProvider, clients);
  }
  if (!clients.has(service)) {
    const sdk = services[service].load();
    const Client = sdk[services[service].clientName];
    const client = Promise.resolve(awsProvider.getAwsSdkV3Config()).then(
      (config) => new Client(config)
    );
    clients.set(service, { sdk, client });
  }
  return clients.get(service);
};

// Mirrors the error shape of serverless/osls v3 provider.request()
// (`code: AWS_<SERVICE>_<METHOD>_<ERROR>` plus the original `providerError`),
// so existing callers that inspect either keep working.
const normalizeErrorCodePostfix = (name: string) =>
  name.replace(/(?<!^)([A-Z])/g, "_$1").toUpperCase();

const toProviderError = (service: string, method: string, err: any) => {
  const errorName = err && err.name ? String(err.name) : "";
  const postfix = errorName ? normalizeErrorCodePostfix(errorName) : "ERROR";
  return Object.assign(new Error(err && err.message), {
    code: `AWS_${normalizeErrorCodePostfix(
      service
    )}_${normalizeErrorCodePostfix(method)}_${postfix}`,
    providerError: err,
  });
};

export const awsRequest = async (
  awsProvider: any,
  service: string,
  method: string,
  params: any = {}
) => {
  if (typeof awsProvider.getAwsSdkV3Config !== "function") {
    return awsProvider.request(service, method, params);
  }

  if (!services[service]) {
    throw new Error(`Unsupported AWS service for SDK v3 request: ${service}`);
  }

  const { sdk, client } = getClient(awsProvider, service);
  const commandName = `${method.charAt(0).toUpperCase()}${method.slice(
    1
  )}Command`;
  const Command = sdk[commandName];
  if (!Command) {
    throw new Error(
      `Unsupported AWS method for SDK v3 request: ${service}.${method}`
    );
  }

  try {
    return await (await client).send(new Command(params));
  } catch (err) {
    throw toProviderError(service, method, err);
  }
};
