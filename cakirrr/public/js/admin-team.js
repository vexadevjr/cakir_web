// Yönetim paneli: yönetim kadrosu (Discord profilleri)
(function () {
    "use strict";

    var TONE_LABELS = { ceo: "Kurucu", dev: "Geliştirici", mgmt: "Yönetim", staff: "Ekip" };
    var members = [];
    var editingId = null;
    var deletingMember = null;

    function $(id) { return document.getElementById(id); }
    function core() { return window.cakirAdmin; }

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
    }

    function buildRow(m, index) {
        var el = core().el;
        var row = el("div", "media-list-item");

        var img = el("img", "team-avatar");
        img.alt = m.name;
        img.referrerPolicy = "no-referrer";
        img.src = m.avatar;
        img.addEventListener("error", function () { img.onerror = null; img.src = "/images/cakir_logo1.png"; });

        var details = el("div", "item-details");
        details.appendChild(el("div", "item-title", m.name));
        var meta = el("div", "item-meta");
        meta.appendChild(el("span", "badge tone-" + m.tone, m.role));
        meta.appendChild(el("span", "", TONE_LABELS[m.tone] || ""));
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
            tone: $("teamTone").value
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
        $("teamEditTone").value = m.tone;
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
        var body = { name: $("teamEditName").value.trim(), role: $("teamEditRole").value.trim(), tone: $("teamEditTone").value };
        if (!body.name || !body.role) return core().toast("İsim ve rütbe boş bırakılamaz.", "error");
        btn.disabled = true;
        core().api("/api/team/" + encodeURIComponent(editingId), { method: "PATCH", body: body })
            .then(function (updated) { replace(updated); closeEdit(); core().toast("Üye güncellendi."); })
            .catch(function (err) { core().toast(err.message, "error"); })
            .then(function () { btn.disabled = false; });
    });

    // ---------- Silme (iki adımlı onay) ----------
    function removeMember(m) {
        // İlk tık düğmeyi "EMİN MİSİNİZ?" haline getirir; ikinci tık siler
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

    document.addEventListener("admin:ready", load);
})();
