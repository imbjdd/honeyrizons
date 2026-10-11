# Demo traffic generators on other continents, next to the ones the stack runs in
# its own region, so the attack map shows sources from several parts of the world.
# Same switch as the stack's generators: attacker_count = 0 removes them all.

provider "aws" {
  alias   = "sa_east_1" # São Paulo
  region  = "sa-east-1"
  profile = var.profile != "" ? var.profile : null
  default_tags {
    tags = { Project = "honeyrizons", Environment = "prod" }
  }
}

provider "aws" {
  alias   = "ap_southeast_1" # Singapore
  region  = "ap-southeast-1"
  profile = var.profile != "" ? var.profile : null
  default_tags {
    tags = { Project = "honeyrizons", Environment = "prod" }
  }
}

locals {
  remote_attackers = {
    enabled               = var.attacker_count > 0
    name                  = "honeyrizons"
    user_data             = module.stack.attacker_user_data
    instance_profile_name = aws_iam_instance_profile.ec2.name
  }
}

module "attacker_sa_east_1" {
  source                = "../modules/attacker-region"
  providers             = { aws = aws.sa_east_1 }
  enabled               = local.remote_attackers.enabled
  name                  = local.remote_attackers.name
  user_data             = local.remote_attackers.user_data
  instance_profile_name = local.remote_attackers.instance_profile_name
}

module "attacker_ap_southeast_1" {
  source                = "../modules/attacker-region"
  providers             = { aws = aws.ap_southeast_1 }
  enabled               = local.remote_attackers.enabled
  name                  = local.remote_attackers.name
  user_data             = local.remote_attackers.user_data
  instance_profile_name = local.remote_attackers.instance_profile_name
}

# us-east-1 reuses the provider the CloudFront certificate already needs (domain.tf).
module "attacker_us_east_1" {
  source                = "../modules/attacker-region"
  providers             = { aws = aws.us_east_1 }
  enabled               = local.remote_attackers.enabled
  name                  = local.remote_attackers.name
  user_data             = local.remote_attackers.user_data
  instance_profile_name = local.remote_attackers.instance_profile_name
}

output "remote_attacker_ips" {
  value = {
    "sa-east-1"      = module.attacker_sa_east_1.public_ip
    "ap-southeast-1" = module.attacker_ap_southeast_1.public_ip
    "us-east-1"      = module.attacker_us_east_1.public_ip
  }
}
