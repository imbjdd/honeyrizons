# Staging root. One staging stack; reuses the prod-owned ECR repos and EC2
# instance profile by name. Its own remote state.
#   cd deploy/terraform/staging && terraform init && terraform apply

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    bucket       = "honeyrizons-tfstate-621511849531"
    key          = "staging/honeyrizons.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region  = var.region
  profile = var.profile != "" ? var.profile : null
  default_tags {
    tags = { Project = "honeyrizons", Environment = "staging" }
  }
}

variable "profile" {
  type    = string
  default = "admin"
}

variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "attacker_count" {
  type    = number
  default = 0
}

data "aws_caller_identity" "current" {}

locals {
  repo_root = abspath("${path.module}/../../..")
  registry  = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.region}.amazonaws.com"

  source_patterns = [
    "package.json", "bun.lock", ".dockerignore", "docker-compose.yml",
    "apps/honeypot/Dockerfile", "apps/honeypot/.dockerignore", "apps/honeypot/config/**",
    "apps/honeypot/beelzebub/go.mod", "apps/honeypot/beelzebub/go.sum", "apps/honeypot/beelzebub/**/*.go",
    "apps/api/**", "apps/web/**", "packages/**",
  ]
  source_files = sort(distinct([
    for f in flatten([for p in local.source_patterns : fileset(local.repo_root, p)]) : f
    if !strcontains(f, "node_modules/") && !strcontains(f, "dist/")
  ]))
  source_hash = sha1(join("", [for f in local.source_files : filesha1("${local.repo_root}/${f}")]))
}

module "stack" {
  source          = "../modules/stack"
  environment     = "staging"
  region          = var.region
  profile         = var.profile
  registry        = local.registry
  repo_root       = local.repo_root
  source_hash     = local.source_hash
  attacker_count  = var.attacker_count
  city_planner    = "propose" # the operator applies the planner's suggestions on the dashboard
  domain          = var.domain
  certificate_arn = aws_acm_certificate_validation.dashboard.certificate_arn
}

output "public_ip" { value = module.stack.public_ip }
output "dashboard_url" { value = module.stack.dashboard_url }
output "instance_id" { value = module.stack.instance_id }
output "attacker_ids" { value = module.stack.attacker_ids }
output "shell" { value = module.stack.shell }
