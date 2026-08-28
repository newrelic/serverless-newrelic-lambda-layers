using System.Text.Json;
using Amazon.Lambda.Core;

namespace LmiTest;

public class HelloFunction
{
    public Task<object> FunctionHandler(JsonElement input, ILambdaContext context) =>
        Task.FromResult<object>(new { statusCode = 200, body = "{}" });
}
