import { FolderKanban, Terminal } from "lucide-react";
import { useProjects, type Project } from "../../lib/api/projects";

const getStatus = (project: Project): "active" | "idle" | "error" => {
  if (project.discordCategoryId || project.linearIssuesChannelId) {
    return "active";
  }
  return "idle";
};

export const ProjectsPage = () => {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="border-b border-[#333] pb-4">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
            Workspaces
          </h1>
          <p className="text-[#777] font-mono text-sm mt-1">
            MANAGED PROJECT DIRECTORIES
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 bg-[#0D0D0D] border border-[#333] animate-pulse"
            >
              <div className="h-6 w-6 bg-[#222] rounded mb-4" />
              <div className="h-8 w-3/4 bg-[#222] rounded mb-2" />
              <div className="h-10 w-full bg-[#222] rounded mb-6" />
              <div className="h-4 w-1/2 bg-[#222] rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((project) => (
            <div
              key={project.id}
              className="group relative p-5 bg-[#0D0D0D] border border-[#333] hover:border-[#FF4400] transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-[#777] group-hover:text-[#FF4400] transition-colors">
                  <FolderKanban size={24} />
                </div>
              </div>

              <h3 className="text-2xl font-bold text-white uppercase tracking-wide mb-2">
                {project.name}
              </h3>

              <div className="flex items-center gap-2 text-xs text-[#777] mb-6 font-mono bg-[#050505] p-2 border border-[#222] truncate">
                <Terminal size={14} className="text-[#00FF41] shrink-0" />
                <span className="truncate">{project.folder}</span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#222]">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 ${
                      getStatus(project) === "active"
                        ? "bg-[#00FF41] animate-pulse"
                        : getStatus(project) === "error"
                          ? "bg-[#FF4400]"
                          : "bg-[#F2A900]"
                    }`}
                  />
                  <span className="text-xs font-bold tracking-widest text-[#CCC] uppercase">
                    {getStatus(project)}
                  </span>
                </div>
                <span className="text-xs font-mono text-[#555]">
                  {project.linearProjectName || "No Linear"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
