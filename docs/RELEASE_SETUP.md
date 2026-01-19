# Release Setup Guide

This guide explains how to set up automated releases to Google Play and App Store.

## Overview

When you run `make release` locally:
1. Claude generates a changelog from commits
2. A git tag is created with the changelog
3. The tag is pushed to GitHub
4. GitHub Actions automatically:
   - Creates a GitHub Release
   - Builds and uploads to Google Play (internal track)
   - Builds and uploads to TestFlight

## GitHub Secrets Required

Add these secrets at: https://github.com/dmattsson/giraff/settings/secrets/actions

### Android Secrets

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded keystore file | `base64 -i android/stuga_keystore_private.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Your keystore password |
| `PLAY_STORE_CREDENTIALS_BASE64` | Base64-encoded Play Store JSON key | `base64 -i android/fastlane/play-store-credentials.json` |

#### Getting Play Store Credentials

1. Go to [Google Play Console](https://play.google.com/console)
2. Setup → API access → Create service account
3. Grant "Release to production" permission
4. Download JSON key

### iOS Secrets

| Secret | Description | How to get it |
|--------|-------------|---------------|
| `IOS_CERTIFICATE_BASE64` | Base64-encoded .p12 certificate | Export from Keychain, then `base64 -i cert.p12` |
| `IOS_CERTIFICATE_PASSWORD` | Password for the .p12 file | Set when exporting |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64-encoded provisioning profile | `base64 -i profile.mobileprovision` |
| `IOS_KEYCHAIN_PASSWORD` | Temporary keychain password | Any random string |
| `APP_STORE_CONNECT_KEY_ID` | App Store Connect API Key ID | From App Store Connect |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect Issuer ID | From App Store Connect |
| `APP_STORE_CONNECT_API_KEY` | Contents of .p8 API key file | Copy file contents |

#### Getting App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Users and Access → Keys → App Store Connect API
3. Generate a new key with "App Manager" access
4. Download the .p8 file (only available once!)
5. Note the Key ID and Issuer ID

#### Getting iOS Certificate

1. Open Keychain Access
2. Find your "Apple Distribution" certificate
3. Right-click → Export → Save as .p12
4. Set a password

#### Getting Provisioning Profile

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/profiles/list)
2. Download the App Store provisioning profile for com.twinbolt.stuga

## Local Setup

For local releases, you just need:
- Claude CLI installed and authenticated
- Git configured with push access

```bash
# Run a release
make release          # patch version
make release-minor    # minor version
make release-major    # major version
```

## Encoding Files as Base64

```bash
# Encode a file
base64 -i path/to/file > encoded.txt

# Or copy directly to clipboard (macOS)
base64 -i path/to/file | pbcopy
```

## Testing the Workflow

1. First, add all secrets to GitHub
2. Run `make release` locally
3. Check GitHub Actions for build status
4. Verify uploads in Play Console and App Store Connect
