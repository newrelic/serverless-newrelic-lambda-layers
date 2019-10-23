# serverless-newrelic-layers

A [Serverless](https://serverless.com) plugin to add [New Relic](https://www.newrelic.com)
observability using [AWS Lambda Layers](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html) without requiring a code change.

## Requirements

* serverless >= 1.34.0

## Features

* Supports Node.js and Python runtimes (more runtimes to come)
* No code change required to enable New Relic
* Bundles New Relic's agent in a single layer

## Install

With NPM:

```bash
npm install --save-dev serverless-newrelic-layers
```

With yarn:

```bash
yarn add --dev serverless-newrelic-layers
```

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-newrelic-layers
```

Get a [New Relic license key](https://dashboard.iopipe.com/install) and plug it into your `serverless.yml`:

```yaml
custom:
  newRelic:
      licenseKey: your-new-relic-license-key-here
```

Deploy and you're all set.

## Usage

This plugin wraps your handlers without requiring a code change. If you're currently
using a New Relic agent, you can remove the wrapping code you currently have and this plugin will
do it for you automatically.

## Config

The following config options are available via the `newRelic` section of the `custom` section of your `serverless.yml`:

#### `licenseKey` (required)

The New Relic license key to use.

#### `debug` (optional)

Whether or not to enable debug mode. Must be a boolean value.

```yaml
custom:
  newRelic:
    debug: true
```

#### `exclude` (optional)

An array of functions to exclude from automatic wrapping.

```yaml
custom:
  newRelic:
    exclude:
      - excluded-func-1
      - another-excluded-func
```

#### `layer_arn` (optional)

Pin to a specific layer version. The latest layer ARN is automatically fetched from the [New Relic Layers API](https://nrlayers.iopipe.com)

#### `prepend` (optional)

Whether or not to prepend the IOpipe layer. Defaults to `false` which appends the layer.

```yaml
custom:
  newRelic:
    prepend: true
```


## Supported Runtimes

This plugin currently supports the following AWS runtimes:

* nodejs8.10
* nodejs10.x
* python2.7
* python3.6
* python3.7
