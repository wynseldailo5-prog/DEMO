"""Backend API tests for FarmDirect Laguna — Iteration 2.
Covers pickup fulfillment, seller-confirm flow, order cancellation + stock restore,
and regressions from iteration 1."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

SELLER = {"email": "mang.kanor@laguna.ph", "password": "farmer123"}
BUYER = {"email": "aling.nena@laguna.ph", "password": "buyer123"}
ADMIN = {"email": "wynseldailo5@gmail.com", "password": "AdminLaguna123"}


def _token(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def seller_token():
    return _token(SELLER)


@pytest.fixture(scope="session")
def buyer_token():
    return _token(BUYER)


@pytest.fixture(scope="session")
def admin_token():
    return _token(ADMIN)


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def sample_product(seller_token):
    """Return a product owned by our seller so seller can update its orders."""
    r = requests.get(f"{API}/auth/me", headers=H(seller_token), timeout=15)
    seller_id = r.json()["id"]
    r = requests.get(f"{API}/products", params={"seller_id": seller_id}, timeout=20)
    prods = r.json()
    if prods and prods[0].get("stock", 0) > 5:
        return prods[0]
    # create one so we have plenty of stock
    payload = {"name": f"TEST_Iter2_{uuid.uuid4().hex[:6]}", "description": "iter2",
               "category": "Vegetables", "price": 25.0, "unit": "kg", "stock": 100,
               "location": "Los Baños, Laguna"}
    r = requests.post(f"{API}/products", json=payload, headers=H(seller_token), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Health ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Auth regression ----------
class TestAuth:
    def test_login_all(self, seller_token, buyer_token, admin_token):
        for t in (seller_token, buyer_token, admin_token):
            assert isinstance(t, str) and len(t) > 20

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "no@x.com", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- Products regression ----------
class TestProducts:
    def test_list_products(self):
        r = requests.get(f"{API}/products", timeout=20)
        assert r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1

    def test_buyer_cannot_create_product(self, buyer_token):
        r = requests.post(f"{API}/products",
                          json={"name": "TEST bad", "category": "Vegetables", "price": 10, "unit": "kg", "stock": 5},
                          headers=H(buyer_token), timeout=15)
        assert r.status_code == 403


# ---------- Riders (should have lat/lng now) ----------
class TestRiders:
    def test_riders_have_lat_lng(self):
        r = requests.get(f"{API}/riders", timeout=15)
        assert r.status_code == 200
        riders = r.json()
        assert len(riders) >= 1
        for rd in riders:
            assert rd.get("lat") is not None, f"rider {rd.get('name')} missing lat"
            assert rd.get("lng") is not None, f"rider {rd.get('name')} missing lng"


# ---------- Iteration 2: Pickup + COD checkout ----------
class TestPickupCheckout:
    def test_pickup_cod_checkout(self, buyer_token, sample_product):
        p = sample_product
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"], "image_url": p.get("image_url")}],
            "delivery_address": "",
            "contact_phone": "0917-000-1111",
            "payment_method": "cod",
            "fulfillment_type": "pickup",
            "pickup_location": p.get("location", "Los Baños, Laguna"),
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["payment_method"] == "cod"
        oid = d["order_id"]

        r2 = requests.get(f"{API}/orders/{oid}", headers=H(buyer_token), timeout=15)
        assert r2.status_code == 200
        o = r2.json()
        assert o["status"] == "pending", f"expected pending, got {o['status']}"
        assert o["payment_status"] == "cod_pending"
        assert o["fulfillment_type"] == "pickup"
        assert o["pickup_location"] is not None
        pytest.pickup_order_id = oid


# ---------- Iteration 2: Delivery COD + seller-advance flow ----------
class TestDeliverySellerAdvance:
    def test_delivery_cod_starts_pending(self, buyer_token, sample_product):
        p = sample_product
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 2, "seller_id": p["seller_id"]}],
            "delivery_address": "TEST Address, Los Baños",
            "delivery_lat": 14.1699, "delivery_lng": 121.2415,
            "contact_phone": "0917-000-0000",
            "payment_method": "cod",
            "fulfillment_type": "delivery",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        o = requests.get(f"{API}/orders/{oid}", headers=H(buyer_token), timeout=15).json()
        assert o["status"] == "pending"
        assert o["fulfillment_type"] == "delivery"
        assert o["delivery_lat"] == 14.1699
        pytest.delivery_order_id = oid

    def test_seller_advances_pending_to_delivered(self, seller_token):
        oid = pytest.delivery_order_id
        for status in ["confirmed", "packed", "out_for_delivery", "delivered"]:
            r = requests.put(f"{API}/orders/{oid}/status", json={"status": status},
                             headers=H(seller_token), timeout=15)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == status

    def test_assign_rider_delivery(self, seller_token, buyer_token, sample_product):
        p = sample_product
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"]}],
            "delivery_address": "TEST rider addr", "contact_phone": "0917-111-2222",
            "payment_method": "cod", "fulfillment_type": "delivery",
            "origin_url": BASE_URL,
        }
        c = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=20)
        assert c.status_code == 200
        oid = c.json()["order_id"]
        # advance pending -> confirmed -> packed
        for status in ["confirmed", "packed"]:
            r = requests.put(f"{API}/orders/{oid}/status", json={"status": status},
                             headers=H(seller_token), timeout=15)
            assert r.status_code == 200

        riders = requests.get(f"{API}/riders", timeout=10).json()
        rid = riders[0]["id"]
        r = requests.put(f"{API}/orders/{oid}/assign-rider", json={"rider_id": rid},
                         headers=H(seller_token), timeout=15)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["status"] == "rider_assigned"
        assert o["rider"]["id"] == rid
        assert o["rider"].get("lat") is not None


# ---------- Iteration 2: Pickup seller-advance flow ----------
class TestPickupSellerAdvance:
    def test_seller_advances_pickup(self, seller_token):
        oid = getattr(pytest, "pickup_order_id", None)
        assert oid, "pickup order fixture not set"
        for status in ["confirmed", "ready_for_pickup", "picked_up"]:
            r = requests.put(f"{API}/orders/{oid}/status", json={"status": status},
                             headers=H(seller_token), timeout=15)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == status


# ---------- Iteration 2: Order cancellation ----------
class TestOrderCancellation:
    def _create_cod_delivery(self, buyer_token, product, qty=3):
        payload = {
            "items": [{"product_id": product["id"], "name": product["name"], "price": product["price"],
                       "quantity": qty, "seller_id": product["seller_id"]}],
            "delivery_address": "TEST cancel addr", "contact_phone": "0917-999-8888",
            "payment_method": "cod", "fulfillment_type": "delivery",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=20)
        assert r.status_code == 200
        return r.json()["order_id"]

    def _stock(self, pid):
        r = requests.get(f"{API}/products/{pid}", timeout=10)
        assert r.status_code == 200
        return r.json()["stock"]

    def test_buyer_cancel_restores_stock(self, buyer_token, sample_product):
        p = sample_product
        stock_before = self._stock(p["id"])
        oid = self._create_cod_delivery(buyer_token, p, qty=3)
        # stock decremented
        assert self._stock(p["id"]) == stock_before - 3
        # cancel
        r = requests.put(f"{API}/orders/{oid}/cancel", headers=H(buyer_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "cancelled"
        # stock restored
        assert self._stock(p["id"]) == stock_before

    def test_seller_cancel_restores_stock(self, buyer_token, seller_token, sample_product):
        p = sample_product
        stock_before = self._stock(p["id"])
        oid = self._create_cod_delivery(buyer_token, p, qty=2)
        assert self._stock(p["id"]) == stock_before - 2
        r = requests.put(f"{API}/orders/{oid}/cancel", headers=H(seller_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "cancelled"
        assert self._stock(p["id"]) == stock_before

    def test_cannot_cancel_delivered(self, buyer_token, seller_token, sample_product):
        p = sample_product
        oid = self._create_cod_delivery(buyer_token, p, qty=1)
        # seller drives it to delivered
        for status in ["confirmed", "packed", "out_for_delivery", "delivered"]:
            r = requests.put(f"{API}/orders/{oid}/status", json={"status": status},
                             headers=H(seller_token), timeout=15)
            assert r.status_code == 200
        r = requests.put(f"{API}/orders/{oid}/cancel", headers=H(buyer_token), timeout=15)
        assert r.status_code == 400

    def test_cancel_only_once(self, buyer_token, sample_product):
        p = sample_product
        oid = self._create_cod_delivery(buyer_token, p, qty=1)
        r1 = requests.put(f"{API}/orders/{oid}/cancel", headers=H(buyer_token), timeout=15)
        assert r1.status_code == 200
        r2 = requests.put(f"{API}/orders/{oid}/cancel", headers=H(buyer_token), timeout=15)
        assert r2.status_code == 400  # already cancelled

    def test_stranger_buyer_cannot_cancel(self, sample_product, buyer_token):
        # Create a second buyer and try to cancel someone else's order
        uid = uuid.uuid4().hex[:8]
        email = f"TEST_stranger_{uid}@laguna.ph"
        rr = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "test1234", "name": "TEST Stranger", "role": "buyer"
        }, timeout=20)
        assert rr.status_code == 200
        stranger = rr.json()["token"]

        # buyer1 creates order
        p = sample_product
        payload = {"items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                              "quantity": 1, "seller_id": p["seller_id"]}],
                   "delivery_address": "x", "contact_phone": "0917", "payment_method": "cod",
                   "fulfillment_type": "delivery", "origin_url": BASE_URL}
        oid = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=20).json()["order_id"]

        r = requests.put(f"{API}/orders/{oid}/cancel", headers=H(stranger), timeout=15)
        assert r.status_code == 403


# ---------- Regression: online checkout still returns Stripe URL ----------
class TestOnlineCheckoutRegression:
    def test_online_checkout(self, buyer_token, sample_product):
        p = sample_product
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"]}],
            "delivery_address": "TEST online addr",
            "contact_phone": "0917-000-0000",
            "payment_method": "online",
            "fulfillment_type": "delivery",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("checkout_url", "").startswith("http")
        assert "session_id" in d and "order_id" in d
        # order should be pending + payment pending
        o = requests.get(f"{API}/orders/{d['order_id']}", headers=H(buyer_token), timeout=15).json()
        assert o["status"] == "pending"
        assert o["payment_status"] == "pending"
