import { DataTable } from "@/components/data-table";
import { cronJobsColumnDefs } from "./cron-jobs-columns";
import { useCronJobs, type CronJob } from "@/lib/api";

export function CronJobsTable() {
  const { data } = useCronJobs();

  return (
    <DataTable
      data={(data?.rows as CronJob[]) ?? []}
      columns={cronJobsColumnDefs}
    />
  );
}
