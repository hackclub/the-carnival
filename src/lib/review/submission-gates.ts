/**
 * SUBMISSION GATES — the automatic pre-review filter.
 *
 * Every rule that must hold BEFORE a project may enter the review queue lives
 * here as one pure function, `validateSubmissionRequirements`. The server
 * enforces it on the work-in-progress → in-review transition (so an API
 * client with a valid token cannot bypass it), and the submission UI runs the
 * exact same function to show people what's missing before they try.
 *
 * Rationale: reviewer time is the scarce resource. Anything a machine can
 * check — screenshot count and format, code-host allowlist, playable-URL
 * rules per project type, required declarations — is checked here so a
 * reviewer never opens a project that was dead on arrival.
 *
 * The rules follow the YSWS Handbook ("Required Submission Fields", "What
 * Makes a Project Shipped?"). Program-specific tuning lives in ./config.ts.
 */

import {
  ALLOWED_SCREENSHOT_EXTENSIONS,
  CODE_HOST_ALLOWLIST,
  EXTENSION_STORE_HOSTS_BY_PLATFORM,
  MIN_SCREENSHOT_COUNT,
  PLAYABLE_URL_BLOCKED_HOSTS,
  isEnabledProjectType,
  type ProjectTypeId,
} from "./config";
import {
  hostMatchesAny,
  isForgeReleaseUrl,
  isNonPublicHost,
  isUrlOnPublicBase,
  parseHttpUrl,
  urlPathExtension,
} from "./urls";

// ----------------------------------------------------------------------------
// Declarations the creator must check before submitting.
// ----------------------------------------------------------------------------
// Unlike the old checklist (which recorded unchecked answers "for reviewer
// context"), these BLOCK submission. `usedAi` is intentionally absent: it is
// a disclosure, not a promise, and must never be forced either way.

export const REQUIRED_SUBMISSION_DECLARATIONS: readonly string[] = [
  "readmeDescribesProject",
  "readmeInstructions",
  "testedWorking",
  "githubPublic",
  "descriptionClear",
  "screenshotsWorking",
  "worksOnDeclaredPlatform",
  "didNotManipulateHackatimeData",
  "didNotCopyCodeWithoutAttribution",
];

export type SubmissionGateFailure = {
  /** Stable machine-readable code (also used as the UI checklist item id). */
  code: string;
  /** Human-readable explanation shown to the creator. */
  message: string;
};

export type SubmissionGateInput = {
  name: string;
  description: string;
  projectType: string | null | undefined;
  /** Platform sub-picker for extension/plugin projects (project.editor). */
  editor: string | null | undefined;
  editorOther: string | null | undefined;
  videoUrl: string;
  playableDemoUrl: string;
  codeUrl: string;
  screenshots: readonly string[];
  checklist: Record<string, boolean> | null | undefined;
  /**
   * Public base URL of the platform's R2 bucket. When provided (server side),
   * every screenshot must be hosted there — proving it went through our
   * upload flow. Pass null on the client, where the env value is unknown;
   * the server remains the authority.
   */
  r2PublicBaseUrl: string | null;
};

/**
 * Validate everything required for a project to enter the review queue.
 * Returns an empty array when the project may be submitted; otherwise, every
 * failed gate (not just the first) so the creator can fix them all at once.
 */
export function validateSubmissionRequirements(
  input: SubmissionGateInput,
): SubmissionGateFailure[] {
  const failures: SubmissionGateFailure[] = [];

  if (!input.name.trim()) {
    failures.push({ code: "name", message: "Project name is required." });
  }
  if (!input.description.trim()) {
    failures.push({ code: "description", message: "Project description is required." });
  }

  if (!isEnabledProjectType(input.projectType)) {
    failures.push({
      code: "project_type",
      message: "Select the project type so the right shipping rules apply.",
    });
  }

  if ((input.editor ?? "").trim() === "other" && !(input.editorOther ?? "").trim()) {
    failures.push({
      code: "editor_other",
      message: "Name the platform your extension/plugin targets.",
    });
  }

  validateScreenshots(input, failures);
  validateCodeUrl(input.codeUrl, failures);
  validateVideoUrl(input.videoUrl, failures);
  validatePlayableUrl(input, failures);
  validateDeclarations(input.checklist, failures);

  return failures;
}

// ----------------------------------------------------------------------------
// Screenshots
// ----------------------------------------------------------------------------
// >= MIN_SCREENSHOT_COUNT, PNG/JPG/JPEG only, and hosted on our own bucket.
// The handbook bans non-image and animated files; Carnival additionally bans
// WebP/SVG and requires platform uploads so the stored bytes are the bytes
// the reviewer approved.

function validateScreenshots(input: SubmissionGateInput, failures: SubmissionGateFailure[]) {
  const screenshots = input.screenshots.map((s) => s.trim()).filter(Boolean);

  if (screenshots.length < MIN_SCREENSHOT_COUNT) {
    failures.push({
      code: "screenshots_count",
      message: `Add at least ${MIN_SCREENSHOT_COUNT} screenshots of the project working.`,
    });
  }

  for (const screenshot of screenshots) {
    const url = parseHttpUrl(screenshot);
    const ext = url ? urlPathExtension(url) : null;
    if (!url || !ext || !ALLOWED_SCREENSHOT_EXTENSIONS.includes(ext)) {
      failures.push({
        code: "screenshots_format",
        message: "Screenshots must be PNG or JPG images (no GIF, WebP, or SVG).",
      });
      break;
    }
  }

  if (input.r2PublicBaseUrl) {
    const offPlatform = screenshots.some(
      (s) => !isUrlOnPublicBase(s, input.r2PublicBaseUrl as string),
    );
    if (offPlatform) {
      failures.push({
        code: "screenshots_hosting",
        message: "Screenshots must be uploaded here directly — external image links aren't accepted.",
      });
    }
  }
}

// ----------------------------------------------------------------------------
// Code URL
// ----------------------------------------------------------------------------
// Must be a known public forge (allowlist in config). The handbook requires a
// public version-control repository; the allowlist guarantees reviewers land
// on one, never on a file locker or a private tracker.

function validateCodeUrl(codeUrl: string, failures: SubmissionGateFailure[]) {
  const url = parseHttpUrl(codeUrl);
  if (!url) {
    failures.push({ code: "code_url", message: "Add a link to your source code repository." });
    return;
  }
  if (!hostMatchesAny(url.hostname, CODE_HOST_ALLOWLIST)) {
    failures.push({
      code: "code_url_host",
      message: `Source code must be on a known public forge (${CODE_HOST_ALLOWLIST.join(", ")}).`,
    });
  }
}

// ----------------------------------------------------------------------------
// Video URL
// ----------------------------------------------------------------------------
// Carnival keeps the demo video lenient (any public http(s) host, including
// Drive/YouTube/self-hosted): it is a Carnival-side review aid and is NOT
// forwarded to the Unified Database.

function validateVideoUrl(videoUrl: string, failures: SubmissionGateFailure[]) {
  if (!parseHttpUrl(videoUrl)) {
    failures.push({ code: "video_url", message: "Add a demo video link (http/https)." });
  }
}

// ----------------------------------------------------------------------------
// Playable URL — the per-type shipping rules from "What Makes a Project
// Shipped?". Common floor for every type: public http(s), not a file locker
// or notebook host (blocklist), not localhost/private-network.
// ----------------------------------------------------------------------------

function validatePlayableUrl(input: SubmissionGateInput, failures: SubmissionGateFailure[]) {
  const url = parseHttpUrl(input.playableDemoUrl);
  if (!url) {
    failures.push({
      code: "playable_url",
      message: "Add a public link where anyone can experience the project.",
    });
    return;
  }

  if (isNonPublicHost(url.hostname)) {
    failures.push({
      code: "playable_url_public",
      message: "The playable link must be publicly reachable (not localhost or a private network).",
    });
    return;
  }

  if (hostMatchesAny(url.hostname, PLAYABLE_URL_BLOCKED_HOSTS)) {
    failures.push({
      code: "playable_url_host",
      message:
        "That host can't be used as a playable link (file lockers, notebooks, and Streamlit aren't ships). Publish the project properly and link that instead.",
    });
    return;
  }

  const projectType = (input.projectType ?? "") as ProjectTypeId;

  switch (projectType) {
    case "extension-plugin": {
      // Store listing for the declared platform, or a release on an allowed
      // forge (.crx/.zip/.vsix/...) for platforms whose store needs a paid
      // developer license — the handbook's browser-extension carve-out.
      const platform = (input.editor ?? "").trim();
      const storeHosts = EXTENSION_STORE_HOSTS_BY_PLATFORM[platform] ?? [];
      const onStore = storeHosts.length > 0 && hostMatchesAny(url.hostname, storeHosts);
      const onForgeRelease = isForgeReleaseUrl(url, CODE_HOST_ALLOWLIST);
      if (!onStore && !onForgeRelease) {
        failures.push({
          code: "playable_url_type",
          message:
            storeHosts.length > 0
              ? `Extensions must link a published store listing (${storeHosts.join(", ")}) or a release on your code host (e.g. a GitHub release with the packaged extension).`
              : "Extensions must link a published store listing for their platform or a release on your code host (e.g. a GitHub release with the packaged extension).",
        });
      }
      return;
    }
    case "game-downloadable":
    case "desktop-app": {
      // Needs an actual build: a forge release with artifacts or itch.io.
      const onForgeRelease = isForgeReleaseUrl(url, CODE_HOST_ALLOWLIST);
      const onItch = hostMatchesAny(url.hostname, ["itch.io"]);
      if (!onForgeRelease && !onItch) {
        failures.push({
          code: "playable_url_type",
          message:
            "Downloadable projects must link a release with a build for at least one major OS (e.g. a GitHub release or itch.io page) — not a source code dump.",
        });
      }
      return;
    }
    case "mobile-app": {
      const storeHosts = ["apps.apple.com", "play.google.com", "testflight.apple.com"];
      const onStore = hostMatchesAny(url.hostname, storeHosts);
      const onForgeRelease = isForgeReleaseUrl(url, CODE_HOST_ALLOWLIST);
      if (!onStore && !onForgeRelease) {
        failures.push({
          code: "playable_url_type",
          message:
            "Mobile apps must link a store/TestFlight listing or a release with a signed build and sideloading instructions.",
        });
      }
      return;
    }
    case "cli":
    case "library": {
      const packageHosts = [
        "pypi.org",
        "npmjs.com",
        "crates.io",
        "rubygems.org",
        "packagist.org",
        "nuget.org",
        "formulae.brew.sh",
      ];
      const onPackageHost = hostMatchesAny(url.hostname, packageHosts);
      const onForgeRelease = projectType === "cli" && isForgeReleaseUrl(url, CODE_HOST_ALLOWLIST);
      if (!onPackageHost && !onForgeRelease) {
        failures.push({
          code: "playable_url_type",
          message:
            projectType === "library"
              ? "Libraries must be released on a package host (PyPI, npm, crates.io, ...)."
              : "CLIs must be released on a package host (PyPI, npm, crates.io, ...) or as an executable build on a forge release.",
        });
      }
      return;
    }
    // website-webapp, game-web, hardware, other: the common floor above
    // (public host, blocklist) is the rule — any real deployment host is
    // fine, since custom domains make an allowlist impossible.
    default:
      return;
  }
}

// ----------------------------------------------------------------------------
// Declarations
// ----------------------------------------------------------------------------

function validateDeclarations(
  checklist: Record<string, boolean> | null | undefined,
  failures: SubmissionGateFailure[],
) {
  const missing = REQUIRED_SUBMISSION_DECLARATIONS.filter((key) => checklist?.[key] !== true);
  if (missing.length > 0) {
    failures.push({
      code: "declarations",
      message: "Confirm every submission declaration (README, testing, screenshots, integrity).",
    });
  }
}
