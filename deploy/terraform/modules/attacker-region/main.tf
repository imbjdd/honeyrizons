# Demo-only: one traffic generator in another AWS region, running the same probe
# script as the stack's own generators, so the attack map shows sources on several
# continents. It only needs egress: a tiny VPC with a public subnet, nothing inbound.
# Pass the region through `providers = { aws = aws.<alias> }`.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

variable "name" {
  description = "Name prefix, e.g. honeyrizons-staging"
  type        = string
}

variable "enabled" {
  type = bool
}

variable "user_data" {
  description = "Probe script, from module.stack.attacker_user_data"
  type        = string
}

variable "instance_profile_name" {
  type = string
}

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

locals {
  count = var.enabled ? 1 : 0
  tag   = "${var.name}-attacker-${data.aws_region.current.region}"
}

resource "aws_vpc" "main" {
  count      = local.count
  cidr_block = "10.60.0.0/16"
  tags       = { Name = local.tag }
}

resource "aws_internet_gateway" "main" {
  count  = local.count
  vpc_id = aws_vpc.main[0].id
  tags   = { Name = local.tag }
}

resource "aws_subnet" "public" {
  count                   = local.count
  vpc_id                  = aws_vpc.main[0].id
  cidr_block              = "10.60.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags                    = { Name = local.tag }
}

resource "aws_route_table" "public" {
  count  = local.count
  vpc_id = aws_vpc.main[0].id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main[0].id
  }
  tags = { Name = local.tag }
}

resource "aws_route_table_association" "public" {
  count          = local.count
  subnet_id      = aws_subnet.public[0].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_security_group" "attacker" {
  count       = local.count
  name        = local.tag
  description = "Honeyrizons demo traffic generator (egress only)"
  vpc_id      = aws_vpc.main[0].id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "attacker" {
  count                       = local.count
  ami                         = data.aws_ssm_parameter.al2023.insecure_value
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.attacker[0].id]
  iam_instance_profile        = var.instance_profile_name
  user_data                   = var.user_data
  user_data_replace_on_change = true

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  tags       = { Name = local.tag }
  depends_on = [aws_route_table_association.public]
}

output "public_ip" {
  value = one(aws_instance.attacker[*].public_ip)
}
