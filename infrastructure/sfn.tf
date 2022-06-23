resource "aws_sfn_state_machine" "main" {
  name     = local.prefix
  role_arn = aws_iam_role.sfn.arn
  definition = templatefile("${path.module}/sfn.json", {
    grant_access_function_arn     = aws_lambda_function.grant_access.arn,
    revoke_access_function_arn    = aws_lambda_function.revoke_access.arn,
    report_on_access_function_arn = aws_lambda_function.report_on_access.arn,
  })
}
