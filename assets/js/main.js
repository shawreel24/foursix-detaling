document.addEventListener('DOMContentLoaded', () => {
  // Navigation Scroll Effect
  const nav = document.getElementById('navbar');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  // Reveal Animations
  const observerOptions = { root: null, rootMargin: '0px', threshold: 0.15 };
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach((el) => { observer.observe(el); });

  // Parallax effect for gallery images
  const galleryItems = document.querySelectorAll('.gal-item img');
  window.addEventListener('scroll', () => {
    galleryItems.forEach(img => {
      const rect = img.parentElement.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (inView) {
        const scrollPercent = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        const yPos = (scrollPercent * 20) - 10;
        img.style.transform = `scale(1.15) translateY(${yPos}%)`;
      }
    });
  });

  // ── Mobile Menu ──────────────────────────────────────────
  const hamburger = document.getElementById('navHamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const backdrop = document.getElementById('mobileMenuBackdrop');

  if (hamburger && mobileMenu && backdrop) {
    function openMenu() {
      hamburger.classList.add('open');
      mobileMenu.classList.add('open');
      backdrop.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
      backdrop.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', () => {
      hamburger.classList.contains('open') ? closeMenu() : openMenu();
    });

    backdrop.addEventListener('click', closeMenu);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
  }
});

