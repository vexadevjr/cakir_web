// Yönetim paneli: sekmeler, ziyaret istatistikleri (grafik + sayılar) ve IP kayıtları
(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";
    var state = { range: "week", data: null, visitors: [], timezone: "Europe/Istanbul" };
    var resizeTimer = null;
    var activeTab = "media";

    function $(id) { return document.getElementById(id); }
    function core() { return window.cakirAdmin; }
    function nf(n) { return Number(n).toLocaleString("tr-TR"); }

    // ---------- Biçimlendirme ----------
    function dateTime(iso) {
        return new Date(iso).toLocaleString("tr-TR", { timeZone: state.timezone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    function shortLabel(key, unit) {
        if (unit === "hour") return key.slice(11) + ":00";
        if (unit === "day") return key.slice(8, 10) + "." + key.slice(5, 7);
        var d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
        return d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
    }

    function longLabel(key, unit) {
        if (unit === "hour") {
            var h = Number(key.slice(11));
            return key.slice(8, 10) + "." + key.slice(5, 7) + "." + key.slice(0, 4) + " " + key.slice(11) + ":00–" + String((h + 1) % 24).padStart(2, "0") + ":00";
        }
        if (unit === "day") {
            var d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
            return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
        }
        return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    }

    // "Chrome · Windows" gibi kısa özet; tam metin başlık olarak gösterilir
    function browserSummary(ua) {
        if (!ua) return "—";
        var b = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /bot|crawl|spider/i.test(ua) ? "Bot" : /curl|wget|python|axios|node-fetch|go-http|java\//i.test(ua) ? "Betik/Araç" : "Diğer";
        var os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad|iOS/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
        return os ? b + " · " + os : b;
    }

    function cell(tr, text, className, title) {
        var td = document.createElement("td");
        if (className) td.className = className;
        td.textContent = text;
        if (title) td.title = title;
        tr.appendChild(td);
        return td;
    }

    function emptyRow(tbody, cols, text) {
        var tr = document.createElement("tr");
        var td = document.createElement("td");
        td.colSpan = cols;
        td.className = "empty-row";
        td.textContent = text;
        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    // ---------- Sekmeler ----------
    function showTab(name) {
        document.querySelectorAll(".admin-tab").forEach(function (t) {
            var active = t.getAttribute("data-tab") === name;
            t.classList.toggle("is-active", active);
            t.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll(".tab-panel").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
        activeTab = name;
        if (name === "stats") loadOverview();
        if (name === "logs") { loadLogins(); loadVisitors(); }
    }

    // Açık sekmedeki veri 15 saniyede bir kendiliğinden yenilenir (sekme görünürken ve oturum açıkken)
    setInterval(function () {
        if (document.hidden || $("dashBox").hidden) return;
        if (activeTab === "logs") { loadLogins(true); loadVisitors(true); }
        else if (activeTab === "stats") loadOverview(true);
    }, 15000);

    document.querySelectorAll(".admin-tab").forEach(function (t) {
        t.addEventListener("click", function () { showTab(t.getAttribute("data-tab")); });
    });

    // ---------- İstatistikler ----------
    function loadOverview(silent) {
        core().api("/api/analytics/overview?range=" + state.range)
            .then(function (data) {
                state.data = data;
                state.timezone = data.timezone;
                renderCards(data);
                renderChart(data);
                renderTable(data);
                $("statsNote").textContent = "Botlar ve yönetici gezintileri sayılmaz. Gün ve saat sınırları " + data.timezone + " saat dilimine göredir. Kayıtlar " + data.retentionDays + " gün saklanır; şu an " + nf(data.recordedVisits) + " kayıt var.";
            })
            .catch(function (err) { if (silent !== true) core().toast(err.message, "error"); });
    }

    function renderCards(data) {
        ["day", "week", "month", "year"].forEach(function (k) {
            document.querySelector('[data-card="' + k + '"]').textContent = nf(data.totals[k].views);
            document.querySelector('[data-card-sub="' + k + '"]').textContent = nf(data.totals[k].uniques) + " tekil ziyaretçi";
        });
    }

    function renderTable(data) {
        var body = $("statsBody");
        body.textContent = "";
        var views = 0;
        data.points.slice().reverse().forEach(function (p) {
            var tr = document.createElement("tr");
            cell(tr, longLabel(p.key, data.unit));
            cell(tr, nf(p.views), "num");
            cell(tr, nf(p.uniques), "num");
            body.appendChild(tr);
        });
        data.points.forEach(function (p) { views += p.views; });
        $("sumViews").textContent = nf(views);
        // Tekil ziyaretçiler dönemler arasında toplanamaz (aynı kişi birden çok dönemde sayılır); bu yüzden kart değeri gösterilir
        $("sumUniques").textContent = nf(data.totals[data.range].uniques) + " (dönem geneli)";
    }

    function svg(tag, attrs) {
        var node = document.createElementNS(SVG_NS, tag);
        Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
        return node;
    }

    function niceStep(max) {
        var raw = max / 5, pow = Math.pow(10, Math.floor(Math.log10(raw))), base = raw / pow;
        return (base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10) * pow;
    }

    function renderChart(data) {
        var wrap = $("chartWrap");
        var tip = $("chartTip");
        var old = wrap.querySelector("svg");
        if (old) old.remove();
        tip.hidden = true;

        var points = data.points;
        var W = Math.max(300, wrap.clientWidth - 16), H = W < 520 ? 270 : 320;
        var m = { l: 46, r: 14, t: 14, b: 36 };
        var iw = W - m.l - m.r, ih = H - m.t - m.b;
        var maxV = points.reduce(function (a, p) { return Math.max(a, p.views); }, 0);
        var step = niceStep(Math.max(maxV, 5));
        var top = Math.ceil(Math.max(maxV, 1) / step) * step;
        var slot = iw / points.length;
        var bw = Math.min(42, slot * 0.62);
        function x(i) { return m.l + slot * (i + 0.5); }
        function y(v) { return m.t + ih - (ih * v) / top; }

        var el = svg("svg", { "class": "chart-svg", viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Ziyaret grafiği" });

        for (var t = 0; t <= top; t += step) {
            el.appendChild(svg("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), "class": t === 0 ? "chart-axis" : "chart-grid" }));
            var label = svg("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end", "class": "chart-text" });
            label.textContent = nf(t);
            el.appendChild(label);
        }

        var every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(iw / 54))));
        var bars = [];
        points.forEach(function (p, i) {
            var h = ih - (y(p.views) - m.t);
            var bar = svg("rect", { x: x(i) - bw / 2, y: y(p.views), width: bw, height: Math.max(0, h), "class": "chart-bar" });
            bars.push(bar);
            el.appendChild(bar);
            if (i % every === 0) {
                var lt = svg("text", { x: x(i), y: H - 12, "text-anchor": "middle", "class": "chart-text" });
                lt.textContent = shortLabel(p.key, data.unit);
                el.appendChild(lt);
            }
        });

        var path = points.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.uniques).toFixed(1); }).join(" ");
        el.appendChild(svg("path", { d: path, "class": "chart-line" }));
        points.forEach(function (p, i) { el.appendChild(svg("circle", { cx: x(i), cy: y(p.uniques), r: points.length > 24 ? 2.5 : 3.5, "class": "chart-dot" })); });

        if (!maxV) {
            var empty = svg("text", { x: W / 2, y: H / 2, "text-anchor": "middle", "class": "chart-empty" });
            empty.textContent = "BU DÖNEMDE ZİYARET KAYDI YOK";
            el.appendChild(empty);
        }

        // Üzerine gelince ayrıntı balonu (dokunmatik ekranlarda dokununca)
        points.forEach(function (p, i) {
            var hit = svg("rect", { x: m.l + slot * i, y: m.t, width: slot, height: ih, "class": "chart-hit" });
            function show() {
                bars.forEach(function (b, j) { b.classList.toggle("is-hover", j === i); });
                tip.textContent = "";
                var strong = document.createElement("strong");
                strong.textContent = longLabel(p.key, data.unit);
                tip.appendChild(strong);
                tip.appendChild(document.createTextNode("Ziyaret: " + nf(p.views)));
                tip.appendChild(document.createElement("br"));
                tip.appendChild(document.createTextNode("Tekil ziyaretçi: " + nf(p.uniques)));
                tip.hidden = false;
                var left = x(i) + 8 + 8;
                if (left + tip.offsetWidth > wrap.clientWidth - 6) left = x(i) - tip.offsetWidth - 4;
                tip.style.left = Math.max(4, left) + "px";
                tip.style.top = Math.max(4, Math.min(y(p.views), H - tip.offsetHeight - 40)) + "px";
            }
            hit.addEventListener("pointerenter", show);
            hit.addEventListener("pointerdown", show);
            hit.addEventListener("pointerleave", function () { tip.hidden = true; bars[i].classList.remove("is-hover"); });
            el.appendChild(hit);
        });

        wrap.insertBefore(el, tip);
    }

    $("rangeSwitch").addEventListener("click", function (e) {
        var btn = e.target.closest(".range-btn");
        if (!btn) return;
        state.range = btn.getAttribute("data-range");
        document.querySelectorAll(".range-btn").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        loadOverview();
    });

    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (state.data && !$("chartWrap").closest(".tab-panel").hidden) renderChart(state.data);
        }, 150);
    });

    // ---------- Giriş denemeleri ----------
    var REASONS = { success: ["BAŞARILI", "result-ok"], bad_credentials: ["HATALI BİLGİ", "result-fail"], rate_limited: ["ENGELLENDİ", "result-block"] };

    function loadLogins(silent) {
        var filter = $("loginFilter").value;
        core().api("/api/analytics/logins" + (filter ? "?result=" + filter : ""))
            .then(function (data) {
                $("loginOk").textContent = nf(data.summary.success24h);
                $("loginFail").textContent = nf(data.summary.failed24h);
                var top = data.summary.topFailed[0];
                $("loginTop").textContent = top ? top.ip + " (" + nf(top.attempts) + " deneme)" : "—";

                var body = $("loginBody");
                body.textContent = "";
                if (!data.items.length) return emptyRow(body, 5, "KAYIT YOK");
                data.items.forEach(function (a) {
                    var tr = document.createElement("tr");
                    cell(tr, dateTime(a.createdAt));
                    cell(tr, a.ip, "mono");
                    cell(tr, a.username || "—", a.username ? "" : "muted-cell");
                    var r = REASONS[a.reason] || [a.reason, "result-fail"];
                    var td = document.createElement("td");
                    var badge = document.createElement("span");
                    badge.className = "badge " + r[1];
                    badge.textContent = r[0];
                    td.appendChild(badge);
                    tr.appendChild(td);
                    cell(tr, browserSummary(a.ua), "", a.ua);
                    body.appendChild(tr);
                });
            })
            .catch(function (err) { if (silent !== true) core().toast(err.message, "error"); });
    }

    $("loginFilter").addEventListener("change", function () { loadLogins(); });

    // ---------- Ziyaretçi IP listesi ----------
    function loadVisitors(silent) {
        var url = "/api/analytics/visitors?range=" + $("ipRange").value + ($("ipBots").checked ? "&bots=1" : "");
        core().api(url)
            .then(function (data) {
                state.visitors = data.items;
                state.truncated = data.truncated;
                renderVisitors();
            })
            .catch(function (err) { if (silent !== true) core().toast(err.message, "error"); });
    }

    function renderVisitors() {
        var q = $("ipSearch").value.trim().toLowerCase();
        var items = state.visitors.filter(function (v) { return !q || v.ip.toLowerCase().indexOf(q) !== -1; });
        var body = $("ipBody");
        body.textContent = "";
        $("ipNote").textContent = nf(items.length) + " IP adresi listeleniyor" + (state.truncated ? " (en son ziyaret eden 300 IP gösteriliyor)" : "") + ($("ipBots").checked ? "; botlar dahil." : "; botlar hariç.");
        if (!items.length) return emptyRow(body, 6, "KAYIT YOK");
        items.forEach(function (v) {
            var tr = document.createElement("tr");
            var ipTd = cell(tr, v.ip, "mono");
            if (v.bot) {
                var b = document.createElement("span");
                b.className = "badge";
                b.textContent = "BOT";
                ipTd.appendChild(document.createTextNode(" "));
                ipTd.appendChild(b);
            }
            cell(tr, nf(v.views), "num");
            cell(tr, dateTime(v.firstSeen));
            cell(tr, dateTime(v.lastSeen));
            cell(tr, v.lastPath || "—");
            cell(tr, browserSummary(v.ua), "", v.ua);
            body.appendChild(tr);
        });
    }

    $("ipRange").addEventListener("change", function () { loadVisitors(); });
    $("ipBots").addEventListener("change", function () { loadVisitors(); });
    $("ipSearch").addEventListener("input", renderVisitors);

    // Oturum açılınca medya sekmesiyle başlanır
    document.addEventListener("admin:ready", function () { showTab("media"); });
})();
