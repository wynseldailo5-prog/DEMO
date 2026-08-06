import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { fileUrl, peso, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import OrderTracker from "@/components/OrderTracker";
import DeliveryMap from "@/components/DeliveryMap";
import { etaFrom, matchCoords } from "@/lib/laguna";
import { Package, MapPin, Phone, Bike, ChevronDown, Store, X, Wallet, Clock } from "lucide-react";
import { toast } from "sonner";

const FALLBACK = "https://images.unsplash.com/photo-1687199129802-3e4cc27baac0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBtYXJrZXQlMjBzdGFsbHxlbnwwfHx8fDE3ODU1NTQzMDd8MA&ixlib=rb-4.1.0&q=85";
const STATUS_LABEL = { pending: "Pending", confirmed: "Confirmed", packed: "Packed", rider_assigned: "Rider Assigned", out_for_delivery: "Out for Delivery", delivered: "Delivered", ready_for_pickup: "Ready for Pickup", picked_up: "Picked Up", cancelled: "Cancelled" };

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/orders").then((r) => setOrders(r.data)).finally(() => setLoading(false));
  useEffect(() => { if (user) load(); }, [user]);

  useEffect(() => {
    if (!open) return;
    const current = orders.find((x) => x.id === open);
    if (!current || current.status !== "out_for_delivery") return;
    const poll = setInterval(() => {
      api.get(`/orders/${open}`).then((r) => {
        setOrders((prev) => prev.map((x) => x.id === open ? r.data : x));
        if (r.data.status !== "out_for_delivery") clearInterval(poll);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(poll);
    // eslint-disable-next-line
  }, [open]);

  const cancel = async (id) => {
    try { await api.put(`/orders/${id}/cancel`); toast.success("Order cancelled & stock restored"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Cannot cancel"); }
  };

  const canCancel = (o) => o.payment_status !== "paid" && !["delivered", "picked_up", "cancelled"].includes(o.status);

  if (!user) return <div className="max-w-3xl mx-auto px-4 py-24 text-center"><p className="text-muted-foreground">Please <Link to="/login" className="text-primary font-semibold">sign in</Link> to view orders.</p></div>;
  if (loading) return <div className="max-w-3xl mx-auto px-4 py-24 text-center text-muted-foreground">Loading orders…</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-heading font-black text-3xl tracking-tight mb-6">My Orders</h1>
      {orders.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground"><Package className="mx-auto mb-3 opacity-50" /><p>No orders yet.</p></div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} data-testid={`order-${o.id}`} className="bg-card border border-border rounded-2xl overflow-hidden">
              <button onClick={() => setOpen(open === o.id ? null : o.id)} className="w-full flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3 text-left">
                  <span className="grid place-items-center h-10 w-10 rounded-xl bg-secondary text-primary">{o.fulfillment_type === "pickup" ? <Store size={18} /> : <Package size={18} />}</span>
                  <div>
                    <div className="font-heading font-bold">Order #{o.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()} · {o.items.length} item(s) · {peso(o.total)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${o.status === "delivered" || o.status === "picked_up" ? "bg-primary/10 text-primary" : o.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>{STATUS_LABEL[o.status]}</span>
                  <ChevronDown size={18} className={`transition-transform ${open === o.id ? "rotate-180" : ""}`} />
                </div>
              </button>

              {open === o.id && (
                <div className="p-4 border-t border-border space-y-5">
                  <div className="pt-3"><OrderTracker status={o.status} fulfillment_type={o.fulfillment_type} /></div>

                  {o.status !== "cancelled" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{o.fulfillment_type === "pickup" ? "Pickup location" : "Live delivery map"}</div>
                        {o.fulfillment_type !== "pickup" && o.status === "out_for_delivery" && o.rider_location && (() => {
                          const dropoff = o.delivery_lat != null ? { lat: o.delivery_lat, lng: o.delivery_lng } : matchCoords(o.delivery_address);
                          const eta = etaFrom(o.rider_location, dropoff);
                          return <span data-testid={`eta-${o.id}`} className="inline-flex items-center gap-1 text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full"><Clock size={12} /> ~{eta.min} min · {eta.km} km away</span>;
                        })()}
                      </div>
                      <DeliveryMap order={o} />
                    </div>
                  )}

                  <div className="space-y-2">
                    {o.items.map((i, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <img src={fileUrl(i.image_url) || FALLBACK} alt={i.name} className="h-12 w-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{i.name}</div><div className="text-xs text-muted-foreground">×{i.quantity}</div></div>
                        <div className="text-sm font-semibold">{peso(i.price * i.quantity)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm space-y-1 bg-secondary/40 rounded-xl p-4">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{peso(o.subtotal ?? o.total)}</span></div>
                    {o.fulfillment_type !== "pickup" && <div className="flex justify-between"><span className="text-muted-foreground">Shipping fee</span><span data-testid={`order-shipping-${o.id}`}>{peso(o.shipping_fee || 0)}</span></div>}
                    <div className="flex justify-between font-heading font-bold pt-1 border-t border-border/60"><span>Total</span><span className="text-primary">{peso(o.total)}</span></div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm bg-secondary/40 rounded-xl p-4">
                    {o.fulfillment_type === "pickup"
                      ? <div className="flex items-start gap-2"><Store size={15} className="mt-0.5 text-primary" /><span>{o.pickup_location || "Farm pickup"}</span></div>
                      : <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 text-primary" /><span>{o.delivery_address}</span></div>}
                    <div className="flex items-center gap-2"><Phone size={15} className="text-primary" /><span>{o.contact_phone}</span></div>
                    <div className="flex items-center gap-2"><span className="text-muted-foreground">Payment:</span><span className="font-medium">{o.payment_method === "cod" ? "Cash" : o.payment_method === "gcash" ? "GCash" : "Online"} · {o.payment_status}</span></div>
                    {o.rider && <div className="flex items-center gap-2"><Bike size={15} className="text-primary" /><span>{o.rider.name}{o.rider.vehicle && o.rider.vehicle !== "—" ? ` · ${o.rider.vehicle}` : ""}{o.rider.phone ? ` · ${o.rider.phone}` : ""}{o.rider.custom ? " (temporary)" : ""}</span></div>}
                  </div>

                  {o.payment_method === "gcash" && o.payment_status !== "paid" && (
                    <Link to={`/gcash-pay/${o.id}`} data-testid={`gcash-pay-link-${o.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0079FF] hover:underline">
                      <Wallet size={15} /> {o.payment_status === "gcash_submitted" ? "View GCash payment (awaiting seller)" : "Complete GCash payment"}
                    </Link>
                  )}

                  {canCancel(o) && (
                    <button data-testid={`cancel-order-${o.id}`} onClick={() => cancel(o.id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline">
                      <X size={15} /> Cancel order
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
