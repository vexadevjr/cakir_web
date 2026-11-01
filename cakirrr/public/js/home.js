// Ana sayfa: galeri paneli ve son görsellerin yüklenmesi
(function () {
    var panel = document.getElementById("galleryPanel");
    var openBtn = document.getElementById("galleryOpenBtn");
    var closeBtn = document.getElementById("galleryCloseBtn");

    function togglePanel() {
        var hidden = panel.classList.toggle("panel-hidden");
        openBtn.classList.toggle("btn-visible", hidden);
    }

    if (panel && openBtn && closeBtn) {
        closeBtn.addEventListener("click", togglePanel);
        openBtn.addEventListener("click", togglePanel);
    }

    // Panelde son 3 görseli göster; sunucuya ulaşılamazsa varsayılan görsel kalır
    var grid = document.getElementById("panelGalleryGrid");
    if (!grid) return;

    fetch("/api/media")
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (items) {
            var boxes = grid.querySelectorAll(".gallery-preview-box");
            items.slice(-3).reverse().forEach(function (item, i) {
                if (boxes[i]) boxes[i].style.backgroundImage = "url('" + item.url + "')";
            });
        })
        .catch(function () { /* varsayılan görsel kullanılır */ });

    // ---------- Yönetim kadrosu ----------
    // API'ye ulaşılamazsa gösterilecek varsayılan liste
    var FALLBACK_TEAM = [
        { name: "Çakır", role: "FOUNDER / CEO", tone: "ceo", avatar: "images/cakir_logo1.png" },
        { name: "Vexa", role: "DEVELOPER", tone: "dev", avatar: "images/vexa.png" },
        { name: "Lutzz", role: "MANAGEMENT", tone: "mgmt", avatar: "images/lutz.png" }
    ];
    var TONES = ["ceo", "dev", "mgmt", "staff"];

    function buildMember(member, className) {
        var tone = TONES.indexOf(member.tone) === -1 ? "staff" : member.tone;
        var card = document.createElement("div");
        card.className = className + " card-" + tone;

        var img = document.createElement("img");
        img.className = "discord-avatar";
        img.alt = member.name;
        img.loading = "lazy";
        img.referrerPolicy = "no-referrer";
        img.src = member.avatar;
        // Discord görseli yüklenemezse şirket logosu gösterilir
        img.addEventListener("error", function () {
            img.onerror = null;
            img.src = "images/cakir_logo1.png";
        });

        var info = document.createElement("div");
        info.className = "discord-user-info";
        var name = document.createElement("span");
        name.className = "discord-name";
        name.textContent = member.name;
        var role = document.createElement("span");
        role.className = "discord-role";
        role.textContent = member.role;
        info.appendChild(name);
        info.appendChild(role);

        card.appendChild(img);
        card.appendChild(info);
        return card;
    }

    function renderTeam(members) {
        var modalTeam = document.getElementById("modalTeam");
        var teamGrid = document.getElementById("teamGrid");
        if (modalTeam) {
            modalTeam.querySelectorAll(".discord-profile-card").forEach(function (n) { n.remove(); });
            members.forEach(function (m) { modalTeam.appendChild(buildMember(m, "discord-profile-card")); });
        }
        if (teamGrid) {
            teamGrid.textContent = "";
            members.forEach(function (m) { teamGrid.appendChild(buildMember(m, "team-card")); });
        }
    }

    renderTeam(FALLBACK_TEAM);
    fetch("/api/team")
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (members) { if (members.length) renderTeam(members); })
        .catch(function () { /* varsayılan liste kullanılır */ });
})();
