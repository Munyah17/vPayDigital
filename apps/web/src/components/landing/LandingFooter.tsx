import { Link } from 'react-router-dom';

const FOOTER_COLS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/#features' },
      { label: 'Virtual Cards', to: '/#features' },
      { label: 'Wallets', to: '/#features' },
      { label: 'Transfers', to: '/#features' },
      { label: 'Vouchers', to: '/#features' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Careers', to: '#' },
      { label: 'Blog', to: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '#' },
      { label: 'Terms of Service', to: '#' },
      { label: 'Cookie Policy', to: '#' },
      { label: 'Compliance', to: '#' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-foreground/[0.06] py-16 px-6 lg:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          <div className="col-span-2 lg:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4 w-fit">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                <span className="text-foreground font-bold text-sm">e</span>
              </div>
              <span className="font-display font-bold text-foreground text-lg">ePayZW</span>
            </Link>
            <p className="text-foreground/35 text-sm leading-relaxed max-w-xs">
              The modern financial platform for Africa and beyond. Send, receive, spend and earn — globally.
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="text-foreground font-semibold text-sm mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-foreground/35 text-sm hover:text-foreground/70 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-foreground/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-foreground/25 text-sm">© 2026 ePayZW Technologies. All rights reserved. Powered by Global Space Web.</p>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
