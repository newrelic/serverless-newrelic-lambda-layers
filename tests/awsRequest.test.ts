import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { IAMClient, NoSuchEntityException } from "@aws-sdk/client-iam";
import { awsRequest } from "../src/awsRequest";

const v3Provider = () => ({
  getAwsSdkV3Config: jest.fn(async () => ({
    credentials: { accessKeyId: "a", secretAccessKey: "b" },
    region: "us-east-1",
  })),
  request: jest.fn(() => {
    throw new Error("provider.request() is no longer available");
  }),
});

describe("awsRequest", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses an AWS SDK v3 client when getAwsSdkV3Config is available", async () => {
    const send = jest
      .spyOn(CloudFormationClient.prototype, "send")
      .mockResolvedValue({ StackId: "stack-id" } as never);
    const provider = v3Provider();

    const result = await awsRequest(provider, "CloudFormation", "createStack", {
      StackName: "NewRelicLicenseKeySecret",
    });

    expect(result).toEqual({ StackId: "stack-id" });
    expect(provider.request).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    const command: any = send.mock.calls[0][0];
    expect(command.constructor.name).toBe("CreateStackCommand");
    expect(command.input).toEqual({ StackName: "NewRelicLicenseKeySecret" });
  });

  it("reuses the client per provider and service", async () => {
    jest.spyOn(IAMClient.prototype, "send").mockResolvedValue({} as never);
    const provider = v3Provider();

    await awsRequest(provider, "IAM", "listPolicies", { Scope: "Local" });
    await awsRequest(provider, "IAM", "listPolicies", { Scope: "Local" });

    expect(provider.getAwsSdkV3Config).toHaveBeenCalledTimes(1);
  });

  it("maps capitalized method names to commands", async () => {
    const send = jest.fn().mockResolvedValue({});
    const { CloudWatchLogsClient } = require("@aws-sdk/client-cloudwatch-logs");
    jest.spyOn(CloudWatchLogsClient.prototype, "send").mockImplementation(send);

    await awsRequest(
      v3Provider(),
      "CloudWatchLogs",
      "DeleteSubscriptionFilter",
      { filterName: "NewRelicLogStreaming", logGroupName: "/aws/lambda/fn" }
    );

    expect(send.mock.calls[0][0].constructor.name).toBe(
      "DeleteSubscriptionFilterCommand"
    );
  });

  it("wraps SDK v3 errors in the provider.request() error shape", async () => {
    const original = new NoSuchEntityException({
      $metadata: {},
      message: "The role cannot be found.",
    });
    jest
      .spyOn(IAMClient.prototype, "send")
      .mockRejectedValue(original as never);

    await expect(
      awsRequest(v3Provider(), "IAM", "getRole", { RoleName: "missing" })
    ).rejects.toMatchObject({
      code: "AWS_I_A_M_GET_ROLE_NO_SUCH_ENTITY_EXCEPTION",
      message: "The role cannot be found.",
      providerError: original,
    });
  });

  it("falls back to provider.request() without getAwsSdkV3Config", async () => {
    const provider = { request: jest.fn().mockResolvedValue({ Account: "1" }) };

    const result = await awsRequest(provider, "STS", "getCallerIdentity", {});

    expect(result).toEqual({ Account: "1" });
    expect(provider.request).toHaveBeenCalledWith(
      "STS",
      "getCallerIdentity",
      {}
    );
  });

  it("rejects unsupported services and methods", async () => {
    await expect(
      awsRequest(v3Provider(), "S3", "listBuckets", {})
    ).rejects.toThrow("Unsupported AWS service for SDK v3 request: S3");
    await expect(
      awsRequest(v3Provider(), "STS", "doesNotExist", {})
    ).rejects.toThrow(
      "Unsupported AWS method for SDK v3 request: STS.doesNotExist"
    );
  });
});
