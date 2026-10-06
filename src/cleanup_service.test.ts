import assert from "node:assert/strict";
import { shouldDelete } from "./cleanup_service.js";

const stale = { orderId: "ord-7", customerId: "cus-2", receiptKey: "receipts/ord-7.json", stale: true };
const fresh = { ...stale, stale: false };
assert.equal(shouldDelete(stale), true);
assert.equal(shouldDelete(fresh), false);
console.log("cleanup decision test passed");
