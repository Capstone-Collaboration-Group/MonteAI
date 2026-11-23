# Temporary Azure API deployment (.NET 8, Basic B1)

> **Current deployment route: .NET 8 Docker image, manually built in Azure
> Container Registry, hosted on Linux Basic B1.** Follow
> [the container runbook](AZURE_CONTAINER_DEPLOYMENT.md). The Code/ZIP steps below
> are retained as a legacy reference, not the current publishing instructions.
> The API settings and receipt-trust sections still apply to the container.

This deploys the ASP.NET API, not the separate ID-verifier Function App. Azure
resource creation, configuration, IAM changes, and publishing are performed by
the user. Never upload the raw `server/` directory or share credential values.

**Temporary testing only:** .NET 8 ended support on November 10, 2026. Upgrade
before production. A framework-dependent .NET 8 app cannot simply be placed on a
.NET 10-only host.

AutoMapper has been updated, with user approval, from 16.1.1 to **16.3.0** to fix
the two high-severity advisories reported by the initial publish:
[constructor recursion](https://github.com/advisories/GHSA-6vhm-j9h7-f9gh)
and [other recursion paths](https://github.com/advisories/GHSA-gpwp-5797-mjff).
The patched dependency passed 70 isolated API tests; the three Python receipt
contract tests were deliberately excluded. The package guards passed 33 offline
checks, including Linux ZIP-path checks. The final ZIP audit confirmed AutoMapper
16.3.0, 134 entries, no forbidden files, and valid Linux paths. The framework
remains .NET 8 and no other direct package pins changed.
**Do not deploy the initial pre-patch ZIP.** These checks do not prove live Azure
startup or successful registration, and the unsupported runtime remains a risk.

## 1. Prepare the package locally

From the repository root, using existing installed dependencies:

```powershell
& .\server\tools\package-azure.ps1
```

The script publishes Release without restoring packages, creates a fresh
directory under `%TEMP%\opencode`, and reports the ZIP path and SHA-256. It checks
the project exclusions and the ZIP contents. The archive contains `server.dll`
at its root and uses forward slashes for Linux subfolder paths, including when
created by Windows PowerShell. It does not start the API or access a database.

Environment-specific appsettings files, Firebase credential files, keys,
logs, and test files must not be published. Local development files remain
untouched. Supply cloud settings privately in App Service instead.

## 2. Create an App Service web app (user)

In Azure Portal: **App Services > Create > Web App**.

- Choose your approved subscription and resource group.
- Choose a globally unique API app name; do not select the verifier Function App.
- Publish: **Code**. Operating system: **Linux**.
- Runtime: **.NET 8 / ASP.NET Core 8**, if still offered.
- Region: use an approved region near the existing SQL/AI resources.
- App Service plan: **Basic B1**, as selected by the user. Check the Linux B1
  price shown for the approved region before creating the plan. The plan remains
  billable even if the app is stopped; delete the dedicated test plan when no
  longer needed, after checking that it does not host other apps.
- After creation, enable **Always On** in the web app's general settings; B1
  supports it and this avoids idle unloading during phone testing.
- Do not create a new SQL database or enable deployment-time migrations.
- Leave Application Insights/request-body collection disabled for this test.

For this temporary out-of-support runtime, consider App Service access
restrictions that allow only the user's approved public IP and deny other
traffic. The phone must then use the same Wi-Fi/public egress IP. Review the
SCM/deployment endpoint restrictions too. The AutoMapper patch does not make
the .NET 8 runtime supported or this deployment production-ready.

If .NET 8 is missing from the runtime picker, stop before creating a different
runtime. The user can check platform availability in Cloud Shell:

```bash
az webapp list-runtimes --os linux
```

An outdated runtime may be hidden in Portal even when still provisionable through
CLI/ARM. If `DOTNETCORE:8.0` is available, a separately reviewed user-run resource
creation command can select it. If it is no longer available, use a separately
approved framework upgrade or self-contained/container deployment; do not
silently roll this binary forward to .NET 10.

Record the **Default domain** shown by Azure; newer hostnames may include a
region/hash. Do not assume the hostname from the app name alone.

## 3. Configure the API before publishing (user)

App Service **Environment variables > App settings**. Nested .NET keys use `__`.
Enter secret values privately, preferably using existing Key Vault references.
Do not upload development JSON files to substitute for these settings.

| Setting | Required source/purpose |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production`; do not use Development to bypass missing settings. |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | ZIP deployment only: `false`. Not needed for the current custom-container route. |
| `ConnectionStrings__DefaultConnection` | Existing approved SQL connection; preserve the database target. |
| `Firebase__ProjectId` | Existing Firebase project. |
| `Firebase__AdminKeyPath` | Despite the name, the code also accepts service-account **JSON** directly. Use a protected setting/Key Vault reference containing the existing JSON, not a PC file path. |
| `Firebase__WebApiKey` | Existing project API key, used by password-change verification. |
| `Pinecone__ApiKey` | Existing Pinecone credential. |
| `AzureAI__ProjectEndpoint` | Existing Foundry project endpoint. Keep the approved agent/deployment names and limits. |
| `AzureAIEmbedding__Endpoint` | Existing Azure OpenAI embedding endpoint. |
| `AzureAIEmbedding__EmbeddingDeploymentName` | Existing embedding deployment. |
| `AzureAIEmbedding__ApiKey` | Existing embedding credential. |
| `AzureStorage__ConnectionString` | Existing approved thesis/PDF storage connection. |
| `AzureStorage__ContainerName` | Existing PDF container. |
| `Auth__JwtSigningKey` | Existing approved stable base64 key containing at least 32 bytes. Production has no ephemeral fallback. Do not reuse the ID-verifier RSA private key. If no stable cloud key exists, provision it privately before publishing; the agent does not generate it. |
| `DataProtection__KeysPath` | `/home/monteai-data-protection`; persist MFA protection keys across restarts. |
| `Serilog__WriteTo__1__Args__path` | `/home/LogFiles/monteai-.json`; keep file logs outside the deployed package. Do not log request bodies, Authorization, captures, or receipts. |
| `PING_SECRET` | Existing approved nonempty health-check secret; never send it in a URL. |
| `Backup__Scheduled__Enabled` | `false` for this test. |
| `Email__Enabled` | `false` unless SMTP has been separately configured. |

The packaged `appsettings.json` retains non-secret agent settings. If your
development file overrides agent names, pool settings, index name, namespaces,
or other required values, supply those approved overrides in App Service as
well; do not assume the development file was deployed.

### ID-verification receipt trust

The hosted API must trust the **already deployed** verifier, not the local signer.
Check privately before attempting another paid OCR scan:

| Setting | Required value |
| --- | --- |
| `IdVerification__Issuer` | Exact `IDV_RECEIPT_ISSUER` from the verifier; normally `https://monteai-id-verifier.azurewebsites.net`, no route/trailing slash. |
| `IdVerification__Audience` | Matching verifier audience, normally `monteai-registration`. |
| `IdVerification__PublicKeys__0__KeyId` | Existing deployed verifier's signing-key ID. |
| `IdVerification__PublicKeys__0__PublicKeyPemBase64` | Base64 of the matching **public** PEM; never the private key. |
| `IdVerification__MaximumReceiptLifetimeSeconds` | `600`. |
| `IdVerification__ClockSkewSeconds` | `30`. |
| `IdVerification__AllowedTemplateIds__0` | `cdm-front-v1`. |

Do not regenerate/replace signing material or raise verifier quotas during API
deployment. Hosting the API will not fix an ID-template rejection by itself.

### Managed identity, networking, and HTTPS

- Enable the web app's **system-assigned managed identity**. Grant that identity
  the appropriate existing Foundry project role (normally **Azure AI User**).
  The API's Foundry client uses Entra authentication; the PC's `az login` does
  not transfer to Azure. Keep it in the tenant holding the existing project.
- Ensure existing SQL/Storage/AI network rules permit the web app, using the
  approved network setup. Do not enable broad firewall exceptions blindly.
- Enable App Service **HTTPS Only**. Use the platform's certificate, not local
  mkcert files. Leave Linux startup discovery enabled, or use `dotnet server.dll`.
- App Service terminates TLS before the app. If custom startup/proxy settings
  cause redirect loops, configure trusted forwarded headers for that hosting
  environment; do not disable certificate validation or expose development mode.
- `Program.cs` already allows `https://192.168.100.8:5173` for phone testing.
  Keep ASP.NET as the CORS source of truth; do not add wildcard Azure CORS.

## 4. Publish (user)

After configuration is saved, run this in the user's local Azure CLI terminal
(substitute only the resource group, web app name, and audited ZIP path):

```powershell
az webapp deploy --resource-group "<resource-group>" --name "<api-app-name>" --src-path "<audited-zip-path>" --type zip
```

This uploads and restarts the API. Prefer Entra login; do not paste publishing
credentials/access tokens into commands or this repository. Linux App Service
does not support Kudu's drag-and-drop ZIP push UI; use the CLI or Visual Studio
publishing instead. Never upload a source ZIP or private publish profile.

## 5. Validate without another OCR charge

- `/swagger` and `/` are **not** public production readiness checks: Swagger is
  Development-only and the default policy requires authentication.
- App Service health probing cannot use the current secret-protected `/health`
  route without its required header. Do not configure that as an anonymous
  App Service Health Check path. Keep the secret private.
- Privately change web `VITE_API_BASE_URL` to `https://<actual-default-domain>/api/v1`.
  Keep `VITE_ID_VERIFICATION_ENDPOINT` on the existing verifier. Restart Vite in
  the same terminal to preserve any process-scoped verifier override.
- Try ordinary phone login and a profile/catalog request first. Share only safe
  UI/status results, not successful bodies, tokens, raw network dumps, or logs.
- Only after API reachability and receipt trust are correct, perform one fresh
  ID capture. No migrations, re-ingestion, quotas, or database targets change.
- Return `IDV_ENABLED` to `false` after OCR testing wraps up.

References: [App Service ASP.NET configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-language-dotnetcore),
[ZIP deployment](https://learn.microsoft.com/en-us/azure/app-service/deploy-zip),
[.NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core).
