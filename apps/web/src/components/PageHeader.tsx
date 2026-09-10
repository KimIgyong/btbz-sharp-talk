import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  action,
  backTo,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Where "back" goes from this page — a sub-screen's way home (PLN-260910). */
  backTo?: { to: string; label: string };
}) {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        {backTo && (
          <Link
            to={backTo.to}
            className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {backTo.label}
          </Link>
        )}
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
