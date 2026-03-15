import { Input } from "@/components/ui/input";
import { type DataTableSearchProps } from "./types";
import { cn } from "@/lib/utils";

export function DataTableSearch<TData>({
  table,
  searchKey,
  placeholder = "Search...",
  className,
}: DataTableSearchProps<TData>) {
  return (
    <Input
      placeholder={placeholder}
      value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
      onChange={(event) =>
        table.getColumn(searchKey)?.setFilterValue(event.target.value)
      }
      className={cn("max-w-sm", className)}
    />
  );
}
