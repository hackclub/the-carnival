const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID;


async function sendEmailWithLoops(
    transactionEmailId: string,
    targetEmail: string,
    emailParams: Record<string, string>,
) {
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
    console.log(result);
    if (!result.success) throw new Error("Failed to send loops email");
}


export async function sendReviewEmail(targetEmail: string, updates: string, reviewer: string, project_link: string) {
    await sendEmailWithLoops(
        LOOPS_TRANSACTIONAL_REVIEW_EMAIL_ID!,
        targetEmail, { updates, reviewer, project_link });
}