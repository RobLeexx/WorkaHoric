import { MainLayout, ProjectsManager } from '@/components';
import { useAppContext } from '@/context';
import { useProjects } from '@/hooks';

export function ProjectsScreen() {
  const { t } = useAppContext();
  const { managedProjects, createProject, updateProject, deleteProject } = useProjects();

  return (
    <MainLayout showHeader={false} title={t('sidebar.projects')}>
      <ProjectsManager
        defaultOpen
        showToggle={false}
        projects={managedProjects}
        onCreateProject={createProject}
        onUpdateProject={updateProject}
        onDeleteProject={deleteProject}
      />
    </MainLayout>
  );
}
