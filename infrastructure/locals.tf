locals {
  prefix = "break-glass-access"

  lambdas = {
    access_requested = "${local.prefix}-access-requested"
    grant_access     = "${local.prefix}-grant-access"
    revoke_access    = "${local.prefix}-revoke-access"
    report_on_access = "${local.prefix}-report-on-access"
  }
}
