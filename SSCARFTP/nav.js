function initPage() {
    // Mouse glow
    document.addEventListener('mousemove', function(e) {
        if (window.matchMedia('(hover: hover)').matches) {
            document.documentElement.style.setProperty('--mouse-x', e.clientX + 'px');
            document.documentElement.style.setProperty('--mouse-y', e.clientY + 'px');
        }
    });

    // Scroll reveal
    document.addEventListener('DOMContentLoaded', function() {
        var observer = new IntersectionObserver(function(entries, obs) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08 });
        document.querySelectorAll('.animate-on-scroll').forEach(function(el) {
            observer.observe(el);
        });
    });

    // Mobile menu
    var menuBtn = document.getElementById('mobile-menu-btn');
    var navMenu = document.getElementById('nav-menu');
    if (menuBtn && navMenu) {
        menuBtn.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            menuBtn.classList.toggle('open');
        });
        document.querySelectorAll('.nav-link').forEach(function(link) {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                menuBtn.classList.remove('open');
            });
        });
    }
}
