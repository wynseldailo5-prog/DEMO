from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form, Query, Header
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response as StarletteResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging, uuid, bcrypt, jwt, requests

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "laguna-farm"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ----------------------- Object Storage -----------------------
storage_key = None

def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ----------------------- Auth helpers -----------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def serialize_user(user: dict) -> dict:
    return {"id": str(user["_id"]), "email": user["email"], "name": user.get("name"),
            "role": user.get("role"), "phone": user.get("phone"), "address": user.get("address"),
            "farm_name": user.get("farm_name")}

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_seller(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("seller", "admin"):
        raise HTTPException(status_code=403, detail="Seller access required")
    return user

# ----------------------- Models -----------------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "buyer"
    phone: Optional[str] = None
    address: Optional[str] = None
    farm_name: Optional[str] = None

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class ProductInput(BaseModel):
    name: str
    description: str = ""
    category: str = "Vegetables"
    price: float
    unit: str = "kg"
    stock: int = 0
    image_url: Optional[str] = None
    location: str = "Laguna"

class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    seller_id: str
    image_url: Optional[str] = None

class CheckoutInput(BaseModel):
    items: List[OrderItem]
    delivery_address: str
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    contact_phone: str
    payment_method: str  # "online" or "cod"
    origin_url: str

class StatusUpdate(BaseModel):
    status: str

class RiderAssign(BaseModel):
    rider_id: str

ORDER_STAGES = ["pending", "confirmed", "packed", "rider_assigned", "out_for_delivery", "delivered", "cancelled"]

# ----------------------- Auth routes -----------------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    role = data.role if data.role in ("buyer", "seller") else "buyer"
    doc = {"email": email, "password_hash": hash_password(data.password), "name": data.name,
           "role": role, "phone": data.phone, "address": data.address, "farm_name": data.farm_name,
           "created_at": datetime.now(timezone.utc).isoformat()}
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    token = create_access_token(str(result.inserted_id), email)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"token": token, "user": serialize_user(doc)}

@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), email)
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"token": token, "user": serialize_user(user)}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return serialize_user(user)

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

# ----------------------- File upload -----------------------
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(require_seller)):
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{str(user['_id'])}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    doc = {"id": str(uuid.uuid4()), "storage_path": result["path"],
           "content_type": file.content_type, "is_deleted": False,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.files.insert_one(doc)
    backend = os.environ.get("REACT_APP_BACKEND_URL", "")
    return {"image_url": f"/api/files/{result['path']}"}

@api_router.get("/files/{path:path}")
async def download(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = get_object(path)
    return StarletteResponse(content=data, media_type=record.get("content_type", content_type))

# ----------------------- Products -----------------------
@api_router.get("/products")
async def list_products(category: Optional[str] = None, search: Optional[str] = None, seller_id: Optional[str] = None):
    q = {"is_deleted": {"$ne": True}}
    if category and category != "All":
        q["category"] = category
    if seller_id:
        q["seller_id"] = seller_id
    if search:
        q["name"] = {"$regex": search, "$options": "i"}
    products = await db.products.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return products

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p

@api_router.post("/products")
async def create_product(data: ProductInput, user: dict = Depends(require_seller)):
    doc = data.model_dump()
    doc.update({"id": str(uuid.uuid4()), "seller_id": str(user["_id"]),
                "seller_name": user.get("farm_name") or user.get("name"),
                "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat()})
    await db.products.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductInput, user: dict = Depends(require_seller)):
    p = await db.products.find_one({"id": product_id})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    if p["seller_id"] != str(user["_id"]) and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your product")
    await db.products.update_one({"id": product_id}, {"$set": data.model_dump()})
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_seller)):
    p = await db.products.find_one({"id": product_id})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    if p["seller_id"] != str(user["_id"]) and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your product")
    await db.products.update_one({"id": product_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}

# ----------------------- Riders -----------------------
@api_router.get("/riders")
async def list_riders():
    return await db.riders.find({}, {"_id": 0}).to_list(100)

# ----------------------- Orders -----------------------
def order_total(items):
    return round(sum(i["price"] * i["quantity"] for i in items), 2)

async def restore_stock(order):
    if order.get("stock_restored"):
        return
    for i in order.get("items", []):
        await db.products.update_one({"id": i["product_id"]}, {"$inc": {"stock": i["quantity"]}})
    await db.orders.update_one({"id": order["id"]}, {"$set": {"stock_restored": True}})

@api_router.post("/checkout")
async def checkout(data: CheckoutInput, request: Request, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    items = [i.model_dump() for i in data.items]
    total = order_total(items)
    order_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    order = {"id": order_id, "buyer_id": str(user["_id"]), "buyer_name": user.get("name"),
             "items": items, "total": total, "delivery_address": data.delivery_address,
             "delivery_lat": data.delivery_lat, "delivery_lng": data.delivery_lng,
             "contact_phone": data.contact_phone, "payment_method": data.payment_method,
             "payment_status": "pending", "status": "pending", "rider": None,
             "seller_ids": list({i["seller_id"] for i in items}),
             "created_at": now, "updated_at": now, "history": [{"status": "pending", "at": now}]}

    # decrement stock
    for i in items:
        await db.products.update_one({"id": i["product_id"]}, {"$inc": {"stock": -i["quantity"]}})

    if data.payment_method == "cod":
        order["payment_status"] = "cod_pending"
        order["status"] = "confirmed"
        order["history"].append({"status": "confirmed", "at": now})
        await db.orders.insert_one(dict(order))
        return {"order_id": order_id, "payment_method": "cod"}

    # online payment
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=webhook_url)
    success_url = f"{data.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/payment/cancel"
    req = CheckoutSessionRequest(amount=float(total), currency="php",
                                 success_url=success_url, cancel_url=cancel_url,
                                 metadata={"order_id": order_id, "user_id": str(user["_id"])})
    session = await stripe_checkout.create_checkout_session(req)
    order["session_id"] = session.session_id
    await db.orders.insert_one(dict(order))
    await db.payment_transactions.insert_one({
        "session_id": session.session_id, "order_id": order_id, "user_id": str(user["_id"]),
        "amount": float(total), "currency": "php", "status": "initiated",
        "payment_status": "pending", "created_at": now, "updated_at": now})
    return {"order_id": order_id, "checkout_url": session.url, "session_id": session.session_id}

@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if record.get("payment_status") != "paid":
        host_url = str(request.base_url)
        stripe_checkout = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=f"{host_url}api/webhook/stripe")
        try:
            status = await stripe_checkout.get_checkout_status(session_id)
            if status.payment_status == "paid":
                now = datetime.now(timezone.utc).isoformat()
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now}})
                await db.orders.update_one(
                    {"id": record["order_id"], "payment_status": {"$ne": "paid"}},
                    {"$set": {"payment_status": "paid", "status": "confirmed", "updated_at": now},
                     "$push": {"history": {"status": "confirmed", "at": now}}})
                record = await db.payment_transactions.find_one({"session_id": session_id})
            elif status.status == "expired":
                order = await db.orders.find_one({"id": record["order_id"]})
                if order:
                    await restore_stock(order)
        except Exception as e:
            logger.error(f"stripe status err: {e}")
    return {"session_id": session_id, "status": record["status"], "payment_status": record["payment_status"], "order_id": record.get("order_id")}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature")
    host_url = str(request.base_url)
    stripe_checkout = StripeCheckout(api_key=os.environ["STRIPE_API_KEY"], webhook_url=f"{host_url}api/webhook/stripe")
    try:
        wh = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.error(f"webhook err: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook")
    if wh.payment_status == "paid":
        now = datetime.now(timezone.utc).isoformat()
        await db.payment_transactions.update_one(
            {"session_id": wh.session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now}})
        rec = await db.payment_transactions.find_one({"session_id": wh.session_id})
        if rec:
            await db.orders.update_one(
                {"id": rec["order_id"], "payment_status": {"$ne": "paid"}},
                {"$set": {"payment_status": "paid", "status": "confirmed", "updated_at": now},
                 "$push": {"history": {"status": "confirmed", "at": now}}})
    elif wh.payment_status in ("expired", "failed", "unpaid"):
        rec = await db.payment_transactions.find_one({"session_id": wh.session_id})
        if rec:
            order = await db.orders.find_one({"id": rec["order_id"]})
            if order and order.get("payment_status") != "paid":
                await restore_stock(order)
    return {"status": "ok"}

@api_router.get("/orders")
async def my_orders(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    if user.get("role") == "admin":
        orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    elif user.get("role") == "seller":
        orders = await db.orders.find({"seller_ids": uid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    else:
        orders = await db.orders.find({"buyer_id": uid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    uid = str(user["_id"])
    if user.get("role") == "buyer" and o["buyer_id"] != uid:
        raise HTTPException(status_code=403, detail="Not your order")
    return o

@api_router.put("/orders/{order_id}/status")
async def update_status(order_id: str, data: StatusUpdate, user: dict = Depends(require_seller)):
    if data.status not in ORDER_STAGES:
        raise HTTPException(status_code=400, detail="Invalid status")
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one({"id": order_id},
        {"$set": {"status": data.status, "updated_at": now},
         "$push": {"history": {"status": data.status, "at": now}}})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

@api_router.put("/orders/{order_id}/assign-rider")
async def assign_rider(order_id: str, data: RiderAssign, user: dict = Depends(require_seller)):
    rider = await db.riders.find_one({"id": data.rider_id}, {"_id": 0})
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one({"id": order_id},
        {"$set": {"rider": rider, "status": "rider_assigned", "updated_at": now},
         "$push": {"history": {"status": "rider_assigned", "at": now}}})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})

@api_router.get("/seller/stats")
async def seller_stats(user: dict = Depends(require_seller)):
    uid = str(user["_id"])
    products = await db.products.count_documents({"seller_id": uid, "is_deleted": {"$ne": True}})
    orders = await db.orders.find({"seller_ids": uid}, {"_id": 0}).to_list(1000)
    revenue = 0.0
    for o in orders:
        if o.get("payment_status") in ("paid", "cod_pending") and o.get("status") != "cancelled":
            revenue += sum(i["price"] * i["quantity"] for i in o["items"] if i["seller_id"] == uid)
    return {"products": products, "orders": len(orders), "revenue": round(revenue, 2)}

@api_router.get("/")
async def root():
    return {"message": "Laguna FarmDirect API"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_pw),
                                   "name": "Laguna Admin", "role": "admin",
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    if await db.riders.count_documents({}) == 0:
        riders = [
            {"id": str(uuid.uuid4()), "name": "Jun Dela Cruz", "phone": "0917-555-1010", "vehicle": "Motorcycle", "zone": "Calamba"},
            {"id": str(uuid.uuid4()), "name": "Marvin Reyes", "phone": "0917-555-2020", "vehicle": "Tricycle", "zone": "Los Baños"},
            {"id": str(uuid.uuid4()), "name": "Ella Santos", "phone": "0917-555-3030", "vehicle": "Motorcycle", "zone": "Santa Cruz"},
            {"id": str(uuid.uuid4()), "name": "Boy Aquino", "phone": "0917-555-4040", "vehicle": "Multicab", "zone": "San Pablo"},
        ]
        await db.riders.insert_many(riders)
    try:
        init_storage()
    except Exception as e:
        logger.error(f"storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
