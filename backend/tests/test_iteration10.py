"""Iteration 10 backend tests — same-town shipping discount, stock PATCH, assign-rider email, rider earnings, product reviews."""
import os, uuid, pytest, requests

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"

SELLER = {"email": "mang.kanor@laguna.ph", "password": "farmer123"}
BUYER = {"email": "aling.nena@laguna.ph", "password": "buyer123"}


def _sess(creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s, r.json()


@pytest.fixture(scope="session")
def seller():
    return _sess(SELLER)


@pytest.fixture(scope="session")
def buyer():
    return _sess(BUYER)


@pytest.fixture(scope="session")
def kanor_product(seller):
    s, _ = seller
    me = s.get(f"{API}/auth/me", timeout=15).json()
    prods = requests.get(f"{API}/products", params={"seller_id": me["id"]}, timeout=15).json()
    # pick a Calamba product for same-town test
    for p in prods:
        if "calamba" in (p.get("location") or "").lower() and p.get("stock", 0) > 3:
            return p
    # fallback: any well-stocked product
    for p in prods:
        if p.get("stock", 0) > 3:
            return p
    pytest.skip("No suitable Kanor product")


# ---------- (1) Shipping quote same-town vs far ----------
class TestShippingQuote:
    def test_same_town_local_rate(self, kanor_product):
        town = kanor_product["location"].split(",")[0].strip()
        r = requests.post(f"{API}/shipping-quote", json={
            "product_id": kanor_product["id"],
            "delivery_address": f"Brgy Test, {town}, Laguna",
            "fulfillment_type": "delivery"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["local_rate"] is True, f"expected local_rate True for {town}, got {d}"
        assert d["shipping_fee"] == 30.0, f"expected ₱30 local, got {d['shipping_fee']}"

    def test_far_town_distance_rate(self, kanor_product):
        # Paete is far from most of Kanor's products; if the product is already in Paete pick Nagcarlan.
        far = "Paete"
        if "paete" in (kanor_product.get("location") or "").lower():
            far = "Nagcarlan"
        r = requests.post(f"{API}/shipping-quote", json={
            "product_id": kanor_product["id"],
            "delivery_address": f"Brgy Test, {far}, Laguna",
            "fulfillment_type": "delivery"
        }, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["local_rate"] is False
        assert d["shipping_fee"] > 30.0

    def test_pickup_no_shipping(self, kanor_product):
        r = requests.post(f"{API}/shipping-quote", json={
            "product_id": kanor_product["id"], "delivery_address": "", "fulfillment_type": "pickup"
        }, timeout=15).json()
        assert r["shipping_fee"] == 0.0

    def test_checkout_applies_local_rate(self, buyer, kanor_product):
        s, _ = buyer
        p = kanor_product
        town = p["location"].split(",")[0].strip()
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"]}],
            "delivery_address": f"Brgy TEST, {town}, Laguna",
            "contact_phone": "0917-000-1010",
            "payment_method": "cod", "fulfillment_type": "delivery",
            "origin_url": BASE,
        }
        r = s.post(f"{API}/checkout", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        oid = r.json()["order_id"]
        o = s.get(f"{API}/orders/{oid}", timeout=15).json()
        assert o["shipping_fee"] == 30.0, f"expected same-town ₱30 in order, got {o.get('shipping_fee')}"
        pytest.local_rate_order_id = oid


# ---------- (2) Seller can PATCH stock ----------
class TestStockPatch:
    def test_seller_can_edit_own_stock(self, seller, kanor_product):
        s, _ = seller
        pid = kanor_product["id"]
        before = requests.get(f"{API}/products/{pid}", timeout=10).json()["stock"]
        new_val = before + 7
        r = s.patch(f"{API}/products/{pid}/stock", json={"stock": new_val}, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["stock"] == new_val
        after = requests.get(f"{API}/products/{pid}", timeout=10).json()["stock"]
        assert after == new_val
        # restore
        s.patch(f"{API}/products/{pid}/stock", json={"stock": before}, timeout=10)

    def test_stock_negative_rejected(self, seller, kanor_product):
        s, _ = seller
        r = s.patch(f"{API}/products/{kanor_product['id']}/stock", json={"stock": -1}, timeout=10)
        assert r.status_code == 422

    def test_buyer_cannot_edit_stock(self, buyer, kanor_product):
        s, _ = buyer
        r = s.patch(f"{API}/products/{kanor_product['id']}/stock", json={"stock": 5}, timeout=10)
        assert r.status_code in (401, 403)


# ---------- (3) Buyer can POST review on delivered product ----------
class TestReviewFromOrder:
    def test_review_delivered_product(self, seller, buyer, kanor_product):
        sels, _ = seller
        s, _ = buyer
        p = kanor_product
        # create a delivery COD order, advance to delivered
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"]}],
            "delivery_address": "TEST_review addr, Laguna",
            "contact_phone": "0917-333-4444",
            "payment_method": "cod", "fulfillment_type": "delivery",
            "origin_url": BASE,
        }
        oid = s.post(f"{API}/checkout", json=payload, timeout=20).json()["order_id"]
        for st in ["confirmed", "packed", "out_for_delivery", "delivered"]:
            r = sels.put(f"{API}/orders/{oid}/status", json={"status": st}, timeout=15)
            assert r.status_code == 200, f"{st}: {r.text}"

        # POST review
        r = s.post(f"{API}/products/{p['id']}/reviews",
                   json={"rating": 5, "comment": "TEST_iter10 fresh & delicious"}, timeout=15)
        assert r.status_code == 200, r.text

        # GET reviews list contains it
        revs = requests.get(f"{API}/products/{p['id']}/reviews", timeout=10).json()
        assert any("TEST_iter10" in (rv.get("comment") or "") for rv in revs), "review not persisted"


# ---------- (4) Assign rider with email + (5) rider earnings tally ----------
class TestAssignRiderEmail:
    def test_assign_saved_rider_returns_200(self, seller, buyer, kanor_product):
        sels, _ = seller
        s, _ = buyer
        p = kanor_product
        # new delivery order
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"]}],
            "delivery_address": "TEST_assign_rider, Los Banos, Laguna",
            "contact_phone": "0917-555-6666",
            "payment_method": "cod", "fulfillment_type": "delivery",
            "origin_url": BASE,
        }
        oid = s.post(f"{API}/checkout", json=payload, timeout=20).json()["order_id"]
        for st in ["confirmed", "packed"]:
            sels.put(f"{API}/orders/{oid}/status", json={"status": st}, timeout=15)

        # find a rider that has rider_user_id (saved rider account with email)
        riders = requests.get(f"{API}/riders", timeout=10).json()
        rid = None
        for rd in riders:
            if rd.get("rider_user_id"):
                rid = rd["id"]; break
        assert rid, "No saved rider with rider_user_id"

        r = sels.put(f"{API}/orders/{oid}/assign-rider", json={"rider_id": rid}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "rider_assigned"
        assert r.json()["rider"]["id"] == rid


class TestRiderEarnings:
    def test_earnings_shape(self):
        # login as Pedro
        s = requests.Session()
        lr = s.post(f"{API}/auth/login", json={"email": "rider.pedro@laguna.ph", "password": "rider123"}, timeout=15)
        assert lr.status_code == 200, lr.text
        s.headers.update({"Authorization": f"Bearer {lr.json()['token']}"})
        r = s.get(f"{API}/rider/earnings", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("completed", "active", "fees_earned", "assigned"):
            assert k in d, f"missing {k}"
        assert isinstance(d["fees_earned"], (int, float))
        assert d["fees_earned"] >= 0
