import { describe, expect, test } from "bun:test";

const {
  blockquote,
  buildCreatorReviewMessage,
  buildStaffSubmissionMessage,
  buildStaffThreadReply,
  escapeSlackText,
  formatHoursFromSeconds,
  formatRejectionCategory,
  truncateForSlack,
} = await import("./review-messages.ts");

describe("escapeSlackText", () => {
  test("escapes the three mrkdwn control characters", () => {
    expect(escapeSlackText("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });
});

describe("formatHoursFromSeconds", () => {
  test("rounds to a tenth under ten hours and to whole hours above", () => {
    expect(formatHoursFromSeconds(0)).toBe("0h");
    expect(formatHoursFromSeconds(null)).toBe("0h");
    expect(formatHoursFromSeconds(1800)).toBe("0.5h");
    expect(formatHoursFromSeconds(7 * 3600)).toBe("7h");
    expect(formatHoursFromSeconds(12.6 * 3600)).toBe("13h");
  });
});

describe("truncateForSlack / blockquote", () => {
  test("truncates long text with an ellipsis", () => {
    const long = "x".repeat(700);
    const out = truncateForSlack(long);
    expect(out.length).toBe(600);
    expect(out.endsWith("…")).toBe(true);
  });

  test("quotes every line and escapes content", () => {
    expect(blockquote("line <1>\nline 2")).toBe("> line &lt;1&gt;\n> line 2");
  });
});

describe("formatRejectionCategory", () => {
  test("humanizes keys and ignores blanks", () => {
    expect(formatRejectionCategory("ai-slop")).toBe("ai slop");
    expect(formatRejectionCategory("unclear_readme")).toBe("unclear readme");
    expect(formatRejectionCategory("")).toBeNull();
    expect(formatRejectionCategory(null)).toBeNull();
  });
});

describe("buildCreatorReviewMessage", () => {
  test("first submission vs resubmission wording", () => {
    const base = { projectName: "Tab Rot", status: "submitted", projectUrl: "https://c.test/projects/1" };
    expect(buildCreatorReviewMessage(base)).toContain("We got your submission.");
    expect(buildCreatorReviewMessage({ ...base, isResubmission: true })).toContain(
      "We got your resubmission.",
    );
  });

  test("links the project and escapes its name", () => {
    const text = buildCreatorReviewMessage({
      projectName: "A <b> & c",
      status: "rejected",
      projectUrl: "https://c.test/projects/1",
      creatorSlackId: "U1",
      comment: "Needs a README",
      reviewerSlackId: "U2",
    });
    expect(text).toContain("Hey <@U1>,");
    expect(text).toContain("<https://c.test/projects/1|A &lt;b&gt; &amp; c>");
    expect(text).toContain("*Comment:*\n> Needs a README");
    expect(text).toContain("*By:* <@U2>");
  });

  test("approved copy mentions credited tokens and omits missing reviewer", () => {
    const text = buildCreatorReviewMessage({ projectName: "P", status: "approved" });
    expect(text).toContain("approved and granted");
    expect(text).not.toContain("*By:*");
    expect(text).toContain("*Project:* *P*");
  });
});

describe("buildStaffSubmissionMessage", () => {
  const base = {
    projectName: "Tab Rot",
    reviewUrl: "https://c.test/review/p1",
    creatorName: "Ada Lovelace",
    creatorSlackId: null,
    editorLabel: "vscode",
    projectTypeLabel: "Extension / Plugin",
    devlogSeconds: 7.5 * 3600,
    hackatimeSeconds: 8 * 3600,
    isResubmission: false,
    submissionNumber: 1,
    priorReviewCount: 0,
    lastRejectionCategory: null,
    lastRejectionComment: null,
  };

  test("new submission shows headline, creator name, hours and link", () => {
    const text = buildStaffSubmissionMessage(base);
    expect(text.startsWith("🎪 *New submission:* <https://c.test/review/p1|Tab Rot>")).toBe(true);
    expect(text).toContain("*Creator:* Ada Lovelace");
    expect(text).toContain("*Hours:* 7.5h in devlogs · 8h Hackatime");
    expect(text).not.toContain("*History:*");
    expect(text).toContain("<https://c.test/review/p1|Open review →>");
  });

  test("resubmission adds history, last rejection and mentions the creator", () => {
    const text = buildStaffSubmissionMessage({
      ...base,
      creatorSlackId: "U9",
      isResubmission: true,
      submissionNumber: 3,
      priorReviewCount: 4,
      lastRejectionCategory: "ai-slop",
      lastRejectionComment: "Looks generated.",
      hackatimeSeconds: null,
    });
    expect(text.startsWith("🔁 *Resubmission #3:*")).toBe(true);
    expect(text).toContain("*Creator:* <@U9>");
    expect(text).toContain("*History:* 4 prior reviews");
    expect(text).toContain("*Last rejection:* ai slop");
    expect(text).toContain("> Looks generated.");
    expect(text).toContain("*Hours:* 7.5h in devlogs\n");
  });
});

describe("buildStaffThreadReply", () => {
  test("pass-1 approval is labelled and shows hours", () => {
    const text = buildStaffThreadReply("Tab Rot", {
      kind: "reviewer_decision",
      decision: "approved",
      reviewerName: "Grace",
      reviewerSlackId: "U2",
      comment: "",
      approvedHours: 7.5,
      dismissed: false,
      rejectionCategory: null,
    });
    expect(text).toBe("✅ <@U2> approved *Tab Rot* (pass 1) · 7.5h approved — ready for the grant page.");
  });

  test("dismissed rejection with category and quoted comment", () => {
    const text = buildStaffThreadReply("Tab Rot", {
      kind: "reviewer_decision",
      decision: "rejected",
      reviewerName: "Grace",
      reviewerSlackId: null,
      comment: "No.",
      approvedHours: null,
      dismissed: true,
      rejectionCategory: "ai-slop",
    });
    expect(text).toBe("⛔ Grace rejected and dismissed *Tab Rot* · ai slop.\n> No.");
  });

  test("owner comment and grant replies", () => {
    expect(
      buildStaffThreadReply("Tab Rot", {
        kind: "owner_comment",
        creatorName: "Ada",
        creatorSlackId: null,
        comment: "Fixed <it>",
      }),
    ).toBe("🗣️ Ada (creator) replied on *Tab Rot*:\n> Fixed &lt;it&gt;");
    expect(
      buildStaffThreadReply("Tab Rot", { kind: "granted", approvedHours: 7.5, tokensIssued: 75 }),
    ).toBe("🎉 *Tab Rot* granted · 7.5h · 75 tokens credited.");
  });
});
