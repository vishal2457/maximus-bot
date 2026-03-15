import {
  Filter,
  FILTER_TYPES,
  FilterItem,
  FilterList,
} from "@/components/filter";
import { PageContainer } from "@/components/page-layout/page-container";
import { PageTitle } from "@/components/page-layout/page-title";
import { CronJobsTable } from "./components/cronJobs-table";
import { useState } from "react";
import type { FilterValue } from "@/components/filter";

export function CronJobsListPage() {
  const [filters, setFilters] = useState<FilterValue[]>([]);

  const handleFilterChange = (newFilters: FilterValue[]) => {
    setFilters(newFilters);
  };

  return (
    <PageContainer>
      <PageTitle title="Cron Job List" description="Manage your cron jobs" />
      <div className="flex items-center justify-between">
        <Filter onFilterChange={handleFilterChange}>
          <FilterList>
            
          </FilterList>
        </Filter>
      </div>
      <CronJobsTable  />
    </PageContainer>
  );
}