import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { fileUrl, peso, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Package, Wallet, ShoppingBag, Upload, Trash2, Bike, ImageIcon, X, Store, Copy, CreditCard, Banknote, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import StarRating from "@/components/StarRating";

const CATEGORIES = ["Vegetables", "Fruits", "Rice & Grains", "Herbs", "Root Crops", "Dairy & Eggs"];
const UNITS = ["kg", "piece", "bundle", "sack", "tray", "liter"];
const NEXT_DELIVERY = { pending: "confirmed", confirmed: "packed", packed: "rider_assigned", rider_assigned: "out_for_delivery", out_for_delivery: "delivered" };
const NEXT_PICKUP = { pending: "confirmed", confirmed: "ready_for_pickup", ready_for_pickup: "picked_up" };
const nextStatus = (o) => (o.fulfillment_type === "pickup" ? NEXT_PICKUP : NEXT_DELIVERY)[o.status];
const STATUS_LABEL = { pending: "Pending", confirmed: "Confirmed", packed: "Packed", rider_assigned: "Rider Assigned", out_for_delivery: "Out for Delivery", delivered: "Delivered", ready_for_pickup: "Ready for Pickup", picked_up: "Picked Up", cancelled: "Cancelled" };

export default function SellerDashboard() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ products: 0, orders: 0, revenue: 0 });
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [riders, setRiders] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [customFor, setCustomFor] = useState(null);
  const [customRider, setCustomRider] = useState({ name: "", phone: "", vehicle: "Motorcycle" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gcashOpen, setGcashOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gcashUploading, setGcashUploading] = useState(false);
  const [gcash, setGcash] = useState({ gcash_number: "", gcash_name: "", gcash_qr_url: null });
  const [stockFor, setStockFor] = useState(null);
  const [stockVal, setStockVal] = useState("");
  const [form, setForm] = useState({ name: "", description: "", category: "Vegetables", price: "", unit: "kg", stock: "", location: "Laguna", image_url: null });
  const fileRef = useRef();
  const qrRef = useRef();

  useEffect(() => {
    if (user) setGcash({ gcash_number: user.gcash_number || "", gcash_name: user.gcash_name || "", gcash_qr_url: user.gcash_qr_url || null });
  }, [user]);

  const loadAll = async () => {
    const [s, p, o, r, e] = await Promise.all([
      api.get("/seller/stats"), api.get("/products", { params: { seller_id: user.id } }), api.get("/orders"), api.get("/riders"), api.get("/seller/earnings"),
    ]);
    setStats(s.data); setProducts(p.data); setOrders(o.data); setRiders(r.data); setEarnings(e.data);
  };

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== "seller" && user.role !== "admin")) { navigate("/"); return; }
    loadAll(); /* eslint-disable-next-line */
  }, [user, loading]);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, image_url: data.image_url }));
      toast.success("Image uploaded");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Upload failed"); }
    finally { setUploading(false); }
  };

  const createProduct = async () => {
    if (!form.name || !form.price) { toast.error("Name and price are required"); return; }
    try {
      await api.post("/products", { ...form, price: parseFloat(form.price), stock: parseInt(form.stock || 0) });
      toast.success("Product posted!");
      setDialogOpen(false);
      setForm({ name: "", description: "", category: "Vegetables", price: "", unit: "kg", stock: "", location: "Laguna", image_url: null });
      loadAll();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed"); }
  };

  const del = async (id) => { await api.delete(`/products/${id}`); toast.success("Removed"); loadAll(); };
  const saveStock = async () => {
    const val = parseInt(stockVal);
    if (isNaN(val) || val < 0) { toast.error("Enter a valid stock amount"); return; }
    try { await api.patch(`/products/${stockFor.id}/stock`, { stock: val }); toast.success("Stock updated"); setStockFor(null); loadAll(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed to update stock"); }
  };
  const advance = async (o) => { const next = nextStatus(o); if (!next) return; await api.put(`/orders/${o.id}/status`, { status: next }); toast.success(`Marked ${STATUS_LABEL[next]}`); loadAll(); };
  const assignRider = async (orderId, riderId) => { await api.put(`/orders/${orderId}/assign-rider`, { rider_id: riderId }); toast.success("Rider assigned"); loadAll(); };
  const assignCustom = async () => {
    if (!customRider.name.trim()) { toast.error("Rider name is required"); return; }
    await api.put(`/orders/${customFor}/assign-custom-rider`, customRider);
    toast.success("Temporary rider assigned");
    setCustomFor(null); setCustomRider({ name: "", phone: "", vehicle: "Motorcycle" });
    loadAll();
  };
  const cancelOrder = async (id) => { try { await api.put(`/orders/${id}/cancel`); toast.success("Cancelled & stock restored"); loadAll(); } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Cannot cancel"); } };
  const verifyPayment = async (id) => { await api.put(`/orders/${id}/verify-payment`); toast.success("Payment confirmed"); loadAll(); };

  const uploadQr = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setGcashUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setGcash((g) => ({ ...g, gcash_qr_url: data.image_url }));
      toast.success("QR uploaded");
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Upload failed"); }
    finally { setGcashUploading(false); }
  };

  const saveGcash = async () => {
    if (!gcash.gcash_number || !gcash.gcash_name) { toast.error("GCash name and number are required"); return; }
    try {
      const { data } = await api.put("/seller/gcash", gcash);
      setUser(data);
      toast.success("GCash details saved");
      setGcashOpen(false);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed to save"); }
  };

  if (loading || !user) return <div className="py-24 text-center text-muted-foreground">Loading…</div>;

  const STAT_CARDS = [
    { icon: Package, label: "Products", value: stats.products },
    { icon: ShoppingBag, label: "Orders", value: stats.orders },
    { icon: Wallet, label: "Revenue", value: peso(stats.revenue) },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading font-black text-3xl tracking-tight">Farm Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{user.farm_name || user.name}</p>
        </div>
        <div className="flex items-center gap-2">
        <Dialog open={gcashOpen} onOpenChange={setGcashOpen}>
          <DialogTrigger asChild>
            <Button data-testid="gcash-settings-btn" variant="outline" className="rounded-full gap-2 border-[#0079FF]/40 text-[#0079FF] hover:bg-[#0079FF]/10"><Wallet size={18} /> GCash{user.gcash_number ? "" : " setup"}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading flex items-center gap-2"><Wallet size={18} className="text-[#0079FF]" /> Receive payments via GCash</DialogTitle><DialogDescription>Enter your GCash details so buyers can pay you directly.</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">Buyers will pay directly to your GCash. Enter your details and upload your GCash QR (from your GCash app → “Show QR”).</p>
              <div><Label>GCash account name</Label><Input data-testid="gcash-name-input" value={gcash.gcash_name} onChange={(e) => setGcash({ ...gcash, gcash_name: e.target.value })} className="mt-1.5" placeholder="Juan D." /></div>
              <div><Label>GCash number</Label><Input data-testid="gcash-number-input" value={gcash.gcash_number} onChange={(e) => setGcash({ ...gcash, gcash_number: e.target.value })} className="mt-1.5" placeholder="0917-xxx-xxxx" /></div>
              <div>
                <Label>Your GCash QR (optional)</Label>
                <input ref={qrRef} type="file" accept="image/*" hidden onChange={uploadQr} data-testid="gcash-qr-input" />
                <button type="button" onClick={() => qrRef.current?.click()} className="mt-1.5 w-full aspect-video rounded-xl border-2 border-dashed border-border grid place-items-center overflow-hidden hover:border-[#0079FF]/50 transition-colors">
                  {gcash.gcash_qr_url ? <img src={fileUrl(gcash.gcash_qr_url)} alt="qr" className="h-full w-full object-contain p-2" /> :
                    <div className="text-center text-muted-foreground"><ImageIcon className="mx-auto mb-1" /><span className="text-sm">{gcashUploading ? "Uploading…" : "Upload GCash QR"}</span></div>}
                </button>
              </div>
              <Button data-testid="save-gcash-btn" onClick={saveGcash} className="w-full rounded-full bg-[#0079FF] hover:bg-[#0079FF]/90 text-white">Save GCash details</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-product-btn" className="rounded-full bg-accent hover:bg-accent/90 text-accent-foreground gap-2"><Plus size={18} /> Post goods</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Post your goods</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Product photo</Label>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} data-testid="image-upload-input" />
                <button type="button" onClick={() => fileRef.current?.click()} className="mt-1.5 w-full aspect-video rounded-xl border-2 border-dashed border-border grid place-items-center overflow-hidden hover:border-primary/50 transition-colors">
                  {form.image_url ? <img src={fileUrl(form.image_url)} alt="preview" className="h-full w-full object-cover" /> :
                    <div className="text-center text-muted-foreground"><ImageIcon className="mx-auto mb-1" /><span className="text-sm">{uploading ? "Uploading…" : "Click to upload"}</span></div>}
                </button>
              </div>
              <div><Label>Name</Label><Input data-testid="product-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" placeholder="e.g. Fresh Tomatoes" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" placeholder="Freshly harvested…" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger data-testid="category-select" className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Unit</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Price (₱)</Label><Input data-testid="product-price-input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5" placeholder="0.00" /></div>
                <div><Label>Stock</Label><Input data-testid="product-stock-input" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-1.5" placeholder="0" /></div>
              </div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1.5" placeholder="Municipality, Laguna" /></div>
              <Button data-testid="save-product-btn" onClick={createProduct} className="w-full rounded-full bg-primary hover:bg-primary/90">Post product</Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
            <s.icon className="text-primary" size={22} />
            <div className="font-heading font-black text-2xl mt-2" data-testid={`stat-${s.label.toLowerCase()}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      <Dialog open={!!customFor} onOpenChange={(v) => !v && setCustomFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Assign a temporary rider</DialogTitle><DialogDescription>Added just for this order and shown in its delivery history — not saved to your riders.</DialogDescription></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Rider name</Label><Input data-testid="custom-rider-name" value={customRider.name} onChange={(e) => setCustomRider({ ...customRider, name: e.target.value })} className="mt-1.5" placeholder="e.g. Kuya Ramon" /></div>
            <div><Label>Phone</Label><Input data-testid="custom-rider-phone" value={customRider.phone} onChange={(e) => setCustomRider({ ...customRider, phone: e.target.value })} className="mt-1.5" placeholder="0917-xxx-xxxx" /></div>
            <div><Label>Vehicle</Label>
              <Select value={customRider.vehicle} onValueChange={(v) => setCustomRider({ ...customRider, vehicle: v })}>
                <SelectTrigger data-testid="custom-rider-vehicle" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{["Motorcycle", "Tricycle", "Bicycle", "Multicab", "Car", "Jeep"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button data-testid="save-custom-rider-btn" onClick={assignCustom} className="w-full rounded-full bg-primary hover:bg-primary/90">Assign rider</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!stockFor} onOpenChange={(v) => !v && setStockFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Edit stock</DialogTitle><DialogDescription>{stockFor?.name} — update how many units are available.</DialogDescription></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Available stock</Label><Input data-testid="stock-edit-input" type="number" min="0" value={stockVal} onChange={(e) => setStockVal(e.target.value)} className="mt-1.5" placeholder="0" /></div>
            <Button data-testid="save-stock-btn" onClick={saveStock} className="w-full rounded-full bg-primary hover:bg-primary/90">Save stock</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="orders">
        <TabsList className="mb-4"><TabsTrigger value="orders" data-testid="tab-orders">Incoming Orders</TabsTrigger><TabsTrigger value="products" data-testid="tab-products">My Products</TabsTrigger><TabsTrigger value="earnings" data-testid="tab-earnings">Earnings</TabsTrigger></TabsList>

        <TabsContent value="orders">
          {orders.length === 0 ? <p className="text-muted-foreground text-center py-12">No orders yet.</p> : (
            <div className="space-y-3">
              {orders.map((o) => (
                <div key={o.id} data-testid={`seller-order-${o.id}`} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-heading font-bold flex items-center gap-2">#{o.id.slice(0, 8)} · {o.buyer_name}
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary bg-secondary px-2 py-0.5 rounded-full">
                          {o.fulfillment_type === "pickup" ? <><Store size={11} /> Pickup</> : <><Bike size={11} /> Delivery</>}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{o.items.length} item(s) · {peso(o.total)} · {o.payment_method === "cod" ? "Cash" : o.payment_method === "gcash" ? "GCash" : "Online"} ({o.payment_status})</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{o.fulfillment_type === "pickup" ? (o.pickup_location || "Farm pickup") : o.delivery_address} · {o.contact_phone}</div>
                      {o.payment_method === "gcash" && o.gcash_reference && (
                        <div className="text-xs mt-1 inline-flex items-center gap-1 text-[#0079FF] font-medium" data-testid={`gcash-ref-${o.id}`}>GCash Ref: {o.gcash_reference}</div>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${o.status === "delivered" || o.status === "picked_up" ? "bg-primary/10 text-primary" : o.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>{STATUS_LABEL[o.status]}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {nextStatus(o) && (
                      <Button data-testid={`advance-${o.id}`} size="sm" onClick={() => advance(o)} className="rounded-full bg-primary hover:bg-primary/90 text-xs h-8">Mark {STATUS_LABEL[nextStatus(o)]}</Button>
                    )}
                    {o.fulfillment_type !== "pickup" && !["delivered", "cancelled"].includes(o.status) && (
                      <Select onValueChange={(v) => assignRider(o.id, v)}>
                        <SelectTrigger data-testid={`assign-rider-${o.id}`} className="h-8 w-44 rounded-full text-xs"><Bike size={13} className="mr-1" /><SelectValue placeholder={o.rider ? o.rider.name : "Saved rider"} /></SelectTrigger>
                        <SelectContent>{riders.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} · {r.zone}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                    {o.fulfillment_type !== "pickup" && !["delivered", "cancelled"].includes(o.status) && (
                      <Button data-testid={`custom-rider-${o.id}`} size="sm" variant="outline" onClick={() => setCustomFor(o.id)} className="h-8 rounded-full text-xs gap-1"><Plus size={12} /> New rider</Button>
                    )}
                    {o.rider && <span className="text-xs text-muted-foreground flex items-center gap-1"><Bike size={13} /> {o.rider.name}{o.rider.vehicle && o.rider.vehicle !== "—" ? ` · ${o.rider.vehicle}` : ""}{o.rider.custom ? " (temp)" : ""}</span>}
                    {o.payment_method === "gcash" && o.payment_status !== "paid" && (
                      <Button data-testid={`verify-payment-${o.id}`} size="sm" onClick={() => verifyPayment(o.id)} className="rounded-full bg-[#0079FF] hover:bg-[#0079FF]/90 text-white text-xs h-8">
                        {o.payment_status === "gcash_submitted" ? "Confirm payment received" : "Mark GCash paid"}
                      </Button>
                    )}
                    {o.payment_status !== "paid" && !["delivered", "picked_up", "cancelled"].includes(o.status) && (
                      <button data-testid={`seller-cancel-${o.id}`} onClick={() => cancelOrder(o.id)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"><X size={13} /> Cancel</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products">
          {products.length === 0 ? <p className="text-muted-foreground text-center py-12">No products yet. Post your first harvest!</p> : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {products.map((p) => (
                <div key={p.id} data-testid={`seller-product-${p.id}`} className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="aspect-[4/3] bg-muted"><img src={fileUrl(p.image_url) || "https://images.unsplash.com/photo-1687199129802-3e4cc27baac0?w=400"} alt={p.name} className="h-full w-full object-cover" /></div>
                  <div className="p-3">
                    <div className="font-heading font-bold text-sm line-clamp-1">{p.name}</div>
                    <div className="mt-0.5"><StarRating value={p.rating_avg || 0} count={p.rating_count || 0} size={12} showEmpty={false} /></div>
                    <div className="text-xs text-muted-foreground">{peso(p.price)}/{p.unit} · {p.stock} left</div>
                    <div className="mt-2 flex items-center gap-3">
                      <button data-testid={`edit-stock-${p.id}`} onClick={() => { setStockFor(p); setStockVal(String(p.stock ?? 0)); }} className="text-xs text-primary flex items-center gap-1 hover:underline"><Package size={12} /> Edit stock</button>
                      <button data-testid={`delete-product-${p.id}`} onClick={() => del(p.id)} className="text-xs text-destructive flex items-center gap-1 hover:underline"><Trash2 size={12} /> Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="earnings">
          {!earnings ? <p className="text-muted-foreground text-center py-12">Loading…</p> : (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[{ icon: CreditCard, label: "Card / Online", value: earnings.breakdown.online, testid: "earn-online" },
                  { icon: Wallet, label: "GCash", value: earnings.breakdown.gcash, testid: "earn-gcash" },
                  { icon: Banknote, label: "Cash", value: earnings.breakdown.cod, testid: "earn-cod" },
                  { icon: TrendingUp, label: "Total earned", value: earnings.total, testid: "earn-total", highlight: true }].map((c) => (
                  <div key={c.label} className={`rounded-2xl p-5 border ${c.highlight ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}>
                    <c.icon size={22} className={c.highlight ? "text-primary-foreground" : "text-primary"} />
                    <div className="font-heading font-black text-2xl mt-2" data-testid={c.testid}>{peso(c.value)}</div>
                    <div className={`text-xs uppercase tracking-wider ${c.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{c.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">Pending (not yet paid / delivered): <span className="font-semibold text-foreground" data-testid="earn-pending">{peso(earnings.pending)}</span></p>

              <div className="mt-6 bg-card border border-border rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <div className="col-span-4">Order</div><div className="col-span-2">Method</div><div className="col-span-3">Status</div><div className="col-span-3 text-right">Your income</div>
                </div>
                {earnings.orders.length === 0 ? <p className="text-muted-foreground text-center py-8 text-sm">No orders yet.</p> :
                  earnings.orders.map((r) => (
                    <div key={r.order_id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-border/60 last:border-0 items-center">
                      <div className="col-span-4 min-w-0"><div className="font-medium truncate">#{r.order_id.slice(0, 8)}</div><div className="text-xs text-muted-foreground truncate">{r.buyer_name} · {new Date(r.date).toLocaleDateString()}</div></div>
                      <div className="col-span-2 text-xs">{r.method === "cod" ? "Cash" : r.method === "gcash" ? "GCash" : "Card"}</div>
                      <div className="col-span-3"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.realized ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{r.realized ? "Earned" : "Pending"}</span></div>
                      <div className="col-span-3 text-right font-semibold">{peso(r.amount)}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
