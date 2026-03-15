
export enum FILTER_TYPES {
  TEXT = "text",
  NUMBER = "number",
  DATE = "date",
  SELECT = "select",
  SELECT_STATIC = "selectStatic",
  MULTI_SELECT = "multiSelect",
}

export interface FilterProps {
    children: React.ReactNode;
    onFilterChange: (filterValues: FilterValue[]) => void;
    showSavedFilters?: boolean;
  }

  export interface ColumnOption {
    label: string;
    value: string;
    icon?: React.ReactNode;
  }

  export interface CommonProps {
    label: string;
    columnId: string;
    type: FILTER_TYPES;
    icon?: React.ReactNode;
    textProps?: React.InputHTMLAttributes<HTMLInputElement>;
    staticOptions?: ColumnOption[];
  }

  
  export interface FilterValue extends CommonProps {
    value: string | number | Date[] | string[] | number[];
    operator?: string;
  }

  export interface ActiveFilter extends CommonProps {}

export interface FilterContextType {
  active: null | FilterValue;
  setActive: (active: FilterValue | null) => void;
  filterValues: FilterValue[];
  filterActions: FilterActions;
}

  export interface FilterActions {
    addFilter: (filter: FilterValue) => void;
    modifyFilter: (filter: FilterValue) => void;
    removeFilter: (columnId: string) => void;
    clearAllFilters: () => void;
  }

  export interface SavedFilter {
    id: string;
    name: string;
    filters: FilterValue[];
    isFavorite: boolean;
    createdAt: Date;
  }

  export interface SavedFilterActions {
    saveCurrentFilters: (name: string) => void;
    loadSavedFilter: (id: string) => void;
    deleteSavedFilter: (id: string) => void;
    toggleFavorite: (id: string) => void;
  }