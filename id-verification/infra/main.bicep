targetScope = 'resourceGroup'

@allowed(['southeastasia'])
param location string = 'southeastasia'

@minLength(3)
@maxLength(40)
param functionAppName string

param firebaseProjectId string

@description('Exact HTTPS client origins. Localhost HTTP origins can be included for development.')
@minLength(1)
param allowedOrigins array

@description('Email addresses receiving the resource-group monthly budget alerts.')
@minLength(1)
param alertEmails array

@secure()
param receiptPrivateKeyB64 string

@secure()
param quotaHmacKeyB64 string

param receiptKeyId string = 'idv-2026-01'
param verificationEnabled bool = true

@description('Keep this stable on subsequent deployments; budgets start on the first of a month.')
param budgetStartDate string = utcNow('yyyy-MM-01')

@description('Budget currency is inherited from the subscription. This preset requires USD billing.')
@allowed(['USD'])
param billingCurrency string = 'USD'

var storageName = 'idv${uniqueString(resourceGroup().id, functionAppName)}'
var deploymentContainer = 'function-releases'
var quotaTableName = 'IdVerificationQuota'
var tags = {
  application: 'MonteAI'
  component: 'id-verification'
  monthlyBudget: '5 ${billingCurrency}'
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    isVersioningEnabled: false
    deleteRetentionPolicy: { enabled: false }
    containerDeleteRetentionPolicy: { enabled: false }
  }
}

resource packages 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: deploymentContainer
  properties: { publicAccess: 'None' }
}

resource tables 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource quota 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = {
  parent: tables
  name: quotaTableName
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${functionAppName}-plan'
  location: location
  tags: tags
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true }
}

resource function 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${packages.name}'
          authentication: { type: 'SystemAssignedIdentity' }
        }
      }
      runtime: { name: 'python', version: '3.12' }
      scaleAndConcurrency: {
        // Azure's minimum allowed maximum is 40, not a minimum running count.
        // Scale-to-zero + shared table reservations provide the cost controls.
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
        triggers: { http: { perInstanceConcurrency: 1 } }
        alwaysReady: []
      }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
    }
  }
}

var storageRoles = [
  'b7e6dc6d-f1e8-4753-8033-0f276bb0955b' // Blob Data Owner: host + deployment package
  '974c5e8b-45b9-4653-ba55-5f855dd0fb88' // Queue Data Contributor: Functions host
  '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3' // Table Data Contributor: shared admission counters
]

resource permissions 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for role in storageRoles: {
  name: guid(storage.id, function.id, role)
  scope: storage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', role)
    principalId: function.identity.principalId
    principalType: 'ServicePrincipal'
  }
}]

resource settings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: function
  name: 'appsettings'
  properties: {
    AzureWebJobsStorage__credential: 'managedidentity'
    AzureWebJobsStorage__blobServiceUri: storage.properties.primaryEndpoints.blob
    AzureWebJobsStorage__queueServiceUri: storage.properties.primaryEndpoints.queue
    AzureWebJobsStorage__tableServiceUri: storage.properties.primaryEndpoints.table
    FUNCTIONS_REQUEST_BODY_SIZE_LIMIT: '4194304'
    PYTHON_THREADPOOL_THREAD_COUNT: '1'
    IDV_FIREBASE_PROJECT_ID: firebaseProjectId
    IDV_ALLOWED_ORIGINS: join(allowedOrigins, ',')
    IDV_RECEIPT_ISSUER: 'https://${function.properties.defaultHostName}'
    IDV_RECEIPT_AUDIENCE: 'monteai-registration'
    IDV_RECEIPT_KEY_ID: receiptKeyId
    IDV_RECEIPT_PRIVATE_KEY_B64: receiptPrivateKeyB64
    IDV_QUOTA_HMAC_KEY_B64: quotaHmacKeyB64
    IDV_TABLE_ENDPOINT: storage.properties.primaryEndpoints.table
    IDV_QUOTA_TABLE: quotaTableName
    IDV_MONTHLY_ATTEMPTS: '6000'
    IDV_MONTHLY_COMPUTE_SECONDS: '40000'
    IDV_DAILY_USER_ATTEMPTS: '8'
    IDV_MONTHLY_USER_ATTEMPTS: '20'
    IDV_ENABLED: string(verificationEnabled)
  }
  dependsOn: [permissions, quota]
}

resource budget 'Microsoft.Consumption/budgets@2024-08-01' = {
  name: 'id-verification-monthly-5-usd'
  properties: {
    amount: 5
    category: 'Cost'
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: budgetStartDate
      endDate: dateTimeAdd(budgetStartDate, 'P5Y')
    }
    notifications: {
      actual60: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 60
        thresholdType: 'Actual'
        contactEmails: alertEmails
      }
      actual80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: alertEmails
      }
      actual100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: alertEmails
      }
    }
  }
}

output endpoint string = 'https://${function.properties.defaultHostName}/api/v1/id-verification'
output receiptIssuer string = 'https://${function.properties.defaultHostName}'
output storageAccountName string = storage.name
output functionName string = function.name
