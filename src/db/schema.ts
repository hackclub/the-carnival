import { pgTable, text, timestamp, boolean, pgEnum, integer, uniqueIndex } from "drizzle-orm/pg-core";

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
  role: userRole("role").notNull().default("user"),
  identityToken: text("identity_token"),
  refreshToken: text("refresh_token"),
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
  playableUrl: text("playable_url").notNull(),
  codeUrl: text("code_url").notNull(),
  screenshots: text("screenshots").array().notNull(),
  status: projectStatus("status").notNull().default("work-in-progress"),
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
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const bountyProject = pgTable("bounty_project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  prizeUsd: integer("prize_usd").notNull(),
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
