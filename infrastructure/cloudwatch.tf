resource "aws_cloudwatch_log_group" "access_requested" {
  name              = "/aws/lambda/${local.lambdas.access_requested}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "grant_access" {
  name              = "/aws/lambda/${local.lambdas.grant_access}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "revoke_access" {
  name              = "/aws/lambda/${local.lambdas.revoke_access}"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "report_on_access" {
  name              = "/aws/lambda/${local.lambdas.report_on_access}"
  retention_in_days = 30
}
