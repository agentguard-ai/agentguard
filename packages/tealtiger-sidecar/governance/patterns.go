package governance

import "regexp"

// PII detection patterns
var (
	// SSN: XXX-XX-XXXX or XXXXXXXXX
	SSNPattern = regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b`)

	// Credit card: 13-19 digit sequences with optional separators
	CreditCardPattern = regexp.MustCompile(`\b(?:\d[ -]*?){13,19}\b`)

	// Email addresses
	EmailPattern = regexp.MustCompile(`\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b`)

	// Phone numbers: various formats
	PhonePattern = regexp.MustCompile(`\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b`)
)

// Secret detection patterns
var (
	// Generic API keys (32+ hex or alphanumeric chars)
	APIKeyPattern = regexp.MustCompile(`(?i)(?:api[_-]?key|apikey)\s*[:=]\s*["']?([A-Za-z0-9\-_]{20,})["']?`)

	// Password assignments
	PasswordPattern = regexp.MustCompile(`(?i)(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"']{8,})["']?`)

	// Bearer tokens
	BearerTokenPattern = regexp.MustCompile(`(?i)bearer\s+[A-Za-z0-9\-_\.]{20,}`)

	// Generic tokens
	TokenPattern = regexp.MustCompile(`(?i)(?:token|secret)\s*[:=]\s*["']?([A-Za-z0-9\-_\.]{20,})["']?`)

	// Private keys (PEM format)
	PrivateKeyPattern = regexp.MustCompile(`-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----`)

	// AWS Access Key IDs
	AWSKeyIDPattern = regexp.MustCompile(`\bAKIA[0-9A-Z]{16}\b`)

	// AWS Secret Access Keys
	AWSSecretPattern = regexp.MustCompile(`(?i)aws_secret_access_key\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?`)
)

// PIIPatterns returns all PII detection patterns with their identifiers.
func PIIPatterns() map[string]*regexp.Regexp {
	return map[string]*regexp.Regexp{
		"ssn":         SSNPattern,
		"credit_card": CreditCardPattern,
		"email":       EmailPattern,
		"phone":       PhonePattern,
	}
}

// SecretPatterns returns all secret detection patterns with their identifiers.
func SecretPatterns() map[string]*regexp.Regexp {
	return map[string]*regexp.Regexp{
		"api_key":            APIKeyPattern,
		"password":           PasswordPattern,
		"bearer_token":       BearerTokenPattern,
		"token":              TokenPattern,
		"private_key":        PrivateKeyPattern,
		"aws_access_key_id":  AWSKeyIDPattern,
		"aws_secret_key":     AWSSecretPattern,
	}
}
