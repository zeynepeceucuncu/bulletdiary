# Yaprak

## iPad için PWA (Xcode gerektirmez)

Web sürümü React/Vite üstünde çalışır ve `frontend/public/manifest.webmanifest` ile ana ekrana eklenebilir.
`npm run build:pwa` statik dosyaları `dist/` altına derler ve sürümlü service worker üretir.
HTTPS altında Safari > Paylaş > Ana Ekrana Ekle ile yükleyebilirsin. Ücretsiz Apple geliştirici sertifikasının yedi günlük imza süresi web sürümüne uygulanmaz.

GitHub Pages yayınlaması için GitHub deposunda **Settings > Pages > Build and deployment > Source: GitHub Actions** seç.
`main` dalındaki `Publish Yaprak web app` workflow'u statik uygulamayı yayımlar.
Web uygulamasını internete çıkarmak **verileri internete yüklemek değildir**: Günlük ve çizimler cihazın IndexedDB veritabanında kalır.
Farklı uygulama yüklemeleri / tarayıcı profilleri veri paylaşmaz. Bu kayıtlar site verileri silindiğinde veya tarayıcı tarafından temizlendiğinde kaybolabilir.
Site adresi değiştirilirse eski IndexedDB içeriği yeni adrese taşınmaz.

**Yeni sürüme geçmeden önce** mevcut iPad uygulamasında **Defter yedeği > Dosyaya aktar** ile
`yaprak-defter.json` dosyasını iCloud Drive'a kaydet; yeni web uygulamasında
**Defter yedeği > Dosyadan içe aktar** ile geri yükle.
Fotoğraf, ses ve el yazısı da yedek dosyasına dahildir. Dosya şifrelenmemiştir;
özel içerikler için yedek dosyasını ve iCloud hesabını koru.

Tarayıcıdaki kayıtlar otomatik bulut senkronizasyonu **değildir**. Sürekli yedekleme için ayrıca güvenli
bir servis kurulması gerekir. Mevcut backend otomatik senkronizasyon değil, elle alınan sürümlü yedekler sağlar.
Üretim ortamında HTTPS, kimlik doğrulama, gizlilik ve yedek geri yükleme ayrıca doğrulanmalıdır.

Türkçe dijital ajanda ve günlük. Bir tarihe birden fazla günlük, yapılacaklar listesi veya hatırlatma sayfası eklenebilir. Metin, fotoğraf, ses kaydı, müzik dosyası, şarkı bağlantısı, sticker ve alıntılar desteklenir.

## Mac üzerinde iPhone sürümünü aç

Mac üzerinde Xcode ve Node.js 22 kurulu olmalı. Önce Xcode’u açıp iOS Simulator bileşenini yükle. Proje klasöründen çalıştır:

```sh
cd frontend
npm install
npm run ios:open
```

Bu komut Vite arayüzünü derler, Capacitor ile ilk kullanımda `ios/App/App.xcodeproj` üretir, mikrofon ve fotoğraf izin metinlerini ekler ve Xcode’u açar. Xcode’da bir iPhone simülatörü seçip ▶ düğmesine bas. Kendi iPhone’una kurmak için App hedefinin Signing & Capabilities bölümünde kendi Team hesabını seç. Bundle ID başka bir hesaba aitse hem Xcode’daki Bundle Identifier’ı hem de `capacitor.config.json` içindeki appId’yi sana ait bir değerle değiştir. Arayüz değişikliğinden sonra `npm run ios:prepare` komutunu yeniden çalıştır. Tarayıcıda geliştirmek için `npm run dev` kullan.

## Backend ve veritabanı

Backend tek kişilik, sürümlü defter yedekleri sunar. Normal düzenlemeler cihazdaki IndexedDB’ye kaydedilir. Defter yedeği ekranından manuel yedek gönderilir veya alınır. Her gönderim yeni bir kayıt oluşturur. Geri yükleme sırasında aynı kimlikteki yerel sayfalar atlanır. Bu işlem iki cihazdaki değişiklikleri birleştirmez. Fotoğraf ve sesler JSON dosyasına dahil edilir. Sunucu yedek başına 32 MiB kabul eder. JSON yedeği şifrelenmemiştir.

Docker Desktop çalışırken proje kökünde, ilk kurulumda:

```sh
(umask 077; set -C; { echo "POSTGRES_PASSWORD=$(openssl rand -hex 32)"; echo "YAPRAK_TOKEN=$(openssl rand -hex 32)"; } > .env)
docker compose up -d --build
```

PostgreSQL verileri Docker volume içinde kalır. `docker compose down` servisleri durdurur. Sunucu Docker tarafından Mac’in yalnızca loopback adresine bağlanır. Mac tarayıcısında frontend’i `http://localhost:5173` adresinden aç. Defter yedeği ekranında adres olarak `http://localhost:8080`, anahtar olarak yerel .env dosyandaki YAPRAK_TOKEN değerini kullan. Fiziksel iPhone için erişilebilir bir sunucuda API’yi çalıştır ve HTTPS reverse proxy adresini gir. Telefonda localhost telefonun kendisidir. Anahtar uygulama paketine gömülmez ve panel kapatıldığında bellekten temizlenir. Bu anahtarı alan kişi tüm sunucu yedeklerine erişebilir.

## Eski web defterini taşı

Yeni iOS kurulumu boş başlar. Eski prototipin açık olduğu aynı tarayıcı profili ve aynı site adresinde geliştirici konsoluna bu projenin `frontend/public/export-notebook.js` içeriğini gir. Ardından şu kodu çalıştır:

```js
const file = await exportYaprakNotebook();
const href = URL.createObjectURL(file);
const a = document.createElement('a');
a.href = href;
a.download = 'yaprak-defter.json';
a.click();
setTimeout(() => URL.revokeObjectURL(href), 60000);
```

Dosyayı AirDrop veya Dosyalar ile iPhone’a aktar ve Yaprak içinden **Defter yedeği → Dosyadan içe aktar** seç. Yeni uygulamada **Dosyaya aktar** ile sonraki yedeklerini doğrudan alabilirsin.

## Kaynak ve doğrulama

- `frontend/` mevcut günlük editörünü, React/TypeScript yedekleme ekranını, Vite ayarlarını ve iOS proje hazırlama komutunu içerir.
- `backend/` Java 21, Spring Boot ve PostgreSQL ile çalışan API’yi içerir.
- `.github/workflows/check.yml` GitHub Actions etkinse yüklemeden sonra imzasız simülatör derlemesini, yetkisiz istek reddini ve PostgreSQL yedekleme/okuma akışını sınar.

## El yazısı

Günlük ve her iki ajanda şablonunda **El yazısı ekle** düğmesi bulunur. Her sayfaya birden fazla alan ekleyebilirsin. Kalem, renk, üç kalınlık, silgi, geri alma ve yineleme araçları alanın üstündedir. Silgi geçtiği bölgedeki mürekkebi kaldırır. Silme de geri alınabilir.

Varsayılan olarak kalem ve fare girişleri kabul edilir. Parmak ve avuç temasının çizgi üretmemesi için **Parmakla çiz** kapalı başlar. Sayfayı kaydırmak için çizim alanının dışını kullan. Yazı karaktere dönüştürülmeden çizgiler halinde tutulur. Alan yeniden boyutlandığında veya tablet çevrildiğinde aynı koordinatlar kullanılır. Tamamlanan çizgiler cihazdaki deftere kaydedilir ve yedeklere dahil edilir. Geri alma geçmişi o alan açıkken kullanılabilir; kayıtlı son çizgiler yeniden açıldıktan sonra da geri alınabilir.

Hedef cihaz iPad 6. nesil, iPadOS 17.7.11 ve Apple Pencil 1. nesildir. Bu donanımda çizim gecikmesi, avuç teması ve uygulama yaşam döngüsü gerçek cihaz testi gerektirir. Cihazda test yapılmadı.
