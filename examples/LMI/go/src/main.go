package main

import (
	"context"
	"encoding/json"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-lambda-go/lambdacontext"
	"github.com/newrelic/go-agent/v3/integrations/nrlambda"
	"github.com/newrelic/go-agent/v3/newrelic"
)

func handler(ctx context.Context, _ map[string]any) (map[string]any, error) {
	lc, _ := lambdacontext.FromContext(ctx)
	body, err := json.Marshal(map[string]string{
		"message":   "hello world",
		"runtime":   "go-provided.al2023",
		"requestId": lc.AwsRequestID,
	})
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"statusCode": 200,
		"body":       string(body),
	}, nil
}

func main() {
	app, err := newrelic.NewApplication(nrlambda.ConfigOption())
	if err != nil {
		lambda.Start(handler)
		return
	}
	nrlambda.Start(handler, app)
}
