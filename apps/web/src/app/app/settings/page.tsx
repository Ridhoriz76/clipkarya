import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/misc";
import { getProfile } from "@/lib/auth";
import { isPersonalMode } from "@/lib/personal";
import { SettingsForm } from "./form";

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Pengaturan" description="Profil, bahasa, tampilan, dan keamanan akun." />
      <SettingsForm email={profile.email ?? ""} fullName={profile.full_name ?? ""} locale={profile.locale} personal={isPersonalMode()} />
    </div>
  );
}
