import { Check, Package, ShoppingBag, Bike, Truck, Home, Store, PackageCheck } from "lucide-react";

const DELIVERY_STAGES = [
  { key: "confirmed", label: "Confirmed", icon: ShoppingBag },
  { key: "packed", label: "Packed", icon: Package },
  { key: "rider_assigned", label: "Rider Assigned", icon: Bike },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Home },
];
const PICKUP_STAGES = [
  { key: "confirmed", label: "Confirmed", icon: ShoppingBag },
  { key: "ready_for_pickup", label: "Ready for Pickup", icon: Store },
  { key: "picked_up", label: "Picked Up", icon: PackageCheck },
];

const DELIVERY_ORDER = ["pending", "confirmed", "packed", "rider_assigned", "out_for_delivery", "delivered"];
const PICKUP_ORDER = ["pending", "confirmed", "ready_for_pickup", "picked_up"];

export default function OrderTracker({ status, fulfillment_type = "delivery" }) {
  if (status === "cancelled") {
    return <div className="text-sm font-medium text-destructive" data-testid="order-tracker">This order was cancelled.</div>;
  }
  const isPickup = fulfillment_type === "pickup";
  const stages = isPickup ? PICKUP_STAGES : DELIVERY_STAGES;
  const order = isPickup ? PICKUP_ORDER : DELIVERY_ORDER;
  const current = order.indexOf(status);
  return (
    <div className="flex items-center justify-between" data-testid="order-tracker">
      {stages.map((s, i) => {
        const stageIdx = order.indexOf(s.key);
        const done = current >= stageIdx;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex-1 flex flex-col items-center relative">
            {i > 0 && <div className={`absolute top-4 right-1/2 w-full h-0.5 ${done ? "bg-primary" : "bg-border"}`} />}
            <div className={`relative z-10 grid place-items-center h-8 w-8 rounded-full border-2 ${done ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground"}`}>
              {done && current > stageIdx ? <Check size={14} /> : <Icon size={14} />}
            </div>
            <span className={`mt-1.5 text-[10px] sm:text-xs text-center leading-tight ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}
