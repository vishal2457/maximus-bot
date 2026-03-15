import { PageContainer } from "@/components/page-layout/page-container";
import { PageTitle } from "@/components/page-layout/page-title";
import { CronJobsTable } from "./components/cron-jobs-table";

export function CronJobsListPage() {
  return (
    <PageContainer>
      <PageTitle title="Cron Job List" description="Manage your cron jobs" />
      <CronJobsTable />
    </PageContainer>
  );
}
