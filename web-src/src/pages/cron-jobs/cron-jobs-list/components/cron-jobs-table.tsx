 import { DataTable } from "@/components/data-table";
import { cronJobsColumnDefs } from "./cron-jobs-columns";

export function CronJobsTable() {
  return <DataTable data={[]} columns={ cronJobsColumnDefs} />;
}
