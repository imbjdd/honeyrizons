# Per-environment Honeyrizons stack: an isolated VPC with one EC2 instance running
# docker-compose.yml (honeypot + dashboard), fronted by CloudFront, plus optional
# demo traffic-generator instances. Account-global resources (ECR repos, the EC2
# instance profile, GitHub OIDC) live in the prod root and are referenced by name.

locals {
  is_prod   = var.environment == "prod"
  suffix    = local.is_prod ? "" : "-${var.environment}"
  name      = "honeyrizons${local.suffix}"
  image_tag = local.is_prod ? "latest" : var.environment
  vpc_cidr  = local.is_prod ? "10.42.0.0/16" : "10.43.0.0/16"
  sub_cidr  = local.is_prod ? "10.42.1.0/24" : "10.43.1.0/24"
  # Core services, then the lures the city planner may open.
  ports     = [22, 23, 80, 3306, 6379, 8000, 11434, 2375, 8081, 5432, 8001, 1883]
}

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# --- Images ---------------------------------------------------------------

resource "terraform_data" "images" {
  triggers_replace = [var.source_hash, local.image_tag]

  provisioner "local-exec" {
    working_dir = var.repo_root
    environment = merge(
      {
        AWS_REGION = var.region
        REGISTRY   = var.registry
        TAG        = local.image_tag
      },
      var.profile != "" ? { AWS_PROFILE = var.profile } : {},
    )
    command     = <<-EOT
      set -eu
      CLI=$(command -v podman || command -v docker)
      aws ecr get-login-password | $CLI login --username AWS --password-stdin $REGISTRY
      $CLI build --platform linux/amd64 -t $REGISTRY/honeyrizons-honeypot:$TAG apps/honeypot
      $CLI build --platform linux/amd64 -t $REGISTRY/honeyrizons-dashboard:$TAG -f apps/api/Dockerfile .
      $CLI push $REGISTRY/honeyrizons-honeypot:$TAG
      $CLI push $REGISTRY/honeyrizons-dashboard:$TAG
    EOT
    interpreter = ["bash", "-c"]
  }
}

# --- Isolated network -----------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = local.vpc_cidr
  enable_dns_hostnames = true # CloudFront needs a DNS name for the origin
  tags                 = { Name = local.name }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = local.name }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.sub_cidr
  availability_zone       = "${var.region}a"
  map_public_ip_on_launch = true
  tags                    = { Name = local.name }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = { Name = local.name }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Honeypot ports, open to everyone. Admin access is through SSM, not SSH.
resource "aws_security_group" "honeypot" {
  name        = local.name
  description = "Honeyrizons honeypot ports"
  vpc_id      = aws_vpc.main.id

  dynamic "ingress" {
    for_each = local.ports
    content {
      from_port   = ingress.value
      to_port     = ingress.value
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Dashboard port, reachable only from CloudFront.
resource "aws_security_group" "dashboard" {
  name        = "honeyrizons-dashboard${local.suffix}"
  description = "Honeyrizons dashboard, CloudFront only"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront.id]
  }
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# --- Instance -------------------------------------------------------------

resource "aws_instance" "honeypot" {
  ami                    = data.aws_ssm_parameter.al2023.insecure_value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.honeypot.id, aws_security_group.dashboard.id]
  iam_instance_profile   = var.instance_profile_name

  user_data = templatefile("${path.module}/user-data.sh", {
    region      = var.region
    registry    = var.registry
    location    = var.location
    image_tag   = local.image_tag
    compose_b64 = filebase64("${var.repo_root}/docker-compose.yml")
  })

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  tags = { Name = local.name }

  # Keep the instance (and its captured logs) across AMI / user-data updates.
  lifecycle {
    ignore_changes = [ami, user_data]
  }

  depends_on = [terraform_data.images, aws_route_table_association.public]
}

# Stable address, so the CloudFront origin survives instance stop/start.
resource "aws_eip" "honeypot" {
  instance = aws_instance.honeypot.id
  tags     = { Name = local.name }
}

# --- Public dashboard URL -------------------------------------------------

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

# Forwards query strings, cookies and headers (except Host, which must stay the origin's).
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "dashboard" {
  enabled         = true
  comment         = "Honeyrizons dashboard (${var.environment})"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true
  aliases         = var.domain != "" ? [var.domain] : []

  origin {
    origin_id   = "dashboard"
    domain_name = aws_eip.honeypot.public_dns
    custom_origin_config {
      http_port              = 4000
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      # The SSE stream sends a ping every 15s, well under this.
      origin_read_timeout = 60
    }
  }

  default_cache_behavior {
    target_origin_id       = "dashboard"
    viewer_protocol_policy = "redirect-to-https"
    # POST for the city planner's apply/close (propose mode).
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    # Without it CloudFront drops query strings, so /api/events?limit=… always got the API's default of 2000.
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
    compress                 = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.certificate_arn == "" ? true : null
    acm_certificate_arn            = var.certificate_arn != "" ? var.certificate_arn : null
    ssl_support_method             = var.certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = var.certificate_arn != "" ? "TLSv1.2_2021" : null
  }
}

# Push new images to the running instance without replacing it.
resource "terraform_data" "deploy" {
  triggers_replace = [var.source_hash, local.image_tag, aws_instance.honeypot.id]

  provisioner "local-exec" {
    environment = merge(
      {
        AWS_REGION        = var.region
        INSTANCE          = aws_instance.honeypot.id
        HONEYPOT_LOCATION = var.location
        REGISTRY          = var.registry
        IMAGE_TAG         = local.image_tag
        COMPOSE_B64       = filebase64("${var.repo_root}/docker-compose.yml")
      },
      var.profile != "" ? { AWS_PROFILE = var.profile } : {},
    )
    command     = "${path.module}/deploy.sh"
    interpreter = ["bash"]
  }
}
