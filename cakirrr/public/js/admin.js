// Yönetim paneli: oturum, medya yükleme, düzenleme, sıralama ve silme
(function () {
    "use strict";

    var MAX_BYTES = 8 * 1024 * 1024;
    var ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    var CATEGORY_LABELS = { genel: "Genel", konvoy: "Konvoy", etkinlik: "Etkinlik", filo: "Filo" };

    var csrf = "";
    var items = [];
    var selectedFiles = [];
    var editingId = null;
    var deletingId = null;
    var dragIndex = null;

    function $(id) { return document.getElementById(id); }

    // ---------- Yardımcılar ----------
    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function formatBytes(bytes) {
        if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    function formatDate(value) {
        return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
    }

    function toast(message, type) {
        var node = el("div", "toast toast-" + (type || "success"), message);
        $("toastStack").appendChild(node);
        setTimeout(function () { node.remove(); }, 4000);
    }

    function api(path, options) {
        options = options || {};
        var headers = { Accept: "application/json" };
        if (options.body) headers["Content-Type"] = "application/json";
        if (csrf) headers["X-CSRF-Token"] = csrf;
        return fetch(path, {
            method: options.method || "GET",
            headers: headers,
            credentials: "same-origin",
            body: options.body ? JSON.stringify(options.body) : undefined
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (res.status === 401 && path !== "/api/auth/login") showLogin();
                if (!res.ok) throw new Error(data.error || "İşlem başarısız oldu.");
                return data;
            });
        });
    }

    // Kadro modülü bu yardımcıları kullanır
    window.cakirAdmin = { api: api, toast: toast, el: el };

    // ---------- Oturum ----------
    function showLogin() {
        csrf = "";
        $("dashBox").hidden = true;
        $("loginBox").hidden = false;
    }

    function showDashboard(session) {
        csrf = session.csrf;
        $("userChip").textContent = session.username.toUpperCase();
        $("loginBox").hidden = true;
        $("dashBox").hidden = false;
        loadMedia();
        document.dispatchEvent(new CustomEvent("admin:ready"));
    }

    $("loginBox").addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = $("loginBtn");
        $("loginError").textContent = "";
        btn.disabled = true;

        api("/api/auth/login", {
            method: "POST",
            body: { username: $("adminUser").value.trim(), password: $("adminPass").value }
        })
            .then(function (session) {
                $("adminPass").value = "";
                showDashboard(session);
            })
            .catch(function (err) { $("loginError").textContent = err.message; })
            .then(function () { btn.disabled = false; });
    });

    $("logoutBtn").addEventListener("click", function () {
        api("/api/auth/logout", { method: "POST" }).catch(function () {}).then(showLogin);
    });

    // ---------- Veri ----------
    function loadMedia() {
        return api("/api/media")
            .then(function (data) { items = data; render(); })
            .catch(function (err) { toast(err.message, "error"); });
    }

    function render() {
        renderStats();
        renderList();
    }

    function renderStats() {
        var total = items.reduce(function (sum, i) { return sum + (i.size || 0); }, 0);
        var cats = {};
        items.forEach(function (i) { cats[i.category] = true; });
        var last = items.reduce(function (a, b) { return !a || new Date(b.createdAt) > new Date(a.createdAt) ? b : a; }, null);

        $("statCount").textContent = items.length;
        $("statSize").textContent = formatBytes(total);
        $("statCats").textContent = Object.keys(cats).length;
        $("statLast").textContent = last ? formatDate(last.createdAt) : "—";
    }

    function isFiltering() {
        return $("searchInput").value.trim() !== "" || $("filterCategory").value !== "";
    }

    function renderList() {
        var list = $("adminMediaList");
        var query = $("searchInput").value.trim().toLocaleLowerCase("tr-TR");
        var category = $("filterCategory").value;
        var filtering = isFiltering();
        list.textContent = "";
        $("reorderNote").textContent = filtering
            ? "Sıralama yapmak için arama ve filtreyi temizleyin."
            : "Sıralamak için satırları sürükleyin veya ▲ ▼ tuşlarını kullanın.";

        var shown = 0;
        items.forEach(function (item, index) {
            if (category && item.category !== category) return;
            if (query && item.title.toLocaleLowerCase("tr-TR").indexOf(query) === -1) return;
            shown++;
            list.appendChild(buildRow(item, index, filtering));
        });

        if (!shown) {
            list.appendChild(el("div", "empty-state", items.length ? "SONUÇ BULUNAMADI" : "HENÜZ MEDYA EKLENMEDİ"));
        }
    }

    function buildRow(item, index, filtering) {
        var row = el("div", "media-list-item");

        if (!filtering) {
            row.draggable = true;
            row.addEventListener("dragstart", function (e) {
                dragIndex = index;
                row.classList.add("is-dragging");
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(index));
            });
            row.addEventListener("dragend", function () {
                dragIndex = null;
                row.classList.remove("is-dragging");
            });
            row.addEventListener("dragover", function (e) {
                if (dragIndex === null) return;
                e.preventDefault();
                row.classList.add("is-drop-target");
            });
            row.addEventListener("dragleave", function () { row.classList.remove("is-drop-target"); });
            row.addEventListener("drop", function (e) {
                e.preventDefault();
                row.classList.remove("is-drop-target");
                if (dragIndex !== null && dragIndex !== index) moveTo(dragIndex, index);
            });
            row.appendChild(el("span", "drag-handle", "⋮⋮"));
        }

        var preview = el("div", "item-preview");
        preview.style.backgroundImage = "url('" + item.thumb + "')";

        var details = el("div", "item-details");
        details.appendChild(el("div", "item-title", item.title));
        var meta = el("div", "item-meta");
        meta.appendChild(el("span", "badge", CATEGORY_LABELS[item.category] || item.category));
        meta.appendChild(el("span", "", formatBytes(item.size || 0)));
        meta.appendChild(el("span", "", formatDate(item.createdAt)));
        details.appendChild(meta);

        var controls = el("div", "item-controls");
        var up = el("button", "ctrl-btn", "▲");
        var down = el("button", "ctrl-btn", "▼");
        var edit = el("button", "ctrl-btn", "DÜZENLE");
        var del = el("button", "ctrl-btn btn-delete", "SİL");
        [up, down, edit, del].forEach(function (b) { b.type = "button"; });
        up.setAttribute("aria-label", "Yukarı taşı");
        down.setAttribute("aria-label", "Aşağı taşı");
        up.disabled = filtering || index === 0;
        down.disabled = filtering || index === items.length - 1;
        up.addEventListener("click", function () { moveTo(index, index - 1); });
        down.addEventListener("click", function () { moveTo(index, index + 1); });
        edit.addEventListener("click", function () { openEdit(item.id); });
        del.addEventListener("click", function () { openDelete(item.id); });
        [up, down, edit, del].forEach(function (b) { controls.appendChild(b); });

        row.appendChild(preview);
        row.appendChild(details);
        row.appendChild(controls);
        return row;
    }

    function moveTo(from, to) {
        if (to < 0 || to >= items.length) return;
        var previous = items.slice();
        var moved = items.splice(from, 1)[0];
        items.splice(to, 0, moved);
        render();

        api("/api/media/order", { method: "PUT", body: { ids: items.map(function (i) { return i.id; }) } })
            .catch(function (err) {
                items = previous;
                render();
                toast(err.message, "error");
            });
    }

    $("searchInput").addEventListener("input", renderList);
    $("filterCategory").addEventListener("change", renderList);

    // ---------- Yükleme ----------
    function setFiles(fileList) {
        var valid = [];
        Array.prototype.forEach.call(fileList, function (file) {
            if (ALLOWED.indexOf(file.type) === -1) return toast(file.name + ": desteklenmeyen dosya türü.", "error");
            if (file.size > MAX_BYTES) return toast(file.name + ": dosya 8 MB sınırını aşıyor.", "error");
            valid.push(file);
        });
        selectedFiles = valid;
        updateDropzone();
    }

    function updateDropzone() {
        var preview = $("dropPreview");
        if (!selectedFiles.length) {
            preview.hidden = true;
            $("dropTitle").textContent = "DOSYAYI BURAYA BIRAKIN";
            $("dropNote").textContent = "veya seçmek için tıklayın (birden fazla seçebilirsiniz)";
            return;
        }
        var first = selectedFiles[0];
        var reader = new FileReader();
        reader.onload = function (e) { preview.style.backgroundImage = "url('" + e.target.result + "')"; };
        reader.readAsDataURL(first);
        preview.hidden = false;
        $("dropTitle").textContent = selectedFiles.length === 1 ? first.name.toUpperCase() : selectedFiles.length + " DOSYA SEÇİLDİ";
        $("dropNote").textContent = selectedFiles.length === 1 ? formatBytes(first.size) : "Başlıklar dosya adlarından oluşturulur";
    }

    var dropzone = $("dropzone");
    $("fileInput").addEventListener("change", function (e) { setFiles(e.target.files); });
    ["dragenter", "dragover"].forEach(function (name) {
        dropzone.addEventListener(name, function (e) { e.preventDefault(); dropzone.classList.add("is-dragover"); });
    });
    ["dragleave", "drop"].forEach(function (name) {
        dropzone.addEventListener(name, function () { dropzone.classList.remove("is-dragover"); });
    });
    dropzone.addEventListener("drop", function (e) {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files.length) setFiles(e.dataTransfer.files);
    });

    $("imgTitle").addEventListener("input", function () { $("titleCount").textContent = this.value.length + "/80"; });
    $("imgDesc").addEventListener("input", function () { $("descCount").textContent = this.value.length + "/300"; });

    // Galeri önizlemeleri hızlı açılsın diye tarayıcıda 640 px'lik küçük sürüm üretilir
    function makeThumb(file) {
        return new Promise(function (resolve) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                var scale = Math.min(1, 640 / Math.max(img.width, img.height));
                var canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                canvas.toBlob(function (blob) { resolve(blob); }, "image/jpeg", 0.82);
            };
            img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
            img.src = url;
        });
    }

    function uploadOne(file, title, category, description, onProgress) {
        return makeThumb(file).then(function (thumb) {
            return sendUpload(file, thumb, title, category, description, onProgress);
        });
    }

    function sendUpload(file, thumb, title, category, description, onProgress) {
        return new Promise(function (resolve, reject) {
            var form = new FormData();
            form.append("title", title);
            form.append("category", category);
            form.append("description", description);
            form.append("image", file);
            if (thumb) form.append("thumb", thumb, "thumb.jpg");

            var xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/media");
            xhr.setRequestHeader("X-CSRF-Token", csrf);
            xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
            xhr.onload = function () {
                var data = {};
                try { data = JSON.parse(xhr.responseText); } catch (err) { /* boş yanıt */ }
                if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
                if (xhr.status === 401) showLogin();
                reject(new Error(data.error || "Yükleme başarısız oldu."));
            };
            xhr.onerror = function () { reject(new Error("Sunucuya ulaşılamadı.")); };
            xhr.send(form);
        });
    }

    function resetUploadForm() {
        selectedFiles = [];
        $("fileInput").value = "";
        $("imgTitle").value = "";
        $("imgDesc").value = "";
        $("titleCount").textContent = "0/80";
        $("descCount").textContent = "0/300";
        updateDropzone();
    }

    $("uploadBtn").addEventListener("click", function () {
        if (!selectedFiles.length) return toast("Lütfen en az bir görsel seçin.", "error");
        var manualTitle = $("imgTitle").value.trim();
        if (selectedFiles.length === 1 && !manualTitle) return toast("Lütfen bir başlık girin.", "error");

        var btn = $("uploadBtn");
        var track = $("progressTrack");
        var bar = $("progressBar");
        var category = $("imgCategory").value;
        var description = $("imgDesc").value.trim();
        var files = selectedFiles.slice();
        var done = 0;
        var failed = 0;

        btn.disabled = true;
        track.hidden = false;
        bar.style.width = "0%";

        // Dosyalar sırayla yüklenir; böylece sıralama ve hata takibi güvenilir kalır
        files.reduce(function (chain, file) {
            return chain.then(function () {
                var title = files.length === 1 ? manualTitle : file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80);
                return uploadOne(file, title, category, description, function (ratio) {
                    bar.style.width = Math.round(((done + ratio) / files.length) * 100) + "%";
                })
                    .then(function () { done++; })
                    .catch(function (err) {
                        failed++;
                        toast(file.name + ": " + err.message, "error");
                    });
            });
        }, Promise.resolve()).then(function () {
            btn.disabled = false;
            track.hidden = true;
            if (done) toast(done + " görsel galeriye eklendi.");
            if (!failed) resetUploadForm();
            return loadMedia();
        });
    });

    // ---------- Düzenleme ----------
    function findItem(id) {
        return items.filter(function (i) { return i.id === id; })[0];
    }

    function openEdit(id) {
        var item = findItem(id);
        if (!item) return;
        editingId = id;
        $("editPreview").style.backgroundImage = "url('" + item.url + "')";
        $("editTitle").value = item.title;
        $("editCategory").value = item.category;
        $("editDesc").value = item.description || "";
        $("editModal").hidden = false;
        $("editTitle").focus();
    }

    function closeEdit() {
        $("editModal").hidden = true;
        editingId = null;
    }

    $("editCancel").addEventListener("click", closeEdit);
    $("editSave").addEventListener("click", function () {
        var title = $("editTitle").value.trim();
        if (!title) return toast("Başlık boş bırakılamaz.", "error");
        var btn = $("editSave");
        btn.disabled = true;

        api("/api/media/" + encodeURIComponent(editingId), {
            method: "PATCH",
            body: { title: title, category: $("editCategory").value, description: $("editDesc").value.trim() }
        })
            .then(function (updated) {
                items = items.map(function (i) { return i.id === updated.id ? updated : i; });
                render();
                closeEdit();
                toast("Değişiklikler kaydedildi.");
            })
            .catch(function (err) { toast(err.message, "error"); })
            .then(function () { btn.disabled = false; });
    });

    // ---------- Silme ----------
    function openDelete(id) {
        var item = findItem(id);
        if (!item) return;
        deletingId = id;
        $("deleteText").textContent = "“" + item.title + "” galeriden kalıcı olarak silinecek. Bu işlem geri alınamaz.";
        $("deleteModal").hidden = false;
    }

    function closeDelete() {
        $("deleteModal").hidden = true;
        deletingId = null;
    }

    $("deleteCancel").addEventListener("click", closeDelete);
    $("deleteConfirm").addEventListener("click", function () {
        var btn = $("deleteConfirm");
        btn.disabled = true;
        api("/api/media/" + encodeURIComponent(deletingId), { method: "DELETE" })
            .then(function () {
                items = items.filter(function (i) { return i.id !== deletingId; });
                render();
                closeDelete();
                toast("Medya silindi.");
            })
            .catch(function (err) { toast(err.message, "error"); })
            .then(function () { btn.disabled = false; });
    });

    // Pencerelerde Escape ve dış alan tıklaması
    [["editModal", closeEdit], ["deleteModal", closeDelete]].forEach(function (pair) {
        $(pair[0]).addEventListener("click", function (e) { if (e.target === this) pair[1](); });
    });
    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (!$("editModal").hidden) closeEdit();
        if (!$("deleteModal").hidden) closeDelete();
    });

    // ---------- Başlangıç: açık oturum varsa doğrudan panele geç ----------
    fetch("/api/auth/me", { credentials: "same-origin" })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (session) { if (session) showDashboard(session); })
        .catch(function () { /* giriş formu görünür kalır */ });
})();
