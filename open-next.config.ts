import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal OpenNext config for Cloudflare Workers. We don't currently
// use incremental cache, queues, or tag cache — defaults are fine and
// keep the worker bundle small. Add overrides here later if/when we
// need ISR, on-demand revalidation, or Durable Object queues.
export default defineCloudflareConfig({});
