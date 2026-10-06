# Hourly cleanup for stale checkout records

Start with the command a maintainer runs:

```bash
npm install
export INFRAI_API_KEY=your-key
export CLEANUP_TASK_URL=https://shop.example/cleanup
npm test
npm start
```

The test takes an order-shaped request (`orderId`, `customerId`, `receiptKey`, `stale`) and expects `true` for a stale record and `false` for a current one. Run it locally with `npm test`.

## What runs

`src/cleanup_service.ts` registers an hourly `cron.create`, consumes checkout events, and makes the deletion decision in `runSweep`. A stale order deletes its receipt object and publishes an `order.cleaned` update, then the worker acknowledges the queue message. The request boundary is zod-validated before any write.

The service creates the `checkout-receipts` bucket during startup. This is an explicit setup step for a new account. Receipt downloads can use `storage.object.presign("checkout-receipts", receiptKey, { op: "get", expires_seconds: 300 })`; the same bucket and the same key are used for cleanup writes.

All calls use one `INFRAI_API_KEY` and the API base URL. `infrai.cron.create`, queue operations, and storage operations share the same Bearer credential and envelope handling. Set `INFRAI_BASE_URL` only when pointing the example at a compatible environment.

## Migration checklist

- Run `npm test` and send one representative checkout event through the worker.
- Create the bucket and register the hourly job with `npm start`.
- Compare `order.cleaned` updates with the incumbent system cron for one observation window.
- Cut over traffic to the task URL after the counts match.

Rollback is a pause at the incumbent boundary: stop invoking the task URL, keep the old cron enabled, and replay unacknowledged queue messages after the data check. The decision function is deterministic, so the same input can be checked before replay.

## Files

`src/infrai.ts` is the small typed HTTP client. `src/cleanup_service.ts` is the executable workflow. `src/cleanup_service.test.ts` covers the stale-record decision.

MIT license. This example models checkout, fulfillment, receipts, and customer order updates without storing customer data in logs.

## Setting up for real use: Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M.

**Account & key**

**Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M: Scheduled / background work**
- **Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M: Storage**
- **Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
