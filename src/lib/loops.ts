const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID;
const LOOPS_TRANSACTIONAL_SHOP_ORDER_CREATED_EMAIL_ID =
  process.env.LOOPS_TRANSACTIONAL_SHOP_ORDER_CREATED_EMAIL_ID;
const LOOPS_TRANSACTIONAL_SHOP_ORDER_FULFILLED_EMAIL_ID =
  process.env.LOOPS_TRANSACTIONAL_SHOP_ORDER_FULFILLED_EMAIL_ID;

async function sendEmailWithLoops(
  transactionEmailId: string,
  targetEmail: string,
  emailParams: Record<string, string>,
) {
  // Best-effort: do nothing if keys are missing.
  if (!LOOPS_API_KEY || !transactionEmailId) {
    console.warn("Loops API disabled (missing key or transactional ID)");
    return;
  }

  try {
    const response = await fetch("https://app.loops.so/api/v1/transactional", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        transactionalId: transactionEmailId,
        email: targetEmail,
        dataVariables: {
          ...emailParams,
        },
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

export async function sendReviewEmail(targetEmail: string, updates: string, reviewer: string, project_link: string) {
  await sendEmailWithLoops(
    LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID!,
    targetEmail,
    { updates, reviewer, project_link },
  );
}

type ShopOrderCreatedEmailInput = {
  orderId: string;
  itemName: string;
  requesterName: string;
  requesterEmail: string;
  orderNote: string | null;
  tokenCost: number;
  adminOrdersLink: string;
};

export async function sendShopOrderCreatedEmail(targetEmail: string, input: ShopOrderCreatedEmailInput) {
  await sendEmailWithLoops(
    LOOPS_TRANSACTIONAL_SHOP_ORDER_CREATED_EMAIL_ID!,
    targetEmail,
    {
      order_id: input.orderId,
      item_name: input.itemName,
      requester_name: input.requesterName,
      requester_email: input.requesterEmail,
      order_note: input.orderNote ?? "",
      token_cost: String(input.tokenCost),
      admin_orders_link: input.adminOrdersLink,
    },
  );
}

type ShopOrderFulfilledEmailInput = {
  orderId: string;
  itemName: string;
  fulfillmentLink: string;
  requesterOrdersLink: string;
};

export async function sendShopOrderFulfilledEmail(targetEmail: string, input: ShopOrderFulfilledEmailInput) {
  await sendEmailWithLoops(
    LOOPS_TRANSACTIONAL_SHOP_ORDER_FULFILLED_EMAIL_ID!,
    targetEmail,
    {
      order_id: input.orderId,
      item_name: input.itemName,
      fulfillment_link: input.fulfillmentLink,
      requester_orders_link: input.requesterOrdersLink,
    },
  );
}
