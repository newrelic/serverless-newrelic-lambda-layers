module.exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      runtime: "nodejs22",
      requestId: context.awsRequestId,
      receivedEvent: event,
      message: "LMI sample invoked successfully"
    })
  };
};
