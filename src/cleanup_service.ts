import { z } from "zod";
import { InfraiClient, infrai } from "./infrai.js";

const checkoutQueue = process.env.CHECKOUT_QUEUE ?? "checkout-events";
const orderUpdatesQueue = process.env.ORDER_UPDATES_QUEUE ?? "order-updates";

export const cleanupRequest = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  receiptKey: z.string().min(1),
  stale: z.boolean()
});
export type CleanupRequest = z.infer<typeof cleanupRequest>;

export function shouldDelete(input: CleanupRequest): boolean {
  return cleanupRequest.parse(input).stale;
}

export async function runSweep(client: InfraiClient, request: CleanupRequest): Promise<{ deleted: boolean; orderId: string }> {
  const input = cleanupRequest.parse(request);
  if (!input.stale) return { deleted: false, orderId: input.orderId };
  await client.storage.object.delete_batch("checkout-receipts", { keys: [input.receiptKey] });
  await client.queue.publish({ queue: orderUpdatesQueue, payload: JSON.stringify({ type: "order.cleaned", orderId: input.orderId, customerId: input.customerId }) });
  return { deleted: true, orderId: input.orderId };
}

export async function registerSweep(): Promise<string> {
  await infrai.storage.bucket.create({ name: "checkout-receipts" });
  const job = await infrai.cron.create({ cron_expr: "0 * * * *", task: process.env.CLEANUP_TASK_URL ?? "https://example.test/cleanup-sweep" });
  return job.job_id;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const messages = await infrai.queue.consume({ queue: checkoutQueue, max_messages: 10, visibility_timeout: 60 });
  for (const message of messages.messages ?? []) {
    const request = cleanupRequest.parse(JSON.parse(message.payload));
    await runSweep(infrai, request);
    await infrai.queue.ack({ queue: checkoutQueue, message_id: message.message_id });
  }
  console.log(JSON.stringify({ processed: messages.messages?.length ?? 0 }));
}
