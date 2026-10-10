# Custom domain for prod: the apex honeyrizons.xyz → dashboard CloudFront.
# The hosted zone is created by the Route53 domain registration (managed outside
# this config); we look it up and add the cert-validation and alias records.

variable "domain" {
  type    = string
  default = "staging.honeyrizons.xyz"
}

# CloudFront certificates must live in us-east-1.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.profile != "" ? var.profile : null
  default_tags {
    tags = { Project = "honeyrizons", Environment = "staging" }
  }
}

data "aws_route53_zone" "main" {
  name = "honeyrizons.xyz."
}

resource "aws_acm_certificate" "dashboard" {
  provider          = aws.us_east_1
  domain_name       = var.domain
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for o in aws_acm_certificate.dashboard.domain_validation_options : o.domain_name => o
  }
  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "dashboard" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.dashboard.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# Point the domain at the dashboard CloudFront distribution.
resource "aws_route53_record" "alias" {
  for_each = toset(["A", "AAAA"])
  zone_id  = data.aws_route53_zone.main.zone_id
  name     = var.domain
  type     = each.value
  alias {
    name                   = module.stack.cloudfront_domain
    zone_id                = module.stack.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}
