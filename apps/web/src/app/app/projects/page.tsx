import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ProjectGrid } from "@/components/app/project-grid";
import { listProjects } from "@/lib/projects";

export const metadata = { title: "Proyek Saya" };

export default async function ProjectsPage() {
  const projects = await listProjects(200);
  return (
    <div>
      <PageHeader title="Proyek Saya" description="Semua proyek video Anda." actions={<Button asChild><Link href="/app/create"><Plus /> Proyek baru</Link></Button>} />
      {projects.length ? (
        <ProjectGrid projects={projects} />
      ) : (
        <EmptyState icon={FolderKanban} title="Belum ada proyek" description="Buat proyek pertama Anda dari ide, naskah, atau video." action={<Button asChild><Link href="/app/create">Buat video</Link></Button>} />
      )}
    </div>
  );
}
