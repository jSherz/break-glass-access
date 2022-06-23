resource "aws_api_gateway_rest_api" "main" {
  name        = local.prefix
  description = "Handles Slack interactivity hooks."
}

resource "aws_api_gateway_method" "main_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  authorization = "NONE"
  http_method   = "POST"
  resource_id   = aws_api_gateway_rest_api.main.root_resource_id
}

resource "aws_api_gateway_integration" "main_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  http_method             = aws_api_gateway_method.main_post.http_method
  resource_id             = aws_api_gateway_method.main_post.resource_id
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.access_requested.invoke_arn
}

resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id

  stage_name = "prod"

  # Redeploy if this file changes
  triggers = {
    this_file = filebase64sha256("${path.module}/api-gateway.tf")
  }

  depends_on = [
    aws_api_gateway_method.main_post,
    aws_api_gateway_integration.main_post,
  ]
}
