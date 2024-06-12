### v5.2.1 (2024-06-12)

#### Miscellaneous chores

* removed add-to-board which adds issues/PRs to Node.js agent team github board ([#446](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/446)) ([8162697](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/8162697ae3f31214e8835b2613914f28d886039f))

#### Continuous integration

* Updated create release to pass in `build: true` ([#450](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/450)) ([4fd4ea3](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/4fd4ea31c248c68122a9d8e84f3e5a706d35e35c))

### v5.2.0 (2024-06-11)

#### Features

* Added python 3.12 ([#434](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/434)) ([a429cde](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/a429cde681122945d5d5008ef573236a31fac724))

#### Security improvements

* **deps:** bump tar from 6.1.13 to 6.2.1 ([#431](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/431)) ([92fa210](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/92fa210a1caac612979cb7fb34c4e78e5532c416))

#### Miscellaneous chores

* **ci:** Removed redundant publish.yml workflow ([#427](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/427)) ([b392bdc](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/b392bdcfc1e6160cc3e9dd374ad9aca764d20d52))

#### Tests

* **layer:** upgrade Lambda layer version in tests NR-278207 ([#442](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/442)) ([1b7a6f7](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/1b7a6f75fd69c8058c42367c8ceffaa978f0c038))
* Updated ARNs to contain latest layer versions ([#432](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/432)) ([8414422](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/8414422f70307397485860ab47e4149511e67042))

#### Continuous integration

* Removed `use_new_release` input from prepare release workflow ([#430](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/430)) ([e339d48](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/e339d4802b8779f1968c88c9b7c298d35ffc2aaf))
* removed changelog.json file ([#429](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/429)) ([924c798](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/924c798f800c67e5a5be14760df45e7c94d6068f))

### v5.1.0 (2024-03-26)

#### Bug fixes

* Added GitHub Actions workflows for validate (lint, test), and publish ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([99a396b](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/99a396bd02910d1b9db9956ef5866f73d3bd2ff3))

#### Miscellaneous chores

* Added pull_request trigger and uploading test coverage ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([c51fb96](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/c51fb96f695e8f7c07e807eab64aae9e885553cb))
* Added test coverage upload ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([4361a03](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/4361a030dd6dbd893a33538ed4491e804e34ff02))
* Added a workflow to add any new issues or prs to our GH engineering board ([#419](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/419)) ([bbe45c2](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/bbe45c2c241cbb221b54c7b520aac68731587499))
* Bumped version ([#407](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/407)) ([d66dedc](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/d66dedcf85e5f2d21a909e7ceeb21bcd5ca26781))
* **ci:** Added changelog.json to unblock release ([#423](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/423)) ([6fbc27b](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/6fbc27b6a7a08b37ef5fae04fd1c372a5a4a0323))
* **ci:** Automated release creation ([#421](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/421)) ([9a05e0b](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/9a05e0b4b7e28adb83c782ec2eceb639d168a8b0))
* **ci:** Reverted ci to GHA v3 ([#425](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/425)) ([757e07f](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/757e07f453da7433bcbc8eefa548b96b9d6e1b77))
* **deps-dev:** bump follow-redirects in /examples/python ([#413](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/413)) ([4cce79e](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/4cce79e3b9341ce903ae5cf1399779e49b116578))
    * Bumps [follow-redirects](https://github.com/follow-redirects/follow-redirects) from 1.15.4 to 1.15.6. - [Release notes](https://github.com/follow-redirects/follow-redirects/releases) - [Commits](https://github.com/follow-redirects/follow-redirects/compare/v1.15.4...v1.15.6)
* **deps:** bump es5-ext from 0.10.62 to 0.10.64 ([#407](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/407)) ([6984edc](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/6984edcc0b1c891fc1f0ec0c9daf259ab7cf843b))
    * Bumps [es5-ext](https://github.com/medikoo/es5-ext) from 0.10.62 to 0.10.64. - [Release notes](https://github.com/medikoo/es5-ext/releases) - [Changelog](https://github.com/medikoo/es5-ext/blob/main/CHANGELOG.md) - [Commits](https://github.com/medikoo/es5-ext/compare/v0.10.62...v0.10.64)
* Fixed test coverage upload ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([bde102b](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/bde102bad1f790fd38b509d3b758d5ee11719a90))
* Fixed test coverage upload ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([d80805f](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/d80805f3ad0780ea341d3b2bb573987608cf9fa0))
* Removed .npmrc-ci ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([1a75756](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/1a757565e54c795fba49e7ce20fa3f984895fac3))
* Removed CircleCI jobs, in favor of GitHub Actions ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([7439422](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/743942285af51a0749f867e671573421b990a550))
* Removed verbose for codecov ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([9dd7d9a](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/9dd7d9a903655854798f08c6f952dce13fd5ca58))
* Tweaked GHA job names ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([cd546d4](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/cd546d4d9aa4cebd11c6ec899708f2cdbd92faf6))
* Updated follow-redirects ([#418](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/418)) ([f633a93](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/f633a933ce8a6b164129d3286c3f95958bf9ccdb))
* Updated test fixtures ([#412](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/412)) ([92e1cf0](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/92e1cf0d8ea6908097b95d64dbf6a879cbfcb42f))
* Updated test fixtures ([#407](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/407)) ([b5fce25](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/b5fce25df9004b5207f39c9fd9d09a4bd8eb7972))
* Whitespace added to trigger CI ([#407](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/407)) ([216fedf](https://github.com/newrelic/serverless-newrelic-lambda-layers/commit/216fedfa5674635d2647496ee7d88bae05608004))

### v5.0.1 (2024-02-13)

#### Bug fixes
* Updated check for existing `newrelic-log-ingestion` script to handle variable suffix.

### v5.0.0 (2024-01-19)

#### ⚠ BREAKING CHANGES

* Dropped support for deployment of Node 14 Lambda functions.

### v4.3.0 (2023-12-04)

#### Features
* Added support for Lambda functions using Node 20 runtime.

#### Miscellaneous chores
* Updated dependencies

### v4.2.0 (2023-10-30)

#### Features
* Added support for Java 17 layer (thank you to @michjacobs!)

#### Miscellaneous chores
* Updated dependencies

### v4.1.0 (2023-09-05)

#### Features
* Added manualWrapping flag to skip wrapper helper, but still instrument functions with the latest layer-installed agent.

#### Bug fixes
* fix: Updated integration to iterate over paginated ListPolicies results

### v4.0.0 (2023-08-28)

#### ⚠ BREAKING CHANGES
* Dropped support for Node 12 and Python 3.6

#### Features
* Added support for Python 3.11

#### Bug fixes
* Handle when null account values are returned from NR API (thank you, @sethawright !)
* Fix boolean test for enableExtensionLogs (thank you @nr-swilloughby !)

### v3.5.0 (2023-05-31)

#### Features
* Added support for Python 3.10

### v3.4.3 (2023-01-24)

#### Miscellaneous chores
* Updated dependencies

### v3.4.0 (2022-12-02)

#### Features
* Added support for Node 18. Thank you @Engerim !

### v3.3.7 (2022-11-02)

#### Code refactoring
* Merge layers instead of overriding them when the serverless.yml has layers defined in provider or global as well as in specific functions. Thank you to @alexmchardy for the PR!

#### Miscellaneous chores
* Added codecov to measure test coverage. Thank you to @jmartin4563 !

### v3.3.6 (2022-10-27)

#### Miscellaneous chores
* Updated dependencies
* Changed peer dependency versions to use the ^ specifier instead of ~. Thanks to @wrumsby for pointing it out, and @ran-j for submitting a PR to fix.

### v3.3.5 (2022-07-14)

#### Miscellaneous chores
This release updates the ReadMe to emphasize that this plugin should be last in the plugins section of the serverless.yml. Thank you to @sebastianmarines for pinpointing this as a cause of Node 16 functions being unable to find the NR handler.

### v3.3.3 (2022-06-22)

#### Miscellaneous chores
* Corrected serverless.yml in the Java example

### v3.3.2 (2022-06-16)

#### Miscellaneous chores
* Set stderr log output for Python agent
* Updated newrelic-log-ingestion script stack name to comply with the CLI.

### v3.3.1 (2022-06-06)

#### Bug fixes
* Restored the NEW_RELIC_LOG_ENABLED env var when logEnabled is set in serverless.yml.

### v3.3.0 (0222-05-31)

#### Features
* Added support for Node 16

### v3.2.0 (2022-05-06)

#### Features
* Added support for provider layers. (Thank you to @Shereef for the contribution!)

#### Miscellaneous chores
* Moved project dependencies to peer dependencies

### v3.1.1 (2022-04-13)

#### Features
* Added Fallback logging for developers running Serverless 2.x, or running 3.x in environments that don't have local Serverless 3.x.

### v3.1.0 (2022-04-06)

#### Features
* Added support for `enableExtensionLogs` boolean

#### Bug fixes
* Improved support for logging in v3
* Handling error state when deploying account is unable to list policies
* Ensuring that API polling integration is created when enableIntegration is set to true

#### Miscellaneous chores
* Dependency updates 

### v3.0.0 (2022-02-25)

#### ⚠ BREAKING CHANGES
* Added support for Serverless 3.x.

### v2.4.1 (2022-02-22)

#### Miscellaneous chores
* Updated dependencies
* This is the last 2.x.x release.

### v.2.4.0 (2022-01-25)

#### Miscellaneous chores
* Updated dependencies

### v2.2.2 (2022-01-21)

#### Miscellaneous chores
* Changed the conditions under which the plugin NOOPs. If the serverless.yml specifies an architecture that doesn't yet have a compatible layer, the plugin skips integration. Similarly, the plugin skips if no API key is specified.

* Updated dependencies:
  * Removed a dependency on the deprecated request package (thank you to @Engerim !)
  * Updated log4j version references in Java examples.

### v2.2.1 (2021-11-30)

#### Bug fixes
* Changed how the plugin detects NR-AWS integration. If any integration exists, the plugin skips creating any integration, and so avoids creating a polling integration when there's a current streaming integration. The integration code still requests specific integration names from AWS, but that's a backstop which happens after a request to NerdGraph.

### v2.2.0 (2021-11-11)

#### Features
* Added support for Lambda ARM64/Graviton2 architecture.

#### Miscellaneous chores
* Updated serverless to 2.66, and Jest to 27
* Removed Node 10 from example serverless.yml

### v2.1.4 (2021-09-15)

#### Miscellaneous chores
* Updated Serverless to 2.59.0

### v2.1.3 (2021-09-15)

#### Bug fixes
* Fixed trusted account key handling 

#### Miscellaneous chores
* Added logging
* updated test fixtures

### v2.1.1 (2021-09-02)

#### Miscellaneous chores
* Updated Serverless to 2.57.0
* Updated CI/CD image to Node 10

### v2.1.0 (2021-09-01)

#### Features
Added support for Python 3.9

#### ⚠ BREAKING CHANGES
Removed support for Node 8

### v1.1.8 (2021-07-09)

#### Features
* Added 'proxy' option in order to allow this plugin to work behind an HTTP proxy #144 (thanks @CalMlynarczyk)

### v1.1.7 (2021-06-09)

#### Miscellaneous chores
* Updated dependencies

### V1.1.6 (2021-04-29)

#### Features
* Added support for java layer

### v1.1.5 (2021-03-05)

#### Features
* Added disableLicenseKeySecret flag

### v1.1.4 (2021-02-18)

#### Features
* Added support for Node 14
* New Relic Distributed Tracing can be enabled in the custom.newRelic block of the serverless.yml by setting enableDistributedTracing to true

### v1.1.2 (2021-02-01)

#### Bug fixes
* Fix for string accountId values not matching number value returned by integration validation.

### v.1.1.1 (2021-01-29)

#### Bug fixes
* Corrected constructor in handling fallback to default region. (Thank you, @vishalraghav94!)

### v1.1.0 (2021-01-27)

#### Bug fixes
* corrected CloudFormation template for automatic creation of the appropriate managed secret in AWS, and corresponding access policy, attached to the function execution role
* more obvious messaging if the New Relic License Key can't be retrieved from New Relic

#### Miscellaneous chores
* updates to the serverless module

### v1.0.0 (2021-01-19)

#### Features
* Added deployment to non-US regions from US-based NR accounts
* Added automatic creation and attachment of access policy for authenticating the NR Extension instead of log subscription/ingest (unless the extension is explicitly not enabled)

#### Miscellaneous chores
* Updated Serverless and Jest

### v0.4.1 (2020-12-17)

#### Miscellaneous chores
* Bumped package.json version for release pipeline

### v0.4.0 (2020-12-17)

#### Features
* Added support for log ingestion via New Relic Lambda Extension. 
* Added option for extension to be disabled via serverless.yml config

#### Miscellaneous chores
* Updated dependencies

### v0.3.0 (2020-11-13)

#### Features
* Added support for the New Relic Lambda Extension ([#81](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/81))

### v0.2.5 (2020-09-23)

#### Bug fixes
* Fix to include templates in NPM package ([#76](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/76))
* Fix request handling of JSON response ([#77](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/77))

### v0.2.4 (2020-09-22)

#### Bug fixes
* Fix undefined error in integration module ([#74](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/74))

### v0.2.3 (2020-09-14)

#### Bug fixes
* Fixed missing fetch dependency error ([#72](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/72))

### v0.2.2 (2020-09-11)

#### Bug fixes
* Fixed an integration check binding bug ([#70](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/70))

### v0.2.1 (2020-09-11)

#### Bug fixes
* Fixed a reference error for getCallerIdentity ([#69](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/69))

### v0.2.0 (2020-09-08)

#### Features
* Added installation of the New Relic Lambda integration and log ingestion function ([#61](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/61))

#### ⚠ BREAKING CHANGES
* Some functionality now requires the newRelic.apiKey to be set

### v0.1.2.0 (2020-08-21)

#### Code refactoring
* Moved plugin skipping to constructor (thanks @karopolopoulos) ([#60](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/60))

### v0.1.19 (2020-08-19)

#### Features
* Added config option to specify stages for layer deployment (thanks @karopolopoulos) ([#56](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/56))

### v0.1.18 (2020-04-29)

#### Features
* Updated the New Relic Layers API to layers.newrelic-external.com, deprecating nr-layers.iopipe.com

### v0.1.17 (2020-03-17)

#### Code refactoring
* Optimized async HTTP requests the plugin makes during instrumentation ([#49](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/49))

### v0.1.16 (2020-03-04)

### Features
* Added RequestId log filter pattern

### v0.1.15 (2020-03-02)

#### Features
* Added include configuration for wrapping functions 
* Added tslint-on-commit

#### Miscellaneous chores
* Updated ReadMe

### v0.1.14 (2020-02-24)

#### Miscellaneous chores
* Addressed tslint complaints

### v0.1.13 (2020-02-24)
#### Features
* Added customizable log level

#### Miscellaneous chores
* Added jest test

### v0.1.12 (2020-02-07)

#### Bug fixes
Updated the log filter subscription pattern so that the filter string is only wrapped once, and passes pattern validation.

### v0.1.11 (2020-02-05)

#### Features
* Updated the log subscription pattern to capture timeouts ([#37](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/37))

### v0.1.10 (2020-01-02)

#### Features
* Added warning if competing log subscription filter detected ([#33](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/33))

### v0.1.9 (2019-12-17)

#### Features
* Added ability to disable auto subscription
* Added log ingestion function parameterization

#### Code refactoring
* Replaced forEach with for ... of. Thank you to @kamaz !

### v0.1.8 (2019-12-11)

#### Bug fixes
* Fixed forEach async bug [#24](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/24) (thanks @kamaz)

### v0.1.7 (2019-11-26)

#### Miscellaneous chores
* Forced new version to keep package.json in sync with release.
* Merged pull request #22 from iopipe/issue/20-need-new-tags-for-ci

### v0.1.6 (2019-11-26)

#### Miscellaneous chores
* Bumped plugin version

### v0.1.5 (2019-11-25)

#### Code refactoring
* Corrected the plugin name reference in ordering check.

### v0.1.4 (2019-11-25)
#### Features
* Added python3.8 Runtime Support [#16](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/16)

### v0.1.3 (2019-11-19)
#### Features
* Added cloudWatchFilter option to customize the CloudWatch Log Filter [#11](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/11) (thanks @justinrcs)
* Added support for the nodejs12.x runtime [#12](https://github.com/newrelic/serverless-newrelic-lambda-layers/pull/12)

### v0.1.2 (2019-11-5)
#### Miscellaneous chores
* Bumped version to pass CircleCI builds


### v0.1.1 (2019-11-05)
#### Miscellaneous chores
Fixed typo

### v0.1.0 (2019-11-01)
#### Bug fixes
* Fix Circle CI config typo
