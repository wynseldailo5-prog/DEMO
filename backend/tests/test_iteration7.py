"""Iteration 7 backend tests: shipping quote, checkout shipping fields, custom rider."""
import os, requests, pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback for pytest execution env — read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

BUYER = {"email": "aling.nena@laguna.ph", "password": "buyer123"}
SELLER = {"email": "mang.kanor@laguna.ph", "password": "farmer123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return d.get("token") or d.get("access_token")


@pytest.fixture(scope="module")
def buyer_token():
    return _login(BUYER)


@pytest.fixture(scope="module")
def seller_token():
    return _login(SELLER)


@pytest.fixture(scope="module")
def in_stock_product():
    r = requests.get(f"{BASE_URL}/api/products", timeout=15)
    r.raise_for_status()
    for p in r.json():
        if p.get("stock", 0) > 0:
            return p
    pytest.skip("No in-stock product available")


# ---- Shipping quote ----
class TestShippingQuote:
    def test_pickup_is_free(self, in_stock_product):
        r = requests.post(f"{BASE_URL}/api/shipping-quote", json={
            "fulfillment_type": "pickup", "product_id": in_stock_product["id"],
            "delivery_address": "Santa Cruz, Laguna"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["shipping_fee"] == 0.0
        assert data["distance_km"] == 0

    def test_delivery_returns_positive_fee(self, in_stock_product):
        r = requests.post(f"{BASE_URL}/api/shipping-quote", json={
            "fulfillment_type": "delivery", "product_id": in_stock_product["id"],
            "delivery_address": "Santa Cruz, Laguna"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["shipping_fee"] > 0
        assert data["distance_km"] >= 0
        # rate: base 49 + tiered — should be at least base fee
        assert data["shipping_fee"] >= 49

    def test_delivery_by_coords(self, in_stock_product):
        r = requests.post(f"{BASE_URL}/api/shipping-quote", json={
            "fulfillment_type": "delivery", "product_id": in_stock_product["id"],
            "delivery_lat": 14.28, "delivery_lng": 121.42,
            "delivery_address": ""
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["shipping_fee"] >= 49


# ---- Checkout persists subtotal/shipping/total ----
class TestCheckoutShipping:
    def _place(self, buyer_token, product, fulfillment):
        payload = {
            "items": [{"product_id": product["id"], "name": product["name"],
                       "price": product["price"], "quantity": 1,
                       "seller_id": product["seller_id"], "image_url": product.get("image_url")}],
            "delivery_address": "Santa Cruz, Laguna" if fulfillment == "delivery" else "",
            "delivery_lat": None, "delivery_lng": None,
            "fulfillment_type": fulfillment,
            "pickup_location": product.get("location") if fulfillment == "pickup" else None,
            "contact_phone": "0917-000-0000",
            "payment_method": "cod",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{BASE_URL}/api/checkout", json=payload,
                          headers={"Authorization": f"Bearer {buyer_token}"}, timeout=20)
        assert r.status_code == 200, r.text
        return r.json()

    def test_delivery_order_has_shipping(self, buyer_token, in_stock_product):
        resp = self._place(buyer_token, in_stock_product, "delivery")
        order_id = resp["order_id"]
        # fetch orders
        r = requests.get(f"{BASE_URL}/api/orders",
                         headers={"Authorization": f"Bearer {buyer_token}"}, timeout=15)
        assert r.status_code == 200
        order = next((o for o in r.json() if o["id"] == order_id), None)
        assert order, "Order not found"
        assert "subtotal" in order
        assert "shipping_fee" in order
        assert "total" in order
        assert order["shipping_fee"] > 0
        assert round(order["subtotal"] + order["shipping_fee"], 2) == round(order["total"], 2)

    def test_pickup_order_no_shipping(self, buyer_token, in_stock_product):
        resp = self._place(buyer_token, in_stock_product, "pickup")
        order_id = resp["order_id"]
        r = requests.get(f"{BASE_URL}/api/orders",
                         headers={"Authorization": f"Bearer {buyer_token}"}, timeout=15)
        order = next((o for o in r.json() if o["id"] == order_id), None)
        assert order
        assert order.get("shipping_fee", 0) == 0
        assert round(order["subtotal"], 2) == round(order["total"], 2)


# ---- Custom rider ----
class TestCustomRider:
    def test_assign_custom_rider(self, buyer_token, seller_token, in_stock_product):
        # place delivery order as buyer
        payload = {
            "items": [{"product_id": in_stock_product["id"], "name": in_stock_product["name"],
                       "price": in_stock_product["price"], "quantity": 1,
                       "seller_id": in_stock_product["seller_id"], "image_url": in_stock_product.get("image_url")}],
            "delivery_address": "Santa Cruz, Laguna",
            "fulfillment_type": "delivery",
            "contact_phone": "0917-000-0000",
            "payment_method": "cod",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{BASE_URL}/api/checkout", json=payload,
                          headers={"Authorization": f"Bearer {buyer_token}"}, timeout=20)
        assert r.status_code == 200
        order_id = r.json()["order_id"]

        # advance to confirmed
        requests.put(f"{BASE_URL}/api/orders/{order_id}/status", json={"status": "confirmed"},
                     headers={"Authorization": f"Bearer {seller_token}"}, timeout=15)

        # assign custom rider
        r = requests.put(f"{BASE_URL}/api/orders/{order_id}/assign-custom-rider",
                         json={"name": "TEST_Kuya Ramon", "phone": "0917-111-2222", "vehicle": "Motorcycle"},
                         headers={"Authorization": f"Bearer {seller_token}"}, timeout=15)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "rider_assigned"
        assert order["rider"]["name"] == "TEST_Kuya Ramon"
        assert order["rider"]["vehicle"] == "Motorcycle"
        assert order["rider"]["custom"] is True
        # history has a note
        notes = [h for h in order.get("history", []) if h.get("status") == "rider_assigned"]
        assert notes, "No rider_assigned history entry"
        assert any("TEST_Kuya Ramon" in (h.get("note") or "") for h in notes)

    def test_custom_rider_not_saved_to_riders(self, seller_token):
        r = requests.get(f"{BASE_URL}/api/riders",
                         headers={"Authorization": f"Bearer {seller_token}"}, timeout=15)
        assert r.status_code == 200
        assert not any(rr["name"] == "TEST_Kuya Ramon" for rr in r.json())
