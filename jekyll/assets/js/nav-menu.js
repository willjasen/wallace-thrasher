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
  
  // Handle dropdown toggle clicks
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', function(event) {
      event.preventDefault();
      const dropdownItem = this.closest('.nav-dropdown');
      
      // On mobile, toggle the open class
      if (window.innerWidth <= 600) {
        dropdownItem.classList.toggle('open');
        
        // Close other dropdowns
        document.querySelectorAll('.nav-dropdown').forEach(item => {
          if (item !== dropdownItem && item.classList.contains('open')) {
            item.classList.remove('open');
          }
        });
      }
    });
  });
  
  // Close dropdown when clicking outside on mobile
  document.addEventListener('click', function(event) {
    if (window.innerWidth <= 600) {
      const dropdowns = document.querySelectorAll('.nav-dropdown');
      dropdowns.forEach(dropdown => {
        if (!dropdown.contains(event.target) && dropdown.classList.contains('open')) {
          dropdown.classList.remove('open');
        }
      });
    }
  });
});