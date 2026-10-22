document.addEventListener('DOMContentLoaded', () => {
    const tvWrapper = document.getElementById('tv-flip-wrapper');
    const tvInner = document.getElementById('tv-flip-inner');

    if (tvWrapper && tvInner) {
        tvWrapper.addEventListener('click', () => {
            // Alternar la clase de rotación de CSS
            tvInner.classList.toggle('rotate-y-180');
        });
    }
});