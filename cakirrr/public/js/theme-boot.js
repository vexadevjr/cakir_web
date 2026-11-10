// <head> içinde çalışır: kayıtlı tema açıksa sayfa çizilmeden uygulanır (koyu/açık yanıp sönmesini önler)
(function () {
    try {
        if (localStorage.getItem("cakir_theme") === "light") {
            document.documentElement.setAttribute("data-theme", "light");
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute("content", "#eff1f4");
        }
    } catch (e) { /* depolama kapalıysa varsayılan koyu tema kalır */ }
})();
