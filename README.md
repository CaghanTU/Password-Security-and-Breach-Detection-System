# Password Security System

Kapsamlı ve güvenli bir parola yönetim, analiz ve izleme sistemi. Bu proje, kullanıcıların parolalarını güvenli bir şekilde saklamalarını sağlamanın yanı sıra güçlü parola üretimi, sızıntı kontrolü, güvenlik puanlaması ve denetim kayıtları gibi gelişmiş güvenlik özellikleri sunmaktadır.

## Özellikler

- **Parola Yönetimi**: Parolaların güvenli (kriptografik) olarak saklanması ve yönetilmesi (Oluşturma, Görüntüleme, Güncelleme, Silme).
- **Parola Güvenlik Puanlaması**: Parolalarınızın güçlü olup olmadığını test eden gelişmiş bir skorlama mekanizması.
- **Veri Sızıntısı (Breach) Kontrolü**: Parolalarınızın bilinen veri sızıntılarında (data breaches) yer alıp almadığını kontrol etme özelliği.
- **İki Faktörlü Doğrulama (2FA)**: Kullanıcı hesapları için ekstra güvenlik katmanı.
- **Parola Üretici (Generator)**: Belirlenen güvenlik kurallarına (uzunluk, özel karakterler, rakamlar vb.) uygun, kırılması zor ve rastgele parolalar oluşturma.
- **Denetim Kayıtları (Audit Logs)**: Kullanıcı ve sistem işlemlerinin takip edilebilir, detaylı loglanması.
- **İçe/Dışa Aktarma (Import/Export)**: Parola verilerini güvenli bir şekilde yedekleme veya başka bir platformdan taşıma.

## Teknoloji Yığını (Tech Stack)

**Backend:**
- Python & [FastAPI](https://fastapi.tiangolo.com/) (Yüksek performanslı, hızlı API geliştirme)
- Güvenlik: Pydantic (Validasyon ve şemalar), Kriptografi ve Hash (Uçtan uca şifreleme)
- Modüler mimari (Routers, Services, Models, Schemas)

**Frontend:**
- [React.js](https://react.dev/) + [Vite](https://vitejs.dev/) (Hızlı derleme ve modern web arayüzü)
- Bileşen Tabanlı Yapı (Dashboard, Passwords, Audit, Breach, Score Tabs)
- State & Context API tabanlı yönetim (AuthContext)

## Proje Yapısı

```text
password_security_system/
├── backend/
│   ├── main.py                 # FastAPI uygulamasının giriş noktası
│   ├── config.py & database.py # Yapılandırma ve veritabanı ayarları
│   ├── models/                 # Veritabanı modelleri ve Pydantic şemaları
│   ├── routers/                # API Uç noktaları (auth, passwords, breach, score, vb.)
│   └── services/               # İş mantığı (crypto, audit, breach, generator, vb.)
│
├── frontend/
│   ├── index.html & vite.config.js       # Vite ve giriş ayarları
│   ├── package.json & eslint.config.js   # Bağımlılıklar ve Lint kuralları
│   └── src/
│       ├── components/         # Arayüz bileşenleri (Sekmeler, Modal vs.)
│       ├── context/            # React Context (AuthContext)
│       ├── pages/              # Sayfalar (Login, Dashboard)
│       └── services/           # Backend ile iletişim kuran API servisleri (api.js)
```

## Kurulum ve Çalıştırma

### Backend'i Ayağa Kaldırma

Projenin kök dizininde (veya backend dizininde) aşağıdaki adımları sırasıyla uygulayın:

```bash
cd password_security_system

# Python sanal ortamı (virtual environment) oluşturun
python3 -m venv .venv

# Sanal ortamı aktifleştirin (macOS / Linux)
source .venv/bin/activate
# Windows için: .venv\Scripts\activate

# Gerekli bağımlılıkları yükleyin
pip install -r requirements.txt

# FastAPI sunucusunu uvicorn ile başlatın
uvicorn backend.main:app --reload
```
API sunucusu varsayılan olarak `http://localhost:8000` adresinde çalışacak ve interaktif belgelendirme sayfasına `http://localhost:8000/docs` adresinden ulaşılabilecektir.

### Frontend'i Ayağa Kaldırma

Farklı bir terminal sekmesinde/penceresinde aşağıdaki adımları takip edin:

```bash
cd password_security_system/frontend

# Node paketlerini yükleyin
npm install

# Geliştirme (development) sunucusunu başlatın
npm run dev
```
Uygulama arayüzü `http://localhost:5173` adresinde erişime açılacaktır.

