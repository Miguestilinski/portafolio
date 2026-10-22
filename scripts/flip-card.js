document.addEventListener('DOMContentLoaded', () => {
    const tvWrapper = document.getElementById('tv-flip-wrapper');
    const tvInner = document.getElementById('tv-flip-inner');
    
    if (tvWrapper && tvInner) {
        const frontFace = tvInner.querySelector('.front-face');
        const backFace = tvInner.querySelector('.back-face');
        let isFlipped = false;

        // Fix inicial para Safari: Ocultar visualmente la parte de atrás al cargar
        if (backFace) backFace.style.opacity = '0';

        tvWrapper.addEventListener('click', () => {
            isFlipped = !isFlipped;
            
            // Alternar la clase de rotación 3D
            tvInner.classList.toggle('rotate-y-180');
            
            // Fix estricto para Safari: Ocultar con opacidad la cara que no mira a la cámara
            // a la mitad de la transición (350ms, la mitad de duration-700)
            setTimeout(() => {
                if (isFlipped) {
                    if (frontFace) frontFace.style.opacity = '0';
                    if (backFace) backFace.style.opacity = '1';
                } else {
                    if (frontFace) frontFace.style.opacity = '1';
                    if (backFace) backFace.style.opacity = '0';
                }
            }, 350); 
        });
    }
});