variable "environment" {
  description = "Environment name; \"prod\" keeps unsuffixed names and the \"latest\" image tag."
  type        = string
}

variable "region" {
  type = string
}

variable "profile" {
  description = "AWS CLI profile for local runs; empty in CI (OIDC)."
  type        = string
  default     = ""
}

variable "registry" {
  description = "ECR registry host (account.dkr.ecr.region.amazonaws.com)."
  type        = string
}

variable "repo_root" {
  description = "Absolute path to the monorepo root (for image builds)."
  type        = string
}

variable "source_hash" {
  description = "Hash of the image source tree; changes trigger rebuild + redeploy."
  type        = string
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "location" {
  description = "Honeypot position on the dashboard map, \"lat,lon\"."
  type        = string
  default     = "53.3498,-6.2603"
}

variable "attacker_count" {
  description = "Number of demo traffic-generator instances."
  type        = number
  default     = 0
}

variable "instance_profile_name" {
  description = "Existing instance profile granting SSM + ECR read."
  type        = string
  default     = "honeyrizons-ec2"
}
