import React from 'react';
import { cn } from '@/lib/utils';

export default function StatusBadge({ status, statusMap, className }) {
  const config = statusMap[status] || { label: status, className: 'bg-secondary text-secondary-foreground border-border' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap', config.className, className)}>
      {config.label}
    </span>
  );
}
