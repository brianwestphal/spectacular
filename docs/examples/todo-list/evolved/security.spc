# Security

## Network Communication
@label(tls)

All API communication **must** use TLS 1.3 or higher.
Certificate pinning is implemented for all first-party API endpoints.

## Token Storage
@label(token-storage)

Authentication tokens **must** be stored using platform-appropriate secure storage.
Tokens expire after 24 hours and are refreshed transparently in the background.
Refresh tokens expire after 30 days. After expiry, the user must re-authenticate.

## Data Encryption
@label(data-encryption)

Sensitive user data must be encrypted at rest on the device.
Task content and list names are considered sensitive.
PII **must not** be written to application logs.

## Input Validation

All user input is validated and sanitized on both client and server.
Task titles are limited to 200 characters.
Notes fields are limited to 5000 characters.
