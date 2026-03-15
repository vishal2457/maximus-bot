import { useState } from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
  type FilterFn,
  type ColumnOrderState,
  type ColumnPinningState,
} from "@tanstack/react-table";
import { Density, DensityFeature, type DensityState } from "../features/density";

interface UseDataTableProps<TData, TValue> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  pageSize?: number;
  filterFns?: Record<string, FilterFn<TData>>;
  globalFilterFn?: FilterFn<TData>;
  enableColumnOrdering?: boolean;
}

export function useDataTable<TData, TValue>({
  data,
  columns,
  pageSize = 10,
  filterFns = {},
  globalFilterFn,
  enableColumnOrdering = true,
}: UseDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: [],
    right: ["actions"], // Default: pin actions column to right
  });
  const [density, setDensity] = useState<DensityState>(Density.NORMAL);

  const table = useReactTable({
    _features: [DensityFeature], // Add density feature
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnOrderChange: enableColumnOrdering ? setColumnOrder : undefined,
    onColumnPinningChange: setColumnPinning,
    onDensityChange: setDensity, // Add density change handler
    globalFilterFn: globalFilterFn || "includesString",
    filterFns,
    initialState: {
      pagination: {
        pageSize,
      },
      columnPinning: {
        left: [],
        right: ["actions"],
      },
      density: Density.NORMAL, // Add initial density state
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      columnPinning,
      density, // Add density to state
      ...(enableColumnOrdering && { columnOrder }),
    },
  });

  return {
    table,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      columnOrder,
      columnPinning,
      density,
    },
    handlers: {
      setSorting,
      setColumnFilters,
      setColumnVisibility,
      setRowSelection,
      setGlobalFilter,
      setColumnOrder,
      setColumnPinning,
      setDensity,
    },
  };
} 