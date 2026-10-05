import * as Sentry from "@sentry/nextjs";
import type { Member } from "@taimei-code/auth-client";
import { listMembers, requireCompany } from "@/app/lib/auth-guard";
import { lusitana } from "@/lib/fonts";
import { memberLabel } from "@/lib/member-label";

export default async function Page() {
  await requireCompany({ returnTo: "/dashboard/members" });
  const memberListResult = await listMembers();
  if (!memberListResult.ok) {
    Sentry.captureMessage("listMembers failed", {
      level: "error",
      extra: { reason: memberListResult.reason },
    });
  }

  return (
    <div>
      <h1 className={`${lusitana.className} mb-4 text-xl md:text-2xl`}>
        メンバー
      </h1>
      {memberListResult.ok ? (
        <MemberTable members={memberListResult.data.members} />
      ) : (
        <p>メンバー一覧を取得できませんでした</p>
      )}
    </div>
  );
}

function MemberTable({ members }: { members: readonly Member[] }) {
  if (members.length === 0) return <p>メンバーがいません</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th scope="col" className="py-2">
              名前
            </th>
            <th scope="col" className="py-2">
              メールアドレス
            </th>
            <th scope="col" className="py-2">
              role
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.userId} className="border-t">
              <td className="py-2">{memberLabel(member)}</td>
              <td className="py-2">{member.email}</td>
              <td className="py-2">{member.role ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
