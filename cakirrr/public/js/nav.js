// Mobil menü açma/kapama
(function () {
    var toggle = document.getElementById("navToggle");
    var links = document.getElementById("navLinks");
    if (!toggle || !links) return;

    function setOpen(open) {
        links.classList.toggle("nav-open", open);
        toggle.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", String(open));
    }

    toggle.addEventListener("click", function () {
        setOpen(!links.classList.contains("nav-open"));
    });

    links.addEventListener("click", function (e) {
        if (e.target.closest("a")) setOpen(false);
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth > 768) setOpen(false);
    });
})();
