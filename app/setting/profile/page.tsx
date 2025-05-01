import { fetchUserProfile } from "@/app/lib/data";
import { EditForm } from "@/app/ui/profile/edit-form";
import { fetchCurrentUser, fetchImages } from "@/app/lib/data";

export default async function Page() {
  const userProfile = await fetchUserProfile((await fetchCurrentUser()).id);
  const images = await fetchImages();

  return (
    <div className="flex flex-col p-4">
      <EditForm userProfile={userProfile} images={images} />
    </div>
  );
}
