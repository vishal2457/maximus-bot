import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArrowRightIcon, FilterIcon, X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useQueryState } from "nuqs";
import { Separator } from "../ui/separator";
import {
  FilterDebouncedInput,
  FilterDateController,
  FilterStaticOptions,
} from "./components/filter-types";
import { FilterOperatorContainer } from "./components/operators";
import {
  FILTER_TYPES,
  type CommonProps,
  type FilterContextType,
  type FilterProps,
  type FilterValue,
} from "./filter.model";
import {
  FilterDateDisplay,
  FilterSelectDisplay,
  FilterTextDisplay,
} from "./components/filter-display";
import { SavedFilters } from "./components/saved-filters";

export const FilterContext = createContext<FilterContextType>({
  active: null,
  setActive: () => {},
  filterValues: [],
  filterActions: {
    addFilter: () => {},
    modifyFilter: () => {},
    removeFilter: () => {},
    clearAllFilters: () => {},
  },
});

// Store filter definitions to restore icons and other props when loading from URL
const filterDefinitionsRegistry = new Map<string, CommonProps>();

// Helper functions for URL compression
const getTypeAbbreviation = (type: string) => {
  const typeMap: Record<string, string> = {
    text: "t",
    number: "n",
    date: "d",
    select: "s",
    selectStatic: "ss",
    multiSelect: "ms",
  };
  return typeMap[type] || type;
};

const expandTypeAbbreviation = (abbr: string) => {
  const expandMap: Record<string, string> = {
    t: "text",
    n: "number",
    d: "date",
    s: "select",
    ss: "selectStatic",
    ms: "multiSelect",
  };
  return expandMap[abbr] || abbr;
};

const getOperatorAbbreviation = (operator: string) => {
  const opMap: Record<string, string> = {
    equals: "eq",
    contains: "ct",
    startsWith: "sw",
    endsWith: "ew",
    greaterThan: "gt",
    lessThan: "lt",
    between: "bt",
  };
  return opMap[operator] || "eq";
};

const expandOperatorAbbreviation = (abbr: string) => {
  const expandMap: Record<string, string> = {
    eq: "equals",
    ct: "contains",
    sw: "startsWith",
    ew: "endsWith",
    gt: "greaterThan",
    lt: "lessThan",
    bt: "between",
  };
  return expandMap[abbr] || "equals";
};

const encodeFilterValue = (value: any): string => {
  if (Array.isArray(value)) {
    return value.join(",");
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value || "");
};

const decodeFilterValue = (encoded: string, type: string): any => {
  if (!encoded) return "";

  if (type === "date") {
    try {
      return [new Date(encoded)];
    } catch {
      return "";
    }
  }

  if (type === "number") {
    const num = parseFloat(encoded);
    return isNaN(num) ? "" : num;
  }

  if (type === "multiSelect" || encoded.includes(",")) {
    return encoded.split(",").filter(Boolean);
  }

  return encoded;
};

export const Filter = ({
  children,
  onFilterChange,
  showSavedFilters = false,
}: FilterProps) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<FilterValue | null>(null);

  const [rawUrlValue] = useQueryState("f", { defaultValue: "" });

  const [filterValues, setInternalFilterValues] = useState<FilterValue[]>([]);

  const [, setUrlValue] = useQueryState("f", {
    defaultValue: "",
    serialize: (value: string) => value,
    parse: (value: string) => value,
  });

  const setFilterValues = useCallback(
    (newFilters: FilterValue[] | ((prev: FilterValue[]) => FilterValue[])) => {
      setInternalFilterValues((prev) => {
        const resolved =
          typeof newFilters === "function" ? newFilters(prev) : newFilters;

        // Update URL
        if (resolved.length === 0) {
          setUrlValue("");
        } else {
          const compressed = resolved
            .map((filter) => {
              const parts = [
                filter.columnId,
                getTypeAbbreviation(filter.type),
                getOperatorAbbreviation(filter.operator || "eq"),
                encodeFilterValue(filter.value),
              ];
              return parts.join(":");
            })
            .join("|");
          setUrlValue(compressed);
        }

        return resolved;
      });
    },
    [setUrlValue]
  );

  const filterActions = {
    addFilter: (filter: FilterValue) => {
      setFilterValues((prev) => {
        const existingIndex = prev.findIndex(
          (f) => f.columnId === filter.columnId
        );
        if (existingIndex !== -1) {
          return prev.map((f, idx) =>
            idx === existingIndex ? { ...f, ...filter } : f
          );
        }
        return [...prev, filter];
      });
    },
    modifyFilter: (filter: FilterValue) => {
      setFilterValues((prev) =>
        prev.map((f) =>
          f.columnId === filter.columnId ? { ...f, ...filter } : f
        )
      );
    },
    removeFilter: (columnId: string) => {
      setFilterValues((prev) =>
        prev.filter((filter) => filter.columnId !== columnId)
      );
    },
    clearAllFilters: () => {
      setFilterValues([]);
    },
  };

  // Parse URL filters when filter definitions are available
  const parseUrlFilters = useCallback(() => {
    if (!rawUrlValue || filterDefinitionsRegistry.size === 0) return;

    try {
      const filterParts = rawUrlValue.split("|");
      const parsedFilters = filterParts
        .map((part) => {
          const [columnId, typeAbbr, operatorAbbr, encodedValue] =
            part.split(":");
          const definition = filterDefinitionsRegistry.get(columnId);

          if (!definition) return null;

          return {
            ...definition,
            type: expandTypeAbbreviation(typeAbbr) || definition.type,
            operator: expandOperatorAbbreviation(operatorAbbr),
            value: decodeFilterValue(encodedValue, definition.type),
          };
        })
        .filter(Boolean) as FilterValue[];

      if (parsedFilters.length > 0) {
        setInternalFilterValues(parsedFilters);
      }
    } catch (error) {
      console.warn("Failed to parse URL filters:", error);
    }
  }, [rawUrlValue]);

  // Parse URL filters when registry size changes (new FilterItems register)
  useEffect(() => {
    if (filterDefinitionsRegistry.size > 0) {
      parseUrlFilters();
    }
  }, [parseUrlFilters]);

  // Also parse URL filters with a delay to ensure all FilterItems have mounted
  useEffect(() => {
    const timer = setTimeout(() => {
      parseUrlFilters();
    }, 100);

    return () => clearTimeout(timer);
  }, [parseUrlFilters]);

  // Parse URL filters when rawUrlValue changes
  useEffect(() => {
    if (rawUrlValue && filterDefinitionsRegistry.size > 0) {
      parseUrlFilters();
    }
  }, [rawUrlValue, parseUrlFilters]);

  // Notify parent when filters change
  useEffect(() => {
    onFilterChange(filterValues);
  }, [filterValues, onFilterChange]);

  const handleLoadSavedFilter = (filters: FilterValue[]) => {
    setFilterValues(filters);
  };

  return (
    <FilterContext.Provider
      value={{ active, setActive, filterValues, filterActions }}
    >
      <div className="flex gap-2">
        {showSavedFilters && (
          <SavedFilters
            currentFilters={filterValues}
            onLoadFilter={handleLoadSavedFilter}
          />
        )}
        <Popover
          open={open}
          onOpenChange={async (value) => {
            setOpen(value);
            if (!value) {
              setOpen(false);
              setTimeout(() => setActive(null), 100);
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-7", "w-fit !px-2")}>
              <FilterIcon className="size-4" />
              <span>Filter</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="bottom"
            className="w-fit p-0 origin-(--radix-popover-content-transform-origin)"
          >
            {children}
          </PopoverContent>
        </Popover>

        <FilterActive />
      </div>
    </FilterContext.Provider>
  );
};

export const FilterList = ({ children }: { children: React.ReactNode }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { active, filterValues } = useContext(FilterContext);

  if (active) {
    const filter = filterValues.find(
      (filter) => filter.columnId === active.columnId
    );

    return <RenderFilterControl filter={filter || active} />;
  }

  return (
    <Command loop>
      <CommandInput ref={inputRef} placeholder="Search" />
      <CommandEmpty>No results.</CommandEmpty>
      <CommandList className="max-h-fit">
        <CommandGroup>{children}</CommandGroup>
      </CommandList>
    </Command>
  );
};

export const FilterItem = (props: CommonProps) => {
  const { active, setActive } = useContext(FilterContext);

  // Register this filter definition for URL restoration
  useEffect(() => {
    filterDefinitionsRegistry.set(props.columnId, props);
  }, [props]);

  return (
    <CommandItem
      className="group"
      onSelect={() => {
        setActive({
          ...props,
          value: "",
        });
      }}
      aria-selected={active?.columnId === props.columnId}
    >
      <div className="flex w-full items-center justify-between">
        <div className="inline-flex items-center gap-1.5">
          {props.icon}
          <span>{props.label}</span>
        </div>
        <ArrowRightIcon className="size-4 opacity-0 group-aria-selected:opacity-100" />
      </div>
    </CommandItem>
  );
};

export const FilterActive = () => {
  const { filterValues, filterActions } = useContext(FilterContext);

  return (
    <>
      {filterValues.map((filter) => (
        <div
          key={filter.columnId}
          className="flex h-7 items-center rounded-md border border-border bg-background shadow-xs text-xs"
        >
          <span className="flex select-none items-center gap-1 whitespace-nowrap px-2 font-medium">
            {filter.icon}
            <span>{filter.label}</span>
          </span>
          <Separator orientation="vertical" />
          <FilterOperatorContainer filter={filter} />
          <Separator orientation="vertical" />
          <FilterDisplayValue filter={filter} />
          <Separator orientation="vertical" />
          <Button
            variant="ghost"
            className="rounded-none rounded-r-2xl text-xs w-7 h-full"
            onClick={() => {
              filterActions.removeFilter(filter.columnId);
            }}
          >
            <X className="size-4 -translate-x-0.5" />
          </Button>
        </div>
      ))}
    </>
  );
};

export const FilterDisplayValue = ({ filter }: { filter: FilterValue }) => {
  return (
    <Popover>
      <PopoverAnchor className="h-full" />
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="m-0 h-full w-fit whitespace-nowrap rounded-none p-0 px-2 text-xs"
        >
          <FilterValueDisplay filter={filter} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-fit p-0 origin-(--radix-popover-content-transform-origin)"
      >
        <RenderFilterControl filter={filter} />
      </PopoverContent>
    </Popover>
  );
};

const FilterValueDisplay = ({ filter }: { filter: FilterValue }) => {
  switch (filter.type) {
    case FILTER_TYPES.TEXT:
      return <FilterTextDisplay filter={filter} />;
    case FILTER_TYPES.DATE:
      return <FilterDateDisplay filter={filter} />;
    case FILTER_TYPES.SELECT_STATIC:
      return <FilterSelectDisplay filter={filter} />;
    default:
      return null;
  }
};

export const RenderFilterControl = ({ filter }: { filter: FilterValue }) => {
  const render = () => {
    switch (filter.type) {
      case FILTER_TYPES.TEXT:
        return <FilterDebouncedInput filter={filter} />;
      case FILTER_TYPES.DATE:
        return <FilterDateController filter={filter} />;
      case FILTER_TYPES.SELECT_STATIC:
        return <FilterStaticOptions filter={filter} />;
      default:
        return null;
    }
  };

  return <div className="p-2">{render()}</div>;
};
