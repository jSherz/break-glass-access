resource "aws_lambda_function" "access_requested" {
  function_name = local.lambdas.access_requested
  role          = aws_iam_role.access_requested.arn
  description   = "Handles interactivity webhooks from Slack."
  environment {
    variables = {
      # NB: assumes only one SSO setup configured
      IDENTITY_STORE_ID = data.aws_ssoadmin_instances.main.identity_store_ids[0]
      STATE_MACHINE_ARN = aws_sfn_state_machine.main.arn
      TABLE_NAME        = aws_dynamodb_table.main.name
    }
  }

  image_uri    = "${aws_ecr_repository.main.repository_url}:${var.container_tag}"
  memory_size  = 256
  package_type = "Image"
  timeout      = 10

  image_config {
    command = ["dist/entrypoint-access-requested.accessRequestedHandler"]
  }
}

resource "aws_lambda_permission" "access_requested" {
  statement_id  = "AllowAPIToExecute"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.access_requested.function_name
  principal     = "apigateway.amazonaws.com"

  # More: http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-control-access-using-iam-policies-to-invoke-api.html
  source_arn = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.main.account_id}:${aws_api_gateway_rest_api.main.id}/*"
}

resource "aws_lambda_function" "grant_access" {
  function_name = local.lambdas.grant_access
  role          = aws_iam_role.grant_access.arn
  description   = "Grants temporary access to SSO permission sets for emergencies."
  environment {
    variables = {
      # NB: assumes only one SSO setup configured
      INSTANCE_ARN = data.aws_ssoadmin_instances.main.arns[0]
    }
  }

  image_uri    = "${aws_ecr_repository.main.repository_url}:${var.container_tag}"
  memory_size  = 256
  package_type = "Image"
  timeout      = 30

  image_config {
    command = ["dist/entrypoint-grant-access.grantAccessHandler"]
  }
}

resource "aws_lambda_function" "revoke_access" {
  function_name = local.lambdas.revoke_access
  role          = aws_iam_role.revoke_access.arn
  description   = "Revokes temporary access after a delay."
  environment {
    variables = {
      # NB: assumes only one SSO setup configured
      INSTANCE_ARN = data.aws_ssoadmin_instances.main.arns[0]
    }
  }

  image_uri    = "${aws_ecr_repository.main.repository_url}:${var.container_tag}"
  memory_size  = 256
  package_type = "Image"
  timeout      = 30

  image_config {
    command = ["dist/entrypoint-revoke-access.revokeAccessHandler"]
  }
}

resource "aws_lambda_function" "report_on_access" {
  function_name = local.lambdas.report_on_access
  role          = aws_iam_role.report_on_access.arn
  description   = "Sends an e-mail based report of all access performed."
  environment {
    variables = {
      # NB: assumes only one SSO setup configured
      INSTANCE_ARN         = data.aws_ssoadmin_instances.main.arns[0]
      CLOUDTRAIL_LOG_GROUP = var.cloud_trail_cloudwatch_log_group_name
      CONTACT_EMAIL        = var.contact_email
      FROM_EMAIL           = var.from_email
    }
  }

  image_uri    = "${aws_ecr_repository.main.repository_url}:${var.container_tag}"
  memory_size  = 256
  package_type = "Image"
  timeout      = 15 * 60

  image_config {
    command = ["dist/entrypoint-report-on-access.reportOnAccessHandler"]
  }
}
