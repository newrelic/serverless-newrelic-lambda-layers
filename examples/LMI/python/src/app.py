import json
import os
import boto3

s3 = boto3.client("s3")
ddb = boto3.client("dynamodb")
lambda_client = boto3.client("lambda")

BUCKET = os.environ["TEST_BUCKET_NAME"]
TABLE = os.environ["TEST_TABLE_NAME"]
ECHO_FN = os.environ["ECHO_FUNCTION_NAME"]


def lambda_handler(event, context):
    req_id = context.aws_request_id

    s3.put_object(
        Bucket=BUCKET,
        Key=f"python/{req_id}.json",
        Body=json.dumps({"runtime": "python3.12", "requestId": req_id}),
        ContentType="application/json",
    )

    ddb.put_item(
        TableName=TABLE,
        Item={
            "requestId": {"S": req_id},
            "runtime": {"S": "python3.12"},
            "event": {"S": json.dumps(event)[:1024]},
        },
    )

    echo_resp = lambda_client.invoke(
        FunctionName=ECHO_FN,
        InvocationType="RequestResponse",
        Payload=json.dumps({"source": "python", "requestId": req_id}),
    )
    echo_payload = json.loads(echo_resp["Payload"].read())

    return {
        "statusCode": 200,
        "body": json.dumps(
            {
                "runtime": "python3.12",
                "requestId": req_id,
                "s3Key": f"python/{req_id}.json",
                "echoResponse": echo_payload,
            }
        ),
    }
