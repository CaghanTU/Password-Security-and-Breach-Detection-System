# Plan: Password Security & Breach Risk Analysis System

**TL;DR** — Modüler FastAPI uygulaması. Güvenlik kararları revize edildi: JWT HttpOnly cookie'de tutulur, KEY_STORE `(user_id, session_id)` tuple key ile çalışır, credentials tablosu GCM tag dahil tam schema ile, master password hiçbir zaman saklanmaz prensibi raporda vurgulanır. Brute-force lockout, TOTP 2FA (gerçek QR kod), rate limiting, zxcvbn güç analizi, Levenshtein benzerlik tespiti, şifre geçmişi, ihlal tarihi karşılaştırması, şifreli dışa aktarma, audit log ve risk skoru geçmişi eklendi.

---

## Stack

- Python + FastAPI backend
- SQLite + SQLAlchemy ORM
- `cryptography` (AES-256-GCM), `argon2-cffi` (Argon2id)
- `requests` (HIBP API), `python-jose` (JWT)
- `slowapi` (rate limiting), `pyotp` (TOTP 2FA), `zxcvbn-python` (gerçekçi güç analizi)
- `qrcode[pil]` (2FA QR kod üretimi), `rapidfuzz` (Levenshtein benzerlik tespiti)
- Bootstrap 5 + vanilla JS + Chart.js frontend

---

## Phase 1 — Project Scaffold & Config

1. Klasör yapısını oluştur ve `requirements.txt` yaz
2. `config.py` — `.env` üzerinden `HIBP_API_KEY`, `JWT_SECRET`, `DB_URL` oku (`python-dotenv`)
3. `database.py` — SQLAlchemy engine + 6 tablo: `users`, `credentials`, `breach_cache`, `score_history`, `password_history`, `audit_log`
   - `users`: `lockout_until DATETIME`, `failed_attempts INTEGER DEFAULT 0`, `totp_secret TEXT` kolonları eklendi
   - `credentials`: `category TEXT`, `is_stale BOOLEAN DEFAULT FALSE` kolonları eklendi
4. `models/schemas.py` — tüm Pydantic request/response modelleri

---

## Phase 2 — Auth & Crypto Services

5. **`crypto_service.py`**
   - `derive_key(master_password, kdf_salt) → bytes` — Argon2id, 32-byte AES key
   - `encrypt(plaintext, key) → (ciphertext_b64, iv_b64, tag_b64)` — AES-256-GCM, GCM tag ayrı saklanır
   - `decrypt(ciphertext_b64, iv_b64, tag_b64, key) → str` — GCM tag doğrulaması dahil
   - `hash_for_reuse(password) → str` — SHA-256, **same-user reuse detection** için

6. **`auth_service.py`**
   - `register(username, master_password)` — Argon2id hash + ayrı `kdf_salt` üret ve sakla
   - `login(username, master_password) → JWT(user_id, session_id, jti)` — hash doğrula, `kdf_salt` ile key derive et, `KEY_STORE[(user_id, session_id)] = key`
   - **Brute-force lockout** — 5 başarısız denemede `lockout_until = now + 15 dk` set et, kilitli hesapta 429 döndür; başarılı login'de `failed_attempts = 0` sıfırla
   - **TOTP 2FA** — `setup_2fa(user_id)` → `pyotp.random_base32()` ile secret üret, `totp_secret` kolonuna kaydet; `qrcode` kütüphanesi ile `otpauth://` URI'dan PNG QR görüntüsü üret, base64 encode edip `data:image/png;base64,...` olarak döndür; frontend'de `<img>` tag'inde göster (Google Authenticator / Authy tarafından taranabilir); `verify_2fa(user_id, code)` → `pyotp.TOTP(secret).verify(code)` ile doğrula; login flow'a opsiyonel ikinci adım olarak ekle
   - `logout(user_id, session_id)` — `KEY_STORE`'dan yalnızca o session'ın key'ini sil
   - JWT response: **`response.set_cookie(key="token", httponly=True, secure=True, samesite="strict")`**
   - JWT middleware — cookie'den token okur, `(user_id, session_id)` çıkarır, KEY_STORE'dan key alır

   > **Rapor notu — mutlaka yaz:** Master password never stored. Argon2id is used twice with separate salts: once for authentication (stored hash), once for key derivation (deterministic, never stored). The derived encryption key lives only in server memory for the session duration.

   > **Rate limiting (`slowapi`)** — `POST /auth/login` ve `POST /breach/email` için IP başına dakikada 10 istek sınırı. `main.py`'de `Limiter` instance'ı oluştur, ilgili endpoint'lere `@limiter.limit("10/minute")` decorator ekle. `CORSMiddleware` ile izin verilen origin'leri kısıtla.

---

## Phase 3 — Core Modules

7. **`password_service.py`**
   - CRUD + same-user reuse detection (`reuse_hash` karşılaştırma)
   - **zxcvbn entegrasyonu** — kural tabanlı weak/medium/strong yerine `zxcvbn(plaintext).score` (0–4) kullan; sözlük, keyboard walk, pattern tespiti dahil. `strength_label` buna göre set edilir.
   - **Levenshtein benzerlik tespiti** — `rapidfuzz.fuzz.ratio(new_plaintext, existing_plaintext)` ile kullanıcının mevcut tüm şifrelerine karşı benzerlik skoru hesapla; `≥ 80` benzerlikte `too_similar` uyarısı döndür (örn. `"password1"` → `"password2"` geçişi engellenir); hash karşılaştırmasının neden yetmediğini raporunda açıkla
   - **Şifre yaşı (staleness)** — `created_at` veya son `updated_at` üzerinden 90 günden eski credential'ları `is_stale = True` olarak işaretle; `GET /passwords` response'unda `stale` flag döndür
   - **Şifre geçmişi** — `PUT /passwords/{id}` çağrısında eski ciphertext/iv/tag `password_history` tablosuna taşı; kullanıcı son 5 şifreye geri dönemez (geçmiş reuse detection); geçmişteki şifreler de Levenshtein kontrolüne dahil edilir
   - **Kategori** — `category` alanı ile credential'ları etiketle (email, banking, social, work, other); `GET /passwords?category=banking` ile filtrele

8. **`breach_service.py`**
   - HIBP email (API key) + HIBP password k-anonymity (SHA-1 prefix, key gerekmez, plaintext asla gönderilmez)
   - `breach_cache` tablosunda TTL bazlı sonuç sakla (aynı email için 24 saat içinde tekrar API çağrısı yapma)
   - **İhlal tarihi karşılaştırması** — HIBP response'undaki `BreachDate` alanını kullanıcının ilgili credential'ının `updated_at` değeriyle karşılaştır:
     - `updated_at > BreachDate` → `"password_changed_after_breach": true` — şifre ihlalden sonra değiştirilmiş ✓
     - `updated_at < BreachDate` → `"password_changed_after_breach": false` — şifre ihlalden önce değiştirilmemiş ✗, score'a ek `−5` uygula
   - Bu flag `credentials.breach_date_status TEXT` kolonuna yazılır; breach scanner sonuç ekranında renkli gösterilir
9. **`generator_service.py`** — `secrets` modülü, Shannon entropy hesabı
10. **`scoring_service.py`** — `score = 100 − (5×weak) − (8×reused) − (15×breached_cred) − (10×email_breached) − (3×stale) − (5×breached_not_rotated)`, min 0; her hesaplamada `score_history` tablosuna `(user_id, score, calculated_at)` satırı ekle
11. **`audit_service.py`** — `log(user_id, action, ip)` → `audit_log` tablosuna yaz; kritik aksiyonlar: `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `2FA_ENABLED`, `CREDENTIAL_ADD`, `CREDENTIAL_UPDATE`, `CREDENTIAL_DELETE`, `BREACH_CHECK`, `EXPORT`
12. **`export_service.py`** — kullanıcının tüm vault'unu plaintext JSON olarak serialize et, ardından `crypto_service.encrypt()` ile master password'dan türetilen key ile şifrele; `GET /export` → AES-256-GCM encrypted blob indir

---

## Phase 4 — FastAPI Routers

13. `routers/auth.py` — `POST /auth/register`, `POST /auth/login` (cookie set + lockout kontrolü), `POST /auth/logout` (cookie clear), `POST /auth/2fa/setup`, `POST /auth/2fa/verify`
14. `routers/passwords.py` — `GET /passwords` (category filter), `POST /passwords`, `PUT /passwords/{id}` (history taşı), `DELETE /passwords/{id}`, `GET /passwords/{id}/history`
15. `routers/breach.py` — `POST /breach/email`, `POST /breach/password`
16. `routers/generator.py` — `POST /generator/generate`
17. `routers/score.py` — `GET /score` (anlık), `GET /score/history` (geçmiş liste)
18. `routers/export.py` — `GET /export` (şifreli vault indir)
19. `routers/audit.py` — `GET /audit` (kullanıcının kendi audit log'u, sayfalı)

---

## Phase 5 — Frontend Dashboard

20. `index.html` — Login formu (Bootstrap 5) + opsiyonel 2FA kodu input alanı; cookie tabanlı auth sayesinde JS'de token yönetimi yok
21. `dashboard.html` — 6 card/tab: Password Manager (category filter dahil) | Breach Scanner | Generator | Score & History | Export | Audit Log
    - **Score History** tab'ında Chart.js ile çizgi grafik: X ekseni tarih, Y ekseni skor (0–100)
    - Password Manager'da kategori dropdown filtresi
    - Stale şifreler için sarı uyarı badge'i
22. `static/app.js` — `fetch(..., { credentials: "include" })` ile cookie otomatik gider, `Authorization` header'ı gerekmez

---

## Folder Structure

```
password_security_system/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── config.py
│   ├── models/
│   │   └── schemas.py
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── crypto_service.py
│   │   ├── password_service.py
│   │   ├── breach_service.py
│   │   ├── generator_service.py
│   │   ├── scoring_service.py
│   │   ├── audit_service.py
│   │   └── export_service.py
│   └── routers/
│       ├── auth.py
│       ├── passwords.py
│       ├── breach.py
│       ├── generator.py
│       ├── score.py
│       ├── export.py
│       └── audit.py
├── frontend/
│   ├── index.html
│   ├── dashboard.html
│   └── static/
│       ├── app.js
│       └── style.css
├── .env.example
└── requirements.txt
```

---

## credentials Table Schema

```
id             INTEGER  PK
user_id        INTEGER  FK → users.id
site_name      TEXT
site_username  TEXT     (encrypted)
ciphertext     TEXT     (AES-256-GCM ciphertext, base64)
iv             TEXT     (96-bit nonce, base64)
tag            TEXT     (GCM auth tag, base64 — ayrı sakla, decrypt sırasında doğrula)
reuse_hash     TEXT     (SHA-256 of plaintext — same-user reuse karşılaştırması)
strength_label TEXT     (weak / medium / strong — zxcvbn score'dan türetilir)
is_breached            BOOLEAN  DEFAULT FALSE
breach_date_status     TEXT     NULLABLE  ("changed_after" / "not_rotated" — ihlal tarih karşılaştırması)
is_stale               BOOLEAN  DEFAULT FALSE  (created_at veya updated_at > 90 gün)
category               TEXT     (email / banking / social / work / other)
created_at     DATETIME
updated_at     DATETIME
```

---

## password_history Table Schema

```
id             INTEGER  PK
credential_id  INTEGER  FK → credentials.id
ciphertext     TEXT
iv             TEXT
tag            TEXT
archived_at    DATETIME
```

---

## score_history Table Schema

```
id             INTEGER  PK
user_id        INTEGER  FK → users.id
score          INTEGER
calculated_at  DATETIME
```

---

## audit_log Table Schema

```
id             INTEGER  PK
user_id        INTEGER  FK → users.id
action         TEXT     (LOGIN / LOGIN_FAILED / LOGOUT / 2FA_ENABLED / CREDENTIAL_ADD / CREDENTIAL_UPDATE / CREDENTIAL_DELETE / BREACH_CHECK / EXPORT)
ip_address     TEXT
created_at     DATETIME
```

---

## users Table — Ek Kolonlar

```
failed_attempts  INTEGER   DEFAULT 0
lockout_until    DATETIME  NULLABLE
totp_secret      TEXT      NULLABLE  (base32, sadece 2FA etkinse dolu)
```

---

## Verification Checklist

1. Login → response header'da `Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict` doğrula
2. Aynı kullanıcı iki sekme/browser'dan login → KEY_STORE'da iki ayrı `(user_id, session_id)` entry olduğunu doğrula
3. Şifre kaydet → decrypt round-trip test (encrypt → DB → fetch → decrypt eşleşmeli)
4. Aynı şifreyi iki farklı credential olarak ekle → `reuse_hash` eşleşiyor mu doğrula
5. Bilinen zayıf parola → zxcvbn score 0–1 → `strength_label = "weak"`, score düşüyor mu kontrol et
6. HIBP k-anonymity: sadece SHA-1 prefix gönderildiğini proxy ile doğrula
7. Score: 2 weak + 1 reused = 100 − 10 − 8 = **82** olmalı
8. Brute-force: 5 yanlış login → `lockout_until` set mi, 6. denemede 429 mu dönüyor doğrula
9. 2FA: `setup_2fa` → QR secret üretildi mi, `verify_2fa` geçerli/geçersiz TOTP kodu ile test et
10. Rate limiting: 11. istekte 429 dönüyor mu kontrol et
11. Şifre güncelle → eski ciphertext `password_history`'de var mı, eski şifreye dönmeye çalışınca hata veriyor mu
12. 91 günlük credential → `is_stale = True` mi, dashboard'da uyarı badge'i çıkıyor mu
13. `GET /score/history` → her score hesaplamadan sonra `score_history` tablosunda yeni satır var mı
14. `GET /export` → indirilen blob decrypt edilebiliyor mu (encrypt → export → decrypt round-trip)
15. `GET /audit` → login, credential add, breach check aksiyonlarının logda göründüğünü doğrula
16. QR kod: `POST /auth/2fa/setup` response'undaki base64 PNG'yi `<img>` tag'ine koy, Google Authenticator ile tara → kod üretiliyor mu doğrula
17. Levenshtein: `"password1"` kayıtlıyken `"password2"` eklemeye çalış → `too_similar` uyarısı dönüyor mu doğrula; benzerlik skoru `< 80` olan tamamen farklı bir şifre kabul ediliyor mu doğrula
18. İhlal tarihi: HIBP'de bilinen breach'li email ile sorgu yap; `updated_at` ihlal tarihinden önce/sonra iki senaryo için `breach_date_status` flag'ini doğrula

---

## Key Decisions

- **HttpOnly cookie** — localStorage XSS açığını ortadan kaldırır, `credentials: "include"` fetch yeterli
- **GCM tag ayrı kolon** — integrity check adımı görünür olsun (pedagojik değer)
- **`(user_id, session_id)` KEY_STORE** — multi-session collision önlenir, JWT'de `jti` claim kullanılır
- **Same-user reuse** — scope net tanımlandı, global cross-user reuse kapsam dışı; `password_history` ile geçmişe de genişletildi
- **HIBP password k-anonymity** — plaintext asla dışarıya çıkmaz, API key gerekmez
- **AES-256-GCM** — authenticated encryption, CBC değil; CBC'nin padding oracle saldırısına karşı savunmasızlığını ortadan kaldırır
- **`secrets` modülü** — generator için `random` yerine; cryptographically secure PRNG
- **Key Store kalıcılığı notu** — sunucu restart olursa session key'ler kaybolur; production'da Redis kullanılır
- **Brute-force lockout** — OWASP A07 (Identification & Authentication Failures) doğrudan karşılığı; `failed_attempts` + `lockout_until` DB kolonları, uygulama katmanında 15 dk kilit
- **TOTP 2FA + QR** — `pyotp` TOTP, RFC 6238 uyumlu; secret DB'de saklanır; `qrcode[pil]` ile base64 PNG üretilir, frontend'de `<img>` tag'ine gömülür; kamera ile taranabilir (Google Authenticator / Authy uyumlu); login flow'da opsiyonel ikinci faktör
- **Rate limiting (`slowapi`)** — kritik endpoint'lere IP bazlı istek sınırı; DoS yüzeyini daraltır
- **zxcvbn** — kural tabanlı güç etiketleme yerine gerçekçi entropi tahmini; sözlük saldırısı, keyboard walk, pattern tespiti; raporda "neden length/complexity kuralı yeterli değil" sorusuna kanıt
- **Şifre yaşı (staleness)** — 90 gün eşiği; score'a `−3×stale` olarak yansır; kullanıcıyı rotasyona teşvik eder
- **score_history + Chart.js** — risk profilinin zamansal değişimi görselleştirilir; demo değeri yüksek
- **Audit log** — OWASP A09 (Security Logging & Monitoring Failures) doğrudan karşılığı; her kritik aksiyon IP ile loglanır
- **Şifreli export** — vault taşınabilirliği; export blobu da AES-256-GCM ile şifrelenir, plaintext asla diske yazılmaz
- **CORS kısıtlaması** — `CORSMiddleware` ile yalnızca frontend origin'e izin verilir; wildcard `*` kullanılmaz
- **Levenshtein benzerlik tespiti** — exact hash match'in ötesinde; `rapidfuzz` ile edit distance tabanlı benzerlik skoru; `"password1"` → `"password2"` gibi tahmin edilebilir varyasyonları engeller; raporda "neden SHA-256 karşılaştırması tek başına yetmez" sorusuna doğrudan kanıt
- **İhlal tarihi karşılaştırması** — HIBP `BreachDate` ile `updated_at` karşılaştırması; ihlali bilen ama şifresini değiştirmeyen kullanıcıyı tespit eder; score'a `−5×breached_not_rotated` olarak yansır; breach scanner ekranında `✓ / ✗` flag ile gösterilir
