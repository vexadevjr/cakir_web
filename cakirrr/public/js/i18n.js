// Çok dilli destek: Türkçe (varsayılan), İngilizce, Almanca, İspanyolca, Rusça
// Sayfadaki Türkçe metinler kaynak kabul edilir; js/lang/*.js dosyaları "Türkçe metin -> çeviri" eşlemesi içerir.
(function () {
    "use strict";

    var LANGS = [
        { code: "tr", label: "Türkçe", short: "TR", locale: "tr-TR" },
        { code: "en", label: "English", short: "EN", locale: "en-US" },
        { code: "de", label: "Deutsch", short: "DE", locale: "de-DE" },
        { code: "es", label: "Español", short: "ES", locale: "es-ES" },
        { code: "ru", label: "Русский", short: "RU", locale: "ru-RU" }
    ];
    var STORAGE_KEY = "cakir_lang";
    var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };
    var ATTRS = ["alt", "title", "aria-label", "placeholder"];

    var dicts = (window.I18N_DICT = window.I18N_DICT || {});
    var current = "tr";
    var textOrig = new WeakMap();   // metin düğümü -> Türkçe özgün metin
    var attrOrig = new WeakMap();   // eleman -> { öznitelik: Türkçe özgün değer }
    var htmlOrig = new WeakMap();   // eleman -> özgün innerHTML
    var titleOrig = null;
    var metaOrig = null;
    var toggleBtn = null;
    var menuList = null;

    function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
    function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }
    function langInfo(code) { return LANGS.filter(function (l) { return l.code === code; })[0]; }

    // Türkçe kaynak metnin geçerli dildeki karşılığını verir (karşılığı yoksa metni olduğu gibi döndürür)
    function t(src) {
        var d = dicts[current];
        var key = norm(src);
        return d && has(d, key) ? d[key] : src;
    }

    function translateText(node) {
        var orig = textOrig.has(node) ? textOrig.get(node) : node.nodeValue;
        var key = norm(orig);
        if (!key) return;
        var d = dicts[current];
        if (!d || !has(d, key)) {
            if (textOrig.has(node) && node.nodeValue !== orig) node.nodeValue = orig;
            return;
        }
        if (!textOrig.has(node)) textOrig.set(node, orig);
        node.nodeValue = orig.match(/^\s*/)[0] + d[key] + orig.match(/\s*$/)[0];
    }

    function translateAttrs(el) {
        var d = dicts[current];
        ATTRS.forEach(function (name) {
            if (!el.hasAttribute(name)) return;
            var store = attrOrig.get(el);
            if (!store) { store = {}; attrOrig.set(el, store); }
            if (!has(store, name)) store[name] = el.getAttribute(name);
            var key = norm(store[name]);
            el.setAttribute(name, d && has(d, key) ? d[key] : store[name]);
        });
    }

    // data-i18n-html: içinde bağlantı/vurgu bulunan, anahtarla (id) çevrilen bloklar
    function translateHtmlEl(el) {
        if (!htmlOrig.has(el)) htmlOrig.set(el, el.innerHTML);
        var d = dicts[current];
        var id = el.getAttribute("data-i18n-html");
        el.innerHTML = d && has(d, id) ? d[id] : htmlOrig.get(el);
    }

    function translateTree(root) {
        if (root.nodeType === 3) { translateText(root); return; }
        if (root.nodeType !== 1 || SKIP_TAGS[root.tagName]) return;
        if (root.hasAttribute("data-no-i18n")) return;

        if (root.hasAttribute("data-i18n-html")) { translateHtmlEl(root); return; }
        root.querySelectorAll("[data-i18n-html]").forEach(translateHtmlEl);

        translateAttrs(root);
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                if (n.nodeType === 1 && (SKIP_TAGS[n.tagName] || n.hasAttribute("data-i18n-html") || n.hasAttribute("data-no-i18n"))) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var n;
        while ((n = walker.nextNode())) {
            if (n.nodeType === 1) translateAttrs(n);
            else translateText(n);
        }
    }

    function translateHead() {
        var d = dicts[current];
        var titleEl = document.querySelector("title");
        if (titleEl) {
            if (titleOrig === null) titleOrig = titleEl.textContent;
            var tk = norm(titleOrig);
            document.title = d && has(d, tk) ? d[tk] : titleOrig;
        }
        var meta = document.querySelector('meta[name="description"]');
        if (meta) {
            if (metaOrig === null) metaOrig = meta.getAttribute("content") || "";
            var mk = norm(metaOrig);
            meta.setAttribute("content", d && has(d, mk) ? d[mk] : metaOrig);
        }
    }

    function updateSwitcher() {
        if (!toggleBtn) return;
        var info = langInfo(current);
        toggleBtn.querySelector(".lang-code").textContent = info.short;
        toggleBtn.setAttribute("aria-label", t("Dil seçimi") + ": " + info.label);
        menuList.querySelectorAll("button").forEach(function (b) {
            var active = b.getAttribute("data-lang") === current;
            b.classList.toggle("is-active", active);
            b.setAttribute("aria-current", active ? "true" : "false");
        });
    }

    function applyLang(code) {
        current = code;
        document.documentElement.lang = code;
        translateHead();
        if (document.body) translateTree(document.body);
        updateSwitcher();
        document.documentElement.classList.remove("i18n-pending");
        document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: code } }));
    }

    function loadDict(code, done) {
        if (code === "tr" || dicts[code]) return done(true);
        var s = document.createElement("script");
        s.src = "/js/lang/" + code + ".js";
        s.onload = function () { done(Boolean(dicts[code])); };
        s.onerror = function () { done(false); };
        document.head.appendChild(s);
    }

    function setLang(code) {
        if (!langInfo(code)) return;
        loadDict(code, function (ok) {
            if (!ok) { document.documentElement.classList.remove("i18n-pending"); return; }
            applyLang(code);
            try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* depolama kapalı */ }
        });
    }

    // ---------- Menüdeki dil seçici ----------
    function closeMenu() {
        if (!toggleBtn) return;
        menuList.classList.remove("is-open");
        toggleBtn.setAttribute("aria-expanded", "false");
    }

    function buildSwitcher() {
        var host = document.getElementById("navLinks");
        if (!host) return;

        var li = document.createElement("li");
        li.className = "lang-switch";
        li.setAttribute("data-no-i18n", "");

        toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "lang-toggle";
        toggleBtn.setAttribute("aria-haspopup", "true");
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.innerHTML =
            '<svg class="lang-globe" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
            '<span class="lang-code"></span>';

        menuList = document.createElement("ul");
        menuList.className = "lang-menu";
        LANGS.forEach(function (l) {
            var item = document.createElement("li");
            var b = document.createElement("button");
            b.type = "button";
            b.setAttribute("data-lang", l.code);
            b.setAttribute("lang", l.code);
            b.textContent = l.label;
            b.addEventListener("click", function () { closeMenu(); setLang(l.code); });
            item.appendChild(b);
            menuList.appendChild(item);
        });

        toggleBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            var open = menuList.classList.toggle("is-open");
            toggleBtn.setAttribute("aria-expanded", String(open));
        });
        document.addEventListener("click", function (e) { if (!li.contains(e.target)) closeMenu(); });
        document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

        li.appendChild(toggleBtn);
        li.appendChild(menuList);
        host.appendChild(li);
        updateSwitcher();
    }

    // Sonradan eklenen içerik (galeri kartları, rakamlar vb.) otomatik çevrilir
    function observe() {
        if (!window.MutationObserver) return;
        new MutationObserver(function (mutations) {
            if (current === "tr") return;
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    var parent = node.parentElement;
                    if (parent && parent.closest("[data-i18n-html], [data-no-i18n]")) return;
                    translateTree(node);
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    window.I18N = {
        t: t,
        setLang: setLang,
        get lang() { return current; },
        get locale() { return langInfo(current).locale; }
    };

    var saved = "tr";
    try { saved = localStorage.getItem(STORAGE_KEY) || "tr"; } catch (e) { /* varsayılan Türkçe */ }
    if (!langInfo(saved)) saved = "tr";

    buildSwitcher();
    observe();
    if (saved !== "tr") setLang(saved);
})();
