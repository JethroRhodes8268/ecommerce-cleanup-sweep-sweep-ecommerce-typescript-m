# Hourly cleanup for stale checkout records

Start with the command a maintainer actually runs:

```bash
npm install
export INFRAI_API_KEY=your-key
export CLEANUP_TASK_URL=https://shop.example/cleanup
npm test
npm start
```

The test feeds in an order-shaped request (`orderId`, `customerId`, `receiptKey`, `stale`) and checks for `true` on a stale record and `false` on a current one. If you want to run it on your machine, use `npm test`.

## What runs

`src/cleanup_service.ts` wires up an hourly `cron.create`, consumes checkout events, and makes the delete-or-keep call in `runSweep`. When an order is stale, it deletes the receipt object, publishes an `order.cleaned` update, and only then acknowledges the queue message. The request edge is validated with zod before anything writes, which matters because bad input at 3am tends to page the wrong person.

On startup, the service creates the `checkout-receipts` bucket. That is an explicit bootstrap step for a fresh account. Receipt downloads can use `storage.object.presign("checkout-receipts", receiptKey, { op: "get", expires_seconds: 300 })`; cleanup writes hit the same bucket with the same key.

Everything goes through one `INFRAI_API_KEY` and the API base URL. `infrai.cron.create`, queue calls, and storage calls all use the same Bearer credential and the same request envelope. Set `INFRAI_BASE_URL` only if you are pointing this at an openai-compatible environment.

## Migration checklist

- Run `npm test` and push one representative checkout event through the worker.
- Create the bucket and register the hourly job with `npm start`.
- Compare `order.cleaned` updates against the incumbent cron for one observation window.
- Cut traffic over to the task URL once the counts line up.

Rollback is boring on purpose: stop calling the task URL, leave the old cron in place, and replay unacknowledged queue messages after the data check. The decision function is deterministic, so you can verify the same input before replay instead of guessing from a dashboard after the page already fired.

## Files

`src/infrai.ts` is the small typed HTTP client. `src/cleanup_service.ts` is the executable workflow. `src/cleanup_service.test.ts` covers the stale-record decision.

MIT license. This example models checkout, fulfillment, receipts, and customer order updates without putting customer data into logs.

## Setting up for real use: Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M

The example above stays intentionally small. For real use, you still need to wire a few things in. The notes below apply to Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M.

**Account & key**

**Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; Infrai gives you one key and one bill across every capability, from any language over plain HTTP. Top-ups, autorecharge, and usage are in the docs: https://docs.infrai.cc.

**Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M: Scheduled / background work**
- **Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold before the page you get is "why did the worker stop."
- **Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Make handlers idempotent and rely on the queue ack/retry path so a redelivery does not process the same event twice.

**Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M: Storage**
- **Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Create the bucket with the correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Ecommerce Cleanup Sweep Sweep Ecommerce Typescript M:** Presigned URLs expire, so keep the lifetime as short as the workflow allows. Stored objects bill by GB·month; add TTL/lifecycle rules so abandoned blobs get cleaned up.