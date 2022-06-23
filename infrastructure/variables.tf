variable "container_tag" {
  type        = string
  description = "Docker image version to deploy."
  default     = "1.0.0"
}

variable "cloud_trail_cloudwatch_log_group_arn" {
  type        = string
  description = "Must hold CloudTrail logs for all relevant access."
}

variable "cloud_trail_cloudwatch_log_group_name" {
  type        = string
  description = "Must hold CloudTrail logs for all relevant access."
}

variable "contact_email" {
  type        = string
  description = "Who should we send reports to?"
}

variable "from_email" {
  type        = string
  description = "SES must be configured with a verified identity to send as this email."
}
