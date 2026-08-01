import { Link } from "react-router-dom";
import { fileUrl, peso } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { MapPin, Plus, Leaf } from "lucide-react";
import { motion } from "framer-motion";

const FALLBACK = "https://images.unsplash.com/photo-1687199129802-3e4cc27baac0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBtYXJrZXQlMjBzdGFsbHxlbnwwfHx8fDE3ODU1NTQzMDd8MA&ixlib=rb-4.1.0&q=85";

export default function ProductCard({ product, index = 0 }) {
  const { add } = useCart();
  const out = product.stock <= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: (index % 8) * 0.05 }}
      data-testid={`product-card-${product.id}`}
      className="group bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-[transform,box-shadow] duration-300">
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img src={fileUrl(product.image_url) || FALLBACK} alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider bg-background/90 backdrop-blur px-2.5 py-1 rounded-full">{product.category}</span>
          {out && <span className="absolute inset-0 grid place-items-center bg-black/40 text-white font-heading font-bold">Out of stock</span>}
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1"><Leaf size={12} className="text-primary" />{product.seller_name}</div>
        <Link to={`/product/${product.id}`}><h3 className="font-heading font-bold text-base leading-tight line-clamp-1">{product.name}</h3></Link>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1"><MapPin size={12} />{product.location}</div>
        <div className="flex items-end justify-between mt-3">
          <div>
            <span className="font-heading font-extrabold text-lg text-primary">{peso(product.price)}</span>
            <span className="text-xs text-muted-foreground">/{product.unit}</span>
          </div>
          <button data-testid={`add-to-cart-${product.id}`} disabled={out}
            onClick={() => add(product)}
            className="grid place-items-center h-9 w-9 rounded-full bg-accent text-accent-foreground hover:scale-110 active:scale-95 transition-transform disabled:opacity-40 disabled:hover:scale-100">
            <Plus size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
