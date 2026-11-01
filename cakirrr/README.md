# Çakır Company Web Sitesi

Node.js + Express + MongoDB ile çalışan TruckersMP VTC sitesi.

## Kurulum

1. Node.js 18 veya üstünü kurun.
2. Bağımlılıkları yükleyin:
   ```
   npm install
   ```
3. `.env.example` dosyasını `.env` olarak kopyalayın ve doldurun:
   - `MONGODB_URI`: MongoDB bağlantı adresiniz (Atlas veya yerel)
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`: yönetim paneli giriş bilgileri
   - `JWT_SECRET`: en az 32 karakterlik rastgele anahtar
     (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
4. Başlatın:
   ```
   npm start
   ```
5. Site: `http://localhost:3000` — Yönetim paneli: `http://localhost:3000/admin`

Yerelde HTTP ile test ederken `.env` içinde `COOKIE_SECURE=false` yapın. Canlıda HTTPS kullanın ve `true` bırakın.
Nginx, Cloudflare, Render, Railway gibi bir proxy arkasındaysanız `TRUST_PROXY=1` ekleyin.

## Discord yönetim profilleri

Yönetim panelindeki "Yönetim Kadrosu" bölümünden bir üyenin Discord ID'sini girdiğinizde kullanıcı adı ve profil fotoğrafı Discord'dan otomatik çekilir ve sitede (Hakkımızda ile şirket profili penceresi) gösterilir.

1. discord.com/developers/applications adresinde yeni bir uygulama oluşturun.
2. Bot sekmesinden "Reset Token" ile anahtarı alıp `.env` dosyasına `DISCORD_BOT_TOKEN` olarak yazın.
3. Botu sunucuya eklemeniz gerekmez; yalnızca herkese açık profil bilgileri okunur.
4. Discord ID'yi almak için Discord'da Ayarlar > Gelişmiş > Geliştirici Modu'nu açın, kişinin profiline sağ tıklayıp "Kullanıcı ID'sini Kopyala" deyin.

Profil fotoğrafları 6 saatte bir kendiliğinden tazelenir; panelden "YENİLE" ile hemen güncelleyebilirsiniz. Anahtar tanımlı değilse üyeler yine isimle eklenebilir.

## Klasör yapısı

```
server.js        Uygulama girişi ve güvenlik katmanları
config/          Ortam değişkenleri ve MongoDB bağlantısı
models/          Mongoose modelleri
middleware/      Oturum ve CSRF doğrulaması
routes/          /api/auth, /api/media ve /api/team uç noktaları
services/        Discord API istemcisi
scripts/         İlk kurulum örnek verisi
public/          Tarayıcıya sunulan site dosyaları
```

Görseller MongoDB içinde saklanır; ayrıca bir dosya klasörüne ihtiyaç yoktur.
