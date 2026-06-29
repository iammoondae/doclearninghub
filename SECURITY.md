# Security Policy & Best Practices

This document establishes the security guidelines and practices for the **Department of Chemistry Portal**. It outlines the classification of sensitive data, credentials, and configuration files, and details which files must never be committed to source control to prevent security leaks.

## Files That Must Never Be Committed

The following file patterns are restricted and must not be committed to the repository:

### Secrets & Credentials
* `.env` - Holds local environment variable secrets and API keys.
* `.env.*` - Holds environment-specific secrets (e.g., development, staging, or production configurations).
* `*.keystore` - Binary file containing the cryptographic keys used to verify developer identity and sign local wrapper apps.
* `*.jks` - Java KeyStore files containing production Android application signing keys.
* `google-services.json` - Contains API keys, project configurations, and client identifiers for Google/Firebase services.
* `GoogleService-Info.plist` - Contains iOS Firebase project configuration settings, client IDs, and API keys.
* `firebase-adminsdk-*.json` - High-privilege Firebase Admin SDK service account credentials providing full administrative access.
* `**/secrets.xml` - Android resource files holding local private keys, API credentials, or sensitive string tokens.
* `local.properties` - Contains local SDK installation paths and developer-specific build configuration variables.

### Signing Keys (Android Release Signing)
* `*.pepk` - Play Encrypt Private Key files used for Google Play App Signing enrollment.
* `keystore.properties` - Contains plain-text store passwords, key passwords, and aliases for signing credentials.

### Build Artifacts (Non-Secrets, Build Noise)
* `/build` - Auto-generated Android build output directories containing compiled code and resource trees.
* `/.gradle` - Local Gradle build system cache directories and configuration metadata.
* `*.apk` - Compiled Android package application binaries.
* `*.aab` - Compiled Android App Bundle publication files.

### IDE/OS Noise (Developer Environment Configurations)
* `.idea/` - Android Studio / IntelliJ workspace settings specific to individual developer environments.
* `*.iml` - Individual IntelliJ IDEA module files specifying local project configuration mappings.
* `.DS_Store` - macOS operating system desktop services store metadata configuration files.

## Reporting a Vulnerability

If you discover a security vulnerability or credential leak within this repository, please do not open a public issue. Instead, report it privately to the project administrator immediately.
