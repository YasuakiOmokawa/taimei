import { createHash, timingSafeEqual } from "node:crypto";
import { purgeDeparted } from "@/app/lib/purge-departed";
import { db } from "@/db/drizzle/client";
import { authClient } from "@/lib/auth/client";

// 長さの違う Buffer で timingSafeEqual が throw しないよう、固定長の digest で比べる
const sha256 = (value: string) => createHash("sha256").update(value).digest();

// .github/workflows/purge-departed.yml が CRON_SECRET を Authorization: Bearer で送る
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(sha256(authorization), sha256(`Bearer ${secret}`)))
    return new Response(null, { status: 401 });

  const report = await purgeDeparted({
    db,
    checkMemberships: (query) =>
      authClient.companyService.checkMemberships(query),
    startedAt: new Date(),
  });
  return Response.json(report);
}
