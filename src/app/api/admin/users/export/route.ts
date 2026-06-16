import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getAuthUser } from "@/lib/api-utils";

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!authUser.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      name: user.name,
      email: user.email,
      slackId: user.slackId,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .orderBy(asc(user.name));

  const header = ["name", "email", "slack_id", "verified"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.name ?? ""),
        csvEscape(r.email),
        csvEscape(r.slackId ?? ""),
        csvEscape(r.emailVerified ? "true" : "false"),
      ].join(","),
    );
  }

  const csv = lines.join("\r\n");
  const filename = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
