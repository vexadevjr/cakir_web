// Koyu / açık tema anahtarı ve renk yardımcıları
(function () {
    "use strict";

    var STORAGE_KEY = "cakir_theme";
    var theme = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    var button = null;

    // ---------- Renk yardımcıları (üye renklerini temaya uyarlamak için) ----------
    function isHex(v) { return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v); }

    function hexToRgb(hex) {
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }

    function rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(function (v) {
            var h = Math.round(Math.max(0, Math.min(255, v))).toString(16);
            return h.length === 1 ? "0" + h : h;
        }).join("");
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0;
        if (max !== min) {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
        }
        return [h, s, l];
    }

    function hslToRgb(h, s, l) {
        function f(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }
        if (s === 0) return [l * 255, l * 255, l * 255];
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
    }

    // Seçilen rengin koyu zeminde çok koyu, açık zeminde çok açık kalıp okunmaz olmasını engeller
    function forTheme(hex, mode) {
        if (!isHex(hex)) return "#6b737d";
        var rgb = hexToRgb(hex), hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
        if (mode === "light" && hsl[2] > 0.42) hsl[2] = 0.38;
        if (mode !== "light" && hsl[2] < 0.58) hsl[2] = 0.62;
        var out = hslToRgb(hsl[0], hsl[1], hsl[2]);
        return rgbToHex(out[0], out[1], out[2]);
    }

    function rgba(hex, alpha) {
        var c = hexToRgb(hex);
        return "rgba(" + c[0] + ", " + c[1] + ", " + c[2] + ", " + alpha + ")";
    }

    // data-color taşıyan öğelere (üye kartları) temaya uygun renk değişkenlerini yazar
    function paint(root) {
        (root || document).querySelectorAll("[data-color]").forEach(function (el) {
            var color = forTheme(el.getAttribute("data-color"), theme);
            el.style.setProperty("--member-color", color);
            el.style.setProperty("--member-glow", rgba(color, 0.22));
        });
    }

    // ---------- Tema anahtarı ----------
    function label() {
        var text = theme === "light" ? "Karanlık temaya geç" : "Aydınlık temaya geç";
        return window.I18N ? window.I18N.t(text) : text;
    }

    var ICONS = {
        dark: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
        light: '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    };

    function updateButton() {
        if (!button) return;
        var text = label();
        // Koyu temada ay, açık temada güneş simgesi görünür
        button.querySelector(".theme-icon").innerHTML = ICONS[theme];
        button.querySelector(".theme-label").textContent = text;
        button.setAttribute("aria-label", text);
        button.setAttribute("title", text);
        button.setAttribute("aria-pressed", String(theme === "light"));
    }

    function applyTheme(next) {
        theme = next;
        if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
        else document.documentElement.removeAttribute("data-theme");
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", theme === "light" ? "#f3f4f6" : "#0f1011");
        updateButton();
        paint();
        document.dispatchEvent(new CustomEvent("theme:change", { detail: { theme: theme } }));
    }

    function toggle() {
        var next = theme === "light" ? "dark" : "light";
        try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* depolama kapalı */ }
        applyTheme(next);
    }

    function build() {
        var host = document.getElementById("navLinks");
        if (!host) return;
        var li = document.createElement("li");
        li.className = "theme-switch";
        li.setAttribute("data-no-i18n", "");
        button = document.createElement("button");
        button.type = "button";
        button.className = "theme-toggle";
        button.innerHTML = '<span class="theme-icon"></span><span class="theme-label"></span>';
        button.addEventListener("click", toggle);
        li.appendChild(button);
        host.appendChild(li);
        updateButton();
    }

    window.CakirTheme = { get theme() { return theme; }, paint: paint, toggle: toggle };
    window.CakirColor = { isHex: isHex, forTheme: forTheme, rgba: rgba };

    build();
    // Dil değişince düğme etiketi yeni dilde yazılır
    document.addEventListener("i18n:change", updateButton);
})();
