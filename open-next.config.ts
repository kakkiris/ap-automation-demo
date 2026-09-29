import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Defaults are enough: the demos hold their state in the isolate for the length of a
// session and nothing is cached across viewers.
export default defineCloudflareConfig();
