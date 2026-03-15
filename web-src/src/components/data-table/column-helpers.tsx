import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { DataTableActionHeader } from "./data-table-action-header";
import {
  type DataTableActionsCellProps,
  type SortableHeaderProps,
} from "./types";

// Sortable Header Component
export function SortableHeader({ column, children }: SortableHeaderProps) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

// Actions Cell Component
export function DataTableActionsCell<TData>({
  row,
  actions,
}: DataTableActionsCellProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {actions.map((action, index) => (
          <div key={index}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => action.onClick(row.original)}
              className={
                action.variant === "destructive" ? "text-destructive" : ""
              }
            >
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Helper function to create a selection column
export function createSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  };
}

// Helper function to create a sortable column
export function createSortableColumn<TData>(
  accessorKey: keyof TData,
  header: string
): ColumnDef<TData> {
  return {
    accessorKey: accessorKey as string,
    header: ({ column }) => (
      <SortableHeader column={column}>{header}</SortableHeader>
    ),
  };
}

// Helper function to create an actions column
export function createActionsColumn<TData>(
  actions: Array<{
    label: string;
    onClick: (data: TData) => void;
    variant?: "default" | "destructive";
  }>
): ColumnDef<TData> {
  return {
    id: "actions",
    header: ({ table }) => <DataTableActionHeader table={table} />,
    cell: ({ row }) => <DataTableActionsCell row={row} actions={actions} />,
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enableResizing: false,
    enablePinning: true,
    meta: { pinned: "right" },
  };
}
