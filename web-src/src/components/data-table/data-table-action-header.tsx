import type { Table } from "@tanstack/react-table";
import { DataTableColumnVisibility } from "./data-table-column-visibility";

export const DataTableActionHeader = ({ table }: { table: Table<any> }) => {
  return (
    <div className="flex items-center gap-2">
      <DataTableColumnVisibility table={table} />
    </div>
  );
};
