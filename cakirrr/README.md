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

## Discord entegrasyonu

Tüm Discord verileri sunucu tarafında çekilir; bot anahtarı tarayıcıya hiçbir zaman gönderilmez.

**1. Bot oluşturma:** discord.com/developers/applications adresinde yeni uygulama açın, Bot sekmesinden "Reset Token" ile anahtarı alıp `.env` dosyasına `DISCORD_BOT_TOKEN` olarak yazın.

**2. Yönetim kadrosu profilleri:** Yalnızca anahtar yeterlidir. Yönetim panelindeki "Yönetim Kadrosu" bölümüne Discord ID girildiğinde kullanıcı adı ve profil fotoğrafı otomatik çekilir. Fotoğraflar 6 saatte bir tazelenir; panelden "YENİLE" ile hemen güncellenebilir.

**3. Ana sayfadaki şirket bilgileri (toplam üye, toplam sürücü, aktif sürücü):** Bot bu sefer sunucunuzda bulunmalıdır.
- Developer Portal > OAuth2 > URL Generator bölümünde yalnızca `bot` kapsamını seçip oluşan bağlantıyla botu sunucuya ekleyin. Hiçbir yetki (permission) vermeniz gerekmez.
- Developer Portal > Bot > **Privileged Gateway Intents** altında **Server Members Intent** ve **Presence Intent** seçeneklerini açın. Aktif sürücü sayısı için ikisi de gereklidir.
- `.env` dosyasına `DISCORD_GUILD_ID` (sunucu ID) ve `DISCORD_DRIVER_ROLE_ID` (Driver rolü ID) yazın.
- **Toplam sürücü** = Driver rolündeki üye sayısı. **Aktif sürücü** = Driver rolüne sahip ve şu an çevrimiçi (online, boşta veya rahatsız etmeyin) olan üyeler. **Toplam üye** = sunucudaki tüm üyeler.
- Sayılar canlı olarak güncellenir (üye veya durum değişince birkaç saniye içinde). Bot bağlanamazsa site çökmez; toplam sayılar yedek yöntemle gösterilir ve "Aktif sürücü" satırı gizlenir. Intent'ler kapalıysa sunucu konsolunda bunu söyleyen bir uyarı görürsünüz.
- Sitede yalnızca toplu sayılar yer alır; üyelerin rol ve durum bilgisi hiçbir yerde saklanmaz veya paylaşılmaz.

## Diller ve tema

**Diller:** Türkçe (varsayılan), İngilizce, Almanca, İspanyolca ve Rusça. Menüde Galeri'nin sağındaki dil seçici ile değiştirilir; seçim tarayıcıda hatırlanır. Yönetim paneli yalnızca Türkçedir.

- Çeviriler `public/js/lang/en.js`, `de.js`, `es.js`, `ru.js` dosyalarındadır. Çoğu giriş `"Türkçe kaynak metin": "çeviri"` biçimindedir; sayfadaki Türkçe metni değiştirirseniz sözlükteki anahtarı da aynı şekilde güncelleyin.
- Gizlilik Politikası ve Kullanım Koşulları paragrafları `priv.s1.b1` gibi kimliklerle çevrilir; bu sayfalardaki Türkçe metni değiştirirken tüm dil dosyalarındaki aynı kimliği de güncelleyin.
- Sözlükte karşılığı olmayan metin Türkçe görünür. Galeri başlıkları ve açıklamaları panelden tek dilde girilir; yalnızca örnek (demo) kayıtların çevirisi hazırdır.
- Yeni dil eklemek için `public/js/lang/xx.js` oluşturup `public/js/i18n.js` içindeki `LANGS` listesine ekleyin.

**Tema:** Varsayılan koyu temadır. Dil seçicinin sağındaki düğme koyu/açık temayı değiştirir (koyuyken ay, açıkken güneş simgesi görünür) ve seçim tarayıcıda hatırlanır. Tüm renkler `public/css/global.css` başındaki değişkenlerden gelir; tonları buradan ayarlayabilirsiniz. Yönetim paneli de aynı temayı kullanır.

## Ziyaret istatistikleri ve IP kayıtları

Yönetim panelinde iki yeni sekme vardır:

- **Ziyaret İstatistikleri:** Günlük (son 24 saat), haftalık (7 gün), aylık (30 gün) ve yıllık (12 ay) grafik; her aralık için ziyaret ve tekil ziyaretçi sayıları ile satır satır sayısal tablo.
- **IP Kayıtları:** Yönetim paneline giriş denemeleri (başarılı, hatalı, engellenen; IP, denenen kullanıcı adı, tarayıcı) ve siteyi ziyaret edenlerin IP listesi (ziyaret sayısı, ilk/son ziyaret, son sayfa). Bot olduğu anlaşılanlar işaretlenir.

Ayrıntılar:
- Ziyaret yalnızca ana sayfa, galeri ve resmi sayfaların açılışında sayılır. Yönetici oturumu açıkken yaptığınız gezintiler ve botlar istatistiğe katılmaz. Aynı IP'nin aynı sayfayı 30 saniye içinde yenilemesi tek ziyarettir. Tekil ziyaretçi = tekil IP.
- Kayıtlar `LOG_RETENTION_DAYS` gün (varsayılan 400) sonra MongoDB tarafından otomatik silinir. Bu süreyi değiştirirseniz Gizlilik Politikası'ndaki "400 gün" ifadesini de güncelleyin.
- `STATS_TIMEZONE` grafiklerdeki gün/saat sınırlarını belirler (varsayılan Europe/Istanbul).
- **Önemli:** Nginx, Cloudflare, Render, Railway gibi bir proxy arkasındaysanız `.env` içine `TRUST_PROXY=1` yazın. Aksi halde tüm ziyaretçiler proxy'nin IP'siyle görünür.
- IP adresleri kişisel veridir. Gizlilik Politikası bu kayıtları belirtecek şekilde güncellenmiştir; kayıtlara yalnızca yönetici erişir.

## Klasör yapısı

```
server.js        Uygulama girişi ve güvenlik katmanları
config/          Ortam değişkenleri ve MongoDB bağlantısı
models/          Mongoose modelleri
middleware/      Oturum ve CSRF doğrulaması
routes/          /api/auth, /api/media, /api/team ve /api/stats uç noktaları
services/        Discord API istemcisi, canlı sayım, giriş denetim kaydı
middleware/      Oturum, CSRF ve ziyaret izleme
utils/           Log maskeleme yardımcıları
scripts/         İlk kurulum örnek verisi
public/          Tarayıcıya sunulan site dosyaları (js/lang: çeviriler)
```

Görseller MongoDB içinde saklanır; ayrıca bir dosya klasörüne ihtiyaç yoktur.

## Güvenlik özeti

- Oturum çerezi `httpOnly`, `SameSite=Strict` ve HTTPS'te `__Host-` önekli; oturumlar veritabanında tutulur, çıkış yapınca token anında geçersiz olur.
- Durum değiştiren tüm yönetici isteklerinde CSRF belirteci zorunlu.
- Giriş denemeleri hem IP başına hem genel olarak sınırlandırılır.
- Sıkı Content-Security-Policy, HSTS, Permissions-Policy ve diğer güvenlik başlıkları aktif.
- Hata günlüklerinde şifre, bot anahtarı ve MongoDB kimlik bilgileri maskelenir.
- Yüklenen dosyalar imzasından doğrulanır; yüklenen görseller betik çalıştıramayacak şekilde sunulur.
- Yalnızca `public` klasörü yayınlanır; `.env` dosyasını asla depoya veya başkalarıyla paylaşmayın.
- Bot anahtarı veya şifre sızdığına dair en küçük şüphede: anahtarı Developer Portal'dan yenileyin, `ADMIN_PASSWORD` ve `JWT_SECRET` değerlerini değiştirin (JWT_SECRET değişince tüm oturumlar düşer).
