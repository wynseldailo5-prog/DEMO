import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sprout, ShoppingBasket, Bike } from "lucide-react";
import { toast } from "sonner";

export default function Auth({ mode }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("buyer");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "", address: "", farm_name: "", vehicle: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (isLogin) {
        const u = await login(form.email, form.password);
        toast.success(`Welcome back, ${u.name}!`);
        navigate(u.role === "seller" ? "/seller" : u.role === "rider" ? "/rider" : "/market");
      } else {
        const u = await register({ ...form, role });
        toast.success("Account created!");
        navigate(role === "seller" ? "/seller" : role === "rider" ? "/rider" : "/market");
      }
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-card border border-border rounded-3xl p-8">
        <h1 className="font-heading font-black text-3xl tracking-tight">{isLogin ? "Welcome back" : "Create account"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{isLogin ? "Sign in to shop or manage your farm." : "Join FarmDirect Laguna today."}</p>

        {!isLogin && (
          <div className="grid grid-cols-3 gap-2 mt-6">
            {[{ v: "buyer", i: ShoppingBasket, l: "Buyer" }, { v: "seller", i: Sprout, l: "Farmer" }, { v: "rider", i: Bike, l: "Rider" }].map((r) => (
              <button key={r.v} type="button" data-testid={`role-${r.v}`} onClick={() => setRole(r.v)}
                className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-colors ${role === r.v ? "border-primary bg-secondary" : "border-border hover:border-primary/40"}`}>
                <r.i size={22} className={role === r.v ? "text-primary" : "text-muted-foreground"} />
                <span className="text-sm font-medium">{r.l}</span>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {!isLogin && (
            <div><Label>Full name</Label><Input data-testid="name-input" required value={form.name} onChange={set("name")} className="mt-1.5" placeholder="Juan Dela Cruz" /></div>
          )}
          <div><Label>Email</Label><Input data-testid="email-input" type="email" required value={form.email} onChange={set("email")} className="mt-1.5" placeholder="you@email.com" /></div>
          <div><Label>Password</Label><Input data-testid="password-input" type="password" required value={form.password} onChange={set("password")} className="mt-1.5" placeholder="••••••••" /></div>
          {!isLogin && (
            <>
              <div><Label>Phone</Label><Input data-testid="phone-input" value={form.phone} onChange={set("phone")} className="mt-1.5" placeholder="0917-xxx-xxxx" /></div>
              {role === "seller" && <div><Label>Farm / Stall name</Label><Input data-testid="farm-input" value={form.farm_name} onChange={set("farm_name")} className="mt-1.5" placeholder="Dela Cruz Farm" /></div>}
              {role === "rider" && <div><Label>Vehicle</Label><Input data-testid="vehicle-input" value={form.vehicle} onChange={set("vehicle")} className="mt-1.5" placeholder="Motorcycle / Tricycle" /></div>}
              <div><Label>Address (Laguna)</Label><Input data-testid="address-input" value={form.address} onChange={set("address")} className="mt-1.5" placeholder="Brgy., Municipality" /></div>
            </>
          )}
          {error && <p data-testid="auth-error" className="text-sm text-destructive">{error}</p>}
          <Button data-testid="auth-submit-btn" type="submit" disabled={loading} className="w-full rounded-full bg-primary hover:bg-primary/90 h-11">
            {loading ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground mt-5">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link data-testid="auth-switch-link" to={isLogin ? "/register" : "/login"} className="text-primary font-semibold hover:underline">
            {isLogin ? "Create account" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
