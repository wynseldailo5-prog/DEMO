import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { ShoppingCart, Sprout, LayoutDashboard, Package, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const link = (to, label) => (
    <Link to={to} data-testid={`nav-${label.toLowerCase()}`}
      className={`text-sm font-medium transition-colors hover:text-primary ${pathname === to ? "text-primary" : "text-foreground/70"}`}>
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
          <span className="grid place-items-center h-9 w-9 rounded-full bg-primary text-primary-foreground">
            <Sprout size={18} />
          </span>
          <span className="font-heading font-extrabold text-lg tracking-tight">FarmDirect <span className="text-accent">Laguna</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {link("/market", "Market")}
          {user && link("/orders", "Orders")}
          {user && (user.role === "seller" || user.role === "admin") && link("/seller", "Sell")}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/cart" data-testid="nav-cart" className="relative p-2 rounded-full hover:bg-secondary transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span data-testid="cart-count" className="absolute -top-0.5 -right-0.5 h-5 w-5 grid place-items-center text-[10px] font-bold rounded-full bg-accent text-accent-foreground">{count}</span>
            )}
          </Link>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1.5 text-sm font-medium"><User size={15} />{user.name?.split(" ")[0]}</span>
              <Button data-testid="logout-btn" variant="ghost" size="icon" onClick={() => { logout(); navigate("/"); }}>
                <LogOut size={18} />
              </Button>
            </div>
          ) : (
            <Button data-testid="nav-login-btn" onClick={() => navigate("/login")} className="rounded-full bg-primary hover:bg-primary/90">Sign in</Button>
          )}
        </div>
      </div>
    </header>
  );
}
