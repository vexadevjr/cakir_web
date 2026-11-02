// <head> içinde çalışır: kayıtlı dil Türkçe değilse çeviri uygulanana kadar sayfayı gizler (Türkçe metnin görünüp kaybolmasını önler)
(function () {
    try {
        var saved = localStorage.getItem("cakir_lang");
        if (saved && saved !== "tr") {
            document.documentElement.classList.add("i18n-pending");
            // Çeviri dosyası gelmezse sayfa yine de görünür olsun
            setTimeout(function () { document.documentElement.classList.remove("i18n-pending"); }, 2000);
        }
    } catch (e) { /* depolama kapalıysa Türkçe devam eder */ }
})();
