import * as fs from "fs-extra";
import * as _ from "lodash";
import * as path from "path";

export const waitForStatus = async (
  requestParams: any,
  serverlessProps: any,
  retryCount: number = 0
) => {
  const { awsProvider, log } = serverlessProps;
  const { awsMethod, callbackMethod, methodParams, statusPath } = requestParams;

  try {
    const resourceStatus = await awsProvider.request(
      "CloudFormation",
      awsMethod,
      methodParams
    );
    const status = _.get(resourceStatus, statusPath);

    if (status.includes("FAILED") || retryCount > 120) {
      throw new Error();
    } else if (status === "CREATE_COMPLETE") {
      log("Resource successfully created.");
      callbackMethod();
      return;
    }

    setTimeout(
      () => waitForStatus(requestParams, serverlessProps, retryCount + 1),
      30000
    );
  } catch (stackErr) {
    log(`Something went wrong while creating aws resource: ${stackErr}`);
  }
};

export const fetchPolicy = async (templatePolicy: string) => {
  const policy = await fs.readFile(
    path.resolve(__dirname, "..", "templates", templatePolicy),
    "utf-8"
  );
  return policy;
};
