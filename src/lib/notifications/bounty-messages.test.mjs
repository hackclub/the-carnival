import { describe, expect, test } from "bun:test";

const { buildNewBountyMessage, richTextToSlack } = await import("./bounty-messages.ts");

describe("richTextToSlack", () => {
  test("converts the app's rich text to Slack mrkdwn", () => {
    expect(
      richTextToSlack("**Bold** and *soft*\n- one\n- [docs](https://example.com/a)", 500),
    ).toBe("*Bold* and _soft_\n• one\n• <https://example.com/a|docs>");
  });

  test("leaves asterisks inside URLs alone", () => {
    expect(richTextToSlack("[docs](https://example.com/a*b*c) and *soft*", 500)).toBe(
      "<https://example.com/a*b*c|docs> and _soft_",
    );
    expect(richTextToSlack("see https://example.com/a*b*c now", 500)).toBe(
      "see https://example.com/a*b*c now",
    );
  });

  test("converts links inside emphasis", () => {
    expect(richTextToSlack("**[docs](https://example.com/a)**", 500)).toBe(
      "*<https://example.com/a|docs>*",
    );
    expect(richTextToSlack("*see [docs](https://example.com/a)*", 500)).toBe(
      "_see <https://example.com/a|docs>_",
    );
    expect(richTextToSlack("*[docs](https://example.com/a*b*c)*", 500)).toBe(
      "_<https://example.com/a*b*c|docs>_",
    );
    expect(richTextToSlack("**[docs](https://example.com/a*b*c)**", 500)).toBe(
      "*<https://example.com/a*b*c|docs>*",
    );
  });

  test("unclosed emphasis around many links converts quickly", () => {
    const input = `*${"[x](http://a)".repeat(38)}!`;
    const started = performance.now();
    const out = richTextToSlack(input, 500);
    expect(performance.now() - started).toBeLessThan(200);
    expect(out).toBe(`*${"<http://a|x>".repeat(38)}!`);
  });

  test("placeholder characters in the input cannot inject a link", () => {
    expect(richTextToSlack("a \uE0000\uE001 b [x](http://a)", 500)).toBe("a 0 b <http://a|x>");
  });

  test("escapes author text so it cannot forge mentions or links", () => {
    expect(richTextToSlack("<!channel> & <@U123>", 500)).toBe(
      "&lt;!channel&gt; &amp; &lt;@U123&gt;",
    );
  });

  test("truncates long text", () => {
    const out = richTextToSlack("x".repeat(900), 500);
    expect(out.length).toBe(500);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("buildNewBountyMessage", () => {
  const base = {
    name: "Build a <terminal> widget",
    description: "Make a **delightful** widget.",
    requirements: "- Runs in VS Code",
    prizeUsd: 40,
    bountyUrl: "https://carnival.hackclub.com/bounties/b1",
    helpfulLinks: [{ label: "Docs", url: "https://example.com/docs" }],
  };

  test("includes the prize, time requirements, details and a link", () => {
    const text = buildNewBountyMessage(base);
    expect(text).toContain(
      "🎯 *New bounty:* <https://carnival.hackclub.com/bounties/b1|Build a &lt;terminal&gt; widget>",
    );
    // $40 at $5/hour is 8 hours; the minimum is 8 / 2 + 1.
    expect(text).toContain("*Prize:* $40 (worth 8 hours) · *Minimum time:* 5 hours");
    expect(text).toContain("Make a *delightful* widget.");
    expect(text).toContain("*Requirements*\n• Runs in VS Code");
    expect(text).toContain("*Helpful links:* <https://example.com/docs|Docs>");
    expect(text).toContain("See the bounty and claim it →");
  });

  test("a helpful link URL cannot break out of its link", () => {
    const text = buildNewBountyMessage({
      ...base,
      helpfulLinks: [{ label: "Docs", url: "https://example.com/><!channel>|x" }],
    });
    expect(text).not.toContain("<!channel>");
    expect(text).toContain("<https://example.com/%3E%3C!channel%3E%7Cx|Docs>");
  });

  test("leaves out empty sections", () => {
    const text = buildNewBountyMessage({ ...base, requirements: "", helpfulLinks: [] });
    expect(text).not.toContain("*Requirements*");
    expect(text).not.toContain("*Helpful links:*");
  });
});
