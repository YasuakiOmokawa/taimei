import { fetchUserProfile } from "@/app/lib/data";
import { EditForm } from "@/app/ui/profile/edit-form";
import { auth } from "@/auth";

export default async function Page() {
  const session = await auth();
  const userProfile = await fetchUserProfile(session?.user?.id ?? "");

  return (
    <div className="flex flex-col p-4">
      <EditForm userProfile={userProfile} />
    </div>
  );
}
