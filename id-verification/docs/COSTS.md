# Cost model and operational limits

## Target configuration

- Southeast Asia Azure Functions Flex Consumption
- Python 3.12, 2,048 MiB (one typical CPU core)
- scale to zero; zero always-ready instances
- HTTP concurrency 1 per instance
- maximum on-demand instance setting 40 (a ceiling, not 40 running instances)
- LRS StorageV2 for Functions host/packages and small Table quota rows
- no Application Insights resource

Azure for Students currently has a lower shared Southeast Asia Flex regional core quota than the
configured ceiling, which can further throttle scale. Quota is not a billing cap.

## Conservative admitted-work calculation

The Southeast Asia retail on-demand execution price checked on 2026-11-16 is
`$0.000037 / GB-second`. This project deliberately does not rely on free grants:

```text
40,000 admitted instance-seconds × 2 GB × $0.000037 = $2.96
6,000 executions × $0.40 / 1,000,000             ≈ $0.0024
```

That leaves about `$2.04` of the `$5` target for host/storage operations, rejected requests, and other
overhead. Storage transactions/capacity should be small but are not assumed to be zero.

Each accepted attempt reserves 30 seconds before image decode/OCR. Settlement atomically refunds unused
time while retaining `ceil(measured elapsed + 2 seconds)`. Worker death or failed settlement leaves all
30 seconds charged. Limits are 6,000 service attempts/month, 40,000 charged seconds/month, 8 attempts per
UID/day, and 20 per UID/month.

The current local clear-card warm path used about 1.4–1.6 seconds; Azure cold starts, host time, network,
and billing rounding have not been measured. At 500–5,000 monthly registrations the quota is plausible,
but only a deployed load test and Cost Management data can establish real capacity/cost.

## Why `$5` is not a hard cap

The Bicep resource-group budget sends actual-cost alerts at 60%, 80%, and 100%; Azure budgets do not
stop resources. Table admission bounds only authenticated/admitted OCR work. Invalid tokens, rejected
traffic, platform startup, delayed metering, storage, attacks, and services added to the resource group
can still incur cost. Azure does not provide a custom `$5` subscription spending limit.

Therefore this design targets, but cannot guarantee, `$5/month`. Do not describe it as a hard cap.

Operational response:

1. configure a monitored alert email and keep this service in its own resource group;
2. review Cost Analysis and Function execution metrics at least weekly during the pilot;
3. set `IDV_ENABLED=false` immediately if spend/traffic is abnormal (this still permits cheap rejected
   invocations, so disable the Function or remove public access if an attack continues);
4. validate the first full billing month before increasing quota;
5. re-query Azure Retail Prices and revise the calculation before each deployment.

Free grants, Student credit, and promotional pricing can reduce actual charges, but none is required by
the calculation above.
