using System.Diagnostics;
using System.Text.Json;
using Amazon.Lambda.Core;

namespace LmiTest;

public class FibFunction
{
    private static long Fib(int n) => n < 2 ? n : Fib(n - 1) + Fib(n - 2);

    public Task<object> FunctionHandler(JsonElement input, ILambdaContext context)
    {
        var n = int.Parse(System.Environment.GetEnvironmentVariable("FIB_N") ?? "30");
        var targetSeconds = double.Parse(System.Environment.GetEnvironmentVariable("FIB_TARGET_SECONDS") ?? "25");

        var stopwatch = Stopwatch.StartNew();
        long iterations = 0;
        while (stopwatch.Elapsed.TotalSeconds < targetSeconds)
        {
            Fib(n);
            iterations++;
        }

        return Task.FromResult<object>(new
        {
            iterations,
            elapsedSeconds = stopwatch.Elapsed.TotalSeconds,
            n,
        });
    }
}
