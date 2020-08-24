export const nerdgraphFetch = async (
  newRelicApiKey: string,
  region: string,
  query: string
) => {
  const gqlUrl = region.includes("eu")
    ? "https://api.eu.newrelic.com/graphql"
    : "https://api.newrelic.com/graphql";

  const res = await fetch(gqlUrl, {
    body: JSON.stringify({ query }),
    headers: {
      "API-Key": newRelicApiKey,
      "Content-Type": "application/json"
    },
    method: "POST"
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
