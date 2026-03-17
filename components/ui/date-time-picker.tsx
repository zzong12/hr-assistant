"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function ChevronIcon({ orientation }: { orientation?: string }) {
  if (orientation === "left") return <ChevronLeft className="h-4 w-4" />;
  return <ChevronRight className="h-4 w-4" />;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "选择日期和时间",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const parsed = value ? parse(value, "yyyy-MM-dd'T'HH:mm", new Date()) : null;
  const selectedDate = parsed && isValid(parsed) ? parsed : undefined;
  const hour = selectedDate ? selectedDate.getHours() : 9;
  const minute = selectedDate ? selectedDate.getMinutes() : 0;

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return;
    const h = selectedDate ? selectedDate.getHours() : 9;
    const m = selectedDate ? selectedDate.getMinutes() : 0;
    day.setHours(h, m, 0, 0);
    onChange(format(day, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleTimeChange = (type: "hour" | "minute", val: number) => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    if (type === "hour") base.setHours(val);
    else base.setMinutes(val);
    base.setSeconds(0, 0);
    onChange(format(base, "yyyy-MM-dd'T'HH:mm"));
  };

  const displayText = selectedDate
    ? format(selectedDate, "yyyy年MM月dd日 HH:mm", { locale: zhCN })
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full h-10 justify-start text-left font-normal px-3",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <Calendar className="mr-2 h-4 w-4 text-primary shrink-0" />
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            locale={zhCN}
            showOutsideDays
            classNames={{
              months: "flex flex-col gap-2",
              month: "space-y-3",
              month_caption: "flex justify-center pt-1 relative items-center text-sm font-semibold",
              caption_label: "text-sm font-semibold",
              nav: "flex items-center gap-1",
              button_previous: "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-lg hover:bg-muted transition-colors",
              button_next: "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-lg hover:bg-muted transition-colors",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] text-center",
              week: "flex w-full mt-1",
              day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 h-8 w-8",
              day_button: "h-8 w-8 p-0 font-normal inline-flex items-center justify-center rounded-lg hover:bg-muted transition-colors cursor-pointer",
              selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-lg",
              today: "bg-accent text-accent-foreground font-semibold rounded-lg",
              outside: "text-muted-foreground/40",
              disabled: "text-muted-foreground/30",
            }}
            components={{
              Chevron: ChevronIcon,
            }}
          />
        </div>

        <div className="border-t border-border/40 p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">时间</span>
            <div className="flex items-center gap-1 ml-auto">
              <select
                value={hour}
                onChange={(e) => handleTimeChange("hour", Number(e.target.value))}
                className="h-8 w-14 rounded-lg border border-border/50 bg-background px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i.toString().padStart(2, "0")}</option>
                ))}
              </select>
              <span className="text-sm font-bold text-muted-foreground">:</span>
              <select
                value={minute}
                onChange={(e) => handleTimeChange("minute", Number(e.target.value))}
                className="h-8 w-14 rounded-lg border border-border/50 bg-background px-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-border/40 p-2 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="text-xs">
            确认
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
