# Yaprak

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
