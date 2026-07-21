import { Construction } from 'lucide-react';

interface ModulePlaceholderProps {
  title: string;
  description: string;
  needs: string;
}

// Honest "not built yet" page for command-center modules that need real
// scoping before they can exist — an HR/Payroll or Loans module can't be
// faked with placeholder data on a financial platform's own admin surface.
// Shown instead of either a 404 or a page that pretends to work.
export default function ModulePlaceholder({ title, description, needs }: ModulePlaceholderProps) {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="glass-card p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-foreground/5 flex items-center justify-center mx-auto">
          <Construction className="w-6 h-6 text-foreground/30" />
        </div>
        <div>
          <h1 className="font-display font-bold text-foreground text-xl">{title}</h1>
          <p className="text-foreground/40 text-sm mt-1">{description}</p>
        </div>
        <div className="rounded-xl bg-foreground/3 border border-foreground/5 p-4 text-left">
          <p className="text-foreground/30 text-xs uppercase tracking-wider mb-1">Needs before this can be built</p>
          <p className="text-foreground/60 text-sm">{needs}</p>
        </div>
      </div>
    </div>
  );
}
