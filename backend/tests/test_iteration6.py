"""Iteration 6 tests: Ratings & Reviews, Seller Earnings, GCash manual regression."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

SELLER = {"email": "mang.kanor@laguna.ph", "password": "farmer123"}
BUYER = {"email": "aling.nena@laguna.ph", "password": "buyer123"}


def _token(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def buyer_token():
    return _token(BUYER)


@pytest.fixture(scope="module")
def seller_token():
    return _token(SELLER)


@pytest.fixture(scope="module")
def buyer_id(buyer_token):
    r = requests.get(f"{API}/auth/me", headers=H(buyer_token), timeout=15)
    return r.json()["id"]


@pytest.fixture(scope="module")
def seller_id(seller_token):
    r = requests.get(f"{API}/auth/me", headers=H(seller_token), timeout=15)
    return r.json()["id"]


@pytest.fixture(scope="module")
def buyer_ordered_product(buyer_token, buyer_id):
    """Find a product the buyer has already ordered."""
    r = requests.get(f"{API}/orders", headers=H(buyer_token), timeout=20)
    assert r.status_code == 200
    orders = r.json()
    assert len(orders) > 0, "Buyer must have prior orders"
    for o in orders:
        for item in o["items"]:
            pid = item["product_id"]
            pr = requests.get(f"{API}/products/{pid}", timeout=10)
            if pr.status_code == 200:
                return pr.json()
    pytest.skip("No fetchable ordered product")


class TestReviews:
    def test_get_reviews_empty_ok(self):
        # Any product listing works
        prods = requests.get(f"{API}/products", timeout=15).json()
        pid = prods[0]["id"]
        r = requests.get(f"{API}/products/{pid}/reviews", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_product_detail_has_seller_rating_fields(self, buyer_ordered_product):
        r = requests.get(f"{API}/products/{buyer_ordered_product['id']}", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "seller_rating" in d
        assert "seller_review_count" in d

    def test_submit_review_by_buyer(self, buyer_token, buyer_ordered_product):
        pid = buyer_ordered_product["id"]
        payload = {"rating": 5, "comment": f"TEST review {uuid.uuid4().hex[:6]}"}
        r = requests.post(f"{API}/products/{pid}/reviews", json=payload,
                          headers=H(buyer_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["rating_avg"] >= 1
        assert d["rating_count"] >= 1
        # verify product now has rating populated
        pr = requests.get(f"{API}/products/{pid}", timeout=15).json()
        assert pr["rating_avg"] == d["rating_avg"]
        assert pr["rating_count"] == d["rating_count"]
        # verify review is listed
        lst = requests.get(f"{API}/products/{pid}/reviews", timeout=15).json()
        assert any(x["comment"] == payload["comment"] for x in lst)

    def test_review_guard_not_ordered(self, buyer_token):
        # Find a product the buyer has NEVER ordered
        all_prods = requests.get(f"{API}/products", timeout=15).json()
        my_orders = requests.get(f"{API}/orders", headers=H(buyer_token), timeout=15).json()
        ordered_ids = {i["product_id"] for o in my_orders for i in o["items"]}
        target = next((p for p in all_prods if p["id"] not in ordered_ids), None)
        if not target:
            pytest.skip("Buyer has ordered every product")
        r = requests.post(f"{API}/products/{target['id']}/reviews",
                          json={"rating": 4, "comment": "TEST forbidden"},
                          headers=H(buyer_token), timeout=15)
        assert r.status_code == 403

    def test_review_requires_auth(self):
        prods = requests.get(f"{API}/products", timeout=15).json()
        r = requests.post(f"{API}/products/{prods[0]['id']}/reviews",
                          json={"rating": 5}, timeout=15)
        assert r.status_code in (401, 403)


class TestSellerEarnings:
    def test_earnings_endpoint(self, seller_token):
        r = requests.get(f"{API}/seller/earnings", headers=H(seller_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "breakdown" in d and "total" in d and "pending" in d and "orders" in d
        for k in ("online", "gcash", "cod"):
            assert k in d["breakdown"]
            assert d["breakdown"][k] >= 0
        assert d["total"] >= 0
        assert d["pending"] >= 0
        # total should equal sum of breakdown
        s = round(sum(d["breakdown"].values()), 2)
        assert abs(s - d["total"]) < 0.01
        # rows structure
        for row in d["orders"][:5]:
            assert "order_id" in row and "method" in row and "amount" in row
            assert "realized" in row

    def test_earnings_forbidden_for_buyer(self, buyer_token):
        r = requests.get(f"{API}/seller/earnings", headers=H(buyer_token), timeout=15)
        assert r.status_code == 403


class TestSellerStatsRegression:
    def test_seller_stats_still_works(self, seller_token):
        """Regression: verify stray decorator at server.py:338 didn't break /seller/stats"""
        r = requests.get(f"{API}/seller/stats", headers=H(seller_token), timeout=15)
        assert r.status_code == 200, f"seller/stats broken: {r.status_code} {r.text}"
        d = r.json()
        # Should have numeric stat fields, not a product body
        assert isinstance(d, dict)


class TestGcashManualRegression:
    def test_gcash_manual_mode(self, buyer_token, seller_id):
        prods = requests.get(f"{API}/products", params={"seller_id": seller_id}, timeout=15).json()
        p = next((x for x in prods if x.get("stock", 0) > 0), None)
        assert p, "Seller has no in-stock products"
        payload = {
            "items": [{"product_id": p["id"], "name": p["name"], "price": p["price"],
                       "quantity": 1, "seller_id": p["seller_id"]}],
            "delivery_address": "TEST manual gcash",
            "contact_phone": "0917-000-1111",
            "payment_method": "gcash",
            "fulfillment_type": "delivery",
            "origin_url": BASE_URL,
        }
        r = requests.post(f"{API}/checkout", json=payload, headers=H(buyer_token), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["payment_method"] == "gcash"
        assert d["gcash_mode"] == "manual"
        assert "checkout_url" not in d or not d.get("checkout_url")
