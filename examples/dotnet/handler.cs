using Amazon.Lambda.Core;
using System.Threading.Tasks;
[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace NewrelicExample;

public class Function
{
    public async Task<string> FunctionHandler(ILambdaContext context)
    {
        await Task.Delay(1000); // Simulate some async work
        return "Hello, World!";
    }
}
