import { fetchUserProfile } from "@/app/lib/data";
import { EditForm } from "@/app/ui/profile/edit-form";
import { fetchCurrentUser } from "@/app/lib/data";

export default async function Page() {
  const currentUser = await fetchCurrentUser();
  const currentUserProfile = await fetchUserProfile(currentUser.id);

  return (
    <div className="flex flex-col p-4">
      <EditForm userProfile={currentUserProfile} user={currentUser} />
    </div>
  );
}
