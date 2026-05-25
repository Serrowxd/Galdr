# Clerk Dashboard setup (OAuth-only)

Configure these settings at [dashboard.clerk.com](https://dashboard.clerk.com) for Galdr.

## User & Authentication → Email, phone, username

- **Disable** email address as a sign-in method
- **Disable** password
- **Disable** phone number
- **Enable Username** (required for grimoire URLs)

## User & Authentication → Social connections

Enable and allow sign-up/sign-in for:

| Provider | Clerk strategy |
|---|---|
| GitHub | `oauth_github` |
| GitLab | `oauth_gitlab` |
| Bitbucket | `oauth_bitbucket` |
| Google | `oauth_google` |
| Microsoft | `oauth_microsoft` |
| Apple | `oauth_apple` |

Development instances can use Clerk shared OAuth credentials. Production requires custom OAuth app credentials per provider (see below).

## Paths

- Do **not** set `CLERK_SIGN_IN_URL` to the Account Portal hosted URL
- Allowed redirect URLs: `http://localhost:3000/**`, your production domain

## Production OAuth registration

Register an OAuth app with each provider and paste credentials into Clerk Dashboard → Social connections → Use custom credentials.

| Provider | Register at |
|---|---|
| GitHub | [GitHub Developer Settings](https://github.com/settings/developers) |
| GitLab | GitLab → User Settings → Applications |
| Bitbucket | [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/) |
| Google | [Google Cloud Console](https://console.cloud.google.com/) |
| Microsoft | [Azure Entra ID](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps) |
| Apple | [Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId) |

Callback URLs are provided by Clerk when you configure each social connection.
