import { fetchUserProfile } from "@/app/lib/data";
import { EditForm } from "@/app/ui/profile/edit-form";
import { fetchCurrentUser } from "@/app/lib/data";

export default async function Page() {
  const userProfile = await fetchUserProfile((await fetchCurrentUser()).id);

  return (
    <div className="flex flex-col p-4">
      <EditForm userProfile={userProfile} />
    </div>
  );
}
