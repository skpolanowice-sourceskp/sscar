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
        var pageHeader = menuBtn.closest('header');
        var mobileMenuQuery = window.matchMedia('(max-width: 768px)');
        var menuLinks = Array.prototype.slice.call(navMenu.querySelectorAll('.nav-link'));

        menuBtn.setAttribute('role', 'button');
        menuBtn.setAttribute('tabindex', '0');
        menuBtn.setAttribute('aria-controls', 'nav-menu');
        menuBtn.setAttribute('aria-label', 'Otwórz menu');
        menuBtn.setAttribute('aria-expanded', 'false');

        function setMenu(open) {
            navMenu.classList.toggle('active', open);
            menuBtn.classList.toggle('open', open);
            document.body.classList.toggle('menu-open', open && mobileMenuQuery.matches);
            if (pageHeader) pageHeader.classList.toggle('menu-is-open', open);
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            menuBtn.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
        }

        function toggleMenu() {
            setMenu(!navMenu.classList.contains('active'));
        }

        menuBtn.addEventListener('click', toggleMenu);
        menuBtn.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleMenu();
            }
        });

        menuLinks.forEach(function(link) {
            link.addEventListener('click', function() { setMenu(false); });
        });

        navMenu.addEventListener('click', function(event) {
            if (event.target === navMenu) setMenu(false);
        });

        document.addEventListener('keydown', function(event) {
            if (!navMenu.classList.contains('active')) return;

            if (event.key === 'Escape') {
                setMenu(false);
                menuBtn.focus();
                return;
            }

            if (event.key === 'Tab' && mobileMenuQuery.matches) {
                var focusable = [menuBtn].concat(menuLinks);
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });

        function handleViewportChange(event) {
            if (!event.matches) setMenu(false);
        }
        if (mobileMenuQuery.addEventListener) {
            mobileMenuQuery.addEventListener('change', handleViewportChange);
        } else {
            mobileMenuQuery.addListener(handleViewportChange);
        }
    }
}
