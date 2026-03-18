import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, pgEnum, integer, uniqueIndex, jsonb } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "reviewer", "admin"]);
export type UserRole = (typeof userRole.enumValues)[number];

export const projectStatus = pgEnum("project_status", [
  "shipped",
  "granted",
  "in-review",
  "work-in-progress",
]);

export type ProjectStatus = (typeof projectStatus.enumValues)[number];

export const projectEditor = pgEnum("project_editor", [
  "vscode",
  "chrome",
  "firefox",
  "figma",
  "neovim",
  "gnu-emacs",
  "jupyterlab",
  "obsidian",
  "blender",
  "freecad",
  "kicad",
  "krita",
  "gimp",
  "inkscape",
  "godot-engine",
  "unity",
  "other",
]);

export type ProjectEditor = (typeof projectEditor.enumValues)[number];

export const reviewDecision = pgEnum("review_decision", ["approved", "rejected", "comment"]);
export type ReviewDecision = (typeof reviewDecision.enumValues)[number];

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  slackId: text("slack_id"),
  verificationStatus: text("verification_status"),
  birthday: text("birthday"), // ISO date (YYYY-MM-DD)
  // Shipping/profile fields (filled once on first project submission; editable in account settings)
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  stateProvince: text("state_province"),
  country: text("country"),
  zipPostalCode: text("zip_postal_code"),
  role: userRole("role").notNull().default("user"),
  identityToken: text("identity_token"),
  refreshToken: text("refresh_token"),
  hackatimeUserId: text("hackatime_user_id"),
  hackatimeAccessToken: text("hackatime_access_token"),
  hackatimeScope: text("hackatime_scope"),
  hackatimeConnectedAt: timestamp("hackatime_connected_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  creatorId: text("creator_id").references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  editor: projectEditor("editor").notNull().default("vscode"),
  editorOther: text("editor_other"),
  hackatimeProjectName: text("hackatime_project_name").notNull(),
  hackatimeStartedAt: timestamp("hackatime_started_at"),
  hackatimeStoppedAt: timestamp("hackatime_stopped_at"),
  hackatimeTotalSeconds: integer("hackatime_total_seconds"),
  videoUrl: text("video_url").notNull(),
  playableDemoUrl: text("playable_demo_url").notNull().default(""),
  codeUrl: text("code_url").notNull(),
  screenshots: text("screenshots").array().notNull(),
  status: projectStatus("status").notNull().default("work-in-progress"),
  // Canonical approved hours for this project (set by a reviewer on approval).
  approvedHours: integer("approved_hours"),
  // Set when a creator submits their project for review (status transitions to "in-review").
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const peerReview = pgTable("peer_review", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  decision: reviewDecision("decision").notNull().default("comment"),
  reviewComment: text("review_comment").notNull(),
  // Optional: reviewer-approved hours for a project (mainly used on approvals).
  approvedHours: integer("approved_hours"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export type BountyHelpfulLink = {
  label: string;
  url: string;
};

export const bountyProject = pgTable("bounty_project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  prizeUsd: integer("prize_usd").notNull(),
  helpfulLinks: jsonb("helpful_links").$type<BountyHelpfulLink[]>().notNull().default(sql`'[]'::jsonb`),
  completed: boolean("completed").notNull().default(false),
  createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const bountyClaim = pgTable(
  "bounty_claim",
  {
    id: text("id").primaryKey(),
    bountyProjectId: text("bounty_project_id")
      .notNull()
      .references(() => bountyProject.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Slot 1 or 2. Enforced via unique index (bountyProjectId, slot) + insert logic.
    slot: integer("slot").notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => ({
    uniqProjectSlot: uniqueIndex("bounty_claim_project_slot_uniq").on(t.bountyProjectId, t.slot),
    uniqProjectUser: uniqueIndex("bounty_claim_project_user_uniq").on(t.bountyProjectId, t.userId),
  }),
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// Editors table - stores the editors/programs that plugins can be built for
export const editor = pgTable("editor", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  iconUrl: text("icon_url"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// Resource type enum
export const resourceType = pgEnum("resource_type", ["video", "documentation", "article"]);
export type ResourceType = (typeof resourceType.enumValues)[number];

// Resources table - stores resources (videos, docs, articles) for each editor
export const resource = pgTable("resource", {
  id: text("id").primaryKey(),
  editorId: text("editor_id")
    .notNull()
    .references(() => editor.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  type: resourceType("type").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

// ============================================================================
// Shop + Tokens
// ============================================================================

export const tokenUpdateKind = pgEnum("token_update_kind", ["issue", "deduct"]);
export type TokenUpdateKind = (typeof tokenUpdateKind.enumValues)[number];

export const shopOrderStatus = pgEnum("shop_order_status", ["pending", "fulfilled", "cancelled"]);
export type ShopOrderStatus = (typeof shopOrderStatus.enumValues)[number];

export const shopItem = pgTable("shop_item", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  approvedHoursNeeded: integer("approved_hours_needed").notNull(),
  tokenCost: integer("token_cost").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const tokenLedger = pgTable(
  "token_ledger",
  {
    id: text("id").primaryKey(),
    kind: tokenUpdateKind("kind").notNull(),
    tokens: integer("tokens").notNull(),
    reason: text("reason").notNull(),
    // The user whose wallet is being updated
    issuedToUserId: text("issued_to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Admin/user who performed the action (admin on issue/fulfill)
    byUserId: text("by_user_id").references(() => user.id, { onDelete: "set null" }),
    // Used for idempotency & traceability (e.g., "project_grant" + projectId)
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("token_ledger_ref_kind_uniq").on(t.referenceType, t.referenceId, t.kind),
  ],
);

export const shopOrder = pgTable("shop_order", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: shopOrderStatus("status").notNull().default("pending"),
  shopItemId: text("shop_item_id")
    .notNull()
    .references(() => shopItem.id, { onDelete: "restrict" }),
  itemNameSnapshot: text("item_name_snapshot").notNull(),
  itemImageSnapshot: text("item_image_snapshot").notNull(),
  itemDescriptionSnapshot: text("item_description_snapshot"),
  tokenCostSnapshot: integer("token_cost_snapshot").notNull(),
  fulfillmentLink: text("fulfillment_link"),
  cancellationReason: text("cancellation_reason"),
  cancelledById: text("cancelled_by_id").references(() => user.id, { onDelete: "set null" }),
  cancelledAt: timestamp("cancelled_at"),
  // admin who fulfilled the order
  fulfilledById: text("fulfilled_by_id").references(() => user.id, { onDelete: "set null" }),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
