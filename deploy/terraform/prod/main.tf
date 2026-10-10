# Prod root. Owns the account-global resources (ECR repos, the EC2 instance
# profile, the GitHub Actions OIDC role) and one prod stack.
#   cd deploy/terraform/prod && terraform init && terraform apply

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
    key          = "prod/honeyrizons.tfstate"
    region       = "eu-west-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region  = var.region
  profile = var.profile != "" ? var.profile : null
  default_tags {
    tags = { Project = "honeyrizons", Environment = "prod" }
  }
}

variable "profile" {
  type    = string
  default = "admin" # empty in CI (OIDC)
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

# --- Account-global: ECR repositories -------------------------------------

resource "aws_ecr_repository" "app" {
  for_each             = toset(["honeypot", "dashboard"])
  name                 = "honeyrizons-${each.key}"
  force_delete         = true
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

# --- Account-global: EC2 instance profile (SSM + ECR read) ----------------

resource "aws_iam_role" "ec2" {
  name = "honeyrizons-ec2"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ec2.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2" {
  for_each = toset([
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
  ])
  role       = aws_iam_role.ec2.name
  policy_arn = each.value
}

resource "aws_iam_instance_profile" "ec2" {
  name = "honeyrizons-ec2"
  role = aws_iam_role.ec2.name
}

# --- Prod stack -----------------------------------------------------------

module "stack" {
  source                = "../modules/stack"
  environment           = "prod"
  region                = var.region
  profile               = var.profile
  registry              = local.registry
  repo_root             = local.repo_root
  source_hash           = local.source_hash
  attacker_count        = var.attacker_count
  instance_profile_name = aws_iam_instance_profile.ec2.name
  domain                = var.domain
  certificate_arn       = aws_acm_certificate_validation.dashboard.certificate_arn

  depends_on = [aws_ecr_repository.app]
}

output "public_ip" { value = module.stack.public_ip }
output "dashboard_url" { value = module.stack.dashboard_url }
output "instance_id" { value = module.stack.instance_id }
output "attacker_ids" { value = module.stack.attacker_ids }
output "shell" { value = module.stack.shell }
