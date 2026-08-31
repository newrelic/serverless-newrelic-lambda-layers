package com.newrelic.lambda.example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

public class App implements RequestHandler<Object, Map<String, Object>> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Map<String, Object> handleRequest(Object event, Context context) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "hello world");
        body.put("runtime", "java21");
        body.put("requestId", context.getAwsRequestId());

        Map<String, Object> response = new LinkedHashMap<>();
        try {
            response.put("statusCode", 200);
            response.put("body", MAPPER.writeValueAsString(body));
        } catch (Exception e) {
            response.put("statusCode", 500);
            response.put("body", "{\"error\":\"" + e.getMessage() + "\"}");
        }
        return response;
    }
}
