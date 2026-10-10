# GitHub Actions OIDC: lets workflows in imbjdd/honeyrizons assume a deploy role
# with no long-lived AWS keys. Account-global, so it lives in the prod root.

variable "github_repo" {
  type    = string
  default = "imbjdd/honeyrizons"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}

resource "aws_iam_role" "github_deploy" {
  name = "honeyrizons-github-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*" }
      }
    }]
  })
}

# Permissions Terraform needs to manage the stack. Scoped to the services used;
# IAM is limited to the honeyrizons-* roles plus PassRole of the instance profile.
resource "aws_iam_role_policy" "github_deploy" {
  name = "honeyrizons-deploy"
  role = aws_iam_role.github_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "Compute"
        Effect   = "Allow"
        Action   = ["ec2:*", "cloudfront:*", "ecr:*", "ssm:*"]
        Resource = "*"
      },
      {
        Sid      = "State"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = ["arn:aws:s3:::honeyrizons-tfstate-${data.aws_caller_identity.current.account_id}", "arn:aws:s3:::honeyrizons-tfstate-${data.aws_caller_identity.current.account_id}/*"]
      },
      {
        Sid      = "IamManage"
        Effect   = "Allow"
        Action   = ["iam:GetRole", "iam:GetInstanceProfile", "iam:GetOpenIDConnectProvider", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies", "iam:ListInstanceProfilesForRole", "iam:GetRolePolicy", "iam:TagRole", "iam:TagInstanceProfile", "iam:TagOpenIDConnectProvider"]
        Resource = "*"
      },
      {
        Sid      = "PassInstanceRole"
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = aws_iam_role.ec2.arn
      },
    ]
  })
}

output "github_deploy_role_arn" {
  description = "Set as the repo variable AWS_DEPLOY_ROLE_ARN for the workflow."
  value       = aws_iam_role.github_deploy.arn
}
