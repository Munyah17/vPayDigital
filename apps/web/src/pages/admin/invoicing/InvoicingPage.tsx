import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, X, Trash2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../../../lib/adminAxios';
import { formatCurrency, formatRelativeTime } from '@vpay/utils';
import toast from 'react-hot-toast';

type Tab = 'invoices' | 'quotations' | 'clients' | 'receipts';
interface LineItem { description: string; quantity: number; unit_price: number }
interface Client { id: string; name: string; email: string | null; phone: string | null }
interface Doc {
  id: string; quote_number?: string; invoice_number?: string; client_id: string;
  billing_clients: { name: string; email: string | null } | null;
  line_items: LineItem[]; currency: string; subtotal: number; tax_percent: number; tax_amount: number; total: number;
  status: string; created_at: string; due_date?: string | null; valid_until?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'text-foreground/40', sent: 'text-indigo-400', accepted: 'text-emerald-400', paid: 'text-emerald-400',
  rejected: 'text-red-400', expired: 'text-foreground/30', overdue: 'text-red-400', cancelled: 'text-foreground/30',
};

function LineItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (items: LineItem[]) => void }) {
  const update = (i: number, patch: Partial<LineItem>) => onChange(items.map((li, idx) => idx === i ? { ...li, ...patch } : li));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const total = items.reduce((s, li) => s + li.quantity * li.unit_price, 0);

  return (
    <div className="space-y-2">
      {items.map((li, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input value={li.description} onChange={e => update(i, { description: e.target.value })} placeholder="Description" className="input-field col-span-6 text-sm" />
          <input value={li.quantity} onChange={e => update(i, { quantity: parseFloat(e.target.value) || 0 })} type="number" min="0" step="1" className="input-field col-span-2 text-sm" placeholder="Qty" />
          <input value={li.unit_price} onChange={e => update(i, { unit_price: parseFloat(e.target.value) || 0 })} type="number" min="0" step="0.01" className="input-field col-span-3 text-sm" placeholder="Price" />
          <button onClick={() => remove(i)} className="col-span-1 p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...items, { description: '', quantity: 1, unit_price: 0 }])} className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
        <Plus className="w-3 h-3" /> Add line item
      </button>
      <p className="text-foreground/40 text-xs text-right">Subtotal: {total.toFixed(2)}</p>
    </div>
  );
}

export default function InvoicingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('invoices');
  const [showForm, setShowForm] = useState(false);
  const [docForm, setDocForm] = useState({ client_id: '', currency: 'USD', tax_percent: '0', due_date: '', valid_until: '', notes: '' });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [paymentModal, setPaymentModal] = useState<{ id: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Bank transfer');

  const clients = useQuery({ queryKey: ['billing-clients'], queryFn: () => api.get<{ success: boolean; data: Client[] }>('/api/admin/invoicing/clients') });
  const quotations = useQuery({ queryKey: ['quotations'], queryFn: () => api.get<{ success: boolean; data: Doc[] }>('/api/admin/invoicing/quotations'), enabled: tab === 'quotations' });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: () => api.get<{ success: boolean; data: Doc[] }>('/api/admin/invoicing/invoices'), enabled: tab === 'invoices' });
  const receipts = useQuery({ queryKey: ['receipts'], queryFn: () => api.get<{ success: boolean; data: any[] }>('/api/admin/invoicing/receipts'), enabled: tab === 'receipts' });

  const createClient = useMutation({
    mutationFn: () => api.post('/api/admin/invoicing/clients', clientForm),
    onSuccess: () => { toast.success('Client added'); qc.invalidateQueries({ queryKey: ['billing-clients'] }); setShowForm(false); setClientForm({ name: '', email: '', phone: '', address: '' }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const createDoc = useMutation({
    mutationFn: () => api.post(`/api/admin/invoicing/${tab}`, {
      client_id: docForm.client_id, line_items: lineItems.filter(li => li.description),
      currency: docForm.currency, tax_percent: parseFloat(docForm.tax_percent) || 0,
      ...(tab === 'invoices' ? { due_date: docForm.due_date || undefined } : { valid_until: docForm.valid_until || undefined }),
      notes: docForm.notes || undefined,
    }),
    onSuccess: () => {
      toast.success(`${tab === 'invoices' ? 'Invoice' : 'Quotation'} created`);
      qc.invalidateQueries({ queryKey: [tab] });
      setShowForm(false);
      setLineItems([{ description: '', quantity: 1, unit_price: 0 }]);
      setDocForm({ client_id: '', currency: 'USD', tax_percent: '0', due_date: '', valid_until: '', notes: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to create'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ kind, id, status }: { kind: 'quotations' | 'invoices'; id: string; status: string }) => api.patch(`/api/admin/invoicing/${kind}/${id}`, { status }),
    onSuccess: (_r, vars) => { qc.invalidateQueries({ queryKey: [vars.kind] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const convert = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/invoicing/quotations/${id}/convert`),
    onSuccess: () => { toast.success('Converted to invoice'); qc.invalidateQueries({ queryKey: ['invoices'] }); setTab('invoices'); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const recordPayment = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/invoicing/invoices/${id}/record-payment`, { payment_method: paymentMethod }),
    onSuccess: () => { toast.success('Payment recorded — receipt issued'); qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['receipts'] }); setPaymentModal(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed'),
  });

  const clientList = clients.data?.data?.data ?? [];
  const docs = (tab === 'quotations' ? quotations.data?.data?.data : tab === 'invoices' ? invoices.data?.data?.data : []) ?? [];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Receipt className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground text-2xl">Invoicing</h1>
            <p className="text-foreground/40 text-sm">Quotations, invoices, and receipts for business clients</p>
          </div>
        </div>
        {(tab === 'invoices' || tab === 'quotations' || tab === 'clients') && (
          <button onClick={() => setShowForm(s => !s)} className="btn-brand flex items-center gap-2 px-4 py-2 text-sm">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : tab === 'clients' ? 'New client' : `New ${tab === 'invoices' ? 'invoice' : 'quote'}`}
          </button>
        )}
      </div>

      <div className="flex gap-2 p-1 rounded-xl bg-foreground/5 w-fit flex-wrap">
        {(['invoices', 'quotations', 'clients', 'receipts'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setShowForm(false); }} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'}`}>{t}</button>
        ))}
      </div>

      {showForm && tab === 'clients' && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} placeholder="Client / company name" className="input-field" />
            <input value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="input-field" />
            <input value={clientForm.address} onChange={e => setClientForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" className="input-field" />
          </div>
          <button onClick={() => createClient.mutate()} disabled={createClient.isPending || !clientForm.name} className="btn-primary w-full py-2.5">
            {createClient.isPending ? 'Adding…' : 'Add client'}
          </button>
        </div>
      )}

      {showForm && (tab === 'invoices' || tab === 'quotations') && (
        <div className="glass-card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Client</label>
              <select value={docForm.client_id} onChange={e => setDocForm(f => ({ ...f, client_id: e.target.value }))} className="input-field">
                <option value="">Select client</option>
                {clientList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Currency</label>
              <select value={docForm.currency} onChange={e => setDocForm(f => ({ ...f, currency: e.target.value }))} className="input-field">
                {['USD', 'EUR', 'GBP', 'ZAR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <LineItemsEditor items={lineItems} onChange={setLineItems} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Tax %</label>
              <input value={docForm.tax_percent} onChange={e => setDocForm(f => ({ ...f, tax_percent: e.target.value }))} type="number" min="0" max="100" className="input-field" />
            </div>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">{tab === 'invoices' ? 'Due date' : 'Valid until'}</label>
              <input
                value={tab === 'invoices' ? docForm.due_date : docForm.valid_until}
                onChange={e => setDocForm(f => tab === 'invoices' ? { ...f, due_date: e.target.value } : { ...f, valid_until: e.target.value })}
                type="date" className="input-field"
              />
            </div>
          </div>
          <textarea value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} className="input-field resize-none" />

          <button
            onClick={() => createDoc.mutate()}
            disabled={createDoc.isPending || !docForm.client_id || lineItems.every(li => !li.description)}
            className="btn-primary w-full py-2.5"
          >
            {createDoc.isPending ? 'Creating…' : `Create ${tab === 'invoices' ? 'invoice' : 'quote'}`}
          </button>
        </div>
      )}

      {tab === 'clients' ? (
        <div className="glass-card overflow-hidden">
          {clientList.length === 0 ? (
            <p className="text-foreground/20 text-sm p-8 text-center">No clients yet</p>
          ) : (
            <ul className="divide-y divide-foreground/5">
              {clientList.map(c => (
                <li key={c.id} className="p-4">
                  <p className="text-foreground text-sm font-medium">{c.name}</p>
                  <p className="text-foreground/40 text-xs">{[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact info'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab === 'receipts' ? (
        <div className="glass-card overflow-hidden">
          {(receipts.data?.data?.data ?? []).length === 0 ? (
            <p className="text-foreground/20 text-sm p-8 text-center">No receipts issued yet</p>
          ) : (
            <ul className="divide-y divide-foreground/5">
              {(receipts.data?.data?.data ?? []).map((r: any) => (
                <li key={r.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-foreground text-sm font-medium font-mono">{r.receipt_number}</p>
                    <p className="text-foreground/40 text-xs">{r.invoices?.invoice_number} · {r.invoices?.billing_clients?.name} · {r.payment_method}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-foreground font-semibold text-sm">{formatCurrency(r.amount, r.currency)}</p>
                    <p className="text-foreground/30 text-xs">{formatRelativeTime(new Date(r.created_at))}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {docs.length === 0 ? (
            <p className="text-foreground/20 text-sm p-8 text-center">No {tab} yet</p>
          ) : (
            <ul className="divide-y divide-foreground/5">
              {docs.map(d => (
                <li key={d.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-foreground text-sm font-medium font-mono">{d.quote_number ?? d.invoice_number}</p>
                      <p className="text-foreground/40 text-xs">{d.billing_clients?.name ?? 'Unknown client'} · {formatRelativeTime(new Date(d.created_at))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground font-semibold">{formatCurrency(d.total, d.currency)}</p>
                      <p className={`text-xs font-medium capitalize ${STATUS_COLOR[d.status]}`}>{d.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {tab === 'quotations' && d.status === 'draft' && (
                      <button onClick={() => updateStatus.mutate({ kind: 'quotations', id: d.id, status: 'sent' })} className="btn-ghost px-3 py-1.5 text-xs">Mark sent</button>
                    )}
                    {tab === 'quotations' && d.status === 'sent' && (
                      <>
                        <button onClick={() => updateStatus.mutate({ kind: 'quotations', id: d.id, status: 'accepted' })} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400">Accepted</button>
                        <button onClick={() => updateStatus.mutate({ kind: 'quotations', id: d.id, status: 'rejected' })} className="px-3 py-1.5 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400">Rejected</button>
                      </>
                    )}
                    {tab === 'quotations' && d.status === 'accepted' && (
                      <button onClick={() => convert.mutate(d.id)} className="btn-brand px-3 py-1.5 text-xs flex items-center gap-1.5">
                        Convert to invoice <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {tab === 'invoices' && d.status === 'draft' && (
                      <button onClick={() => updateStatus.mutate({ kind: 'invoices', id: d.id, status: 'sent' })} className="btn-ghost px-3 py-1.5 text-xs">Mark sent</button>
                    )}
                    {tab === 'invoices' && (d.status === 'sent' || d.status === 'overdue') && (
                      <button onClick={() => setPaymentModal({ id: d.id })} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" /> Record payment
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPaymentModal(null)}>
          <div className="glass-card p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-foreground font-semibold">Record payment</h3>
            <div>
              <label className="block text-foreground/60 text-sm mb-1.5">Payment method / POP reference</label>
              <input value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field" placeholder="Bank transfer, EcoCash ref, etc." />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPaymentModal(null)} className="btn-ghost flex-1 py-2.5">Cancel</button>
              <button onClick={() => recordPayment.mutate(paymentModal.id)} disabled={recordPayment.isPending} className="btn-primary flex-1 py-2.5">
                {recordPayment.isPending ? 'Recording…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
