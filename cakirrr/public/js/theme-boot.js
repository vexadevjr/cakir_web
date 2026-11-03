// <head> içinde çalışır: kayıtlı tema açıksa sayfa çizilmeden uygulanır (koyu/açık yanıp sönmesini önler)
(function () {
    try {
        if (localStorage.getItem("cakir_theme") === "light") {
            document.documentElement.setAttribute("data-theme", "light");
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute("content", "#f3f4f6");
        }
    } catch (e) { /* depolama kapalıysa varsayılan koyu tema kalır */ }
})();
