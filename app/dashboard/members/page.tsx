import type { Member } from "@taimei-code/auth-client";
import { ExternalLink } from "lucide-react";
import { inviteMembersUrl, requireCompany } from "@/app/lib/auth-guard";
import { fetchCompanyMembers } from "@/app/lib/company-members";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { memberLabel } from "@/lib/member-label";

export default async function Page() {
  await requireCompany({ returnTo: "/dashboard/members" });
  const members = await fetchCompanyMembers();

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">メンバー</h1>
          <p className="text-sm text-muted-foreground">
            事業所に所属している人です。チームへの割り当てはチームの画面で行います
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a
            href={inviteMembersUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            メンバーを招待
            <ExternalLink aria-hidden="true" />
            <span className="sr-only">(新しいタブで開きます)</span>
          </a>
        </Button>
      </div>
      <Card className="overflow-hidden">
        {members ? (
          <MemberTable members={members} />
        ) : (
          <CardMessage>メンバー一覧を取得できませんでした</CardMessage>
        )}
      </Card>
    </div>
  );
}

function CardMessage({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-6 py-10 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function MemberTable({ members }: { members: readonly Member[] }) {
  if (members.length === 0)
    return <CardMessage>メンバーがいません</CardMessage>;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead scope="col" className="pl-6">
            名前
          </TableHead>
          <TableHead scope="col">メールアドレス</TableHead>
          <TableHead scope="col" className="pr-6">
            role
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.userId}>
            <TableCell className="pl-6 font-medium">
              {memberLabel(member)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {member.email}
            </TableCell>
            <TableCell className="pr-6">
              {member.role ? (
                <Badge variant="outline">{member.role}</Badge>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
