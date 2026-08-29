'use client';

import { useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Eraser } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import { id as idLocale } from 'react-day-picker/locale';

import { cn } from '@/lib/cn';
import { today as todayDate } from '@/lib/date';

/**
 * The calendar surface behind `<DatePicker />`. Every class name is written here
 * against design tokens — react-day-picker's stylesheet is deliberately not
 * imported, so nothing on the calendar can drift away from the theme (and
 * nothing breaks in dark mode).
 *
 * Navigation is ours, not the library's: the caption is a pair of buttons that
 * swap the day grid for a month grid or a year grid, so a purchase dated eight
 * months back costs one click instead of eight — and unlike native `<select>`
 * dropdowns the panels can actually be themed.
 *
 * Day styling hangs off the `data-*` attributes react-day-picker puts on the
 * grid cell (`data-selected`, `data-today`, …), not off `aria-selected` on the
 * button: the button never receives it, so styling it there silently does
 * nothing.
 */

type View = 'days' | 'months' | 'years';

/** Comparable month index, so range checks are integer math. */
const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();

const MONTHS_LONG = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date(2026, month, 1)),
);
const MONTHS_SHORT = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(2026, month, 1)),
);

/** How many years one page of the year panel shows. */
const YEAR_PAGE = 12;

const navButton = cn(
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
  'border border-border bg-surface text-foreground-muted shadow-xs',
  'transition-[color,border-color,box-shadow] duration-150',
  'hover:border-border-strong hover:text-foreground hover:shadow-sm',
  'focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25',
  'disabled:pointer-events-none disabled:opacity-40',
);

const captionButton = cn(
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-foreground',
  'transition-colors duration-150 hover:bg-accent hover:text-accent-foreground',
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
  'aria-expanded:bg-accent aria-expanded:text-accent-foreground',
);

const panelCell = cn(
  'inline-flex h-9 items-center justify-center rounded-md text-sm text-foreground',
  'transition-colors duration-150 hover:bg-accent hover:text-accent-foreground',
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
  'disabled:pointer-events-none disabled:text-foreground-subtle disabled:opacity-40',
  'data-[active=true]:bg-linear-to-b data-[active=true]:from-primary data-[active=true]:to-primary-hover',
  'data-[active=true]:font-semibold data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm',
  'data-[current=true]:font-semibold data-[current=true]:text-primary',
);

const footerButton = cn(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground-muted',
  'transition-colors duration-150 hover:bg-accent hover:text-accent-foreground',
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
);

/**
 * `DayPickerProps` is a union over the selection modes, so it is passed through
 * whole — narrowing it with `Omit` would collapse `mode` and lose `selected`.
 */
export type CalendarProps = DayPickerProps & {
  /** Renders a "Hari ini" shortcut in the footer, jumping to and picking today. */
  onQuickSelect?: (date: Date) => void;
  /** Renders a "Hapus" shortcut in the footer. */
  onClear?: () => void;
};

export function Calendar({
  className,
  showOutsideDays = true,
  onQuickSelect,
  onClear,
  ...props
}: CalendarProps) {
  const { defaultMonth, startMonth, endMonth, modifiers, modifiersClassNames, onMonthChange } =
    props as DayPickerProps;

  const [month, setMonth] = useState<Date>(() => {
    const initial = defaultMonth ?? todayDate();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [view, setView] = useState<View>('days');
  /** First year of the visible year page — kept apart so paging never selects. */
  const [yearPage, setYearPage] = useState<number>(() => month.getFullYear());

  const minIndex = startMonth ? monthIndex(startMonth) : undefined;
  const maxIndex = endMonth ? monthIndex(endMonth) : undefined;

  const isMonthOutOfRange = (year: number, monthOfYear: number) => {
    const index = year * 12 + monthOfYear;
    return (
      (minIndex !== undefined && index < minIndex) || (maxIndex !== undefined && index > maxIndex)
    );
  };
  const isYearOutOfRange = (year: number) =>
    isMonthOutOfRange(year, 11) && isMonthOutOfRange(year, 0);

  const now = todayDate();
  const goTo = (next: Date) => {
    setMonth(next);
    setYearPage(next.getFullYear());
    onMonthChange?.(next);
  };

  const shift = (direction: -1 | 1) => {
    if (view === 'days') {
      goTo(new Date(month.getFullYear(), month.getMonth() + direction, 1));
      return;
    }
    if (view === 'months') {
      goTo(new Date(month.getFullYear() + direction, month.getMonth(), 1));
      return;
    }
    setYearPage(yearPage + direction * YEAR_PAGE);
  };

  const prevDisabled =
    view === 'days'
      ? isMonthOutOfRange(month.getFullYear(), month.getMonth() - 1)
      : view === 'months'
        ? isYearOutOfRange(month.getFullYear() - 1)
        : isYearOutOfRange(yearPage - 1);
  const nextDisabled =
    view === 'days'
      ? isMonthOutOfRange(month.getFullYear(), month.getMonth() + 1)
      : view === 'months'
        ? isYearOutOfRange(month.getFullYear() + 1)
        : isYearOutOfRange(yearPage + YEAR_PAGE);

  const years = Array.from({ length: YEAR_PAGE }, (_, offset) => yearPage + offset);

  return (
    <div className={cn('w-fit p-3 select-none', className)}>
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          className={captionButton}
          aria-expanded={view === 'months'}
          onClick={() => setView(view === 'months' ? 'days' : 'months')}
        >
          {MONTHS_LONG[month.getMonth()]}
        </button>
        <button
          type="button"
          className={captionButton}
          aria-expanded={view === 'years'}
          onClick={() => {
            setYearPage(month.getFullYear() - (month.getFullYear() % YEAR_PAGE));
            setView(view === 'years' ? 'days' : 'years');
          }}
        >
          {month.getFullYear()}
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={navButton}
            aria-label="Sebelumnya"
            disabled={prevDisabled}
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={navButton}
            aria-label="Berikutnya"
            disabled={nextDisabled}
            onClick={() => shift(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {view === 'months' && (
        <div className="grid w-[17.5rem] grid-cols-3 gap-1">
          {MONTHS_SHORT.map((name, index) => (
            <button
              key={name}
              type="button"
              className={panelCell}
              disabled={isMonthOutOfRange(month.getFullYear(), index)}
              data-active={index === month.getMonth() || undefined}
              data-current={
                (index === now.getMonth() && month.getFullYear() === now.getFullYear()) || undefined
              }
              onClick={() => {
                goTo(new Date(month.getFullYear(), index, 1));
                setView('days');
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {view === 'years' && (
        <div className="grid w-[17.5rem] grid-cols-3 gap-1">
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={panelCell}
              disabled={isYearOutOfRange(year)}
              data-active={year === month.getFullYear() || undefined}
              data-current={year === now.getFullYear() || undefined}
              onClick={() => {
                goTo(new Date(year, month.getMonth(), 1));
                setView('months');
              }}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {view === 'days' && (
        <DayPicker
          {...(props as DayPickerProps)}
          locale={idLocale}
          month={month}
          onMonthChange={goTo}
          showOutsideDays={showOutsideDays}
          hideNavigation
          captionLayout="label"
          modifiers={{ ...modifiers, sunday: { dayOfWeek: [0] } }}
          modifiersClassNames={{
            ...modifiersClassNames,
            // Sunday reads red on an Indonesian calendar — but never over a fill.
            sunday: '[&:not([data-selected]):not([data-outside])>button]:text-destructive',
          }}
          formatters={{
            formatWeekdayName: (date) =>
              new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date),
          }}
          classNames={{
            root: 'w-fit',
            months: 'flex flex-col gap-4 sm:flex-row',
            month: 'flex flex-col',
            month_caption: 'sr-only',
            month_grid: 'w-full border-collapse',
            weekdays: 'flex',
            weekday: cn(
              'w-10 pb-1 text-[0.68rem] font-semibold uppercase tracking-wide',
              'text-foreground-subtle',
            ),
            week: 'flex w-full',
            day: 'relative p-0 text-center',
            day_button: cn(
              'relative flex h-10 w-10 items-center justify-center rounded-md text-sm',
              'text-foreground transition-[background-color,color,box-shadow] duration-150',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
              'disabled:pointer-events-none',
            ),
            today: cn(
              'after:pointer-events-none after:absolute after:bottom-1.5 after:left-1/2',
              'after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary',
              'data-[selected]:after:bg-primary-foreground',
              '[&:not([data-selected])>button]:font-semibold',
            ),
            selected: cn(
              '[&>button]:bg-linear-to-b [&>button]:from-primary [&>button]:to-primary-hover',
              '[&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:shadow-sm',
              '[&>button]:hover:from-primary-hover [&>button]:hover:to-primary-active',
              '[&>button]:hover:text-primary-foreground',
            ),
            range_middle: cn(
              'bg-primary-subtle first:rounded-l-md last:rounded-r-md',
              '[&>button]:bg-transparent [&>button]:from-transparent [&>button]:to-transparent',
              '[&>button]:font-normal [&>button]:text-foreground [&>button]:shadow-none',
            ),
            range_start: 'rounded-l-md bg-primary-subtle',
            range_end: 'rounded-r-md bg-primary-subtle',
            outside: '[&>button]:text-foreground-subtle [&>button]:opacity-60',
            disabled: '[&>button]:text-foreground-subtle [&>button]:opacity-40',
            hidden: 'invisible',
          }}
        />
      )}

      {(onQuickSelect || onClear) && (
        <div className="border-border mt-2 flex items-center justify-between gap-2 border-t pt-2">
          {onQuickSelect ? (
            <button
              type="button"
              className={footerButton}
              disabled={isMonthOutOfRange(now.getFullYear(), now.getMonth())}
              onClick={() => {
                goTo(new Date(now.getFullYear(), now.getMonth(), 1));
                setView('days');
                onQuickSelect(now);
              }}
            >
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Hari ini
            </button>
          ) : (
            <span />
          )}
          {onClear && (
            <button type="button" className={footerButton} onClick={onClear}>
              <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
              Hapus
            </button>
          )}
        </div>
      )}
    </div>
  );
}

Calendar.displayName = 'Calendar';
