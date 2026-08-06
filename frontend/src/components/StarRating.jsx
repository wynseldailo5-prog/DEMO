import { Star } from "lucide-react";

export default function StarRating({ value = 0, count, size = 14, showEmpty = true, onRate }) {
  const rounded = Math.round(value);
  return (
    <div className="flex items-center gap-1" data-testid="star-rating">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" disabled={!onRate} onClick={() => onRate && onRate(n)}
            className={onRate ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}>
            <Star size={size} className={n <= rounded ? "fill-accent text-accent" : "fill-transparent text-muted-foreground/40"} />
          </button>
        ))}
      </div>
      {value > 0 && <span className="text-xs font-medium text-foreground">{Number(value).toFixed(1)}</span>}
      {count != null && count > 0 && <span className="text-xs text-muted-foreground">({count})</span>}
      {showEmpty && (!count || count === 0) && !onRate && <span className="text-xs text-muted-foreground">No reviews</span>}
    </div>
  );
}
