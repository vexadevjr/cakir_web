// Ana sayfa: yan paneller, galeri önizlemesi, Discord rakamları ve yönetim kadrosu
(function () {
    "use strict";

    // ---------- Katlanabilir paneller ----------
    function setupPanel(panelId, openId, closeId) {
        var panel = document.getElementById(panelId);
        var openBtn = document.getElementById(openId);
        var closeBtn = document.getElementById(closeId);
        if (!panel || !openBtn || !closeBtn) return;

        function toggle() {
            var hidden = panel.classList.toggle("panel-hidden");
            openBtn.classList.toggle("btn-visible", hidden);
        }
        closeBtn.addEventListener("click", toggle);
        openBtn.addEventListener("click", toggle);
    }

    setupPanel("galleryPanel", "galleryOpenBtn", "galleryCloseBtn");
    setupPanel("infoPanel", "infoOpenBtn", "infoCloseBtn");

    // ---------- Galeri önizlemesi: tüm görseller ----------
    var grid = document.getElementById("panelGalleryGrid");

    function showGalleryEmpty(text) {
        grid.textContent = "";
        var p = document.createElement("p");
        p.className = "panel-gallery-empty";
        p.textContent = text;
        grid.appendChild(p);
    }

    if (grid) {
        fetch("/api/media")
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (items) {
                if (!items) return; // Varsayılan görseller kalır
                if (!items.length) return showGalleryEmpty("HENÜZ GÖRSEL YOK");

                grid.textContent = "";
                // En yeni görsel başta
                items.slice().reverse().forEach(function (item) {
                    var box = document.createElement("a");
                    box.className = "gallery-preview-box";
                    box.href = "pages/galeri.html";
                    var label = window.I18N ? window.I18N.t(item.title) : item.title;
                    box.title = label;
                    box.setAttribute("aria-label", label);
                    box.style.backgroundImage = "url('" + item.thumb + "')";
                    grid.appendChild(box);
                });
            })
            .catch(function () { /* varsayılan görseller kalır */ });
    }

    // ---------- Discord rakamları ----------
    var statList = document.getElementById("statList");
    var statNote = document.getElementById("statNote");

    var lastStats = null;

    function formatNumber(n) {
        var locale = window.I18N ? window.I18N.locale : "tr-TR";
        return Number(n).toLocaleString(locale);
    }

    function renderStats() {
        if (!statList || !lastStats) return;
        ["activeDrivers", "totalDrivers", "totalMembers"].forEach(function (key) {
            var node = statList.querySelector('[data-stat="' + key + '"]');
            if (!node) return;
            if (lastStats[key] === null || lastStats[key] === undefined) {
                // Çevrimiçi bilgisi alınamıyorsa (canlı bağlantı yoksa) satır gizlenir
                node.parentNode.hidden = true;
            } else {
                node.textContent = formatNumber(lastStats[key]);
            }
        });
    }

    if (statList) {
        fetch("/api/stats")
            .then(function (res) { return res.ok ? res.json() : { available: false }; })
            .then(function (stats) {
                if (!stats.available) {
                    statNote.textContent = "Rakamlar şu an alınamıyor.";
                    return;
                }
                lastStats = stats;
                renderStats();
                statNote.textContent = "Kaynak: Discord sunucumuz";
            })
            .catch(function () { statNote.textContent = "Rakamlar şu an alınamıyor."; });

        // Dil değişince sayılar yeni dilin biçimiyle yazılır (örn. 1.234 / 1,234)
        document.addEventListener("i18n:change", renderStats);
    }

    // ---------- Yönetim kadrosu ----------
    // API'ye ulaşılamazsa gösterilecek varsayılan liste
    var FALLBACK_TEAM = [
        { name: "Çakır", role: "FOUNDER / CEO", color: "#ffffff", avatar: "images/cakir_logo1.png" },
        { name: "Vexa", role: "DEVELOPER", color: "#ff3333", avatar: "images/vexa.png" },
        { name: "Lutzz", role: "MANAGEMENT", color: "#5865F2", avatar: "images/lutz.png" }
    ];

    function buildMember(member, className) {
        var card = document.createElement("div");
        card.className = className;
        // Serbest renk: geçersizse nötr griye düşer; temaya uyarlama js/theme.js içinde yapılır
        card.setAttribute("data-color", window.CakirColor && window.CakirColor.isHex(member.color) ? member.color : "#6b737d");

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
        if (window.CakirTheme) window.CakirTheme.paint();
    }

    renderTeam(FALLBACK_TEAM);
    fetch("/api/team")
        .then(function (res) { return res.ok ? res.json() : []; })
        .then(function (members) { if (members.length) renderTeam(members); })
        .catch(function () { /* varsayılan liste kullanılır */ });
})();
