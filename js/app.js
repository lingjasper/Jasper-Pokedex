document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "b2w2_living_dex_saved_state";

    // Load saved states from localStorage
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

    // Restore saved checkmarks
    Object.keys(savedState).forEach(id => {
      if (savedState[id]) {
        const cell = document.querySelector(`.cell[data-id="${id}"]`);
        if (cell) {
          cell.classList.add("completed");
        }
      }
    });

    // Handle clicks/taps on cells
    document.querySelectorAll(".cell:not(.empty)").forEach(cell => {
      cell.addEventListener("click", () => {
        const id = cell.getAttribute("data-id");
        const isCompleted = cell.classList.toggle("completed");

        // Save updated state back to localStorage
        const currentState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        currentState[id] = isCompleted;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
      });
    });
  });
