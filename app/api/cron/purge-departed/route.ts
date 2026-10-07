import { purgeDeparted } from "@/app/lib/purge-departed";
import { db } from "@/db/drizzle/client";
import { authClient } from "@/lib/auth/client";

// .github/workflows/purge-departed.yml が CRON_SECRET を Authorization: Bearer で送る
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response(null, { status: 401 });

  const report = await purgeDeparted({
    db,
    checkMemberships: (query) =>
      authClient.companyService.checkMemberships(query),
    startedAt: new Date(),
  });
  return Response.json(report);
}
