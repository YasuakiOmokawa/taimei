import { fetchUserProfile } from "@/app/lib/data";
import { fetchCurrentUser } from "@/app/lib/data";
import { EditForm } from "./edit-form";

export default async function Page() {
  const currentUser = await fetchCurrentUser();
  const currentUserProfile = await fetchUserProfile(currentUser.id);

  return (
    <div className="flex flex-col p-4">
      <EditForm userProfile={currentUserProfile} user={currentUser} />
    </div>
  );
}
