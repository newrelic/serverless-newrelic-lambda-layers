using System.Text;
using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using Amazon.Lambda;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using Amazon.Lambda.Model;
using Amazon.Lambda.Serialization.SystemTextJson;
using Amazon.Lambda.SQSEvents;
using Amazon.S3;
using Amazon.S3.Model;

[assembly: LambdaSerializer(typeof(DefaultLambdaJsonSerializer))]

namespace LmiTest;

public class Function
{
    private static readonly AmazonS3Client S3 = new();
    private static readonly AmazonDynamoDBClient Ddb = new();
    private static readonly AmazonLambdaClient LambdaClient = new();

    private static readonly string Bucket  = System.Environment.GetEnvironmentVariable("TEST_BUCKET_NAME")!;
    private static readonly string Table   = System.Environment.GetEnvironmentVariable("TEST_TABLE_NAME")!;
    private static readonly string EchoFn  = System.Environment.GetEnvironmentVariable("ECHO_FUNCTION_NAME")!;

    public async Task FunctionHandler(SQSEvent sqsEvent, ILambdaContext context)
    {
        var reqId = context.AwsRequestId;
        var payload = JsonSerializer.Serialize(new { runtime = "dotnet8", requestId = reqId });

        await S3.PutObjectAsync(new PutObjectRequest
        {
            BucketName  = Bucket,
            Key         = $"dotnet/{reqId}.json",
            ContentBody = payload,
            ContentType = "application/json",
        });

        await Ddb.PutItemAsync(new PutItemRequest
        {
            TableName = Table,
            Item = new Dictionary<string, AttributeValue>
            {
                ["requestId"] = new AttributeValue { S = reqId },
                ["runtime"]   = new AttributeValue { S = "dotnet8" },
                ["event"]     = new AttributeValue { S = payload[..Math.Min(payload.Length, 1024)] },
            },
        });

        var echoInput = JsonSerializer.Serialize(new { source = "dotnet", requestId = reqId });
        var echoResp = await LambdaClient.InvokeAsync(new InvokeRequest
        {
            FunctionName   = EchoFn,
            InvocationType = "RequestResponse",
            Payload        = echoInput,
        });
        using var reader = new StreamReader(echoResp.Payload);
        var echoBody = await reader.ReadToEndAsync();
        JsonSerializer.Deserialize<object>(echoBody);
    }
}
