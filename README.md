# serverless-newrelic-lambda-layers

A [Serverless](https://serverless.com) plugin to add [New Relic](https://www.newrelic.com)
observability using [AWS Lambda Layers](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html) without requiring a code change.

## Requirements

- [serverless](https://github.com/serverless/serverless) >= 1.34.0
- Set up the [New Relic AWS Integration](https://docs.newrelic.com/docs/serverless-function-monitoring/aws-lambda-monitoring/get-started/enable-new-relic-monitoring-aws-lambda#enable-process) (only the `newrelic-lambda integrations install` step is required)

## Features

- Supports Node.js and Python runtimes (more runtimes to come)
- No code change required to enable New Relic
- Bundles New Relic's agent in a single layer
- Configures CloudWatch subscription filters automatically

## Install

With NPM:

```bash
npm install --save-dev serverless-newrelic-lambda-layers
```

With yarn:

```bash
yarn add --dev serverless-newrelic-lambda-layers
```

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-newrelic-lambda-layers
```

If you don't yet have a New Relic account, [sign up here](https://newrelic.com/products/serverless-aws-lambda).
Then set up the [New Relic AWS Integration](https://docs.newrelic.com/docs/serverless-function-monitoring/aws-lambda-monitoring/get-started/enable-new-relic-monitoring-aws-lambda#enable-process) (only the `set-up-lambda-integration` step is required).

Get your [New Relic Account ID](https://docs.newrelic.com/docs/accounts/install-new-relic/account-setup/account-id) and plug it into your `serverless.yml`:

```yaml
custom:
  newRelic:
    accountId: your-new-relic-account-id-here
```

Deploy:

```bash
sls deploy
```

And you're all set.

## Usage

This plugin wraps your handlers without requiring a code change. If you're currently
using a New Relic agent, you can remove the wrapping code you currently have and this plugin will
do it for you automatically.

- [Node.js Instrumentation Guide](https://docs.newrelic.com/docs/agents/nodejs-agent/getting-started/introduction-new-relic-nodejs#extend-instrumentation)
- [Python Instrumentation Guide](https://docs.newrelic.com/docs/agents/python-agent/custom-instrumentation/python-custom-instrumentation)

## Config

The following config options are available via the `newRelic` section of the `custom` section of your `serverless.yml`:

#### `accountId` (required)

Your [New Relic ACcount ID](https://docs.newrelic.com/docs/accounts/install-new-relic/account-setup/account-id).

```yaml
custom:
  newRelic:
    accountId: your-account-id-here
```

#### `trustedAccountKey` (optional)

Only required if your New Relic account is a sub-account. This needs to be the account ID for the root/parent account.

```yaml
custom:
  newRelic:
    accountId: your-sub-account-id
    trustedAccountKey: your-parent-account-id
```

#### `debug` (optional)

Whether or not to enable debug mode. Must be a boolean value. This sets the log level to
debug.

```yaml
custom:
  newRelic:
    debug: true
```

#### `logEnabled` (optional)

Enables logging. Defaults to `false`

#### `logLevel` (optional)

Sets a log level on all functions. Possible values: `'fatal'`, `'error'`, `'warn'`, `'info'`, `'debug'`, `'trace'` or `'silent'`. Defaults to `'error'`

You can still override log level on a per function basis by configuring environment variable `NEW_RELIC_LOG_LEVEL`.

```yaml
custom:
  newRelic:
    logLevel: debug
```

Logging configuration is considered in the following order:

1. function `NEW_RELIC_LOG_LEVEL` environment
2. provider `NEW_RELIC_LOG_LEVEL` environment
3. custom newRelic `logLevel` property
4. custom newRelic `debug` flag

#### `exclude` (optional)

An array of functions to exclude from automatic wrapping.

```yaml
custom:
  newRelic:
    exclude:
      - excluded-func-1
      - another-excluded-func
```

#### `layerArn` (optional)

Pin to a specific layer version. The latest layer ARN is automatically fetched from the [New Relic Layers API](https://nr-layers.iopipe.com)

```yaml
custom:
  newRelic:
    layerArn: arn:aws:lambda:us-east-1:451483290750:layer:NewRelicPython37:2
```

#### `cloudWatchFilter` (optional)

Provide a list of quoted filter terms for the CloudWatch log subscription to the newrelic-log-ingestion Lambda. Combines all terms into an OR filter. Defaults to "NR_LAMBDA_MONITORING" if not set. Use "\*" to capture all logs

```yaml
custom:
  newRelic:
    cloudWatchFilter:
      - "NR_LAMBDA_MONITORING"
      - "trace this"
      - "ERROR"
```

If you want to collect all logs:

```yaml
custom:
  newRelic:
    cloudWatchFilter: "*"
```

Be sure to set the `LOGGING_ENABLED` environment variable to `true` in your log
ingestion function. See the [aws-log-ingestion documentation](https://github.com/newrelic/aws-log-ingestion) for details.

#### `prepend` (optional)

Whether or not to prepend the IOpipe layer. Defaults to `false` which appends the layer.

```yaml
custom:
  newRelic:
    prepend: true
```

#### `logIngestionFunctionName` (optional)

Only required if your New Relic log ingestion function name is different from `newrelic-log-ingestion`.

```yaml
custom:
  newRelic:
    logIngestionFunctionName: log-ingestion-service
```

#### `disableAutoSubscription` (optional)

Only required if you want to disable auto subscription.

```yaml
custom:
  newRelic:
    disableAutoSubscription: true
```

## Supported Runtimes

This plugin currently supports the following AWS runtimes:

- nodejs8.10
- nodejs10.x
- nodejs12.x
- python2.7
- python3.6
- python3.7
- python3.8

## Contributing

### Testing

1. Make changes to `examples/nodejs/serverless.yml` based on what you are planning to test
2. Generate a test case by executing script `generate:test:case`

```shell
# Example
npm run generate:test:case
```

3. Rename generated file `tests/fixtures/example.service.input.json` to test case e.g. `tests/fixtures/log-level.service.input.json`
4. Create expected output file `tests/fixtures/example.service.output.json` for test case e.g. `tests/fixtures/log-level.service.output.json`
5. Run tests

```shell
# Example
npm run test
```
