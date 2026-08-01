import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sprout, Truck, ShieldCheck, MapPin } from "lucide-react";

const HERO = "https://images.unsplash.com/photo-1545830790-68595959c491?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1ODB8MHwxfHNlYXJjaHwyfHxmYXJtZXIlMjBob2xkaW5nJTIwcHJvZHVjZSUyMHBvcnRyYWl0fGVufDB8fHx8MTc4NTU1NDMwOHww&ixlib=rb-4.1.0&q=85";
const MARKET = "https://images.unsplash.com/photo-1779893457658-ef97d16743d8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHw0fHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBtYXJrZXQlMjBzdGFsbHxlbnwwfHx8fDE3ODU1NTQzMDd8MA&ixlib=rb-4.1.0&q=85";
const RIDER = "https://images.unsplash.com/photo-1695654390723-479197a8c4a3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1Mjh8MHwxfHNlYXJjaHwyfHxkZWxpdmVyeSUyMHNjb290ZXIlMjBjYXJnb3xlbnwwfHx8fDE3ODU1NTQzMDh8MA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden grain">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-8 items-center py-14 lg:py-24">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary bg-secondary px-3 py-1.5 rounded-full"><MapPin size={13} /> Farm-fresh, from Laguna</span>
            <h1 className="mt-5 font-heading font-black text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
              Buy straight from <span className="text-primary">Laguna's</span> <span className="text-accent">farmers.</span>
            </h1>
            <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-md">
              A local marketplace connecting farmers and buyers across Laguna. Fresh harvests, fair prices, online payment or cash on delivery — tracked to your door.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button data-testid="hero-shop-btn" onClick={() => navigate("/market")} className="group inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 font-semibold hover:bg-primary/90 transition-colors">
                Shop the market <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button data-testid="hero-sell-btn" onClick={() => navigate("/register")} className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 font-semibold hover:bg-secondary transition-colors">
                <Sprout size={18} /> Sell your harvest
              </button>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.15 }} className="lg:col-span-6 grid grid-cols-2 gap-4">
            <img src={HERO} alt="Laguna farmer" className="col-span-2 h-64 lg:h-80 w-full object-cover rounded-3xl" />
            <img src={MARKET} alt="Fresh market" className="h-40 w-full object-cover rounded-2xl" />
            <img src={RIDER} alt="Delivery rider" className="h-40 w-full object-cover rounded-2xl" />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-3 gap-4">
        {[
          { icon: Sprout, t: "Direct from farms", d: "Skip the middleman. Farmers post their goods, you buy fresh." },
          { icon: ShieldCheck, t: "Secure payment", d: "Pay online securely with card, or choose cash on delivery." },
          { icon: Truck, t: "Tracked delivery", d: "Riders assigned per order, tracked from harvest to your home." },
        ].map((f, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
            className="bg-card border border-border rounded-2xl p-6">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-secondary text-primary"><f.icon size={20} /></span>
            <h3 className="mt-4 font-heading font-bold text-lg">{f.t}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.d}</p>
          </motion.div>
        ))}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-8 sm:p-12">
          <h2 className="font-heading font-black text-2xl sm:text-4xl max-w-lg leading-tight">Ready to taste the harvest?</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-md">Join buyers and farmers across Calamba, Los Baños, Santa Cruz and San Pablo.</p>
          <button data-testid="cta-browse-btn" onClick={() => navigate("/market")} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent text-accent-foreground px-6 py-3 font-semibold hover:scale-105 transition-transform">
            Browse products <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
