import type { Member } from "@taimei-code/auth-client";
import { inviteMembersUrl, requireCompany } from "@/app/lib/auth-guard";
import { fetchCompanyMembers } from "@/app/lib/company-members";
import { lusitana } from "@/lib/fonts";
import { memberLabel } from "@/lib/member-label";

export default async function Page() {
  await requireCompany({ returnTo: "/dashboard/members" });
  const members = await fetchCompanyMembers();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className={`${lusitana.className} text-xl md:text-2xl`}>
          メンバー
        </h1>
        <a
          href={inviteMembersUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium underline underline-offset-4"
        >
          メンバーを招待
        </a>
      </div>
      {members ? (
        <MemberTable members={members} />
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
