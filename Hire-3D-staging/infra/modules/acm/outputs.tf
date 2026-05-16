output "certificate_arn" {
  value = aws_acm_certificate_validation.this.certificate_arn
}

output "validation_records" {
  description = "Add these CNAME records in Cloudflare to validate the certificate."
  value = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}
