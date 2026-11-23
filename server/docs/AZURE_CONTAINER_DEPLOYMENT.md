# Temporary .NET 8 container on Linux Basic B1

> **Deferred alternative:** the user has switched to **Code/ZIP deployment** on
> the existing Linux B1 app. Follow [the Code runbook](AZURE_DEPLOYMENT.md) instead.
> Do not create ACR, build an image, or configure container pulls for the current
> route. The instructions below are retained as a reference only.

**Container alternative:** keep .NET 8, build the Docker image using user-run Azure
Container Registry (ACR) Tasks, and host it in App Service **Linux Basic B1**.
No local Docker installation or .NET 10 SDK is needed. The earlier .NET 10
migration is not being applied. No cloud commands are run by the agent.

**Temporary testing only:** .NET 8 ended support on November 10, 2026. Docker
includes the runtime, bypassing the Portal runtime picker; it does not restore
security support. AutoMapper remains patched at 16.3.0. Upgrade before production.

## 1. Prepare an audited build context locally

From the repository root:

```powershell
& .\server\tools\test-package-azure-container.ps1
& .\server\tools\package-azure-container.ps1
```

The packer uses the already installed SDK only to evaluate MSBuild metadata. It
does not restore dependencies, start the API, access a database, or invoke Docker
or Azure. It copies an explicit allowlist: the project, Dockerfile, Docker ignore
rules, compiled C# sources, public `appsettings.json`, and the school logo.

Development configuration, Firebase credentials, keys, environment files, logs,
tests, build outputs, publish profiles, and linked/outside files are excluded.
Populated secret settings in public `appsettings.json` block packaging without
displaying their values. New build-input types require review instead of being
silently uploaded. Original local files are untouched.

Output is a fresh directory under `%TEMP%\opencode` containing:

- `context/`: the only directory approved for `az acr build`.
- `monteai-api-container-context.zip`: the same source context, with Linux paths,
  for uploading to Cloud Shell.
- `container-context-audit.json`: the ZIP hash and per-file hashes, outside the
  context. It records that a Docker build/live deployment has **not** been verified.

**Do not upload raw `server/`, the repository root, a development JSON file, or
any existing compiled API ZIP.** The context ZIP is not an App Service deployment
ZIP. Do not add local credentials to the context or pass secrets as build args.

Offline guard verification: 73 container-context checks and 33 shared/legacy
package checks passed. The prepared context contains 252 files, no forbidden
files, valid Linux paths, and AutoMapper 16.3.0. The prior 70 isolated API tests
passed; three Python receipt-contract tests were deliberately excluded. These
checks are not a substitute for the user-run Docker build and live startup.

## 2. Create/use ACR and build the image (user)

Use an existing approved private ACR, or in Azure Portal create a **Container
Registry** in your approved subscription/resource group/region. Review **Basic**
registry pricing before creating it. ACR storage/build charges are additional to
the App Service **B1** plan. Keep the registry admin account disabled; use Entra
authentication and managed identity. Do not share passwords, tokens, or build
logs containing credential material.

Record the registry's **name**, actual **Login server**, and **Role assignment
permissions mode**. Do not assume the hostname from the registry name. Do not
change the permissions mode of an existing registry merely for this test.

### Cloud Shell route (no local Azure CLI or Docker required)

1. Open Azure Cloud Shell **Bash** in the approved subscription.
2. Use **Upload/Download > Upload** to upload only the audited context ZIP.
3. Extract into a new directory; choose a unique suffix and do not overwrite an
   older build context:

```bash
unzip "monteai-api-container-context.zip" -d "monteai-api-build-<unique-suffix>"
```

4. Optionally compare `sha256sum` with the local audit's SHA-256 before building:

```bash
sha256sum "monteai-api-container-context.zip"
```

5. Run the cloud build. Replace the placeholders, use a new image tag, and keep
   the platform **linux/amd64**:

```bash
az acr build --registry "<registry-name>" --image "monteai-api:<unique-tag>" --platform linux/amd64 --file Dockerfile "monteai-api-build-<unique-suffix>"
```

ACR Tasks builds with `mcr.microsoft.com/dotnet/sdk:8.0`, restores the project
inside the build container, publishes Release, and pushes the final image to
your registry. The final stage uses `mcr.microsoft.com/dotnet/aspnet:8.0`, runs as
the non-root app user, and starts `dotnet server.dll`. It does not start the API
during the image build, run migrations, or copy development credentials.

For **RBAC Registry + ABAC Repository Permissions** registries, the build caller
needs the appropriate task and repository-write permissions. Add the following
flag to the build command as required by ACR's ABAC quick-build authentication:

```text
--source-acr-auth-id "[caller]"
```

If the subscription disallows ACR Tasks, stop and report the sanitized error;
do not change the subscription or install other tooling automatically. A local
Docker build would be a separately approved fallback. Do not run this API image
as an ACR quick-run with development secrets to test startup.

If using an already installed local Azure CLI instead, the same `az acr build`
command can use the packer's `ContextPath` directly. It still builds in Azure,
not on the PC. Never substitute the raw source directory.

## 3. Create/configure the container web app (user)

In **App Services > Create > Web App**:

- Publish: **Container / Docker Container**, not Code.
- Operating system: **Linux**; plan: **Basic B1**, one instance for this test.
- Use the approved subscription/resource group/region. Do not create or retarget
  a SQL database. Review B1 pricing; stopping the app does not stop plan billing.
- Image: `<actual-login-server>/monteai-api:<unique-tag>` from the successful
  build. Select the API image as the **main** container, not a sidecar.
- Registry authentication: managed identity, not embedded registry credentials.
- Leave startup-command override blank; the Dockerfile supplies the entrypoint.
- Enable **HTTPS Only** and **Always On**. Keep Application Insights/request-body
  collection disabled for this test. Do not upload local certificates.

### Container routing and persistent keys

The image listens on **HTTP 8080**; Azure terminates public HTTPS. `EXPOSE` alone
does not configure App Service routing:

- For a **sidecar-enabled / sitecontainers** app, configure the **main container's
  target port** as `8080`. Legacy `WEBSITES_PORT` does not apply in this mode.
- For a **classic single Docker container** app, set App Service
  `WEBSITES_PORT=8080`.
- Keep `ASPNETCORE_HTTP_PORTS=8080` and `ASPNETCORE_ENVIRONMENT=Production`.
- Set `WEBSITES_ENABLE_APP_SERVICE_STORAGE=true` and retain the `/home` mount.
  Linux custom-container storage is otherwise disabled by default. Configure
  `DataProtection__KeysPath=/home/monteai-data-protection` so MFA protection keys
  survive container replacement/restarts. Ensure the non-root user can write
  there. Do not store protection keys only in the disposable image filesystem.

### Image-pull identity

Enable/select the app's managed identity and configure the container to use it
for image pulls. Grant only the appropriate registry permissions:

- **RBAC Registry Permissions:** `AcrPull` scoped to the approved registry.
- **RBAC Registry + ABAC Repository Permissions:** `Container Registry Repository
  Reader`, preferably conditioned on repository `monteai-api`. `AcrPull` is not
  honored in this mode. Catalog-list permission is separate if registry browsing
  is required; it is not necessary merely to pull a known image reference.

Do not enable the ACR admin account or switch an existing registry's permissions
mode as a workaround. Ensure registry network rules permit the approved pull
path; do not enable broad firewall exceptions blindly.

## 4. Supply the protected API settings before live testing (user)

Use App Service settings/approved Key Vault references—not the Dockerfile,
image layers, Cloud Shell command arguments, or files in the uploaded context.
Follow the [API configuration and receipt-trust checklist](AZURE_DEPLOYMENT.md#3-configure-the-api-before-publishing-user).
The ZIP-only `SCM_DO_BUILD_DURING_DEPLOYMENT` setting is not needed here.

In particular:

- Preserve the existing SQL database, Firebase project, Pinecone/index settings,
  embedding endpoint/deployment, and thesis storage targets.
- Supply the existing approved stable base64 `Auth__JwtSigningKey` containing at
  least 32 bytes. There is no production ephemeral fallback. Do not generate or
  replace signing material as part of this deployment.
- `Firebase__AdminKeyPath` can contain protected service-account JSON directly;
  a PC file path will not work in the container.
- Grant the app identity the appropriate existing Foundry project access
  (normally **Azure AI User**), separately from its ACR pull role. The PC's
  `az login` does not transfer to the running application.
- Match the deployed verifier's issuer, audience, signing-key ID, and **public**
  PEM. Never copy its RSA private key into the API or the image. Keep receipt TTL
  `600`, skew `30`, template `cdm-front-v1`, and all verifier ceilings unchanged.
- Keep logs outside `/app`, using `/home/LogFiles/monteai-.json`. Never log request
  bodies, captures, OCR text, Firebase tokens, or receipts.

The app may fail startup until its required settings and permissions are saved.
Do not switch to Development or weaken receipt validation to work around this.

## 5. Validate without another OCR charge

Record Azure's actual **Default domain**. Follow the
[phone validation checklist](AZURE_DEPLOYMENT.md#5-validate-without-another-ocr-charge):
ordinary login and a safe UI/profile/catalog check first, before a fresh paid
capture. The agent never inspects successful live response bodies.

`/swagger` is Development-only. `/` is not an authenticated readiness check, and
the current `/health` needs a private `X-Ping-Secret`; do not configure it as an
anonymous App Service Health Check. Diagnose startup with sanitized statuses,
not secret dumps. Hosting alone will not fix template rejection or a receipt
trust mismatch. Return the verifier's `IDV_ENABLED` to `false` after OCR testing.

Do not delete a shared resource group for cleanup: it may contain the existing
SQL/AI/verifier resources. Remove only explicitly approved dedicated test
resources after checking dependencies, and keep all repository changes uncommitted.

References: [ACR cloud builds](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-quickstart-task-cli),
[custom containers](https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container),
[sidecar container configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-sidecar),
[ACR ABAC permissions](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions),
[.NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core).
