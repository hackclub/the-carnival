import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 is S3-compatible. This file implements:
 * - env-based configuration
 * - deterministic S3 SigV4 presigned PUT URLs (query-string auth)
 *
 * Docs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
 */

export type R2UploadKind = "project_screenshot" | "shop_item_image" | "editor_icon";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /**
   * S3-compatible endpoint, e.g.:
   * https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   */
  endpoint: string;
  /**
   * Public base URL used to serve objects (custom domain / r2.dev / worker, etc).
   * The app stores full URLs in DB today, so we need a stable public base.
   */
  publicBaseUrl: string;
  region: string; // Cloudflare docs recommend "auto"
};

let _s3: S3Client | null = null;

function getR2S3Client() {
  if (_s3) return _s3;
  const cfg = getR2Config();
  _s3 = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return _s3;
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getR2Config(): R2Config {
  // Keep these names explicit so setup is obvious.
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("R2_BUCKET");
  const publicBaseUrl = requiredEnv("R2_PUBLIC_BASE_URL");

  const endpoint =
    process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;

  // Cloudflare docs use "auto" as the region for R2's S3 compatibility.
  const region = process.env.R2_REGION?.trim() || "auto";

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    publicBaseUrl,
    region,
  };
}

function contentTypeToExt(contentType: string) {
  const ct = contentType.toLowerCase().trim();
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  if (ct === "image/svg+xml") return "svg";
  return "bin";
}

export function makeR2ObjectKey(input: {
  kind: R2UploadKind;
  contentType: string;
  projectId?: string;
}) {
  const ext = contentTypeToExt(input.contentType);
  const id = randomUUID();
  const safeProjectId = input.projectId?.trim();

  if (input.kind === "project_screenshot") {
    // Keep projectId optional (Create flow may not have one yet).
    const projectPart = safeProjectId ? safeProjectId : "unassigned";
    return `projects/${projectPart}/${id}.${ext}`;
  }

  if (input.kind === "shop_item_image") {
    return `shop-items/${id}.${ext}`;
  }

  // editor_icon
  return `editor-icons/${id}.${ext}`;
}

export function r2PublicUrlForKey(key: string) {
  const { publicBaseUrl } = getR2Config();
  const base = publicBaseUrl.replace(/\/+$/g, "");
  // Ensure the key is safely URL-encoded while preserving slashes.
  const encodedKey = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/${encodedKey}`;
}

export async function presignR2PutObject(input: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const cfg = getR2Config();
  const expiresInSeconds = input.expiresInSeconds ?? 15 * 60;
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0 || expiresInSeconds > 7 * 24 * 60 * 60) {
    throw new Error("expiresInSeconds must be between 1 and 604800 seconds");
  }

  const client = getR2S3Client();
  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: input.key,
    ContentType: input.contentType,
  });

  const publicUrl = r2PublicUrlForKey(input.key);

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return { uploadUrl, publicUrl, key: input.key };
}

