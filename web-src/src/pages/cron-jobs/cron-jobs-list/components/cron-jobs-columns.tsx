import {
  createActionsColumn,
  createSelectionColumn,
  DataTableColumnHeader,
} from "@/components/data-table";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { CronJob } from "./types";

export const cronJobsColumnDefs: ColumnDef<CronJob>[] = [
  createSelectionColumn<CronJob>(),
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }: { row: any }) => {
      const value = row.getValue("name");
      return <span>{value}</span>;
    },
  },
  {
    accessorKey: "scheduleTime",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Schedule Time" />
    ),
    cell: ({ row }: { row: any }) => {
      const value = row.getValue("scheduleTime");
      return <span>{value}</span>;
    },
  },
  {
    accessorKey: "expression",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expression" />
    ),
    cell: ({ row }: { row: any }) => {
      const value = row.getValue("expression");
      return <span>{value}</span>;
    },
  },
  {
    accessorKey: "workspace",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Workspace" />
    ),
    cell: ({ row }: { row: any }) => {
      const value = row.getValue("workspace");
      return <span>{value}</span>;
    },
  },
  {
    accessorKey: "instruction",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Instruction" />
    ),
    cell: ({ row }: { row: any }) => {
      const value = row.getValue("instruction");
      return <span>{value}</span>;
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
