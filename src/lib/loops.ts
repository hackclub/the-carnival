const LOOPS_API_KEY = process.env.LOOPS_API_KEY?.trim();
const LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID?.trim();
const LOOPS_TRANSACTIONAL_SHOP_ORDER_CREATED_ADMIN_EMAIL_ID =
  process.env.LOOPS_TRANSACTIONAL_SHOP_ORDER_CREATED_ADMIN_EMAIL_ID?.trim();
const LOOPS_TRANSACTIONAL_SHOP_ORDER_FULFILLED_PARTICIPANT_EMAIL_ID =
  process.env.LOOPS_TRANSACTIONAL_SHOP_ORDER_FULFILLED_PARTICIPANT_EMAIL_ID?.trim();
const LOOPS_TRANSACTIONAL_PROJECT_SUBMITTED_STAFF_EMAIL_ID =
  process.env.LOOPS_TRANSACTIONAL_PROJECT_SUBMITTED_STAFF_EMAIL_ID?.trim();

type LoopsEmailParams = Record<string, string | number | boolean | null | undefined>;

function stringifyEmailParams(emailParams: LoopsEmailParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(emailParams).map(([key, value]) => [key, value == null ? "" : String(value)]),
  );
}

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || "https://carnival.hackclub.com";
}

const LOOPS_TRANSACTIONAL_URL = "https://app.loops.so/api/v1/transactional";

// Loops allows 10 requests/second per team. Every call from this process goes
// through one shared pacer (one request start per 110ms, ~9/s to leave
// headroom for timer jitter), so fan-outs like
// "email every reviewer" can't burst past it. The limit is per process; a
// multi-instance deploy would need a shared limiter.
const LOOPS_MIN_REQUEST_INTERVAL_MS = 110;
const LOOPS_MAX_429_RETRIES = 3;
const LOOPS_429_BASE_DELAY_MS = 1000;
let nextLoopsRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLoopsSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextLoopsRequestAt);
  nextLoopsRequestAt = slot + LOOPS_MIN_REQUEST_INTERVAL_MS;
  if (slot > now) await sleep(slot - now);
}

function retryAfterMs(response: Response, attempt: number) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 10_000);
  return LOOPS_429_BASE_DELAY_MS * 2 ** attempt;
}

/** POST a transactional send, paced and retried (bounded) on HTTP 429 only. */
async function postLoopsTransactional(payload: {
  transactionalId: string;
  email: string;
  dataVariables: Record<string, string>;
}): Promise<Response> {
  const body = JSON.stringify(payload);
  for (let attempt = 0; ; attempt++) {
    await waitForLoopsSlot();
    const response = await fetch(LOOPS_TRANSACTIONAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body,
    });
    if (response.status !== 429 || attempt >= LOOPS_MAX_429_RETRIES) return response;
    await sleep(retryAfterMs(response, attempt));
  }
}

async function sendEmailWithLoops(
  transactionEmailId: string | undefined,
  targetEmail: string,
  emailParams: LoopsEmailParams,
) {
  // Best-effort: do nothing if keys are missing.
  if (!LOOPS_API_KEY || !transactionEmailId) {
    console.warn("Loops API disabled (missing key or transactional ID)");
    return;
  }

  const recipientEmail = targetEmail.trim();
  if (!recipientEmail) return;

  try {
    const response = await postLoopsTransactional({
      transactionalId: transactionEmailId,
      email: recipientEmail,
      dataVariables: stringifyEmailParams(emailParams),
    });

    const result = await response.json();
    if (!result?.success) {
      console.warn("Loops email send failed", result);
    }
  } catch (err) {
    console.warn("Loops email send error", err);
  }
}

const LOOPS_TRANSACTIONAL_NUDGE_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_NUDGE_EMAIL_ID?.trim();

export function isNudgeEmailEnabled(): boolean {
  return Boolean(LOOPS_API_KEY && LOOPS_TRANSACTIONAL_NUDGE_EMAIL_ID);
}

/**
 * Send an admin activation nudge email. Unlike the best-effort transactional
 * sends above, this reports success so the admin UI can show per-user results.
 * Requires a Loops transactional template with `first_name` and `message`
 * data variables; its ID goes in LOOPS_TRANSACTIONAL_NUDGE_EMAIL_ID.
 */
export async function sendNudgeEmail(
  targetEmail: string,
  params: { first_name: string; message: string },
): Promise<boolean> {
  if (!isNudgeEmailEnabled()) return false;
  const recipientEmail = targetEmail.trim();
  if (!recipientEmail) return false;

  try {
    const response = await postLoopsTransactional({
      transactionalId: LOOPS_TRANSACTIONAL_NUDGE_EMAIL_ID!,
      email: recipientEmail,
      dataVariables: stringifyEmailParams(params),
    });
    const result = await response.json();
    if (!result?.success) {
      console.warn("Loops nudge email send failed", result);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Loops nudge email send error", err);
    return false;
  }
}

export async function sendReviewEmail(
  targetEmail: string,
  updates: string,
  reviewer: string,
  project_link: string,
) {
  await sendEmailWithLoops(
    LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID,
    targetEmail,
    { updates, reviewer, project_link },
  );
}

export async function sendShopOrderCreatedAdminEmail(
  targetEmail: string,
  params: {
    order_id: string;
    participant_name: string;
    participant_email: string;
    item_name: string;
    item_description: string;
    item_image_url: string;
    token_cost: number;
    created_at: string;
    admin_orders_url: string;
    order_note?: string | null;
  },
) {
  await sendEmailWithLoops(
    LOOPS_TRANSACTIONAL_SHOP_ORDER_CREATED_ADMIN_EMAIL_ID,
    targetEmail,
    params,
  );
}

export async function sendShopOrderFulfilledParticipantEmail(
  targetEmail: string,
  params: {
    participant_name: string;
    order_id: string;
    item_name: string;
    fulfillment_link: string;
    fulfilled_at: string;
    tokens_deducted: number;
    token_cost_snapshot: number;
    shop_url: string;
  },
) {
  await sendEmailWithLoops(
    LOOPS_TRANSACTIONAL_SHOP_ORDER_FULFILLED_PARTICIPANT_EMAIL_ID,
    targetEmail,
    params,
  );
}

/**
 * Tell an admin/reviewer that a project just entered the review queue.
 * Loops template variables: project_name, creator_name, project_description,
 * review_url, submitted_at, is_resubmission ("yes"/"no").
 */
export async function sendProjectSubmittedStaffEmail(
  targetEmail: string,
  params: {
    project_name: string;
    creator_name: string;
    project_description: string;
    review_url: string;
    submitted_at: string;
    is_resubmission: "yes" | "no";
  },
) {
  await sendEmailWithLoops(
    LOOPS_TRANSACTIONAL_PROJECT_SUBMITTED_STAFF_EMAIL_ID,
    targetEmail,
    params,
  );
}
