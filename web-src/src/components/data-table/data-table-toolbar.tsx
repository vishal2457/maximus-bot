import { DataTableSearch } from "./data-table-search";
import { DataTableColumnVisibility } from "./data-table-column-visibility";
import { type DataTableToolbarProps } from "./types";

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  children,
}: DataTableToolbarProps<TData>) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center space-x-2">
        {searchKey && (
          <DataTableSearch
            table={table}
            searchKey={searchKey}
            placeholder={searchPlaceholder}
          />
        )}
        {children}
      </div>
      <DataTableColumnVisibility table={table} />
    </div>
  );
}
