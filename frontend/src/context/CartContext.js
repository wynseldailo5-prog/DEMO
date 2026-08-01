import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const add = (product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, {
        product_id: product.id, name: product.name, price: product.price,
        quantity: qty, seller_id: product.seller_id, image_url: product.image_url, unit: product.unit,
      }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const updateQty = (product_id, quantity) => {
    if (quantity <= 0) return remove(product_id);
    setItems((prev) => prev.map((i) => i.product_id === product_id ? { ...i, quantity } : i));
  };

  const remove = (product_id) => setItems((prev) => prev.filter((i) => i.product_id !== product_id));
  const clear = () => setItems([]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, updateQty, remove, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
