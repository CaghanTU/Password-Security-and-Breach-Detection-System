# Password Security System Proje İnceleme Raporu

## 1. Giriş

Bu rapor, `Password Security System` isimli projenin kaynak kodu incelenerek hazırlanmıştır. Proje; kullanıcıların parolalarını güvenli biçimde saklamayı, parola kalitesini ölçmeyi, veri ihlali risklerini takip etmeyi ve kullanıcıya aksiyon önerileri sunmayı amaçlayan bütünleşik bir güvenlik uygulamasıdır. İnceleme sırasında hem backend hem de frontend katmanı değerlendirilmiş, sistemin mimarisi, temel işlevleri, güvenlik yaklaşımı, güçlü yönleri ve geliştirilebilecek tarafları analiz edilmiştir.

Projenin ders kapsamında değerli tarafı, yalnızca bir “parola saklama aracı” olmaması; aynı zamanda risk skoru, ihlal takibi, 2FA yönetimi, denetim kayıtları, dış servis entegrasyonu, yapay zeka destekli güvenlik yorumları ve rapor üretimi gibi birçok güvenlik bileşenini tek bir uygulamada birleştirmesidir. Bu nedenle proje, yazılım güvenliği, güvenli kimlik doğrulama, karar destek sistemleri ve uygulama mimarisi açısından incelenmeye uygundur.

## 2. Projenin Amacı ve Kapsamı

Projenin temel amacı, kullanıcıların farklı platformlara ait hesap bilgilerini merkezi bir kasada yönetebilmesini sağlarken bu kayıtların güvenlik durumunu sürekli analiz etmektir. Uygulama; parolaları şifreli biçimde saklar, zayıf ya da tekrar kullanılan parolaları tespit eder, bilinen veri ihlallerini kontrol eder ve genel güvenlik durumunu tek bir risk skoru üzerinden kullanıcıya sunar.

Kod incelemesine göre sistemin başlıca kapsamı şunlardır:

- Kullanıcı kaydı ve oturum açma
- Zorunlu iki faktörlü kimlik doğrulama
- Şifrelenmiş parola kasası yönetimi
- Güçlü parola üretimi
- Parola gücü ve tekrar kullanım analizi
- Veri ihlali kontrolü
- Risk skoru hesaplama ve geçmiş takibi
- Denetim kayıtları
- Veri içe aktarma ve dışa aktarma
- PDF güvenlik raporu üretimi
- Yapay zeka destekli güvenlik tavsiyeleri
- AI destekli içgörü, kısa vadeli aksiyon planı ve senaryo üretimi

Bu yönüyle proje, güvenlik odaklı bir tam yığın web uygulaması olarak değerlendirilebilir.

## 3. Kullanılan Teknolojiler

Kaynak dosyalara göre proje iki ana katmandan oluşmaktadır:

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- Argon2
- Cryptography AES-GCM
- `python-jose` ile JWT
- `pyotp` ile TOTP tabanlı 2FA
- `requests` ile dış API çağrıları
- `apscheduler` ile zamanlanmış görev
- `reportlab` ile PDF üretimi
- OpenAI uyumlu API üzerinden AI tavsiye katmanı

### Frontend

- React
- Vite
- Material UI
- React Router
- Context API
- Chart.js

Teknoloji seçimi genel olarak moderndir ve eğitim amaçlı bir güvenlik projesi için uygundur. Backend tarafında FastAPI ile modüler ve okunabilir bir API yapısı kurulmuş, frontend tarafında ise sekmeli bir kontrol paneli mantığı benimsenmiştir.

## 4. Genel Mimari Yapı

Kod organizasyonu incelendiğinde proje katmanlı ve modüler bir mimari kullanmaktadır. Backend tarafında `routers`, `services`, `models`, `database`, `config` gibi ayrımlar yapılmıştır. Bu ayrım, API uç noktaları ile iş mantığının birbirinden ayrılmasını sağlamakta ve bakım kolaylığı oluşturmaktadır.

### Mimari bileşenler

- `backend/main.py`: Uygulamanın başlangıç noktasıdır. Router kayıtları, CORS ayarları, rate limiting ve scheduler başlatma burada yapılır.
- `backend/database.py`: Veritabanı bağlantısı ve ORM modelleri burada tanımlanır.
- `backend/routers/`: Uygulamanın HTTP uç noktalarını içerir.
- `backend/services/`: Asıl iş kuralları burada bulunur.
- `frontend/src/pages/` ve `frontend/src/components/`: Kullanıcı arayüzünü oluşturan katmandır.

Bu yapı, ders kapsamında “katmanlı yazılım mimarisi” örneği olarak rahatlıkla anlatılabilir. Özellikle servis katmanının kullanılması, iş mantığının route fonksiyonlarına gömülmemesi açısından olumlu bir tercihtir.

Bu mimaride dikkat çeken ek bir katman da `ai_advisor_service.py` ile kurulan yapay zeka destekli yorumlama katmanıdır. Sistem önce yerel olarak ölçülebilen risk metriklerini hesaplamakta, ardından bu metrikleri daha okunabilir ve kullanıcıyı harekete geçiren bir dile dönüştürmektedir. Yani AI burada çekirdek güvenlik mantığının yerine geçen bir yapı değil, çekirdek güvenlik mantığını açıklayan ve önceliklendiren bir katman olarak konumlandırılmıştır.

## 5. Backend İncelemesi

### 5.1 Kimlik Doğrulama ve Oturum Yönetimi

Kimlik doğrulama süreci `auth.py` ve `auth_service.py` dosyalarında yönetilmektedir. Kullanıcı kaydı sırasında ana parola düz metin olarak saklanmaz; bunun yerine Argon2id ile özetlenmiş parola saklanır. Bu, modern parola saklama yaklaşımlarıyla uyumludur. Ayrıca kullanıcı için ayrı bir `kdf_salt` üretilmekte ve bu tuz, kasadaki verileri şifrelemek için türetilen anahtarın oluşturulmasında kullanılmaktadır.

Giriş sürecinde:

- Kullanıcı adı ve ana parola doğrulanır.
- TOTP kodu veya kurtarma kodu zorunlu tutulur.
- Başarısız giriş denemeleri sayılır.
- Belirli sayıda hatalı denemeden sonra hesap geçici olarak kilitlenir.
- Başarılı girişten sonra JWT üretilir.
- Asıl şifreleme anahtarı bellekte `KEY_STORE` adlı yapıda oturum bazlı tutulur.

Bu tasarım eğitim açısından oldukça öğreticidir; çünkü proje yalnızca JWT kullanan basit bir oturum yönetimi yapmamakta, aynı zamanda veritabanındaki şifreli verilerin açılması için ayrı bir oturum içi anahtar yönetimi de kurmaktadır.

### 5.2 Kriptografi Yaklaşımı

`crypto_service.py` dosyasına göre sistem iki farklı güvenlik ihtiyacını ayrı ele almıştır:

- Kimlik doğrulama için Argon2id parola özeti
- Veri gizliliği için AES-256-GCM şifreleme

Bu ayrım önemlidir. Çünkü kullanıcı parolası ile sisteme giriş doğrulanırken, kasa içindeki kayıtlar başka bir anahtar türetme süreciyle korunmaktadır. Ayrıca AES-GCM kullanımı sayesinde sadece gizlilik değil, bütünlük doğrulaması da sağlanmaktadır. GCM etiketi ayrıca saklanarak eğitim amacıyla daha görünür bir yapı kurulmuştur.

Parola tekrar kullanım tespiti için SHA-256 tabanlı `reuse_hash` tutulmaktadır. Bu alan, aynı kullanıcıya ait kayıtlar arasında tekrar kullanılan parolaları bulmak için kullanılır. Düz metin parola saklanmadığı için bu yöntem mantıklıdır. Ancak yine de benzerlik analizi yapılabilmesi için mevcut kayıtlar servis katmanında çözülerek karşılaştırılmaktadır.

### 5.3 Parola Kasası Yönetimi

`password_service.py` dosyası sistemin en kritik servislerinden biridir. Yeni kayıt ekleme sırasında aşağıdaki kontroller yapılmaktadır:

- Aynı parolanın başka kayıtta kullanılıp kullanılmadığı
- Yeni parolanın mevcut parolalara çok benzer olup olmadığı
- Parola gücü sınıflandırması
- Kullanıcı adı ve parolanın şifrelenmesi
- Olası ihlal ve e-posta ihlal kontrolü
- Denetim kaydı oluşturulması

Bu servis, yalnızca CRUD mantığıyla çalışan bir parola kayıt modülü değildir; güvenlik farkındalığı oluşturan aktif bir denetleyici gibi davranmaktadır. Özellikle parola geçmişi takibi ve benzer parola kullanımının engellenmesi ders kapsamında vurgulanabilecek güçlü yönlerdendir.

### 5.4 Parola Gücü Ölçümü

`strength_service.py` dosyasında `zxcvbn` tabanlı bir güç analizi kullanılmaktadır. Bu analizde sadece uzunluk veya karakter çeşitliliği değerlendirilmemekte; site adı ve kullanıcı adı gibi bağlamsal bilgiler de hesaba katılmaktadır. Örneğin kullanıcı adı veya site adıyla ilişkili parolalar zayıf olarak sınıflandırılabilir.

Bu yaklaşım, klasik “8 karakter + rakam + özel karakter” mantığından daha gelişmiş ve gerçek hayata daha yakın bir güvenlik değerlendirmesi sunmaktadır.

### 5.5 İhlal Kontrolü

`breach_service.py` dosyasına göre sistem iki tür ihlal kontrolü yapmaktadır:

1. Parola ihlali kontrolü
2. E-posta/hesap ihlali kontrolü

Parola ihlali kontrolünde Have I Been Pwned’in k-anonimlik tabanlı `range` API yaklaşımı kullanılmaktadır. Bu iyi bir tercihtir; çünkü düz metin parola dış servise gönderilmez, yalnızca SHA-1 özetinin ilk 5 karakteri paylaşılır.

E-posta ihlali kontrolünde ise HIBP’nin hesap ihlali API’si kullanılmaktadır. Sonuçlar veritabanında önbelleğe alınmakta ve tekrar çağrılar azaltılmaktadır. Ayrıca ihlal tarihi ile kullanıcının parola güncelleme tarihi kıyaslanarak “ihlal sonrası parola değiştirilmiş mi” sorusuna cevap verilmektedir. Bu özellik projenin sadece ihlal tespit eden değil, ihlal sonrası durum analizi yapan bir yapıda olduğunu göstermektedir.

### 5.6 Risk Skorlama Sistemi

`scoring_service.py` projenin en ayırt edici modüllerinden biridir. Skor hesaplaması sabit ceza puanı toplama mantığıyla değil, oran temelli normalize edilmiş bir modelle yapılmaktadır. Zayıf parola oranı, tekrar kullanım oranı, ihlal oranı, eski parola oranı ve benzeri ölçütler ağırlıklandırılarak 0-100 arası bir skor üretilmektedir.

Ayrıca:

- TOTP etkin kayıtlar için bonus verilmektedir.
- Benzersiz parola oranı da olumlu katkı sağlamaktadır.
- Skor geçmişi tutulmaktadır.
- Aynı skor tekrar ediyorsa geçmiş yazımı sınırlandırılmaktadır.

Bu yapı ders açısından oldukça başarılıdır; çünkü öğrenciye “güvenlik skoru nasıl tasarlanır” sorusuna sadece teorik değil, uygulanmış bir cevap sunmaktadır.

### 5.7 Aksiyon Merkezi

`action_service.py` incelendiğinde sistem sadece sorunları listelemekle kalmamaktadır; bu sorunları önem derecesine göre sıralayarak kullanıcıya yapılacaklar listesi sunmaktadır. Örneğin:

- Açık ihlal vakaları
- Zayıf parolalar
- Tekrar kullanılan parolalar
- Uzun süredir değiştirilmeyen parolalar
- Azalan kurtarma kodları
- TOTP önerileri

Bu modül, projeyi pasif raporlama sisteminden çıkarıp karar destek sistemine yaklaştırmaktadır. Eğitim bağlamında bu modül, “tespit” ile “iyileştirme önerisi” arasındaki farkı göstermesi açısından değerlidir.

### 5.8 AI Advisor ve AI Insights Katmanı

Projede yapay zeka ile ilgili kısım yüzeysel bir eklenti değildir; `ai_advisor_service.py` üzerinden sistemin birkaç farklı noktasına entegre edilmiştir. Kod incelemesine göre bu servis:

- Genel güvenlik özeti üretir
- Risk duruşunu doğal dilde açıklar
- “Neden şimdi müdahale edilmeli?” sorusuna cevap üretir
- İlk yapılması gereken aksiyonu önerir
- 48 saatlik kısa vadeli plan oluşturur
- “Şu adım atılırsa ne olur?” türünde what-if senaryoları üretir
- Haftalık özet hazırlar
- Riskli hesaplar için hesap bazlı yorum yazar

Bu katman, dashboard üzerinde görülen AI summary kartlarını beslediği gibi, PDF rapor üretiminde de kullanılmaktadır. Yani AI çıktıları yalnızca ekranda görülen kısa bir metinden ibaret değildir; sistemin raporlama ve karar destek akışına da dahil edilmiştir.

Burada önemli bir tasarım tercihi vardır: AI katmanı zorunlu değildir. Koddan görüldüğü üzere AI servisi başarısız olursa sistem tamamen bozulmamakta, bunun yerine aynı risk verilerinden deterministik özetler üretilmektedir. Bu yaklaşım güvenlik projeleri için oldukça doğrudur; çünkü yorumlama katmanı devre dışı kalsa bile temel güvenlik işlevleri çalışmaya devam etmektedir.

### 5.9 Dışa Aktarma, İçe Aktarma ve Raporlama

Proje, kullanıcı kasasını JSON olarak serileştirip tekrar AES-GCM ile şifreleyerek dışa aktarabilmektedir. Bu tasarım olumlu bir tercihtir; çünkü dışa aktarma sırasında düz metin verinin diske yazılmaması hedeflenmiştir.

Ayrıca:

- CSV/JSON tabanlı içe aktarma desteği vardır.
- Farklı parola yöneticilerinden veri alma mantığı eklenmiştir.
- PDF rapor üretimi bulunmaktadır.
- PDF çıktısına AI destekli içgörü ve tavsiyeler eklenebilmektedir.

Bu özellikler projenin yalnızca laboratuvar düzeyinde değil, kullanıcı deneyimi ve operasyonel ihtiyaçlar düşünülerek tasarlandığını göstermektedir.

## 6. Frontend İncelemesi

Frontend tarafı React ve Material UI ile hazırlanmıştır. `DashboardPage.jsx` dosyasına bakıldığında uygulamanın sekmeli bir güvenlik paneli şeklinde tasarlandığı görülmektedir. Bu panelde aşağıdaki bölümler yer almaktadır:

- Actions
- Vault
- Scan
- Generator
- Score
- Transfer
- Audit
- 2FA

Arayüzün amacı kullanıcıya teknik detayları doğrudan yüklemek yerine güvenlik durumunu okunabilir başlıklar ve metrikler ile göstermektir. Ana ekranda mevcut skor, kritik bulgular, açık aksiyonlar ve çözülmemiş takip vakaları özetlenmektedir.

`frontend/src/services/api.js` dosyasına göre istemci tarafında JWT elle tutulmamakta, bunun yerine `HttpOnly` cookie yaklaşımı kullanılmaktadır. Bu tercih XSS kaynaklı token sızıntı riskini azaltması bakımından doğrudur.

Frontend tarafında AI özeti yalnızca tek bir bileşende saklı değildir. Skor sekmesi, aksiyon merkezi, parola inceleme ekranı ve rapor üretim akışında AI destekli veriler kullanılmaktadır. `AIAdvisorCard.jsx` bileşeni, teknik güvenlik çıktılarının kullanıcı dostu ve okunabilir bir özet halinde sunulmasını sağlamaktadır. Bu, projenin kullanıcı deneyimi açısından güçlü yönlerinden biridir; çünkü ham güvenlik verisini anlaşılır karar metinlerine dönüştürmektedir.

Genel olarak frontend:

- İşlevsel
- Bileşen temelli
- Kullanıcıyı güvenlik aksiyonlarına yönlendiren
- Yönetim paneli mantığında çalışan

bir yapıya sahiptir.

## 7. Güvenlik Açısından Güçlü Yönler

Kod incelemesine dayanarak projenin öne çıkan güçlü yanları şunlardır:

### 7.1 Modern parola koruma yaklaşımı

Argon2id kullanımı, düz SHA-256 veya zayıf hash yöntemlerine göre çok daha güçlü bir tercihtir.

### 7.2 Uçtan uca düşünülmüş veri koruması

Kimlik doğrulama özeti ile veri şifreleme anahtarının birbirinden ayrılması önemli bir mimari artıdır.

### 7.3 AES-256-GCM kullanımı

Bu tercih, hem gizlilik hem veri bütünlüğü sağladığı için güçlüdür.

### 7.4 Zorunlu 2FA yapısı

Sistemde 2FA isteğe bağlı bir eklenti değil, ana doğrulama akışının parçasıdır.

### 7.5 Hesap kilitleme mekanizması

Brute-force denemelerine karşı belirli sayıda hatadan sonra geçici kilit uygulanmaktadır.

### 7.6 K-anonim parola ihlali kontrolü

Parolanın düz metin olarak dış servise gitmemesi, mahremiyet açısından iyi bir uygulamadır.

### 7.7 Denetim kayıtları

Güvenlik olaylarının kayıt altına alınması, izlenebilirlik ve olay analizi için önemlidir.

### 7.8 Risk skoru ve aksiyon önerileri

Sistem yalnızca veri saklamamakta, güvenlik durumunu ölçmekte ve kullanıcıyı yönlendirmektedir.

### 7.9 AI destekli açıklama katmanı

Sistemdeki AI bölümü güvenlik motorunun yerine geçmemekte, onun çıktısını yorumlamaktadır. Bu mimari doğru bir tercihtir; çünkü kritik kararın temeli hesaplanabilir metriklerde kalırken, AI kullanıcıya daha anlaşılır özetler ve önceliklendirme sunmaktadır.

## 8. Tespit Edilen Sınırlılıklar ve Geliştirme Önerileri

Proje genel olarak başarılı olsa da ders raporunda eleştirel değerlendirme yapılması daha değerlidir. Kod incelemesine göre aşağıdaki noktalar geliştirilebilir:

### 8.1 Oturum anahtarlarının yalnızca bellekte tutulması

`KEY_STORE` adlı yapı sunucu belleğinde tutulmaktadır. Bu, geliştirme ortamı için anlaşılırdır; ancak sunucu yeniden başladığında tüm oturumlar düşer ve çoklu sunucu mimarisinde ölçeklenmesi zorlaşır. Üretim ortamında Redis benzeri merkezi bir oturum/anahtar yönetimi tercih edilebilir.

### 8.2 Varsayılan gizli anahtar riski

`config.py` içinde `JWT_SECRET` için varsayılan bir değer tanımlanmıştır. Bu değer geliştirme için pratik olsa da üretimde ortam değişkeni zorunlu hale getirilmelidir. Aksi halde yanlış yapılandırma ciddi güvenlik zafiyeti oluşturabilir.

### 8.3 Test altyapısının görünmemesi

Depo içinde belirgin bir `tests` yapısı görülmemiştir. Bu durum, proje özellik açısından güçlü olsa da otomatik doğrulama tarafının zayıf kaldığını düşündürmektedir. Birim testler ve entegrasyon testleri eklenmesi kaliteyi artıracaktır.

### 8.4 Veritabanı migrasyon yönetimi

Şema güncellemeleri için `create_all` ve manuel kolon ekleme yaklaşımı kullanılmıştır. Bu yöntem küçük projelerde işe yarasa da üretim ölçeğinde Alembic gibi migration araçları tercih edilmelidir.

### 8.5 E-posta ihlali sorgularında dış servis bağımlılığı

Parola ihlali kontrolü mahremiyet odaklı tasarlanmışken e-posta ihlali sorgusunda e-posta adresi dış servise gönderilmektedir. Bu, işlevsel olarak gerekli olabilir; ancak raporda “mahremiyet-fayda dengesi” olarak tartışılmalıdır.

### 8.6 AI çıktılarının doğrulanması ihtiyacı

AI katmanı yararlı bir anlatım ve önceliklendirme desteği sağlasa da bu tür sistemlerde model çıktılarının tamamen sorgusuz kabul edilmesi doğru değildir. Projede iyi olan taraf, AI katmanının ham veriyi üretmemesi; ancak yine de üretim ortamında çıktıların daha sıkı şema kontrolleri, loglama ve kalite değerlendirmeleriyle izlenmesi faydalı olacaktır.

### 8.7 Frontend paket boyutu

Üretim derlemesinde tek JavaScript paketi yaklaşık 821 kB olarak üretilmiştir ve Vite büyük paket uyarısı vermektedir. Kod bölme ve lazy loading ile performans iyileştirilebilir.

### 8.8 Veritabanı varsayılanı

Varsayılan yapı SQLite tabanlıdır. Eğitim ve demo amaçlı kullanım için yeterlidir; ancak çok kullanıcılı ve yüksek eşzamanlı üretim senaryolarında daha güçlü bir veritabanı tercih edilmelidir.

## 9. Ders Açısından Değerlendirme

Bu proje ders kapsamında şu nedenlerle başarılı bir örnek olarak değerlendirilebilir:

- Gerçek bir güvenlik problemini ele alır.
- Sadece teorik değil, uygulanmış güvenlik mekanizmaları içerir.
- Backend ve frontend katmanları birlikte çalışır.
- Yapay zeka ile klasik güvenlik analizi birleştirilmiştir.
- Kriptografi, kimlik doğrulama, audit, ihlal takibi ve raporlama gibi farklı konuları bir araya getirir.
- Modüler yapısı sayesinde okunabilir ve anlatılabilir bir mimariye sahiptir.

Akademik açıdan proje, “güvenli parola yönetim sistemi” başlıklı bir dönem projesi veya yazılım güvenliği dersi uygulaması için uygundur. Özellikle skor hesaplama modeli, 2FA zorunluluğu ve aksiyon merkezi gibi parçalar projeyi sıradan bir CRUD uygulamasından ayırmaktadır.

Ayrıca AI advisor ve AI insights modülleri, projeye güncel yazılım eğilimleri açısından da değer katmaktadır. Bu kısım sayesinde proje sadece güvenlik verisi toplayan bir sistem değil, toplanan veriyi yorumlayan ve kullanıcıya yol gösteren bir karar destek uygulamasına dönüşmektedir.

## 10. Doğrulama ve İnceleme Notları

Kod incelemesine ek olarak temel düzeyde iki doğrulama yapılmıştır:

- Backend için `python3 -m compileall backend` komutu çalıştırılmış ve sözdizimsel derleme hatası görülmemiştir.
- Frontend için `npm run build` komutu çalıştırılmış ve üretim derlemesi başarıyla alınmıştır.

Frontend derlemesinde büyük bundle boyutuna ilişkin uyarı görülmüştür; bu hata değil, performans iyileştirme önerisidir.

Ayrıca depo içinde görünür bir otomatik test klasörü tespit edilmemiştir. Bu nedenle rapordaki değerlendirme ağırlıklı olarak kaynak kod incelemesi ve temel derleme doğrulamasına dayanmaktadır.

## 11. Sonuç

Sonuç olarak `Password Security System`, güvenlik odaklı yazılım geliştirme prensiplerini önemli ölçüde yansıtan, kapsamlı ve ders düzeyinde anlatı değeri yüksek bir projedir. Proje; parola saklama, kriptografik koruma, ihlal analizi, 2FA, risk skorlama, audit kayıtları, yapay zeka destekli güvenlik yorumları ve raporlama gibi güvenlik açısından anlamlı bileşenleri tek sistem içinde toplamaktadır.

En güçlü tarafı, kullanıcıyı sadece veri saklamaya değil, güvenlik durumunu anlamaya ve iyileştirmeye yönlendirmesidir. Risk skoru, aksiyon merkezi, AI advisor katmanı ve ihlal sonrası takip mantığı bu açıdan özellikle başarılıdır. Buna karşılık test altyapısı, migrasyon yönetimi, bundle optimizasyonu ve üretim ortamı hazırlığı gibi alanlarda geliştirme fırsatları bulunmaktadır.

Genel değerlendirme olarak bu proje, ders teslimi için hem teknik içeriği güçlü hem de savunulabilir mimari kararlar içeren başarılı bir çalışma niteliğindedir.
