let allCategoriesData = []; // Global variable to store all categories data

document.addEventListener("DOMContentLoaded", () => {
    // Create overlay for zoom functionality
    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.classList.add("overlay");
    document.body.appendChild(overlay);

    // Fetch categories and render on page load
    fetchCategories();

    // Add event listener to overlay to reset zoom
    overlay.addEventListener("click", resetZoom);

    // Add search functionality
    const searchBar = document.getElementById("searchBar");
    if (searchBar) {
        searchBar.addEventListener("input", filterContent);
    }
});

// Fetch categories from the API
function fetchCategories() {
    fetch('/api/categories')
        .then(response => response.json())
        .then(data => {
            allCategoriesData = data; // Store fetched data globally
            const shuffledData = shuffleArray([...data]); // Shuffle the data for random display
            renderCategories(shuffledData); // Render categories
        })
        .catch(error => console.error('Error fetching categories:', error));
}

// Render categories dynamically
function renderCategories(categories) {
    const categoriesContainer = document.getElementById("categories");
    categoriesContainer.innerHTML = ""; // Clear previous content

    categories.forEach(category => {
        const categoryDiv = document.createElement("div");
        categoryDiv.classList.add("category");
        categoryDiv.setAttribute("data-category-id", category.category_id);

        categoryDiv.innerHTML = `
            <h2>${category.name}</h2>
            <button class="magnify-icon" onclick="zoomCategory(this)">🔍</button>
            <div class="subjects scrollable">
                ${category.subjects
                    .map(subject => `
                        <div class="subject">
                            <a href="${subject.link}" target="_blank">${subject.name}</a>
                            <span class="vote-count">${subject.votes}</span>
                        </div>
                    `)
                    .join("")}
            </div>
        `;

        categoriesContainer.appendChild(categoryDiv);
    });

    enableCategoryZoom(); // Attach zoom functionality to newly rendered categories
}

// Add zoom functionality to all categories
function enableCategoryZoom() {
    document.querySelectorAll(".category h2").forEach(title => {
        title.addEventListener("click", () => {
            resetZoom(); // Remove zoom from all categories
            const category = title.parentElement;
            category.classList.add("zoomed"); // Add zoom effect
            document.getElementById("overlay").classList.add("active"); // Show overlay
        });
    });
}

// Handle zoom when clicking the magnify button
function zoomCategory(button) {
    resetZoom(); // Remove zoom from all categories
    const category = button.parentElement; // Get the parent category
    category.classList.add("zoomed"); // Add zoom effect
    document.getElementById("overlay").classList.add("active"); // Show overlay
}

// Reset zoom and overlay
function resetZoom() {
    document.querySelectorAll(".category").forEach(category => {
        category.classList.remove("zoomed");
    });
    document.getElementById("overlay").classList.remove("active");
}

// Filter content based on search input
function filterContent() {
    const searchTerm = document.getElementById("searchBar").value.toLowerCase();
    const categories = document.querySelectorAll(".category");

    categories.forEach(category => {
        const categoryName = category.querySelector("h2").textContent.toLowerCase();
        const subjects = Array.from(category.querySelectorAll(".subject"));
        let isCategoryMatch = categoryName.includes(searchTerm);
        let hasMatchingSubject = false;

        subjects.forEach(subject => {
            const subjectName = subject.textContent.toLowerCase();
            const isSubjectMatch = subjectName.includes(searchTerm);
            subject.style.display = isSubjectMatch ? "block" : "none";
            if (isSubjectMatch) hasMatchingSubject = true;
        });

        category.style.display = isCategoryMatch || hasMatchingSubject ? "block" : "none";
    });
}

// Function to fetch categories by geolocation
function fetchCategoriesByGeolocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;

                fetch(`/api/categories?latitude=${latitude}&longitude=${longitude}`)
                    .then(response => response.json())
                    .then(data => {
                        allCategoriesData = data; // Update global data
                        renderCategories(data); // Render sorted categories
                    })
                    .catch(error => console.error('Error fetching geolocated categories:', error));
            },
            error => console.error('Geolocation error:', error)
        );
    } else {
        console.log("Geolocation is not supported in this browser.");
    }
}

// Shuffle and display all categories
function shuffleCategories() {
    const shuffledCategories = shuffleArray([...allCategoriesData]); // Shuffle a copy of the data
    renderCategories(shuffledCategories);
}

// Sort categories by latest (based on ID)
function sortCategoriesByLatest() {
    const sortedCategories = [...allCategoriesData].sort((a, b) => b.category_id - a.category_id);
    renderCategories(sortedCategories);
}

// Function to add upvotes to a subject
function upvote(subjectId) {
    fetch(`/api/subjects/${subjectId}/vote`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const voteCountElement = document.querySelector(`[data-subject-id="${subjectId}"] .vote-count`);
                if (voteCountElement) {
                    const newVoteCount = parseInt(voteCountElement.textContent) + 1;
                    voteCountElement.textContent = newVoteCount;
                }
            }
        })
        .catch(error => console.error('Error upvoting:', error));
}

// Function to shuffle array randomly
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}






    

    
