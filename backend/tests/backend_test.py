"""Backend API tests for FarmDirect Laguna."""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://farm-direct-laguna.preview.emergentagent.com').rstrip('/')
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


# ---------- Health / basic ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Auth ----------
class TestAuth:
    def test_login_seller(self, seller_token):
        assert isinstance(seller_token, str) and len(seller_token) > 0

    def test_login_buyer(self, buyer_token):
        assert isinstance(buyer_token, str) and len(buyer_token) > 0

    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 0

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "no@x.com", "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_buyer(self, buyer_token):
        r = requests.get(f"{API}/auth/me", headers=H(buyer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "buyer"
        assert r.json()["email"] == BUYER["email"]

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_register_buyer_and_seller(self):
        uid = uuid.uuid4().hex[:8]
        email = f"TEST_buyer_{uid}@laguna.ph"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "test1234", "name": "TEST Buyer", "role": "buyer"
        }, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "buyer"
        assert d["user"]["email"] == email.lower()
        assert "token" in d

        email2 = f"TEST_seller_{uid}@laguna.ph"
        r2 = requests.post(f"{API}/auth/register", json={
            "email": email2, "password": "test1234", "name": "TEST Seller",
            "role": "seller", "farm_name": "TEST Farm"
        }, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["user"]["role"] == "seller"
        assert r2.json()["user"]["farm_name"] == "TEST Farm"

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": BUYER["email"], "password": "x", "name": "x", "role": "buyer"
        }, timeout=15)
        assert r.status_code == 400


# ---------- Products ----------
class TestProducts:
    def test_list_products(self):
        r = requests.get(f"{API}/products", timeout=20)
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list)
        assert len(products) >= 1

    def test_filter_by_category(self):
        r = requests.get(f"{API}/products", params={"category": "Vegetables"}, timeout=15)
        assert r.status_code == 200
        for p in r.json():
            assert p["category"] == "Vegetables"

    def test_search_products(self):
        r = requests.get(f"{API}/products", params={"search": "tomato"}, timeout=15)
        assert r.status_code == 200
        for p in r.json():
            assert "tomato" in p["name"].lower()

    def test_buyer_cannot_create_product(self, buyer_token):
        r = requests.post(f"{API}/products",
                          json={"name": "TEST bad", "category": "Vegetables", "price": 10, "unit": "kg", "stock": 5},
                          headers=H(buyer_token), timeout=15)
        assert r.status_code == 403

    def test_seller_create_and_verify(self, seller_token):
        payload = {"name": f"TEST_Product_{uuid.uuid4().hex[:6]}", "description": "test",
                   "category": "Vegetables", "price": 42.5, "unit": "kg", "stock": 15,
                   "location": "Los Baños, Laguna"}
        r = requests.post(f"{API}/products", json=payload, headers=H(seller_token), timeout=20)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["name"] == payload["name"]
        assert created["price"] == 42.5
        assert "id" in created
        pid = created["id"]

        # GET single
        r2 = requests.get(f"{API}/products/{pid}", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["name"] == payload["name"]

        # appears in list search
        r3 = requests.get(f"{API}/products", params={"search": payload["name"]}, timeout=15)
        assert r3.status_code == 200
        assert any(p["id"] == pid for p in r3.json())


# ---------- Riders ----------
class TestRiders:
    def test_list_riders(self):
        r = requests.get(f"{API}/riders", timeout=15)
        assert r.status_code == 200
        riders = r.json()
        assert isinstance(riders, list) and len(riders) >= 1
        assert "id" in riders[0] and "name" in riders[0]


# ---------- Checkout / Orders ----------
@pytest.fixture(scope="session")
def sample_product():
    r = requests.get(f"{API}/products", timeout=20)
    assert r.status_code == 200
    products = r.json()
    assert products, "no seeded products"
    return products[0]


class TestCheckoutCOD:
    def test_cod_order_flow(self, buyer_token, sample_product):
        p = sample_product
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 2, "seller_id": p["seller_id"], "image_url": p.get("image_url")}],
            "delivery_address": "TEST Address, Los Baños",
            "contact_phone": "0917-000-0000",
            "payment_method": "cod",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["payment_method"] == "cod"
        oid = d["order_id"]

        # verify order
        r2 = requests.get(f"{API}/orders/{oid}", headers=H(buyer_token), timeout=15)
        assert r2.status_code == 200
        o = r2.json()
        assert o["status"] == "confirmed"
        assert o["payment_status"] == "cod_pending"
        assert o["total"] == round(p["price"] * 2, 2)
        pytest.cod_order_id = oid  # share with next tests

    def test_orders_lists_buyer_order(self, buyer_token):
        r = requests.get(f"{API}/orders", headers=H(buyer_token), timeout=15)
        assert r.status_code == 200
        ids = [o["id"] for o in r.json()]
        assert getattr(pytest, "cod_order_id", None) in ids


class TestCheckoutOnline:
    def test_online_checkout_returns_url(self, buyer_token, sample_product):
        p = sample_product
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"]}],
            "delivery_address": "TEST online addr",
            "contact_phone": "0917-000-0000",
            "payment_method": "online",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=45)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "checkout_url" in d and d["checkout_url"].startswith("http")
        assert "session_id" in d
        assert "order_id" in d
        pytest.online_order_id = d["order_id"]
        pytest.online_session_id = d["session_id"]

    def test_online_order_pending(self, buyer_token):
        oid = getattr(pytest, "online_order_id", None)
        assert oid
        r = requests.get(f"{API}/orders/{oid}", headers=H(buyer_token), timeout=15)
        assert r.status_code == 200
        o = r.json()
        assert o["status"] == "pending"
        assert o["payment_status"] == "pending"
        assert o["session_id"] == pytest.online_session_id

    def test_payment_status_endpoint(self):
        sid = getattr(pytest, "online_session_id", None)
        assert sid
        r = requests.get(f"{API}/payments/status/{sid}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["session_id"] == sid
        # not yet paid because no card completed
        assert d["payment_status"] in ("pending", "initiated", "unpaid", "paid")


# ---------- Seller order management ----------
class TestSellerOrderManagement:
    def test_seller_sees_order(self, seller_token):
        r = requests.get(f"{API}/orders", headers=H(seller_token), timeout=15)
        assert r.status_code == 200
        oid = getattr(pytest, "cod_order_id", None)
        assert oid
        ids = [o["id"] for o in r.json()]
        assert oid in ids

    def test_advance_status(self, seller_token):
        oid = pytest.cod_order_id
        for status in ["packed", "out_for_delivery", "delivered"]:
            r = requests.put(f"{API}/orders/{oid}/status", json={"status": status},
                             headers=H(seller_token), timeout=15)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == status

    def test_assign_rider(self, seller_token, buyer_token, sample_product):
        # create a new order to test rider assign
        p = sample_product
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"]}],
            "delivery_address": "TEST rider addr", "contact_phone": "0917-111-2222",
            "payment_method": "cod", "origin_url": BASE_URL,
        }
        c = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=20)
        assert c.status_code == 200
        oid = c.json()["order_id"]

        riders = requests.get(f"{API}/riders", timeout=10).json()
        rid = riders[0]["id"]

        r = requests.put(f"{API}/orders/{oid}/assign-rider", json={"rider_id": rid},
                         headers=H(seller_token), timeout=15)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["status"] == "rider_assigned"
        assert o["rider"]["id"] == rid

    def test_buyer_cannot_update_status(self, buyer_token):
        oid = getattr(pytest, "cod_order_id", None)
        r = requests.put(f"{API}/orders/{oid}/status", json={"status": "packed"},
                         headers=H(buyer_token), timeout=15)
        assert r.status_code == 403
