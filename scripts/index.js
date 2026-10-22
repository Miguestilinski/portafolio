document.addEventListener('DOMContentLoaded', () => {

    // 1. Navbar Glassmorphism al hacer scroll
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.remove('py-5');
            navbar.classList.add('py-3');
        } else {
            navbar.classList.remove('py-3');
            navbar.classList.add('py-5');
        }
    });

    // 2. Animaciones de revelado suave al hacer Scroll (Intersection Observer)
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Solo animar una vez
            }
        });
    }, {
        root: null,
        threshold: 0.15, // Se dispara cuando el 15% del elemento es visible
        rootMargin: "0px 0px -50px 0px"
    });

    revealElements.forEach(el => {
        revealObserver.observe(el);
    });

    // 3. Efecto Glow dinámico en las tarjetas (Mouse tracking)
    const glowCards = document.querySelectorAll('.glow-card');

    glowCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            // Calcular posición del mouse relativa a la tarjeta
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Enviar coordenadas CSS Variables
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

});