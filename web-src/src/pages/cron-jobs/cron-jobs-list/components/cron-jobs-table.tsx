import { DataTable } from "@/components/data-table";
import { cronJobsColumnDefs } from "./cron-jobs-columns";
import { useCronJobs } from "@/lib/api";

export function CronJobsTable() {
  const { data } = useCronJobs();

  return <DataTable data={data ?? []} columns={cronJobsColumnDefs} />;
}
