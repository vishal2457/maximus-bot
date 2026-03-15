import { type ColumnDef, type Table } from "@tanstack/react-table";
import { type ReactNode } from "react";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  toolbar?: ReactNode;
  className?: string;
  enableColumnOrdering?: boolean;
}

export interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchKey?: string;
  searchPlaceholder?: string;
  children?: ReactNode;
}

export interface DataTableSearchProps<TData> {
  table: Table<TData>;
  searchKey: string;
  placeholder?: string;
  className?: string;
}

export interface DataTableColumnVisibilityProps<TData> {
  table: Table<TData>;
  className?: string;
}

export interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  className?: string;
}

export interface DataTableContentProps<TData, TValue> {
  table: Table<TData>;
  columns: ColumnDef<TData, TValue>[];
  className?: string;
  enableColumnOrdering?: boolean;
  isLoading?: boolean;
  loadingRowCount?: number;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: React.ComponentType<{ className?: string }>;
}

export interface SortableHeaderProps {
  column: any;
  children: ReactNode;
}

export interface DataTableActionsCellProps<TData> {
  row: { original: TData };
  actions: Array<{
    label: string;
    onClick: (data: TData) => void;
    variant?: "default" | "destructive";
  }>;
}

export interface EnhancedColumnHeaderProps {
  column: any;
  title: string;
  canSort?: boolean;
  canHide?: boolean;
  canReorder?: boolean;
  className?: string;
}

export interface ColumnOrderingState {
  columnOrder: string[];
} 