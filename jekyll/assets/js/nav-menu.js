document.addEventListener('DOMContentLoaded', function() {
  // Get the nav trigger checkbox
  const navTrigger = document.getElementById('nav-trigger');
  
  // If the screen is mobile-sized, ensure the menu starts collapsed
  function checkScreenSize() {
    if (window.innerWidth <= 600 && navTrigger) {
      navTrigger.checked = false;
    }
  }
  
  // Run on page load
  checkScreenSize();
  
  // Also run when screen is resized
  window.addEventListener('resize', checkScreenSize);
  
  // Close menu when clicking outside
  document.addEventListener('click', function(event) {
    const siteNav = document.querySelector('.site-nav');
    
    // If we clicked outside the nav and the menu is open, close it
    if (siteNav && !siteNav.contains(event.target) && navTrigger && navTrigger.checked) {
      navTrigger.checked = false;
    }
  });
});