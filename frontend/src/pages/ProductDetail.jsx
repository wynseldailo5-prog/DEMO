import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { fileUrl, peso, formatApiErrorDetail } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import StarRating from "@/components/StarRating";
import { MapPin, Leaf, Minus, Plus, ArrowLeft, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";

const FALLBACK = "https://images.pexels.com/photos/10697692/pexels-photo-10697692.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { add } = useCart();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const loadProduct = () => api.get(`/products/${id}`).then((r) => setProduct(r.data)).catch(() => navigate("/market"));
  const loadReviews = () => api.get(`/products/${id}/reviews`).then((r) => setReviews(r.data));

  useEffect(() => { loadProduct(); loadReviews(); /* eslint-disable-next-line */ }, [id]);

  if (!product) return <div className="max-w-5xl mx-auto px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  const out = product.stock <= 0;

  const submitReview = async () => {
    if (!myRating) { toast.error("Please pick a star rating"); return; }
    setPosting(true);
    try {
      await api.post(`/products/${id}/reviews`, { rating: myRating, comment });
      toast.success("Thanks for your review!");
      setComment(""); setMyRating(0);
      loadProduct(); loadReviews();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Could not post review");
    } finally { setPosting(false); }
  };

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
          <div className="mt-2"><StarRating value={product.rating_avg || 0} count={product.rating_count || 0} size={16} /></div>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Leaf size={15} className="text-primary" />{product.seller_name}</span>
            <span className="flex items-center gap-1.5"><MapPin size={15} />{product.location}</span>
            {product.seller_review_count > 0 && (
              <span className="flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-full"><Star size={12} className="fill-accent text-accent" /> Seller {Number(product.seller_rating).toFixed(1)} ({product.seller_review_count})</span>
            )}
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

      {/* Reviews */}
      <div className="mt-12">
        <h2 className="font-heading font-black text-2xl tracking-tight">Ratings & Reviews</h2>

        {user && user.role === "buyer" && (
          <div className="mt-4 bg-card border border-border rounded-2xl p-6">
            <div className="font-heading font-bold">Leave a review</div>
            <p className="text-xs text-muted-foreground mb-3">You can review products you've ordered.</p>
            <StarRating value={myRating} onRate={setMyRating} size={26} showEmpty={false} />
            <Textarea data-testid="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} className="mt-3" placeholder="How was the produce? (optional)" />
            <Button data-testid="submit-review-btn" onClick={submitReview} disabled={posting} className="mt-3 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground">{posting ? "Posting…" : "Post review"}</Button>
          </div>
        )}

        <div className="mt-4 space-y-3" data-testid="reviews-list">
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6">No reviews yet — be the first to rate this produce.</p>
          ) : reviews.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">{r.buyer_name}</div>
                <StarRating value={r.rating} showEmpty={false} />
              </div>
              {r.comment && <p className="text-sm text-muted-foreground mt-1.5">{r.comment}</p>}
              <div className="text-[11px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
