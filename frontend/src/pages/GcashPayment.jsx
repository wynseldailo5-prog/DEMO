import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { API, fileUrl, peso, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Copy, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function GcashPayment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [order, setOrder] = useState(null);
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/login"); return; }
    api.get(`/orders/${orderId}`).then((r) => setOrder(r.data)).catch(() => navigate("/orders"));
  }, [orderId, user, loading, navigate]);

  if (!order) return <div className="max-w-md mx-auto px-4 py-24 text-center text-muted-foreground">Loading…</div>;

  const info = order.gcash_info || {};
  const already = order.payment_status === "gcash_submitted" || order.payment_status === "paid";
  const copy = (t) => { navigator.clipboard?.writeText(t); toast.success("Copied"); };

  const submit = async () => {
    if (!reference.trim()) { toast.error("Enter the GCash reference number from your receipt."); return; }
    setSubmitting(true);
    try {
      await api.put(`/orders/${orderId}/gcash-reference`, { reference });
      toast.success("Reference submitted! The seller will confirm your payment.");
      navigate("/orders");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed to submit");
    } finally { setSubmitting(false); }
  };

  const qrSrc = info.qr_url ? fileUrl(info.qr_url) : `${API}/gcash-qr/${orderId}`;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8" data-testid="gcash-pay-page">
      <button onClick={() => navigate("/orders")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5"><ArrowLeft size={16} /> Orders</button>

      <div className="bg-card border border-border rounded-3xl overflow-hidden">
        <div className="bg-[#0079FF] text-white p-6 text-center">
          <div className="flex items-center justify-center gap-2 font-heading font-black text-xl"><Wallet size={22} /> GCash</div>
          <div className="text-white/80 text-sm mt-1">Order #{order.id.slice(0, 8)}</div>
          <div className="font-heading font-black text-3xl mt-3">{peso(order.total)}</div>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Scan to pay in your GCash app</div>
            <img data-testid="gcash-qr-img" src={qrSrc} alt="GCash QR" className="mx-auto h-52 w-52 rounded-2xl border border-border object-contain bg-white p-2" />
            {!info.qr_url && <p className="text-[11px] text-muted-foreground mt-2">Seller hasn't uploaded their GCash QR — send manually to the number below.</p>}
          </div>

          <div className="rounded-2xl bg-secondary/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div><div className="text-xs text-muted-foreground">Account name</div><div className="font-semibold" data-testid="gcash-name">{info.name || "—"}</div></div>
            </div>
            <div className="flex items-center justify-between">
              <div><div className="text-xs text-muted-foreground">GCash number</div><div className="font-semibold font-mono" data-testid="gcash-number">{info.number || "—"}</div></div>
              <button onClick={() => copy(info.number || "")} className="grid place-items-center h-9 w-9 rounded-full bg-background border border-border hover:bg-muted transition-colors"><Copy size={15} /></button>
            </div>
          </div>

          {already ? (
            <div className="flex items-center gap-2 text-primary bg-primary/10 rounded-xl p-4 text-sm" data-testid="gcash-submitted-note">
              <CheckCircle2 size={18} /> {order.payment_status === "paid" ? "Payment confirmed by seller." : "Reference submitted — waiting for the seller to confirm."}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>GCash reference number</Label>
                <p className="text-xs text-muted-foreground mb-1.5">After paying, copy the reference no. from your GCash receipt.</p>
                <Input data-testid="gcash-ref-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 1029 3847 5610" />
              </div>
              <Button data-testid="gcash-submit-btn" onClick={submit} disabled={submitting} className="w-full rounded-full bg-[#0079FF] hover:bg-[#0079FF]/90 text-white h-12">
                {submitting ? "Submitting…" : "I've paid — submit reference"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
