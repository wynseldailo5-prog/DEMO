# FarmDirect Laguna — PRD

## Original Problem Statement
Build a Shopee-style marketplace for farmers (sellers) and buyers within Laguna province, Philippines. Enable online payment, seller & buyer login, order tracking + delivery procedures. Sellers post their farm goods; buyers buy farm goods.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). All routes under `/api`. JWT (Bearer + httpOnly cookie) auth with bcrypt.
- **Frontend**: React (CRA) + Tailwind + shadcn/ui + framer-motion. AuthContext + CartContext (localStorage cart).
- **Payments**: Stripe via emergentintegrations (managed shared sandbox `sk_test_emergent`), dynamic PHP amounts + Cash on Delivery. (Note: Stripe claimable sandbox not available for PH; using shared test sandbox.)
- **Storage**: Emergent object storage for seller product image uploads.

## User Personas
- **Buyer**: browses market, adds to cart, checks out (online/COD), tracks orders.
- **Seller (Farmer)**: posts goods with photos, manages incoming orders, advances delivery status, assigns riders.
- **Admin/Owner** (wynseldailo5@gmail.com): sees all orders.

## Core Requirements (static)
- Email/password auth, roles buyer/seller/admin.
- Product CRUD with image upload.
- Cart + checkout with online payment (Stripe) and COD.
- Order tracking stages: pending → confirmed → packed → rider_assigned → out_for_delivery → delivered (+cancelled).
- Rider assignment with rider details.

## Implemented (2026-06)
- JWT auth (register/login/me/logout), role guarding. [done]
- Marketplace with category filter + search; product detail. [done]
- Seller dashboard: post/upload/delete products, stats, incoming orders, advance status, assign rider. [done]
- Cart, checkout (online + COD), Stripe session + polling + webhook, payment result page. [done]
- Buyer orders page with visual OrderTracker stepper + rider info. [done]
- Seeded riders, admin, demo seller/buyer + 8 products. [done]
- Stock decrement on order; stock restore on cancelled/expired online payment. [done]
- Tested: 24/24 backend pytest pass, all frontend flows pass. [done]

## Backlog / Remaining
- P1: `/api/orders/{id}/cancel` endpoint for buyers/sellers to cancel unpaid orders.
- P2: Multi-seller cart split into per-seller sub-orders; tighten CORS for prod; split server.py into routers.
- P2: Buyer-facing delivery map (lat/lng captured but not visualized).

## Next Tasks
- Add order cancellation + refunds.
- Ratings/reviews for sellers and products.
- Delivery map view for live tracking.
