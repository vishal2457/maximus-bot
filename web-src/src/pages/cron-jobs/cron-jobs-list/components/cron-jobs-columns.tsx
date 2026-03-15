import {
  createActionsColumn,
  createSelectionColumn,
  DataTableColumnHeader,
} from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { CronJob } from "@/lib/api/cron-jobs";

export const cronJobsColumnDefs: ColumnDef<CronJob>[] = [
  createSelectionColumn<CronJob>(),
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }: { row: { getValue: (key: string) => string } }) => {
      const value = row.getValue("title");
      return <span>{value}</span>;
    },
  },
  {
    accessorKey: "cronExpression",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cron Expression" />
    ),
    cell: ({ row }: { row: { getValue: (key: string) => string } }) => {
      const value = row.getValue("cronExpression");
      return <span>{value}</span>;
    },
  },
  {
    accessorKey: "projectId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Project" />
    ),
    cell: ({ row }: { row: { getValue: (key: string) => string } }) => {
      const value = row.getValue("projectId");
      return <span>{value}</span>;
    },
  },
  {
    accessorKey: "channelId",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Channel ID" />
    ),
    cell: ({ row }: { row: { getValue: (key: string) => string | null } }) => {
      const value = row.getValue("channelId");
      return <span>{value || "-"}</span>;
    },
  },
  {
    accessorKey: "sdkType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="SDK Type" />
    ),
    cell: ({ row }: { row: { getValue: (key: string) => string } }) => {
      const value = row.getValue("sdkType");
      return <span>{value}</span>;
    },
  },
  {
    accessorKey: "isActive",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
    cell: ({ row }: { row: { getValue: (key: string) => boolean } }) => {
      const value = row.getValue("isActive");
      return <span>{value ? "Yes" : "No"}</span>;
    },
  },
  {
    accessorKey: "nextRunAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Next Run" />
    ),
    cell: ({ row }: { row: { getValue: (key: string) => string | null } }) => {
      const value = row.getValue("nextRunAt");
      return <span>{value ? new Date(value).toLocaleString() : "-"}</span>;
    },
  },
  createActionsColumn<CronJob>([
    {
      label: "View Details",
      onClick: (item) => {
        console.log("View Details", item);
      },
    },
  ]),
];
