import { cn } from "@/lib/utils";
import { DataTableContent } from "./data-table-content";
import { DataTablePagination } from "./data-table-pagination";
import { useDataTable } from "./hooks/use-data-table";
import { type DataTableProps } from "./types";

export function DataTable<TData, TValue>({
  columns,
  data,
  className,
  enableColumnOrdering = true,
}: DataTableProps<TData, TValue>) {
  const { table } = useDataTable({
    data,
    columns,
    enableColumnOrdering,
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Table content */}
      <DataTableContent
        table={table}
        columns={columns}
        enableColumnOrdering={enableColumnOrdering}
      />

      {/* Pagination */}
      <DataTablePagination table={table} />
    </div>
  );
}

// Export individual components for custom composition
export { DataTableColumnVisibility } from "./data-table-column-visibility";
export { DataTableContent } from "./data-table-content";
export { DataTablePagination } from "./data-table-pagination";
export { DataTableSearch } from "./data-table-search";
export { DataTableToolbar } from "./data-table-toolbar";
export { useDataTable } from "./hooks/use-data-table";
