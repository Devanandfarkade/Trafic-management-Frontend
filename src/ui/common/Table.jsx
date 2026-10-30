import React, { forwardRef } from 'react';
import { useTheme } from '../Settings/themeUtils';
import TableSorting from './TableSorting';

const Table = forwardRef(({
  className = '',
  headers,
  data,
  renderRow,
  loading,
  emptyMessage,
  hover,
  sortable,
  headerStyle,
  rowStyle,
  ...props
}, ref) => {
  const { themeUtils } = useTheme();

  // Dual-mode: if data, headers, or renderRow is provided, delegate to TableSorting
  if (headers || data || renderRow) {
    return (
      <TableSorting
        headers={headers}
        data={data}
        renderRow={renderRow}
        emptyMessage={emptyMessage}
        className={className}
        loading={loading}
        hover={hover}
        sortable={sortable}
        headerStyle={headerStyle}
        rowStyle={rowStyle}
        {...props}
      />
    );
  }

  return (
    <div
      className={`relative w-full overflow-auto hide-scrollbar rounded-lg border shadow-sm`}
      style={{
        backgroundColor: themeUtils.getBgColor("card"),
        borderColor: themeUtils.getBorderColor(),
      }}
    >
      <table
        ref={ref}
        className={`w-full caption-bottom text-sm ${className}`}
        {...props}
      />
    </div>
  );
});
Table.displayName = 'Table';

const TableHeader = forwardRef(({ className = '', style = {}, ...props }, ref) => {
  const { theme } = useTheme();
  const bgStyle = theme.headerBg?.includes("gradient")
    ? { background: theme.headerBg }
    : { backgroundColor: theme.headerBg };
  return (
    <thead
      ref={ref}
      className={`border-b [&_tr]:border-b-0 ${className}`}
      style={{
        ...bgStyle,
        ...style
      }}
      {...props}
    />
  );
});
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef(({ className = '', ...props }, ref) => (
  <tbody
    ref={ref}
    className={`[&_tr:last-child]:border-0 ${className}`}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = forwardRef(({ className = '', ...props }, ref) => {
  const { themeUtils } = useTheme();
  return (
    <tfoot
      ref={ref}
      className={`border-t font-medium ${className}`}
      style={{
        backgroundColor: themeUtils.getBgColor("hover"),
        borderColor: themeUtils.getBorderColor(),
        color: themeUtils.getTextColor(true),
      }}
      {...props}
    />
  );
});
TableFooter.displayName = 'TableFooter';

const TableRow = forwardRef(({ className = '', ...props }, ref) => {
  const { themeUtils } = useTheme();
  return (
    <tr
      ref={ref}
      className={`border-b transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${className}`}
      style={{
        borderColor: themeUtils.getBorderColor(),
      }}
      {...props}
    />
  );
});
TableRow.displayName = 'TableRow';

const TableHead = forwardRef(({ className = '', style = {}, ...props }, ref) => {
  const { theme, themeUtils } = useTheme();
  return (
    <th
      ref={ref}
      className={`h-10 px-3 py-2 text-left align-middle font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${className}`}
      style={{
        color: themeUtils.getContrastText?.(theme.headerBg) || "#FFFFFF",
        ...style
      }}
      {...props}
    />
  );
});
TableHead.displayName = 'TableHead';

const TableCell = forwardRef(({ className = '', ...props }, ref) => {
  const { themeUtils } = useTheme();
  return (
    <td
      ref={ref}
      className={`py-1.5 px-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${className}`}
      style={{
        color: themeUtils.getTextColor(true),
      }}
      {...props}
    />
  );
});
TableCell.displayName = 'TableCell';

const TableCaption = forwardRef(({ className = '', ...props }, ref) => {
  const { themeUtils } = useTheme();
  return (
    <caption
      ref={ref}
      className={`mt-4 text-sm pb-4 ${className}`}
      style={{
        color: themeUtils.getTextColor(false),
      }}
      {...props}
    />
  );
});
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};

export default Table;