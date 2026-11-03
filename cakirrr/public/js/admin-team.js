// Yönetim paneli: yönetim kadrosu (Discord profilleri ve serbest renk)
(function () {
    "use strict";

    var PRESETS = [
        { name: "Beyaz", value: "#ffffff" }, { name: "Gri", value: "#9aa1a9" }, { name: "Kırmızı", value: "#ff3333" },
        { name: "Turuncu", value: "#ff8a3d" }, { name: "Altın", value: "#f5c542" }, { name: "Yeşil", value: "#3ddc84" },
        { name: "Turkuaz", value: "#2dd4bf" }, { name: "Mavi", value: "#5865f2" }, { name: "Mor", value: "#a855f7" },
        { name: "Pembe", value: "#ec4899" }
    ];
    var DEFAULT_COLOR = "#9aa1a9";
    var members = [];
    var editingId = null;
    var deletingMember = null;

    function $(id) { return document.getElementById(id); }
    function core() { return window.cakirAdmin; }
    function isHex(v) { return /^#[0-9a-fA-F]{6}$/.test(v); }

    // ---------- Renk alanı (seçici + kod + hazır renkler + canlı önizleme) ----------
    function setupColorField(ids) {
        var picker = $(ids.picker), hex = $(ids.hex), preview = $(ids.preview), swatches = $(ids.swatches);

        function set(value, fromHexInput) {
            value = String(value).toLowerCase();
            if (!isHex(value)) return;
            picker.value = value;
            if (!fromHexInput) hex.value = value;
            preview.setAttribute("data-color", value);
            if (window.CakirTheme) window.CakirTheme.paint(preview.parentNode);
            swatches.querySelectorAll(".swatch").forEach(function (b) {
                b.classList.toggle("is-selected", b.getAttribute("data-value") === value);
            });
        }

        PRESETS.forEach(function (p) {
            var b = core().el("button", "swatch");
            b.type = "button";
            b.title = p.name;
            b.setAttribute("aria-label", p.name);
            b.setAttribute("data-value", p.value);
            b.style.backgroundColor = p.value;
            b.addEventListener("click", function () { set(p.value); });
            swatches.appendChild(b);
        });

        picker.addEventListener("input", function () { set(picker.value); });
        hex.addEventListener("input", function () {
            var v = hex.value.trim();
            if (v && v.charAt(0) !== "#") v = "#" + v;
            if (isHex(v)) set(v, true);
        });
        hex.addEventListener("blur", function () { hex.value = picker.value; });

        return { set: set, get: function () { return picker.value; } };
    }

    var addColor = null;
    var editColor = null;

    function load() {
        core().api("/api/team/admin")
            .then(function (data) {
                members = data.items;
                $("discordNote").textContent = data.discordConfigured
                    ? "Discord ID girdiğinizde isim ve profil fotoğrafı otomatik çekilir."
                    : "Discord bot anahtarı tanımlı değil; ID ile profil çekmek için .env dosyasına DISCORD_BOT_TOKEN ekleyin. Şimdilik yalnızca isimle üye ekleyebilirsiniz.";
                render();
            })
            .catch(function (err) { core().toast(err.message, "error"); });
    }

    function render() {
        var list = $("teamList");
        list.textContent = "";
        if (!members.length) {
            list.appendChild(core().el("div", "empty-state", "HENÜZ ÜYE EKLENMEDİ"));
            return;
        }
        members.forEach(function (m, index) { list.appendChild(buildRow(m, index)); });
        if (window.CakirTheme) window.CakirTheme.paint(list);
    }

    function buildRow(m, index) {
        var el = core().el;
        var row = el("div", "media-list-item");
        row.setAttribute("data-color", m.color);

        var img = el("img", "team-avatar");
        img.alt = m.name;
        img.referrerPolicy = "no-referrer";
        img.src = m.avatar;
        img.addEventListener("error", function () { img.onerror = null; img.src = "/images/cakir_logo1.png"; });

        var details = el("div", "item-details");
        details.appendChild(el("div", "item-title", m.name));
        var meta = el("div", "item-meta");
        meta.appendChild(el("span", "badge member-badge", m.role));
        meta.appendChild(el("span", "", m.color.toUpperCase()));
        meta.appendChild(el("span", "", m.discordId ? "Discord: " + (m.discordUsername || m.discordId) : "Discord bağlı değil"));
        details.appendChild(meta);

        var controls = el("div", "item-controls");
        var up = el("button", "ctrl-btn", "▲");
        var down = el("button", "ctrl-btn", "▼");
        var edit = el("button", "ctrl-btn", "DÜZENLE");
        var del = el("button", "ctrl-btn btn-delete", "SİL");
        var buttons = [up, down];
        if (m.discordId) {
            var refresh = el("button", "ctrl-btn", "YENİLE");
            refresh.title = "Discord profilini yeniden çek";
            refresh.addEventListener("click", function () { refreshMember(m.id, refresh); });
            buttons.push(refresh);
        }
        buttons.push(edit, del);
        buttons.forEach(function (b) { b.type = "button"; controls.appendChild(b); });
        up.disabled = index === 0;
        down.disabled = index === members.length - 1;
        up.setAttribute("aria-label", "Yukarı taşı");
        down.setAttribute("aria-label", "Aşağı taşı");
        up.addEventListener("click", function () { move(index, index - 1); });
        down.addEventListener("click", function () { move(index, index + 1); });
        edit.addEventListener("click", function () { openEdit(m.id); });
        del.addEventListener("click", function () { removeMember(m); });

        row.appendChild(img);
        row.appendChild(details);
        row.appendChild(controls);
        return row;
    }

    function replace(updated) {
        members = members.map(function (m) { return m.id === updated.id ? updated : m; });
        render();
    }

    function move(from, to) {
        if (to < 0 || to >= members.length) return;
        var previous = members.slice();
        members.splice(to, 0, members.splice(from, 1)[0]);
        render();
        core().api("/api/team/order", { method: "PUT", body: { ids: members.map(function (m) { return m.id; }) } })
            .catch(function (err) { members = previous; render(); core().toast(err.message, "error"); });
    }

    // ---------- Ekleme ----------
    $("teamAddBtn").addEventListener("click", function () {
        var btn = $("teamAddBtn");
        var body = {
            discordId: $("teamDiscordId").value.trim(),
            name: $("teamName").value.trim(),
            role: $("teamRole").value.trim(),
            color: addColor.get()
        };
        if (!body.role) return core().toast("Lütfen bir rütbe girin.", "error");
        if (!body.discordId && !body.name) return core().toast("Discord ID veya isim girin.", "error");

        btn.disabled = true;
        core().api("/api/team", { method: "POST", body: body })
            .then(function (created) {
                members.push(created);
                render();
                ["teamDiscordId", "teamName", "teamRole"].forEach(function (id) { $(id).value = ""; });
                core().toast(created.name + " kadroya eklendi.");
            })
            .catch(function (err) { core().toast(err.message, "error"); })
            .then(function () { btn.disabled = false; });
    });

    // ---------- Yenileme ----------
    function refreshMember(id, btn) {
        btn.disabled = true;
        core().api("/api/team/" + encodeURIComponent(id) + "/refresh", { method: "POST" })
            .then(function (updated) { replace(updated); core().toast("Discord profili güncellendi."); })
            .catch(function (err) { core().toast(err.message, "error"); btn.disabled = false; });
    }

    // ---------- Düzenleme ----------
    function openEdit(id) {
        var m = members.filter(function (x) { return x.id === id; })[0];
        if (!m) return;
        editingId = id;
        $("teamEditName").value = m.name;
        $("teamEditRole").value = m.role;
        editColor.set(m.color);
        $("teamEditModal").hidden = false;
        $("teamEditName").focus();
    }

    function closeEdit() {
        $("teamEditModal").hidden = true;
        editingId = null;
    }

    $("teamEditCancel").addEventListener("click", closeEdit);
    $("teamEditModal").addEventListener("click", function (e) { if (e.target === this) closeEdit(); });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !$("teamEditModal").hidden) closeEdit();
    });

    $("teamEditSave").addEventListener("click", function () {
        var btn = $("teamEditSave");
        var body = { name: $("teamEditName").value.trim(), role: $("teamEditRole").value.trim(), color: editColor.get() };
        if (!body.name || !body.role) return core().toast("İsim ve rütbe boş bırakılamaz.", "error");
        btn.disabled = true;
        core().api("/api/team/" + encodeURIComponent(editingId), { method: "PATCH", body: body })
            .then(function (updated) { replace(updated); closeEdit(); core().toast("Üye güncellendi."); })
            .catch(function (err) { core().toast(err.message, "error"); })
            .then(function () { btn.disabled = false; });
    });

    // ---------- Silme (iki adımlı onay) ----------
    function removeMember(m) {
        // İlk tık uyarır; 5 sn içinde ikinci tık siler
        if (deletingMember !== m.id) {
            deletingMember = m.id;
            core().toast("“" + m.name + "” silinecek. Onaylamak için SİL düğmesine tekrar basın.", "error");
            setTimeout(function () { if (deletingMember === m.id) deletingMember = null; }, 5000);
            return;
        }
        deletingMember = null;
        core().api("/api/team/" + encodeURIComponent(m.id), { method: "DELETE" })
            .then(function () {
                members = members.filter(function (x) { return x.id !== m.id; });
                render();
                core().toast("Üye kadrodan çıkarıldı.");
            })
            .catch(function (err) { core().toast(err.message, "error"); });
    }

    document.addEventListener("admin:ready", function () {
        // Renk alanları ilk açılışta bir kez kurulur (hazır renkler çizilir)
        if (!addColor) {
            addColor = setupColorField({ picker: "teamColor", hex: "teamColorHex", preview: "teamColorPreview", swatches: "teamSwatches" });
            editColor = setupColorField({ picker: "teamEditColor", hex: "teamEditColorHex", preview: "teamEditPreview", swatches: "teamEditSwatches" });
            addColor.set(DEFAULT_COLOR);
        }
        load();
    });
})();
