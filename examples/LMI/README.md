# LMI Examples (Serverless Framework)

Deployable examples showing how to run a New Relic-instrumented Lambda function on
**Lambda Managed Instances (LMI)** — AWS's Lambda compute type that runs your function
on EC2 instances you control (instance type, VPC placement, EC2 Savings Plans/Reserved
Instances), while AWS still manages scaling, patching, and routing for you — deployed
via the Serverless Framework and this plugin.

> Looking for SAM/CloudFormation examples instead? See
> [`examples/LMI`](https://github.com/newrelic/newrelic-lambda-extension-rust/tree/main/examples/LMI)
> in the `newrelic-lambda-extension-rust` repo.

Two things make LMI different from standard Lambda, and both matter for how these
examples are wired up:

- **No standalone "Lambda function" resource.** A function only becomes invocable once
  it's attached to a **capacity provider** — the EC2 instances your function actually
  runs on. Every example here creates its own capacity provider alongside the function.
- **Multi-concurrency.** One execution environment can run several invocations at the
  same time (standard Lambda runs exactly one invocation per environment). This is why
  New Relic's Node.js Lambda wrapper enables the agent's `worker_threads` instrumentation
  automatically when it detects LMI — without it, concurrent invocations on the same
  environment can hang. No action needed on your part; just make sure your Node.js layer
  is recent enough to include the fix (anything published after
  [newrelic/newrelic-lambda-layers#540](https://github.com/newrelic/newrelic-lambda-layers/pull/540)).

**LMI always runs in APM mode** — there is no serverless-telemetry-mode option on LMI.
The plugin configures this automatically for these examples; you don't need to set
`NEW_RELIC_APM_LAMBDA_MODE` yourself if you're using `custom.newRelic` as shown below,
though the examples set it explicitly for clarity.

Five runtimes are covered — `python`, `nodejs`, `java`, `dotnet`, `go`. Ruby is not
included: AWS currently rejects Lambda Managed Instances deploys for the Ruby runtime
with an explicit runtime-not-supported error — this is an AWS platform limitation, not
something these examples can work around. A `ruby` example will be added once AWS adds
support.

## Before you deploy — prerequisites

You'll need, once, regardless of which runtime you pick:

1. **A VPC with subnets and a security group** the capacity provider's EC2 instances
   will launch into. These need outbound internet access (a NAT gateway, or a public
   subnet) — the instances must reach both the AWS Lambda control plane and New Relic's
   collector endpoints. If they can't, the extension will connect to the Telemetry API
   fine (it's local) but nothing ever reaches New Relic.

2. **An IAM role for the capacity provider** that AWS Lambda assumes to manage the EC2
   instances on your behalf. Create it once:

   ```bash
   aws iam create-role \
     --role-name LambdaCapacityProviderOperatorRole \
     --assume-role-policy-document '{
       "Version": "2012-10-17",
       "Statement": [{
         "Effect": "Allow",
         "Principal": { "Service": "lambda.amazonaws.com" },
         "Action": "sts:AssumeRole"
       }]
     }'

   aws iam attach-role-policy \
     --role-name LambdaCapacityProviderOperatorRole \
     --policy-arn arn:aws:iam::aws:policy/AWSLambdaManagedEC2ResourceOperator
   ```

   That single AWS-managed policy (`AWSLambdaManagedEC2ResourceOperator`) is all the
   role needs — no inline policies required. Grab the resulting role ARN for the deploy
   commands below.

3. **A New Relic account ID and license key** (the ingest license key, not a User key).

4. **The `serverless-newrelic-lambda-layers` plugin**, at a version that supports LMI.
   Each example's `package.json` already declares it — just run `npm install` inside the
   runtime directory you're deploying.

5. Extension version `2.7.0` or later — the first version with LMI support at all. The
   plugin attaches the layer automatically, so you don't need to look up the ARN
   yourself; just make sure the plugin version you install is recent enough.

## Deploying

Configuration comes from environment variables:

| Env var | Required | Notes |
|---|---|---|
| `NEW_RELIC_ACCOUNT_ID` | Yes | |
| `NEW_RELIC_LICENSE_KEY` | Yes | |
| `CAPACITY_PROVIDER_OPERATOR_ROLE_ARN` | Yes | |
| `CAPACITY_PROVIDER_SUBNET_IDS` | Yes | Comma-separated |
| `CAPACITY_PROVIDER_SECURITY_GROUP_IDS` | Yes | Comma-separated |
| `CAPACITY_PROVIDER_MAX_VCPU_COUNT` | No | Default `48` — see note below |
| `CAPACITY_PROVIDER_PER_ENV_MAX_CONCURRENCY` | No | Default `8` |

```bash
cd nodejs   # or python, java, dotnet, go
npm install

export NEW_RELIC_ACCOUNT_ID=<your-account-id>
export NEW_RELIC_LICENSE_KEY=<your-license-key>
export CAPACITY_PROVIDER_OPERATOR_ROLE_ARN=<role-arn-from-prereqs>
export CAPACITY_PROVIDER_SUBNET_IDS=<subnet-1>,<subnet-2>
export CAPACITY_PROVIDER_SECURITY_GROUP_IDS=<sg-1>

sls deploy --region <region> --capacityProviderName <name>
```

`--region`/`AWS_REGION` and `--capacityProviderName` are optional (default `dev` stage,
region from your AWS CLI config, capacity provider name `lmi-example-cp`).

`CAPACITY_PROVIDER_MAX_VCPU_COUNT` defaults to `48` because AWS enforces an undocumented,
account/region-dependent minimum beyond the documented floor of `2` — lower values were
rejected in testing as "below the recommended minimum." `48` is a value verified to
work, not a documented AWS minimum.

The `java`, `dotnet`, and `go` examples keep your handler pointed directly at your own
code — for `java` specifically, that means **not** `com.newrelic.java.HandlerWrapper`
(that class is for standard/non-LMI Lambda only). LMI runs in APM mode, and the Java
agent attaches via `AWS_LAMBDA_EXEC_WRAPPER=/opt/newrelic-java-handler` instead of
replacing the handler — already set in `java/serverless.yml`.

By default, the plugin auto-wraps your handler for Python/Node.js/Ruby (rewriting it to
point at the New Relic wrapper). Set `manualWrapping: true` under `custom.newRelic` if
you'd rather wrap it yourself.

## Verifying the deployment (read this before you invoke)

**Editing a function's configuration doesn't reach its running capacity — publishing a
version does.** LMI capacity is bound to a specific *published* function version. If you
change environment variables, layers, or anything else on `$LATEST` after the initial
deploy, those changes sit as unpublished drift until you explicitly publish:

```bash
aws lambda publish-version --function-name <function-name>
aws lambda invoke --function-name <function-name> --qualifier <version-number> \
  --payload '{}' out.json && cat out.json
```

Invoking without `--qualifier` (i.e. `$LATEST`) after any post-deploy edit will silently
run the *old* published version, not your latest change — this looks identical to your
change simply "not working."

A couple of other things you'll observe that are expected, not errors:
- `aws lambda get-function` may report `State: ActiveNonInvocable` right after deploy or
  a config update — this clears once the capacity provider finishes provisioning
  instances; it isn't itself an invocation failure.
- The first invocation after publishing a version can trigger AWS launching up to three
  fresh execution environments in parallel (AZ resiliency) before marking the version
  active — expect a short delay on the very first call.

## Cleanup

Capacity provider EC2 instances are billable for as long as they exist, independent of
whether you're invoking the function. Tear down when you're done:

```bash
cd nodejs   # or python, java, dotnet, go
sls remove
```

Removing the service also deletes the capacity provider, which terminates its
underlying EC2 instances — there's no separate manual EC2 cleanup step.
