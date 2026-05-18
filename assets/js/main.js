document.addEventListener('DOMContentLoaded', () => {
  // Navigation Scroll Effect
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  // Reveal Animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach((el) => {
    observer.observe(el);
  });

  // Parallax effect for gallery images
  const galleryItems = document.querySelectorAll('.gal-item img');
  window.addEventListener('scroll', () => {
    galleryItems.forEach(img => {
      const rect = img.parentElement.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      
      if(inView) {
        const scrollPercent = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        const yPos = (scrollPercent * 20) - 10;
        img.style.transform = `scale(1.15) translateY(${yPos}%)`;
      }
    });
  });
});
