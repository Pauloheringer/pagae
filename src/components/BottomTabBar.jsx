import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, ClipboardCheck, Users } from 'lucide-react';

const tabs = [
  { path: '/contratos', label: 'Contratos', icon: FileText },
  { path: '/reconciliacao', label: 'Receber', icon: ClipboardCheck },
  { path: '/clientes', label: 'Clientes', icon: Users },
];

export default function BottomTabBar() {
  const location = useLocation();
  return (
    <nav
      className="lg:hidden bg-card border-t border-border flex items-center justify-around shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const active = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors ${
              active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
