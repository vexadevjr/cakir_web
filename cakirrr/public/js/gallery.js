// Galeri sayfası: görselleri API'den çeker ve büyük önizleme sunar
(function () {
    var DEFAULT_DESC = "Çakır Company konvoy ve etkinliklerinden bir kare.";
    var grid = document.getElementById("galleryGrid");
    var visor = document.getElementById("imageVisor");
    var visorImg = document.getElementById("visorTargetImg");
    var visorTitle = document.getElementById("visorTargetTitle");
    var visorDesc = document.getElementById("visorTargetDesc");
    var items = [];

    function showState(text) {
        grid.textContent = "";
        var p = document.createElement("p");
        p.className = "gallery-state";
        p.textContent = text;
        grid.appendChild(p);
    }

    // Tüm içerik textContent ile yazılır; kullanıcı verisi HTML olarak yorumlanmaz
    function renderGallery() {
        grid.textContent = "";
        items.forEach(function (item, index) {
            var card = document.createElement("button");
            card.type = "button";
            card.className = "matrix-card";
            card.addEventListener("click", function () { openVisor(index); });

            var img = document.createElement("div");
            img.className = "matrix-img-box";
            img.style.backgroundImage = "url('" + item.thumb + "')";

            var info = document.createElement("div");
            info.className = "matrix-info";

            var title = document.createElement("span");
            title.className = "matrix-title";
            title.textContent = item.title;

            var meta = document.createElement("span");
            meta.className = "matrix-meta";
            meta.textContent = "FOTO #" + String(index + 1).padStart(2, "0");

            info.appendChild(title);
            info.appendChild(meta);
            card.appendChild(img);
            card.appendChild(info);
            grid.appendChild(card);
        });
    }

    function openVisor(index) {
        var item = items[index];
        if (!item) return;
        visorImg.src = item.url;
        visorImg.alt = item.title;
        visorTitle.textContent = item.title;
        visorDesc.textContent = item.description || DEFAULT_DESC;
        visor.classList.add("visor-active");
        visor.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeVisor() {
        visor.classList.remove("visor-active");
        visor.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    document.getElementById("visorClose").addEventListener("click", closeVisor);
    visor.addEventListener("click", function (e) {
        if (e.target === visor) closeVisor();
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && visor.classList.contains("visor-active")) closeVisor();
    });

    fetch("/api/media")
        .then(function (res) {
            if (!res.ok) throw new Error("Sunucu hatası");
            return res.json();
        })
        .then(function (data) {
            items = data;
            if (!items.length) return showState("HENÜZ GÖRSEL EKLENMEDİ.");
            renderGallery();
        })
        .catch(function () {
            showState("GÖRSELLER ŞU AN YÜKLENEMEDİ. LÜTFEN DAHA SONRA TEKRAR DENEYİN.");
        });
})();
