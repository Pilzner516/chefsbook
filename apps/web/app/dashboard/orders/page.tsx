'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@chefsbook/db';

interface Order {
  id: string;
  status: string;
  quantity: number;
  total_charged_cents: number;
  tracking_number: string | null;
  tracking_url: string | null;
  estimated_delivery_date: string | null;
  created_at: string;
  printed_cookbooks: {
    id: string;
    title: string;
    author_name: string;
    cover_style: string;
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700' },
  payment_complete: { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  submitted_to_lulu: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'In Production', color: 'bg-amber-100 text-amber-700' },
  shipped: { label: 'Shipped', color: 'bg-cb-green/10 text-cb-green' },
  delivered: { label: 'Delivered', color: 'bg-cb-green/20 text-cb-green' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth');
      return;
    }

    try {
      const res = await fetch('/api/print-orders');
      if (res.ok) {
        const { orders: data } = await res.json();
        setOrders(data || []);
      }
    } catch (e) {
      console.error('Failed to load orders:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Cookbook Orders</h1>
        <p className="text-cb-secondary text-sm mt-1">
          Track your printed cookbook orders.
        </p>
      </div>

      {loading ? (
        <div className="text-center text-cb-secondary py-20">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-cb-primary/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">No orders yet</h2>
          <p className="text-cb-secondary text-sm mb-6">
            Create your first printed cookbook and it will appear here.
          </p>
          <Link
            href="/dashboard/print"
            className="inline-flex items-center gap-2 bg-cb-primary text-white px-6 py-2.5 rounded-input font-semibold hover:opacity-90 transition-opacity"
          >
            Print My Cookbook
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
            const date = new Date(order.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={order.id}
                className="bg-cb-card border border-cb-border rounded-card p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{order.printed_cookbooks.title}</h3>
                    <p className="text-sm text-cb-secondary">
                      by {order.printed_cookbooks.author_name}
                    </p>
                    <p className="text-xs text-cb-muted mt-1">
                      Ordered {date} · Qty: {order.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                    <p className="text-sm font-semibold mt-2">
                      ${(order.total_charged_cents / 100).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Tracking info */}
                {order.tracking_url && (
                  <div className="mt-4 pt-4 border-t border-cb-border">
                    <div className="flex items-center justify-between">
                      <div>
                        {order.tracking_number && (
                          <p className="text-sm">
                            Tracking: <span className="font-mono">{order.tracking_number}</span>
                          </p>
                        )}
                        {order.estimated_delivery_date && (
                          <p className="text-xs text-cb-secondary mt-1">
                            Est. delivery: {new Date(order.estimated_delivery_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <a
                        href={order.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-cb-primary hover:underline flex items-center gap-1"
                      >
                        Track Package
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </div>
                  </div>
                )}

                {/* Re-order button */}
                {(order.status === 'delivered' || order.status === 'shipped') && (
                  <div className="mt-4 pt-4 border-t border-cb-border">
                    <Link
                      href={`/dashboard/print?reorder=${order.printed_cookbooks.id}`}
                      className="text-sm text-cb-primary hover:underline"
                    >
                      Order Another Copy →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
