const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID;


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
                "Authorization": `Bearer ${LOOPS_API_KEY}`
            },
            body: JSON.stringify({
                transactionalId: transactionEmailId,
                "email": targetEmail,
                "dataVariables": {
                    ...emailParams,
                }
            })
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
        targetEmail, { updates, reviewer, project_link });
}