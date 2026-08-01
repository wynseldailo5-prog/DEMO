import { useEffect, useState } from "react";
import api from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";

const CATEGORIES = ["All", "Vegetables", "Fruits", "Rice & Grains", "Herbs", "Root Crops", "Dairy & Eggs"];

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/products", { params: { category, search: search || undefined } });
      setProducts(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [category]);
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl tracking-tight">The Market</h1>
          <p className="text-sm text-muted-foreground mt-1">Fresh from farms across Laguna province.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search produce…" className="pl-10 rounded-full" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar mt-6 pb-1">
        {CATEGORIES.map((c) => (
          <button key={c} data-testid={`category-${c}`} onClick={() => setCategory(c)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-8">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[4/5] rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <SlidersHorizontal className="mx-auto mb-3 opacity-50" />
          <p>No products found. Check back soon!</p>
        </div>
      ) : (
        <div data-testid="products-grid" className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-8">
          {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}
    </div>
  );
}
