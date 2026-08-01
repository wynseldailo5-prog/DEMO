import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { fileUrl, peso } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";

const FALLBACK = "https://images.unsplash.com/photo-1687199129802-3e4cc27baac0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBtYXJrZXQlMjBzdGFsbHxlbnwwfHx8fDE3ODU1NTQzMDd8MA&ixlib=rb-4.1.0&q=85";

export default function Cart() {
  const { items, updateQty, remove, total } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <ShoppingCart className="mx-auto mb-4 text-muted-foreground opacity-50" size={48} />
        <h1 className="font-heading font-bold text-2xl">Your cart is empty</h1>
        <p className="text-muted-foreground mt-1">Find something fresh from Laguna's farms.</p>
        <Button data-testid="browse-market-btn" onClick={() => navigate("/market")} className="mt-6 rounded-full bg-primary hover:bg-primary/90">Browse market</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-heading font-black text-3xl tracking-tight mb-6">Your Cart</h1>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {items.map((i) => (
            <div key={i.product_id} data-testid={`cart-item-${i.product_id}`} className="flex gap-4 bg-card border border-border rounded-2xl p-3">
              <img src={fileUrl(i.image_url) || FALLBACK} alt={i.name} className="h-20 w-20 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <h3 className="font-heading font-bold line-clamp-1">{i.name}</h3>
                <p className="text-sm text-muted-foreground">{peso(i.price)} / {i.unit}</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center border border-border rounded-full">
                    <button data-testid={`cart-minus-${i.product_id}`} onClick={() => updateQty(i.product_id, i.quantity - 1)} className="p-1.5 hover:text-primary"><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                    <button data-testid={`cart-plus-${i.product_id}`} onClick={() => updateQty(i.product_id, i.quantity + 1)} className="p-1.5 hover:text-primary"><Plus size={14} /></button>
                  </div>
                  <button data-testid={`cart-remove-${i.product_id}`} onClick={() => remove(i.product_id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="font-heading font-bold text-primary">{peso(i.price * i.quantity)}</div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 h-fit">
          <h2 className="font-heading font-bold text-lg">Summary</h2>
          <div className="flex justify-between text-sm mt-4"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{peso(total)}</span></div>
          <div className="flex justify-between text-sm mt-2"><span className="text-muted-foreground">Delivery</span><span className="font-medium">Calculated at checkout</span></div>
          <div className="border-t border-border my-4" />
          <div className="flex justify-between font-heading font-bold text-lg"><span>Total</span><span className="text-primary" data-testid="cart-total">{peso(total)}</span></div>
          <Button data-testid="checkout-btn" onClick={() => navigate(user ? "/checkout" : "/login")} className="w-full mt-5 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground h-12">
            {user ? "Proceed to checkout" : "Sign in to checkout"}
          </Button>
        </div>
      </div>
    </div>
  );
}
