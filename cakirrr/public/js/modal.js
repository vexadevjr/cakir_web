// Şirket künyesi penceresi
(function () {
    var modal = document.getElementById("profileModal");
    if (!modal) return;

    var openBtn = document.getElementById("openProfileBtn");
    var closeBtn = document.getElementById("closeProfileBtn");

    function openModal() {
        modal.classList.add("modal-active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.classList.remove("modal-active");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    if (openBtn) openBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    // Karartılmış arka plana tıklanınca kapat
    modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modal.classList.contains("modal-active")) closeModal();
    });
})();
