import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar";
import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Marketplace from "@/pages/Marketplace";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import PaymentResult from "@/pages/PaymentResult";
import Orders from "@/pages/Orders";
import SellerDashboard from "@/pages/SellerDashboard";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Navbar />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Auth mode="login" />} />
              <Route path="/register" element={<Auth mode="register" />} />
              <Route path="/market" element={<Marketplace />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/payment/success" element={<PaymentResult />} />
              <Route path="/payment/cancel" element={<PaymentResult cancel />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/seller" element={<SellerDashboard />} />
            </Routes>
            <Toaster position="top-right" richColors />
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
