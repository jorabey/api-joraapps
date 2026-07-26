# Server o'zgarishlari — Admin Panel qo'shilishi

Ushbu hujjat admin panelni qo'llab-quvvatlash uchun `server/` papkasida amalga oshirilgan barcha o'zgarishlarni qisqacha sanab o'tadi.

## Yangi fayllar

### Modellar
- `src/models/Admin.js` — administrator hisoblari (rol: super_admin / moderator / support)
- `src/models/AuditLog.js` — har bir admin amalining doimiy yozuvi

### Middleware
- `src/middlewares/requireAdminAuth.js` — `requireAdminAuth` (token tekshiruvi) + `requireRole(...)` (rol nazorati)

### Utility
- `src/utils/auditLog.js` — `logAdminAction()` — barcha admin controllerlarida ishlatiladi

### Admin API (`src/api/v1/admin/`)
8 ta modul, 41 ta endpoint: `auth`, `dashboard`, `apps`, `developers`, `users`, `reports`, `bridge`, `audit-logs`. Har birida `.controller.js`, `.route.js`, va kerak bo'lganda `.validation.js`.

### Skript
- `src/scripts/seedSuperAdmin.js` — birinchi super_admin hisobini yaratish uchun bir martalik skript

## O'zgartirilgan fayllar

### `src/models/App.js`
- ➕ `category` (enum, 9 ta toifa) — admin tasniflashi uchun
- ➕ `moderation.{suspendedReason, rejectedReason, reviewedBy, reviewedAt}` — audit izi

### `src/models/Developer.js`
- ➕ `tokenVersion` (Number, default 0) — **muhim tuzatish**: `dev.auth.controller.js` bu maydonni allaqachon o'qib/yozib turardi, lekin sxemada e'lon qilinmagani uchun har doim sukut bo'yicha noaniq holatda edi
- ➕ `moderation.{suspendedReason, reviewedBy, reviewedAt}`

### `src/models/User.js`
- ➕ `moderation.{blockedReason, blockedBy, blockedAt}`

### `src/middlewares/verifyAppSignature.js`
- 🔐 **Xavfsizlik tuzatishi**: endi `app.status !== 'live'` bo'lsa Bridge so'rovini rad etadi. Avval suspend/under_review holatidagi ilova ham to'g'ri token+imzo bilan Bridge API'ga (push, user-data, event-logs) kira olardi — bu admin "suspend" amalini amalda kuchsiz qilardi.

### `src/utils/generateTokens.js`
- ➕ `generateAdminAccessToken(admin)`, `generateAdminRefreshToken(admin)` — mavjud funksiyalar o'zgarmagan, faqat yangilari qo'shilgan

### `src/config/env.js`
- ➕ `jwt.adminSecret` — `JWT_ADMIN_SECRET` muhit o'zgaruvchisidan (`requireAdminAuth` shuni o'qiydi, mavjud bo'lmasa `accessSecret`ga tushadi)

### `src/api/v1/client/connections/connection.controller.js` va `connection.route.js`
- ➕ `POST /client/connections/block` — ilovani bloklash
- ➕ `POST /client/connections/unblock` — blokdan chiqarish
- ➕ `POST /client/connections/report` — shikoyat yuborish (`AppReport` yaratadi)

  Bu uchta endpoint avvalgi "Nexa user-app" frontendida chaqirilgan, lekin server tomonida mavjud emas edi (frontend kodida "TODO: backend route kerak" deb izohlangan edi). Endi to'liq ishlaydi va admin panelidagi "Reports" bo'limi shu orqali to'ladi.

### `src/app.js`
- ➕ 8 ta admin route guruhini import va mount qilish (`/api/v1/admin/*`)
- 🔧 CORS: `origin` endi massiv — `5173` (user-app), `5174` (dev-console), `5175` (admin-panel)

## .env ga qo'shilishi kerak bo'lgan o'zgaruvchilar

```env
# Admin JWT (ixtiyoriy — bo'lmasa JWT_ACCESS_SECRET ishlatiladi)
JWT_ADMIN_SECRET=your-admin-secret-here

# Birinchi super_admin yaratish uchun (faqat seedSuperAdmin.js ishlatadi)
SEED_ADMIN_EMAIL=admin@nexa.uz
SEED_ADMIN_PASSWORD=KuchliParol123!
SEED_ADMIN_FULLNAME="Bosh Administrator"
```

## Migratsiya eslatmasi

Mavjud bazada allaqachon `App`, `Developer`, `User` hujjatlari bo'lsa, yangi maydonlar (`category`, `moderation`, `tokenVersion`) Mongoose default qiymatlari bilan avtomatik to'ldiriladi — qo'lda migratsiya skripti shart emas. Faqat eski `App` hujjatlarida `category` har doim `'other'` bo'lib qoladi, admin panelidan qo'lda tasniflash kerak bo'ladi.
