import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";

export const nerdgraphFetch = async (
  apiKey: string,
  region: string,
  query: string,
  proxy?: string,
  context?: any
) => {
  const gqlUrl =
    region === "eu"
      ? "https://api.eu.newrelic.com/graphql"
      : region === "staging"
      ? "https://staging-api.newrelic.com/graphql"
      : "https://api.newrelic.com/graphql";

  const agent =
    typeof proxy === "undefined" ? null : new HttpsProxyAgent(proxy);

  const res = await fetch(gqlUrl, {
    agent,
    body: JSON.stringify({ query }),
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
    },
    method: "POST",
  }).catch((e) => {
    context.log.error(`Error fetching from NerdGraph; ${context.caller}`);
    context.log.error(e);
    return null;
  });
  return res.json();
};

export const cloudLinkAccountMutation = (
  accountId: number,
  roleArn: string,
  linkedAccount: string
) => `
  mutation {
    cloudLinkAccount(accountId: ${accountId}, accounts: {aws: [{arn: "${roleArn}", name: "${linkedAccount}"}]}) {
      linkedAccounts {
        id
        name
      }
      errors {
          message
      }
    }
  }
`;

export const cloudServiceIntegrationMutation = (
  accountId: number,
  provider: string,
  service: string,
  linkedAccountId: number
) => `
  mutation {
    cloudConfigureIntegration (
      accountId: ${accountId},
      integrations: {${provider}: {${service}: {linkedAccountId: ${linkedAccountId}}}}
    ) {
      integrations {
        id
        name
        service {
          id
          name
        }
      }
      errors {
        linkedAccountId
        message
      }
    }
  }
`;

export const fetchLinkedAccounts = (accountId: number) => `
  query {
    actor {
      account(id: ${accountId}) {
        cloud {
          linkedAccounts {
            id
            name
            createdAt
            updatedAt
            authLabel
            externalId
            nrAccountId
          }
        }
      }
    }
  }
`;

export const fetchLicenseKey = (accountId: number) => `
  {
    actor {
      account(id: ${accountId}) {
        licenseKey
        name
        id
      }
    }
  }
`;
