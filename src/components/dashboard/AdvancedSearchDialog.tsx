import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Filter, X, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";

export interface SearchFilters {
  sender?: string;
  subject?: string;
  dateFrom?: Date;
  dateTo?: Date;
  labels?: string[];
  hasAttachments?: boolean;
}

interface AdvancedSearchDialogProps {
  onApplyFilters: (filters: SearchFilters) => void;
  currentFilters: SearchFilters;
}

const AdvancedSearchDialog = ({ onApplyFilters, currentFilters }: AdvancedSearchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(currentFilters);
  const [labelInput, setLabelInput] = useState("");

  const handleApply = () => {
    onApplyFilters(filters);
    setOpen(false);
  };

  const handleClear = () => {
    const emptyFilters: SearchFilters = {};
    setFilters(emptyFilters);
    onApplyFilters(emptyFilters);
  };

  const addLabel = () => {
    if (labelInput.trim()) {
      setFilters(prev => ({
        ...prev,
        labels: [...(prev.labels || []), labelInput.trim().toUpperCase()]
      }));
      setLabelInput("");
    }
  };

  const removeLabel = (label: string) => {
    setFilters(prev => ({
      ...prev,
      labels: prev.labels?.filter(l => l !== label)
    }));
  };

  const activeFilterCount = Object.keys(currentFilters).filter(key => {
    const value = currentFilters[key as keyof SearchFilters];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null;
  }).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          Advanced Search
          {activeFilterCount > 0 && (
            <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center" variant="default">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Advanced Search</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Sender Filter */}
          <div className="space-y-2">
            <Label htmlFor="sender">From (Sender Email)</Label>
            <Input
              id="sender"
              placeholder="sender@example.com"
              value={filters.sender || ""}
              onChange={(e) => setFilters(prev => ({ ...prev, sender: e.target.value }))}
            />
          </div>

          {/* Subject Filter */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject Contains</Label>
            <Input
              id="subject"
              placeholder="Enter keywords..."
              value={filters.subject || ""}
              onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? format(filters.dateFrom, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {filters.dateTo ? format(filters.dateTo, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Labels Filter */}
          <div className="space-y-2">
            <Label>Labels (e.g., INBOX, IMPORTANT, SENT)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add label..."
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLabel()}
              />
              <Button type="button" onClick={addLabel} variant="secondary">
                Add
              </Button>
            </div>
            {filters.labels && filters.labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {filters.labels.map(label => (
                  <Badge key={label} variant="secondary" className="gap-1">
                    {label}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeLabel(label)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Has Attachments */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="attachments"
              checked={filters.hasAttachments || false}
              onChange={(e) => setFilters(prev => ({ ...prev, hasAttachments: e.target.checked || undefined }))}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="attachments" className="cursor-pointer">
              Only show messages with attachments
            </Label>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handleClear}>
            Clear All
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedSearchDialog;
