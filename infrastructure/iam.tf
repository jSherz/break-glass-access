data "aws_iam_policy_document" "lambda_assume" {
  statement {
    sid     = "AllowLambdaToAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "access_requested" {
  statement {
    sid       = "AllowUseOfDynamoDB"
    effect    = "Allow"
    actions   = ["dynamodb:GetItem"]
    resources = [aws_dynamodb_table.main.arn]
  }

  statement {
    sid       = "AllowFetchingConfig"
    effect    = "Allow"
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.main.account_id}:parameter/live-laugh-ship/slack-signing-secret"]
  }

  // NB: if your account contains multiple ID stores, narrow this policy
  statement {
    sid       = "AllowLookingUpUsers"
    effect    = "Allow"
    actions   = ["identitystore:DescribeUser"]
    resources = ["*"]
  }

  statement {
    sid       = "AllowStartingStepFunction"
    effect    = "Allow"
    actions   = ["states:StartExecution"]
    resources = [aws_sfn_state_machine.main.arn]
  }

  statement {
    sid    = "AllowLogging"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.access_requested.arn}:*"]
  }
}

resource "aws_iam_role" "access_requested" {
  name               = "${local.prefix}-access-requested"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "access_requested" {
  role   = aws_iam_role.access_requested.id
  policy = data.aws_iam_policy_document.access_requested.json
}

data "aws_iam_policy_document" "grant_access" {
  statement {
    sid    = "AllowLogging"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.grant_access.arn}:*"]
  }

  statement {
    sid    = "AllowControllingSSO"
    effect = "Allow"

    resources = [
      "arn:aws:sso:::instance/*",
      "arn:aws:sso:::permissionSet/*/*",
      "arn:aws:sso:::account/*",
    ]

    actions = [
      "sso:CreateAccountAssignment",
      "sso:DeleteAccountAssignment",
      "sso:DescribeAccountAssignmentCreationStatus",
      "sso:DescribeAccountAssignmentDeletionStatus",
      "sso:DescribePermissionSet",
    ]
  }

  statement {
    sid       = "AllowGrantingPermissionSets"
    effect    = "Allow"
    resources = ["*"]

    actions = [
      "iam:GetSAMLProvider",
      "iam:CreateRole",
      "iam:ListRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DeleteRole",
      "iam:DetachRolePolicy",
    ]
  }
}

resource "aws_iam_role" "grant_access" {
  name               = "${local.prefix}-grant-access"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "grant_access" {
  role   = aws_iam_role.grant_access.id
  policy = data.aws_iam_policy_document.grant_access.json
}

data "aws_iam_policy_document" "revoke_access" {
  statement {
    sid    = "AllowLogging"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.revoke_access.arn}:*"]
  }

  statement {
    sid    = "AllowControllingSSO"
    effect = "Allow"

    resources = [
      "arn:aws:sso:::instance/*",
      "arn:aws:sso:::permissionSet/*/*",
      "arn:aws:sso:::account/*",
    ]

    actions = [
      "sso:CreateAccountAssignment",
      "sso:DeleteAccountAssignment",
      "sso:DescribeAccountAssignmentCreationStatus",
      "sso:DescribeAccountAssignmentDeletionStatus",
      "sso:DescribePermissionSet",
    ]
  }

  statement {
    sid       = "AllowGrantingPermissionSets"
    effect    = "Allow"
    resources = ["*"]

    actions = [
      "iam:GetSAMLProvider",
      "iam:CreateRole",
      "iam:ListRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DeleteRole",
      "iam:DetachRolePolicy",
    ]
  }
}

resource "aws_iam_role" "revoke_access" {
  name               = "${local.prefix}-revoke-access"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "revoke_access" {
  role   = aws_iam_role.revoke_access.id
  policy = data.aws_iam_policy_document.revoke_access.json
}

data "aws_iam_policy_document" "report_on_access" {
  statement {
    sid    = "AllowLogging"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.report_on_access.arn}:*"]
  }

  statement {
    sid       = "AllowLookingUpPermissionSet"
    effect    = "Allow"
    actions   = ["sso:DescribePermissionSet"]
    resources = [
      "arn:aws:sso:::permissionSet/*/*",
      "arn:aws:sso:::instance/*",
    ]
  }

  statement {
    sid       = "AllowEmailingReport"
    effect    = "Allow"
    resources = ["*"]
    actions   = ["ses:SendEmail"]
  }

  statement {
    sid       = "AllowQueryingLogs"
    effect    = "Allow"
    resources = [var.cloud_trail_cloudwatch_log_group_arn]
    actions   = ["logs:StartQuery"]
  }

  statement {
    sid       = "AllowCheckingStatusOfLogQuery"
    effect    = "Allow"
    actions   = ["logs:GetQueryResults"]
    resources = ["*"]
  }
}

resource "aws_iam_role" "report_on_access" {
  name               = "${local.prefix}-report-on-access"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy" "report_on_access" {
  role   = aws_iam_role.report_on_access.id
  policy = data.aws_iam_policy_document.report_on_access.json
}

data "aws_iam_policy_document" "sfn_assume" {
  statement {
    sid     = "AllowStepFunctionsToAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "sfn" {
  statement {
    sid    = "AllowLogDelivery"
    effect = "Allow"
    actions = [
      "logs:CreateLogDelivery",
      "logs:GetLogDelivery",
      "logs:UpdateLogDelivery",
      "logs:DeleteLogDelivery",
      "logs:ListLogDeliveries",
      "logs:PutResourcePolicy",
      "logs:DescribeResourcePolicies",
      "logs:DescribeLogGroups"
    ]
    resources = ["*"]
  }

  statement {
    sid     = "AllowOrchestratingLambdas"
    effect  = "Allow"
    actions = ["lambda:InvokeFunction"]
    resources = [
      aws_lambda_function.access_requested.arn,
      "${aws_lambda_function.access_requested.arn}:*",
      aws_lambda_function.grant_access.arn,
      "${aws_lambda_function.grant_access.arn}:*",
      aws_lambda_function.revoke_access.arn,
      "${aws_lambda_function.revoke_access.arn}:*",
      aws_lambda_function.report_on_access.arn,
      "${aws_lambda_function.report_on_access.arn}:*",
    ]
  }

  statement {
    sid    = "AllowXRayTracing"
    effect = "Allow"
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
      "xray:GetSamplingRules",
      "xray:GetSamplingTargets"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role" "sfn" {
  name               = "${local.prefix}-sfn"
  assume_role_policy = data.aws_iam_policy_document.sfn_assume.json
}

resource "aws_iam_role_policy" "sfn" {
  role   = aws_iam_role.sfn.id
  policy = data.aws_iam_policy_document.sfn.json
}
