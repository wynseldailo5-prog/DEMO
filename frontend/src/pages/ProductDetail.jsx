import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { fileUrl, peso } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { MapPin, Leaf, Minus, Plus, ArrowLeft, ShoppingCart } from "lucide-react";

const FALLBACK = "https://images.pexels.com/photos/10697692/pexels-photo-10697692.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);

  useEffect(() => { api.get(`/products/${id}`).then((r) => setProduct(r.data)).catch(() => navigate("/market")); }, [id, navigate]);

  if (!product) return <div className="max-w-5xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  const out = product.stock <= 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <button data-testid="back-btn" onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft size={16} /> Back</button>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="aspect-square rounded-3xl overflow-hidden bg-muted border border-border">
          <img src={fileUrl(product.image_url) || FALLBACK} alt={product.name} className="h-full w-full object-cover" />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">{product.category}</span>
          <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tight mt-1">{product.name}</h1>
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Leaf size={15} className="text-primary" />{product.seller_name}</span>
            <span className="flex items-center gap-1.5"><MapPin size={15} />{product.location}</span>
          </div>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="font-heading font-black text-4xl text-primary">{peso(product.price)}</span>
            <span className="text-muted-foreground">/ {product.unit}</span>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed">{product.description || "Freshly harvested and ready for delivery."}</p>
          <p className={`mt-3 text-sm font-medium ${out ? "text-destructive" : "text-primary"}`}>{out ? "Out of stock" : `${product.stock} ${product.unit} available`}</p>

          {!out && (
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center border border-border rounded-full">
                <button data-testid="qty-minus" onClick={() => setQty(Math.max(1, qty - 1))} className="p-2.5 hover:text-primary"><Minus size={16} /></button>
                <span data-testid="qty-value" className="w-10 text-center font-semibold">{qty}</span>
                <button data-testid="qty-plus" onClick={() => setQty(qty + 1)} className="p-2.5 hover:text-primary"><Plus size={16} /></button>
              </div>
              <Button data-testid="detail-add-cart-btn" onClick={() => add(product, qty)} className="flex-1 rounded-full bg-primary hover:bg-primary/90 h-12 gap-2">
                <ShoppingCart size={18} /> Add to cart
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
