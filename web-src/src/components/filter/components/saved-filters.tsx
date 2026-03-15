import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BookmarkIcon,
  StarIcon,
  TrashIcon,
  PlusIcon,
  SaveIcon,
  FilterIcon,
} from "lucide-react";
import { useState, useContext, createContext, useMemo } from "react";
import {
  type SavedFilter,
  type SavedFilterActions,
  type FilterValue,
} from "../filter.model";

interface SavedFiltersContextType {
  savedFilters: SavedFilter[];
  savedFilterActions: SavedFilterActions;
}

export const SavedFiltersContext = createContext<SavedFiltersContextType>({
  savedFilters: [],
  savedFilterActions: {
    saveCurrentFilters: () => {},
    loadSavedFilter: () => {},
    deleteSavedFilter: () => {},
    toggleFavorite: () => {},
  },
});

interface SavedFiltersProps {
  currentFilters: FilterValue[];
  onLoadFilter: (filters: FilterValue[]) => void;
}

export const SavedFilters = ({
  currentFilters,
  onLoadFilter,
}: SavedFiltersProps) => {
  const [open, setOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const savedFilterActions: SavedFilterActions = {
    saveCurrentFilters: (name: string) => {
      const newFilter: SavedFilter = {
        id: Date.now().toString(),
        name: name.trim(),
        filters: currentFilters,
        isFavorite: false,
        createdAt: new Date(),
      };
      setSavedFilters((prev) => [...prev, newFilter]);
      setFilterName("");
      setShowSaveDialog(false);
    },
    loadSavedFilter: (id: string) => {
      const filter = savedFilters.find((f) => f.id === id);
      if (filter) {
        onLoadFilter(filter.filters);
        setOpen(false);
      }
    },
    deleteSavedFilter: (id: string) => {
      setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    },
    toggleFavorite: (id: string) => {
      setSavedFilters((prev) =>
        prev.map((f) => (f.id === id ? { ...f, isFavorite: !f.isFavorite } : f))
      );
    },
  };

  const filteredSavedFilters = useMemo(() => {
    return savedFilters.filter((filter) => {
      if (activeTab === "favorites") {
        return filter.isFavorite;
      }
      return true;
    });
  }, [savedFilters, activeTab]);

  const handleSaveFilter = () => {
    if (filterName.trim()) {
      savedFilterActions.saveCurrentFilters(filterName);
    }
  };

  return (
    <SavedFiltersContext.Provider value={{ savedFilters, savedFilterActions }}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("h-7", "w-fit !px-2")}>
            <BookmarkIcon className="size-4" />
            <span>Saved Filters</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          className="w-80 p-0 shadow-lg shadow-primary/10 border-primary/10"
        >
          <Command>
            <div className="border-b">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-2 h-9 rounded-none border-0 bg-transparent p-0">
                  <TabsTrigger
                    value="all"
                    className="text-xs rounded-none border-b-2 border-transparent  bg-none border-none"
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="favorites"
                    className="text-xs rounded-none border-b-2 border-transparent bg-none border-none"
                  >
                    Favorites
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {activeTab === "all" && (
              <CommandInput placeholder="Search saved filters..." />
            )}
            <CommandList className="max-h-64">
              <CommandEmpty>No saved filters found.</CommandEmpty>
              <CommandGroup>
                {filteredSavedFilters.map((filter) => (
                  <SavedFilterItem key={filter.id} filter={filter} />
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <div className="p-2">
              {!showSaveDialog ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowSaveDialog(true)}
                  disabled={currentFilters.length === 0}
                >
                  <PlusIcon className="size-4 mr-2" />
                  Save Current Filter
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Filter name..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveFilter();
                      } else if (e.key === "Escape") {
                        setShowSaveDialog(false);
                        setFilterName("");
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveFilter}
                      disabled={!filterName.trim()}
                      className="flex-1"
                    >
                      <SaveIcon className="size-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowSaveDialog(false);
                        setFilterName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </SavedFiltersContext.Provider>
  );
};

const SavedFilterItem = ({ filter }: { filter: SavedFilter }) => {
  const { savedFilterActions } = useContext(SavedFiltersContext);

  return (
    <CommandItem
      onSelect={() => savedFilterActions.loadSavedFilter(filter.id)}
      className="flex items-center justify-between p-2"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FilterIcon className="size-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{filter.name}</div>
          <div className="text-xs text-muted-foreground">
            {filter.filters.length} filter
            {filter.filters.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-0"
          onClick={(e) => {
            e.stopPropagation();
            savedFilterActions.toggleFavorite(filter.id);
          }}
        >
          <StarIcon
            className={cn(
              "size-4",
              filter.isFavorite
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-0 text-red-500 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            savedFilterActions.deleteSavedFilter(filter.id);
          }}
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>
    </CommandItem>
  );
};
