package com.serverless;

import java.util.Map;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;

public class Handler implements RequestHandler<Map<String, Object>, String> {

	private static final Logger LOG = LogManager.getLogger(Handler.class);

	@Override
	public String handleRequest(Map<String, Object> input, Context context) {
		LOG.info("received: {}", input);
		return "ok";
	}
}
