import { Clock, Play, Pause, Plus, MoreVertical, Calendar } from "lucide-react";
import { useCronJobs } from "@/lib/api/cron-jobs";

export function CronJobsListPage() {
  const { data: cronJobs, isLoading, error } = useCronJobs();

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="border-b border-[#333] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
              Cron Schedule
            </h1>
            <p className="text-[#777] font-mono text-sm mt-1">
              AUTOMATED TASK EXECUTION
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-[#FF4400] text-[#FF4400] hover:bg-[#FF4400] hover:text-black font-bold uppercase tracking-wider transition-colors">
            <Plus size={18} />
            New Job
          </button>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-[#777] font-mono">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="border-b border-[#333] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
              Cron Schedule
            </h1>
            <p className="text-[#777] font-mono text-sm mt-1">
              AUTOMATED TASK EXECUTION
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-[#FF4400] text-[#FF4400] hover:bg-[#FF4400] hover:text-black font-bold uppercase tracking-wider transition-colors">
            <Plus size={18} />
            New Job
          </button>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-red-500 font-mono">Error loading cron jobs</div>
        </div>
      </div>
    );
  }

  const jobs =
    cronJobs?.map((job) => ({
      id: job.id,
      name: job.title,
      schedule: job.cronExpression,
      project: job.sdkType,
      nextRun: job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : "N/A",
      status: job.isActive ? "active" : "paused",
    })) || [];
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="border-b border-[#333] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wider text-white">
            Cron Schedule
          </h1>
          <p className="text-[#777] font-mono text-sm mt-1">
            AUTOMATED TASK EXECUTION
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-[#FF4400] text-[#FF4400] hover:bg-[#FF4400] hover:text-black font-bold uppercase tracking-wider transition-colors">
          <Plus size={18} />
          New Job
        </button>
      </div>

      <div className="bg-[#0D0D0D] border border-[#333]">
        {jobs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-[#777] font-mono">No cron jobs found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#333] bg-[#050505]">
                  <th className="p-4 text-xs font-bold text-[#777] uppercase tracking-widest">
                    Job Name
                  </th>
                  <th className="p-4 text-xs font-bold text-[#777] uppercase tracking-widest">
                    Schedule
                  </th>
                  <th className="p-4 text-xs font-bold text-[#777] uppercase tracking-widest">
                    Project
                  </th>
                  <th className="p-4 text-xs font-bold text-[#777] uppercase tracking-widest">
                    Next Run
                  </th>
                  <th className="p-4 text-xs font-bold text-[#777] uppercase tracking-widest">
                    Status
                  </th>
                  <th className="p-4 text-xs font-bold text-[#777] uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222]">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-[#111] transition-colors group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Clock size={16} className="text-[#777]" />
                        <span className="font-bold text-white uppercase tracking-wide">
                          {job.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-[#050505] border border-[#333] font-mono text-xs text-[#00FF41]">
                        {job.schedule}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-mono text-[#AAA]">
                      {job.project}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm font-mono text-[#777]">
                        <Calendar size={14} />
                        {job.nextRun}
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-bold tracking-widest uppercase border ${
                          job.status === "active"
                            ? "border-[#00FF41]/30 text-[#00FF41] bg-[#00FF41]/10"
                            : "border-[#555] text-[#777] bg-[#222]"
                        }`}
                      >
                        <div
                          className={`w-1.5 h-1.5 ${job.status === "active" ? "bg-[#00FF41]" : "bg-[#555]"}`}
                        />
                        {job.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-[#777] hover:text-white hover:bg-[#333] transition-colors">
                          {job.status === "active" ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                        <button className="p-1.5 text-[#777] hover:text-white hover:bg-[#333] transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
