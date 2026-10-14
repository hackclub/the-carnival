import { after } from "next/server";

/**
 * Run best-effort work (Slack posts, emails) after the HTTP response is sent.
 *
 * Next's `after()` is the supported way inside a request scope. Outside one
 * (unit tests call route handlers directly; scripts have no request) it
 * throws synchronously, so fall back to a detached promise. The task's own
 * errors are logged and never propagate to the caller either way.
 */
export function runAfterResponse(task: () => Promise<unknown>, label = "after-response task") {
  const guarded = async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[notifications] ${label} failed`, err);
    }
  };
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
