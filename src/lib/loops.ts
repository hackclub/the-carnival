const LOOPS_API_KEY = process.env.LOOPS_API_KEY?.trim();
const LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID?.trim();
const LOOPS_TRANSACTIONAL_SHOP_ORDER_CREATED_ADMIN_EMAIL_ID =
  process.env.LOOPS_TRANSACTIONAL_SHOP_ORDER_CREATED_ADMIN_EMAIL_ID?.trim();
const LOOPS_TRANSACTIONAL_SHOP_ORDER_FULFILLED_PARTICIPANT_EMAIL_ID =
  process.env.LOOPS_TRANSACTIONAL_SHOP_ORDER_FULFILLED_PARTICIPANT_EMAIL_ID?.trim();

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
    const response = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        transactionalId: transactionEmailId,
        email: recipientEmail,
        dataVariables: stringifyEmailParams(emailParams),
      }),
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
    const response = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        transactionalId: LOOPS_TRANSACTIONAL_NUDGE_EMAIL_ID,
        email: recipientEmail,
        dataVariables: stringifyEmailParams(params),
      }),
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
