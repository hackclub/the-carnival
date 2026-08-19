/**
 * ============================================================================
 * REVIEW PROGRAM CONFIGURATION — the single tuning point for this program.
 * ============================================================================
 *
 * Everything a YSWS program is likely to change when reusing Carnival's review
 * system lives in this file, in code (deliberately NOT environment variables,
 * so the rules are versioned, reviewed, and identical in every environment).
 *
 * The rules encoded here follow the YSWS Handbook ("Required Submission
 * Fields", "What Makes a Project Shipped?", "Override Hours Spent",
 * "Override Hours Spent Justification"). Programs may be STRICTER than the
 * handbook, never more relaxed.
 *
 * To port this review system to another program:
 *   1. Change PROGRAM_NAME / DEFAULT_PROJECT_TYPE / ENABLED_PROJECT_TYPES.
 *   2. Adjust allowlists/blocklists if your program trusts additional hosts.
 *   3. Adjust AI_APPROVED_HOURS_FACTOR only if your program's AI rule differs
 *      (it must stay <= the handbook's expectations, i.e. stricter or equal).
 */

// ----------------------------------------------------------------------------
// Program identity
// ----------------------------------------------------------------------------

export const PROGRAM_NAME = "The Carnival";

// ----------------------------------------------------------------------------
// Project types
// ----------------------------------------------------------------------------
// The universal catalog mirrors the project types in "What Makes a Project
// Shipped?". Every program enables a subset and picks a default. Carnival is
// an extensions/plugins program: the default type is "extension-plugin" and
// the existing per-project `editor` field acts as the platform sub-picker
// (which host application the extension/plugin targets).

export const PROJECT_TYPE_CATALOG = [
  {
    id: "extension-plugin",
    label: "Extension / Plugin",
    description:
      "A browser extension, editor extension, mod, plugin, or bot that extends another platform.",
  },
  {
    id: "website-webapp",
    label: "Website / Web App",
    description: "A website or web application reachable at a public URL.",
  },
  {
    id: "game-web",
    label: "Game (web playable)",
    description: "A game playable in the browser.",
  },
  {
    id: "game-downloadable",
    label: "Game (downloadable)",
    description: "A game with a downloadable build for at least one major OS.",
  },
  {
    id: "mobile-app",
    label: "Mobile App",
    description: "An iOS/Android app (store release, test release, or signed build).",
  },
  {
    id: "desktop-app",
    label: "Desktop App",
    description: "A desktop application with an installer/executable build.",
  },
  {
    id: "cli",
    label: "CLI",
    description: "A command-line tool released as a package or executable build.",
  },
  {
    id: "library",
    label: "Library",
    description: "A library released on a package host with usage documentation.",
  },
  {
    id: "hardware",
    label: "Hardware",
    description: "A hardware project with BOM/schematics/CAD in the repo.",
  },
  {
    id: "other",
    label: "Other",
    description: "Anything that does not fit the catalog. Reviewed case-by-case.",
  },
] as const;

export type ProjectTypeId = (typeof PROJECT_TYPE_CATALOG)[number]["id"];

/** Types this program accepts at submission time. */
export const ENABLED_PROJECT_TYPES: readonly ProjectTypeId[] = [
  "extension-plugin",
  "website-webapp",
];

/**
 * The default (and pre-selected) type for new projects. On Carnival every
 * submission is an extension/plugin, so this is effectively the program type;
 * other programs change this constant when they fork the review system.
 */
export const DEFAULT_PROJECT_TYPE: ProjectTypeId = "extension-plugin";

export function isEnabledProjectType(value: unknown): value is ProjectTypeId {
  return (
    typeof value === "string" &&
    (ENABLED_PROJECT_TYPES as readonly string[]).includes(value)
  );
}

export function projectTypeLabel(id: string | null | undefined): string {
  const entry = PROJECT_TYPE_CATALOG.find((t) => t.id === id);
  return entry ? entry.label : "Extension / Plugin";
}

// ----------------------------------------------------------------------------
// Source code URL — host ALLOWLIST
// ----------------------------------------------------------------------------
// Handbook: the Code URL must point to a version-control repository that is
// public and shows real commit history. We only accept known forges so
// reviewers never land on a random file host. Subdomains of these hosts are
// accepted (e.g. git.sr.ht, gist.github.com).
//
// Self-hosted Forgejo/Gitea instances a program trusts can be appended here.

export const CODE_HOST_ALLOWLIST: readonly string[] = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "codeberg.org", // flagship public Forgejo instance
  "sr.ht", // SourceHut (repos live on git.sr.ht — covered via subdomain match)
  "gitea.com",
];

// ----------------------------------------------------------------------------
// Playable URL — host BLOCKLIST + per-type rules
// ----------------------------------------------------------------------------
// Websites/web apps can live on any custom domain, so a pure allowlist is
// impossible. Instead we block what the handbook explicitly disallows
// (file lockers, notebook runners, Streamlit) and everything non-public,
// then layer per-type rules on top (see submission-gates.ts).

export const PLAYABLE_URL_BLOCKED_HOSTS: readonly string[] = [
  // File lockers — a drive folder is not a ship.
  "drive.google.com",
  "docs.google.com",
  "dropbox.com",
  "onedrive.live.com",
  "1drv.ms",
  "mega.nz",
  "wetransfer.com",
  "mediafire.com",
  // Hosted notebooks — development tools, not deployed demos (handbook).
  "colab.research.google.com",
  "mybinder.org",
  "kaggle.com",
  // Disallowed web hosts (handbook: use Nest/Railway/Render/Vercel instead).
  "streamlit.app",
  "share.streamlit.io",
];

/**
 * Per-platform store hosts for the "extension-plugin" type. The playable URL
 * for an extension must be a published store listing for its platform, OR a
 * release page/artifact on an allowed forge (e.g. a GitHub release with a
 * .crx/.zip/.vsix) for people who can't afford a store developer license yet
 * — mirroring the handbook's browser-extension carve-out.
 *
 * Keys are `project.editor` values; platforms not listed fall back to the
 * forge-release rule only.
 */
export const EXTENSION_STORE_HOSTS_BY_PLATFORM: Readonly<
  Record<string, readonly string[]>
> = {
  chrome: ["chromewebstore.google.com", "chrome.google.com"],
  firefox: ["addons.mozilla.org"],
  vscode: ["marketplace.visualstudio.com", "open-vsx.org"],
  figma: ["figma.com"],
  obsidian: ["obsidian.md"],
  godot: ["godotengine.org"],
  unity: ["assetstore.unity.com"],
  minecraft: ["modrinth.com", "curseforge.com", "hangar.papermc.io", "spigotmc.org"],
  discord: ["discord.com", "discordapp.com"],
  slack: ["slack.com"],
};

/** Web hosts allowed for web-playable games (handbook) besides itch.io. */
export const GAME_WEB_ALLOWED_HOSTS: readonly string[] = [
  "itch.io",
  "github.io",
  "vercel.app",
  "netlify.app",
  "pages.dev",
  "hackclub.dev",
  "nest.hackclub.app",
];

// ----------------------------------------------------------------------------
// Screenshots
// ----------------------------------------------------------------------------
// Handbook: screenshots must be images, cannot be animated (no GIFs).
// Carnival is stricter: PNG/JPG/JPEG only (no WebP, no SVG, no GIF), at least
// three, and they must be uploaded through the platform (our R2 bucket) —
// pasting arbitrary image URLs is not possible, so the platform controls the
// actual bytes and a spot-check never finds a dead or swapped image.

export const MIN_SCREENSHOT_COUNT = 3;

/** Content types the upload presigner will sign. Everything else is refused. */
export const ALLOWED_IMAGE_CONTENT_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/jpg",
];

/** File extensions (from our own R2 keys) accepted as screenshots. */
export const ALLOWED_SCREENSHOT_EXTENSIONS: readonly string[] = ["png", "jpg", "jpeg"];

// ----------------------------------------------------------------------------
// AI rules
// ----------------------------------------------------------------------------
// Handbook: AI-assisted projects are eligible when genuine effort went in;
// "when in doubt, deflate". Carnival codifies a stricter, mechanical rule so
// every reviewer applies the same math: when AI use is declared/determined
// for a devlog (a slice of the project's time), only ONE THIRD of the claimed
// time for that slice is approved. Reviewers may deflate further, never
// inflate above this cap.
//
// AI slop — a project generated with no meaningful iteration, testing, or
// refinement — is rejected outright, per the handbook.

export const AI_APPROVED_HOURS_FACTOR = 1 / 3;

/** Seconds approved for an AI-assisted slice of work. Floors, never rounds up. */
export function aiDeflatedSeconds(claimedSeconds: number): number {
  if (!Number.isFinite(claimedSeconds) || claimedSeconds <= 0) return 0;
  return Math.floor(claimedSeconds * AI_APPROVED_HOURS_FACTOR);
}

/**
 * User-facing rejection message for AI slop. Deliberately welcoming: the goal
 * is to invite real iteration, not to shame. Reviewers can append specifics.
 */
export const AI_SLOP_REJECTION_MESSAGE =
  "Thanks for submitting! After reviewing, it doesn't look like a lot of hands-on care went " +
  "into this project yet — it reads as mostly AI-generated without much iteration, testing, or " +
  "refinement of your own. We'd love to see you take it further: debug it, shape it, make it " +
  "yours, and resubmit. Genuine effort (even AI-assisted!) is always welcome.";

/**
 * User-facing rejection message for an unclear README. A README that doesn't
 * explain what the project is and how to set it up fails the handbook's
 * reproducibility requirement and is an automatic rejection.
 */
export const UNCLEAR_README_REJECTION_MESSAGE =
  "Thanks for submitting! Your README doesn't yet clearly explain what the project is and how " +
  "to set it up and run it. Reviewers (and anyone curious!) need to get it working in under a " +
  "couple of minutes from the README alone. Please expand it and resubmit.";

// ----------------------------------------------------------------------------
// Hours & deflation
// ----------------------------------------------------------------------------

/**
 * A human-written deflation note is required for ANY deflation (handbook:
 * "deflated from X to Y because ..."). The X→Y numbers are prefixed
 * automatically; the reviewer writes the "because".
 */
export const DEFLATION_NOTE_REQUIRED_FOR_ANY_REDUCTION = true;

// ----------------------------------------------------------------------------
// External review tools
// ----------------------------------------------------------------------------
// Links reviewers open to verify Hackatime activity, and which are embedded
// in the Airtable justification so a spot-checker can retrace the review.
// Billy (billy.3kh0.net) was retired in favor of joe.fraud. When Telescope
// ships, add it here — every review surface and the justification pick these
// up automatically.

export const REVIEW_TOOL_LINKS: readonly { key: string; label: string; baseUrl: string }[] = [
  {
    key: "joe-fraud",
    label: "joe.fraud",
    baseUrl: "https://joe.fraud.hackclub.com/billy",
  },
];
