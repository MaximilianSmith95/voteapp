let allCategoriesData = []; // Global variable to store initial categories data
let currentCategoriesLimit = 15; // Start with 15 categories
let activeFilterFunction = null; // Track the currently active filter function

// Function to render a limited number of categories
function renderLimitedCategories(categories, limit = 15) {
    const limitedCategories = categories.slice(0, limit);
    renderCategories(limitedCategories); // Reuse existing render logic
}

// Function to set up "Explore More" button
function setupExploreMoreButton() {
    const exploreMoreButton = document.getElementById("exploreMoreButton");
    exploreMoreButton.addEventListener("click", () => {
        currentCategoriesLimit += 15; // Increase limit
        if (activeFilterFunction) {
            activeFilterFunction(currentCategoriesLimit); // Fetch and render more categories based on the current filter
        }
    });
}
function enableInfiniteScrolling() {
    window.addEventListener("scroll", () => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 10) { // Near bottom
            if (activeFilterFunction) {
                currentCategoriesLimit += 15; // Increment the limit
                activeFilterFunction(currentCategoriesLimit); // Fetch and render more
            } else {
                const searchTerm = document.getElementById("searchBar").value;
                if (searchTerm) {
                    fetch(`/api/search?query=${encodeURIComponent(searchTerm)}&limit=${currentCategoriesLimit}`)
                        .then(response => response.json())
                        .then(data => renderCategories(data))
                        .catch(error => console.error('Error fetching more results:', error));
                }
            }
        }
    });
}
// Function to fetch and render categories with a given limit
function fetchAndRenderCategories(url, limit = 15, transformFn = null) {
    fetch(url)
        .then(response => response.json())
        .then(data => {
            allCategoriesData = data; // Store the data globally
            let filteredData = allCategoriesData;
            if (transformFn) {
                filteredData = transformFn(allCategoriesData); // Apply transformation function if provided
            }
            renderLimitedCategories(filteredData, limit); // Render limited categories
        })
        .catch(error => console.error('Error fetching categories:', error));
}

document.addEventListener("DOMContentLoaded", () => {
    // Attach event listeners for navigation buttons
    document.getElementById("geolocationButton").addEventListener("click", () => {
        activeFilterFunction = fetchNearMeCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchNearMeCategories(currentCategoriesLimit);
    });

    document.getElementById("forYouButton").addEventListener("click", () => {
        activeFilterFunction = fetchForYouCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchForYouCategories(currentCategoriesLimit);
    });

    document.getElementById("allButton").addEventListener("click", () => {
        activeFilterFunction = fetchAllCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchAllCategories(currentCategoriesLimit);
    });

    document.getElementById("latestButton").addEventListener("click", () => {
        activeFilterFunction = fetchLatestCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchLatestCategories(currentCategoriesLimit);
    });

    console.log("Event listeners attached to navigation buttons.");

    // Default to "All Categories"
   activeFilterFunction = fetchAllCategories;
    fetchAllCategories(currentCategoriesLimit);
    setupExploreMoreButton(); // Set up the Explore More button
    enableInfiniteScrolling(); // Enable infinite scrolling
});

// Fetch functions for each filter
function fetchAllCategories(limit) {
    fetchAndRenderCategories(`/api/categories`, limit, (data) => shuffleArray([...data]));
}

function fetchForYouCategories(limit) {
    fetchAndRenderCategories(`/api/categories?type=for-you`, limit);
}

function fetchNearMeCategories(limit) {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatitude = position.coords.latitude;
                const userLongitude = position.coords.longitude;
                fetchAndRenderCategories(
                    `/api/categories?latitude=${userLatitude}&longitude=${userLongitude}&type=near`,
                    limit
                );
            },
            (error) => {
                console.error("Geolocation error:", error);
            }
        );
    } else {
        console.log("Geolocation is not available in this browser.");
    }
}


window.filterContent = function () {
    const searchTerm = document.getElementById("searchBar").value.toLowerCase();
    const categoriesContainer = document.getElementById("categories");

    // Clear existing content while fetching
    categoriesContainer.innerHTML = "<p>Loading...</p>";

    // Fetch matching categories and their subjects from the backend
    fetch(`/api/search?query=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                // Render all categories from the backend
                renderCategories(data, searchTerm);
            } else {
                categoriesContainer.innerHTML = "<p>No results found.</p>";
            }
        })
        .catch(error => {
            console.error('Error fetching search results:', error);
            categoriesContainer.innerHTML = "<p>Error fetching results. Please try again later.</p>";
        });
};

function fetchLatestCategories(limit) {
    fetchAndRenderCategories(`/api/categories`, limit, (data) => {
        return data.sort((a, b) => b.category_id - a.category_id); // Sort by category_id in descending order
    });
}

// Function to render categories in the DOM
// Function to render categories in the DOM
function renderCategories(categories, highlightSearchTerm = "") {
    const categoriesContainer = document.getElementById("categories");
    categoriesContainer.innerHTML = ""; // Clear existing content

    categories.forEach(category => {
        const categoryDiv = document.createElement("div");
        categoryDiv.classList.add("category");
        categoryDiv.setAttribute("data-category-id", category.category_id);

        // Render the category name
        let categoryName = category.name;
        if (highlightSearchTerm) {
            // Highlight the matching part of the category name
            const regex = new RegExp(`(${highlightSearchTerm})`, "gi");
            categoryName = categoryName.replace(regex, `<span class="highlighted">$1</span>`);
        }
        categoryDiv.innerHTML = `<h2>${categoryName}</h2>`;

        // Sort subjects by votes
        const sortedSubjects = category.subjects.sort((a, b) => b.votes - a.votes);

        // Create a scrollable container for the subjects
        const subjectsDiv = document.createElement("div");
        subjectsDiv.classList.add("subjects", "scrollable");

        // Render each subject within the category
        sortedSubjects.forEach(subject => {
            const subjectDiv = document.createElement("div");
            subjectDiv.classList.add("subject");
            subjectDiv.setAttribute("data-subject-id", subject.subject_id);

            // Highlight the matching part of the subject name
            let subjectName = subject.name;
            if (highlightSearchTerm) {
                const regex = new RegExp(`(${highlightSearchTerm})`, "gi");
                subjectName = subjectName.replace(regex, `<span class="highlighted">$1</span>`);
            }

            // Subject content
            subjectDiv.innerHTML = `
                <p style="display: inline-block;">
                    <a href="${subject.link}" target="_blank">${subjectName}</a>
                </p>
                <span class="vote-container">
                    <span class="vote-count">${subject.votes}</span>
                    <button class="vote-button" onclick="upvote(${subject.subject_id})">&#9650;</button>
                </span>
                <button onclick="toggleComments(${subject.subject_id})" class="comments-toggle">▼</button>
                <div id="comments-container-${subject.subject_id}" class="comments-container hidden">
                    <input type="text" id="comment-input-${subject.subject_id}" placeholder="Leave a Review..." />
                    <button onclick="addComment(${subject.subject_id})">Add Comment</button>
                    <div class="comments" id="comment-section-${subject.subject_id}"></div>
                </div>
            `;

            // Append the subject to the subjects container
            subjectsDiv.appendChild(subjectDiv);
        });

        // Append the subjects container to the category div
        categoryDiv.appendChild(subjectsDiv);

        // Append the category div to the main container
        categoriesContainer.appendChild(categoryDiv);
    });
}

// Function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to handle upvotes
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

                    const subjectDiv = voteCountElement.closest(".subject");
                    const subjectsContainer = subjectDiv.parentNode;

                    const subjectsArray = Array.from(subjectsContainer.children);
                    subjectsArray.sort((a, b) => {
                        const votesA = parseInt(a.querySelector(".vote-count").textContent);
                        const votesB = parseInt(b.querySelector(".vote-count").textContent);
                        return votesB - votesA;
                    });

                    subjectsArray.forEach(subject => subjectsContainer.appendChild(subject));
                }
            }
        })
        .catch(error => console.error('Error upvoting:', error));
}

// Function to toggle comment visibility
window.toggleComments = function (subjectId) {
    const commentsContainer = document.getElementById(`comments-container-${subjectId}`);
    commentsContainer.classList.toggle("hidden");

    const toggleButton = commentsContainer.previousElementSibling;
    toggleButton.textContent = commentsContainer.classList.contains("hidden") ? "▼" : "▲";
};

// Function to add a comment to a subject
function addComment(subjectId) {
    const commentInput = document.getElementById(`comment-input-${subjectId}`);
    const commentText = commentInput.value.trim();
    const username = `User${Math.floor(Math.random() * 1000)}`;

    if (commentText) {
        fetch(`/api/subjects/${subjectId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, comment_text: commentText })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                fetchComments(subjectId);
                commentInput.value = "";
            }
        })
        .catch(error => console.error('Error posting comment:', error));
    }
}

// Function to fetch comments
function fetchComments(subjectId) {
    fetch(`/api/subjects/${subjectId}/comments`)
        .then(response => response.json())
        .then(comments => {
            const commentContainer = document.getElementById(`comment-section-${subjectId}`);
            commentContainer.innerHTML = comments.map(comment => `
                <div class="comment">
                    <strong>${comment.username}</strong>: ${comment.comment_text}
                </div>
            `).join("");
        });
}

// Shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Show all categories in random order
window.showAllCategories = function () {
    const shuffledCategories = shuffleArray([...allCategoriesData]);
    renderCategories(shuffledCategories);
};

// Show latest categories in descending order of `category_id`
window.showLatestCategories = function () {
    const sortedCategories = [...allCategoriesData].sort((a, b) => b.category_id - a.category_id);
    renderCategories(sortedCategories);
};
// Ensure EmailJS is initialized
emailjs.init("T0TFQQo9j8d6RBLsj"); // Replace with your actual public key from EmailJS

// Show the modal when "Add Your Business/Content" button is clicked
document.getElementById("addContentButton").addEventListener("click", () => {
    const modal = document.getElementById("submitModal");
    modal.classList.remove("hidden");
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
});

// Hide the modal when "Close" button is clicked
document.getElementById("closeModal").addEventListener("click", () => {
    const modal = document.getElementById("submitModal");
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
    setTimeout(() => modal.classList.add("hidden"), 300);
});

// Close modal on outside click
document.getElementById("submitModal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
        const modal = document.getElementById("submitModal");
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";
        setTimeout(() => modal.classList.add("hidden"), 300);
    }
});

// Handle form submission
document.getElementById("contentForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        category: document.getElementById("category").value.trim(),
        subjects: document.getElementById("subjects").value.trim(),
    };

    if (!formData.name || !formData.email || !formData.category || !formData.subjects) {
        alert("Please fill in all fields before submitting.");
        return;
    }

    emailjs
        .send("service_jt3wsyn", "template_yi5z10s", formData)
        .then(() => {
            alert("Submission successful! We'll review your content and will add it within 24-72 hours.");
            document.getElementById("contentForm").reset();
            document.getElementById("submitModal").style.opacity = "0";
            setTimeout(() => document.getElementById("submitModal").classList.add("hidden"), 300);
        })
        .catch((error) => {
            console.error("Error sending email:", error);
            alert("An error occurred. Please try again later.");
        });
});
document.addEventListener("DOMContentLoaded", () => {
    const cookieConsent = document.getElementById("cookieConsent");
    const acceptCookiesButton = document.getElementById("acceptCookies");

    // Log visibility check
    console.log("Checking cookie consent visibility...");

    // Check if cookies were already accepted
    if (!localStorage.getItem("cookiesAccepted")) {
        cookieConsent.classList.remove("hidden");
        console.log("Cookie consent banner is now visible.");
    } else {
        console.log("Cookie consent already accepted.");
    }

    // Add event listener to accept cookies
    acceptCookiesButton.addEventListener("click", () => {
        localStorage.setItem("cookiesAccepted", "true");
        cookieConsent.classList.add("hidden");
        console.log("Cookie consent accepted and banner hidden.");
    });
});
