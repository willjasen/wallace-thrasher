document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("theme-toggle");
    const body = document.body;

    // Check if a theme is already saved in localStorage
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
        body.classList.add(savedTheme);
        button.textContent = savedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode";
    }

    // Add a click event to the button
    button.addEventListener("click", () => {
        const isDarkMode = body.classList.toggle("dark");
        localStorage.setItem("theme", isDarkMode ? "dark" : "light");
        button.textContent = isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode";
    });
});
