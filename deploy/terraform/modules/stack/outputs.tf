output "public_ip" {
  description = "Honeypot address (SSH 22, Telnet 23, HTTP 80, MySQL 3306, Redis 6379, MCP 8000)"
  value       = aws_eip.honeypot.public_ip
}

output "instance_id" {
  value = aws_instance.honeypot.id
}

output "dashboard_url" {
  value = "https://${aws_cloudfront_distribution.dashboard.domain_name}"
}

output "shell" {
  value = "aws ssm start-session --region ${var.region} --target ${aws_instance.honeypot.id}"
}
