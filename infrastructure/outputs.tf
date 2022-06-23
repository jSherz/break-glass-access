output "ecr_repo" {
  value = aws_ecr_repository.main.repository_url
}

output "hook_url" {
  value = aws_api_gateway_deployment.main.invoke_url
}
