let allCategoriesData = []; // Global variable to store initial categories data
let currentCategoriesLimit = 15; // Start with 15 categories
let activeFilterFunction = null; // Track the currently active filter function
let infiniteScrollEnabled = true; // Control infinite scroll behavior

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

// Function to enable infinite scrolling
function enableInfiniteScrolling() {
    window.addEventListener("scroll", () => {
        if (!infiniteScrollEnabled) return; // Disable if not applicable

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 10) { // Near bottom
            if (activeFilterFunction) {
                currentCategoriesLimit += 15; // Increment the limit
                activeFilterFunction(currentCategoriesLimit); // Fetch and render more
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
    // Get the token and username from localStorage
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    // Profile Section Handling (visible only when logged in)
    const profileSection = document.getElementById("profileSection");
    const usernameDisplay = document.getElementById("usernameDisplay");
    const profileDropdown = document.getElementById("profileDropdown");
    const editInterestsSection = document.getElementById("editInterestsSection");
    const selectedInterestsList = document.getElementById("selectedInterestsList");
    
    let selectedInterests = JSON.parse(localStorage.getItem("selectedInterests")) || [];

fetch('/api/categories', {
    method: 'GET',
    headers: {
        'selected-interests': JSON.stringify(selectedInterests) // Send selected interests
    }
})
.then(response => response.json())
.then(data => {
    // Handle the sorted categories
    renderCategories(data);
})
.catch(error => console.log(error));

    // Function to update the "X" button and mark selected interests
    function updateInterestButton(interestButton, interest) {
        // Check if the interest is in the selected interests
        if (selectedInterests.includes(interest)) {
            // Add the "X" button to the interest button
            interestButton.innerHTML = `${interest} <span class="remove-btn">×</span>`;
        } else {
            // Reset the interest button to its original state (no "X")
            interestButton.innerHTML = `${interest}`;
        }

        // Add event listener to the "X" button for removal
        const removeButton = interestButton.querySelector(".remove-btn");
        if (removeButton) {
            removeButton.addEventListener("click", (e) => {
                // Prevent bubbling to avoid triggering the main button click
                e.stopPropagation();
                // Remove the interest when "X" is clicked
                removeInterest(interest);
                updateInterestButton(interestButton, interest); // Update the button state
            });
        }
    }

    // Handle interest selection (adds the interest to the list)
    const interestButtons = document.querySelectorAll(".interestBtn");
    interestButtons.forEach(button => {
        const interest = button.textContent.trim();
        // Initially update the button based on whether it's selected
        updateInterestButton(button, interest);

        button.addEventListener("click", () => {
            if (selectedInterests.includes(interest)) {
                // Remove the interest from the list if it's already selected
                removeInterest(interest);
                updateInterestButton(button, interest); // Update button state
            } else {
                // Add the interest to the list if it's not already selected
                selectedInterests.push(interest);
                localStorage.setItem("selectedInterests", JSON.stringify(selectedInterests)); // Persist in localStorage
                updateInterestButton(button, interest); // Update the button state
            }
        });
    });

    // Handle interest removal
    function removeInterest(interest) {
        // Remove the interest from the array
        selectedInterests = selectedInterests.filter(item => item !== interest);
        // Update the localStorage with the new array of selected interests
        localStorage.setItem("selectedInterests", JSON.stringify(selectedInterests)); // Persist in localStorage
    }

    // Handle the profile section visibility and dropdown toggle
    if (token && username) {
        profileSection.classList.remove("hidden");
        usernameDisplay.textContent = username;

        // Add a click event to toggle the dropdown menu
        usernameDisplay.addEventListener("click", () => {
            profileDropdown.classList.toggle("hidden");
        });

        // Handling dropdown options
        document.getElementById("historyLink").addEventListener("click", () => {
            // Handle History action (You can redirect or open a modal)
            alert("History clicked");
        });

        document.getElementById("editProfileLink").addEventListener("click", () => {
            // Handle Edit Profile action (You can open a modal to change the profile picture)
            alert("Edit Profile Picture clicked");
        });

        // Show the Edit Interests section when "Edit Interests" is clicked
       document.getElementById("editInterestsLink").addEventListener("click", function () {
    const interestButtons = document.getElementById("interestButtons");
    interestButtons.classList.toggle("hidden");
});
    } else {
        // If the user is not logged in, ensure the profile section is hidden
        profileSection.classList.add("hidden");
    }

   const feedButton = document.getElementById("feedButton"); // Ensure feedButton is correctly selected
const interestButtonsSection = document.getElementById("interestButtons"); // Select the interestButtonsSection

feedButton.addEventListener("click", () => {
    const selectedInterests = JSON.parse(localStorage.getItem("selectedInterests")) || [];
    let currentFeedLimit = 50; // Start with 15 categories

    if (selectedInterests.length === 0) {
        alert("Please select at least one interest to view your personalized feed.");
        return;
    }

    interestButtonsSection.style.display = "none";

    function fetchFeedCategories(limit) {
        fetch('/api/categories', {
            method: 'GET',
            headers: {
                'selected-interests': JSON.stringify(selectedInterests)
            }
        })
            .then(response => response.json())
            .then(data => {
                renderLimitedCategories(data, limit); // Render only `limit` categories
            })
            .catch(error => console.error('Error refreshing the feed:', error));
    }

    // Initial fetch for the first 15 categories
    fetchFeedCategories(currentFeedLimit);

    // "Explore More" button to load more categories
    const exploreMoreButton = document.getElementById("exploreMoreButton");
    exploreMoreButton.style.display = "inline-block";
    exploreMoreButton.addEventListener("click", () => {
        currentFeedLimit += 50; // Increment the limit by 15
        fetchFeedCategories(currentFeedLimit); // Fetch and render additional categories
    });
});


    // Handle Login/Logout button functionality
    const loginLogoutButton = document.getElementById("loginButtonTop"); // Login/Logout button

    // Show/hide buttons based on login state
    if (token) {
        loginLogoutButton.textContent = "Logout";  // Change Login button to Logout
        feedButton.style.display = "inline-block"; // Show Feed button
    } else {
        loginLogoutButton.textContent = "Login";  // Show Login button
        feedButton.style.display = "none";        // Hide Feed button
    }

    // Handle Login/Logout button click
    loginLogoutButton.addEventListener("click", () => {
        if (token) {
            // User is logged in, so log out by removing the token
            localStorage.removeItem("token");
            localStorage.removeItem("username");
            alert("Logged out successfully!");
            location.reload();  // Reload the page to update UI
        } else {
            // User is not logged in, so show the login modal
            document.getElementById('loginModal').classList.remove('hidden');
            document.getElementById('loginModal').classList.add('visible');
        }
    });

    // Open Sign-Up Modal
    document.getElementById('signUpButton').addEventListener('click', function () {
        const signUpModal = document.getElementById('signUpModal');
        signUpModal.classList.remove('hidden');
        signUpModal.classList.add('visible');
    });

    // Open Login Modal
    document.getElementById('loginButtonTop').addEventListener('click', function () {
        const loginModal = document.getElementById('loginModal');
        loginModal.classList.remove('hidden');
        loginModal.classList.add('visible');
    });

    // Close Sign-Up Modal
    document.getElementById('closeSignUpModal').addEventListener('click', function () {
        const signUpModal = document.getElementById('signUpModal');
        signUpModal.classList.add('hidden');
        signUpModal.classList.remove('visible');
    });

    // Close Login Modal
    document.getElementById('closeLoginModal').addEventListener('click', function () {
        const loginModal = document.getElementById('loginModal');
        loginModal.classList.add('hidden');
        loginModal.classList.remove('visible');
    });

    // Sign-Up Form Submission
    document.getElementById('signUpForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('signUpName').value;
        const email = document.getElementById('signUpEmail').value;
        const password = document.getElementById('signUpPassword').value;

        // Send Sign-Up data to backend
        fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: name, email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                alert('Registration successful! Please log in.');
                document.getElementById('signUpModal').classList.add('hidden');
            } else if (data.error) {
                alert('Registration failed: ' + data.error);
            }
        })
        .catch(error => console.error('Error:', error));
    });
});


    // Login Form Submission
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        // Send Log-In data to backend
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.token) {
                localStorage.setItem("token", data.token);  // Store token
                localStorage.setItem("username", data.username);  // Store username
                alert('Login successful!');
                document.getElementById('loginModal').classList.add('hidden');
                location.reload();  // Reload page to update state
            } else {
                alert('Login failed: ' + data.error);
            }
        })
        .catch(error => console.error('Error:', error));
    });

    // Set up filters and event listeners (e.g., for "For You" and "All" categories)
    document.getElementById("forYouButton").addEventListener("click", () => {
        infiniteScrollEnabled = true;
        activeFilterFunction = fetchForYouCategories;
        currentCategoriesLimit = 15;
        fetchForYouCategories(currentCategoriesLimit);
    });

    document.getElementById("allButton").addEventListener("click", () => {
        infiniteScrollEnabled = true;
        activeFilterFunction = fetchAllCategories;
        currentCategoriesLimit = 15;
        fetchAllCategories(currentCategoriesLimit);
    });

    document.getElementById("latestButton").addEventListener("click", () => {
        infiniteScrollEnabled = true;
        activeFilterFunction = fetchLatestCategories;
        currentCategoriesLimit = 15;
        fetchLatestCategories(currentCategoriesLimit);
    });

    // Set default filter to show all categories
    activeFilterFunction = fetchAllCategories;
    fetchAllCategories(currentCategoriesLimit);
    setupExploreMoreButton();  // Set up Explore More button
    enableInfiniteScrolling();  // Enable infinite scrolling

    // Handle Geolocation Button for fetching near me categories
    document.getElementById("geolocationButton").addEventListener("click", () => {
        infiniteScrollEnabled = true; // Enable infinite scroll
        activeFilterFunction = fetchNearMeCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchNearMeCategories(currentCategoriesLimit);
    });

// Ensure the modal visibility toggle works properly using `hidden` and `visible` CSS classes
// CSS should hide elements with `.hidden` class and show them with `.visible` class


// Search functionality with infinite scroll disabled
window.filterContent = function () {
    const searchTerm = document.getElementById("searchBar").value.toLowerCase();
    const categoriesContainer = document.getElementById("categories");

    // Clear existing content while fetching
    categoriesContainer.innerHTML = "<p>Loading...</p>";

    // Disable infinite scroll for searches
    infiniteScrollEnabled = false;

    // Fetch matching categories and their subjects from the backend
    fetch(`/api/search?query=${encodeURIComponent(searchTerm)}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                renderCategories(data, searchTerm); // Render search results
            } else {
                categoriesContainer.innerHTML = "<p>No results found.</p>";
            }
        })
        .catch(error => console.error('Error fetching search results:', error));
};


// Fetch functions for each filter
function fetchAllCategories(limit) {
    fetch(`/api/categories`)
        .then(response => response.json())
        .then(data => {
            // Find the prioritized category
            const prioritizedCategory = data.find(category => category.category_id === 918);
            const remainingCategories = data.filter(category => category.category_id !== 918);

            // Shuffle remaining categories and prepend the prioritized one
            const shuffledCategories = prioritizedCategory
                ? [prioritizedCategory, ...shuffleArray(remainingCategories)]
                : shuffleArray(remainingCategories);

            // Render the categories
            renderLimitedCategories(shuffledCategories, limit);
        })
        .catch(error => console.error('Error fetching categories:', error));
}

function fetchForYouCategories(limit) {
    fetchAndRenderCategories(`/api/categories?type=for-you`, limit, (data) => {
        // Prioritize "For You" logic, ensuring randomized fallback categories are also displayed
        if (data.length === 0) {
            return shuffleArray(data);
        }
        return data;
    });
}

// Infinite scrolling integration
enableInfiniteScrolling();
setupExploreMoreButton();


function fetchLatestCategories(limit) {
    fetchAndRenderCategories(`/api/categories`, limit, (data) => {
        return data.sort((a, b) => b.category_id - a.category_id); // Sort by category_id in descending order
    });
}

function fetchNearMeCategories(limit) {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatitude = position.coords.latitude;
                const userLongitude = position.coords.longitude;
 fetch(`/api/categories?latitude=${userLatitude}&longitude=${userLongitude}&limit=${limit}`)
                    .then(response => response.json())
                    .then(data => {
                        renderLimitedCategories(data, limit); // Render categories as received
                    })
                    .catch(error => console.error('Error fetching nearby categories:', error));
            },
            (error) => {
                console.error("Geolocation error:", error);
            }
        );
    } else {
        console.log("Geolocation is not available in this browser.");
    }
}


// Updated: Upvote and Track Preferences
// Updated: Upvote and Track Preferences
function upvote(subjectId, categoryId) {
    fetch(`/api/subjects/${subjectId}/vote`, {
        method: 'POST',
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const voteCountElement = document.querySelector(
                    `[data-subject-id="${subjectId}"] .vote-count`
                );
                if (voteCountElement) {
                    const newVoteCount = parseInt(voteCountElement.textContent) + 1;
                    voteCountElement.textContent = newVoteCount;
                }

                // Track user preference for the category
                trackUserPreference(categoryId);
            }
        })
        .catch(error => console.error('Error upvoting:', error));
}

// New: Track User Preferences with Cookies
function trackUserPreference(categoryId) {
    let preferences = JSON.parse(getCookie('preferences') || '{}');
    preferences[categoryId] = (preferences[categoryId] || 0) + 1;
    setCookie('preferences', JSON.stringify(preferences), 365); // Persist for 1 year
}

// Updated: Render Categories with "Recommended" Label
function renderCategories(categories, highlightSearchTerm = '') {
    const categoriesContainer = document.getElementById('categories');
    categoriesContainer.innerHTML = ''; // Clear existing content

    categories.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('category');
        categoryDiv.setAttribute('data-category-id', category.category_id);

        // Render the category name
        let categoryName = category.name;
        if (highlightSearchTerm) {
            const regex = new RegExp(`(${highlightSearchTerm})`, 'gi');
            categoryName = categoryName.replace(regex, `<span class="highlighted">$1</span>`);
        }
        categoryDiv.innerHTML = `<h2>${categoryName}</h2>`;

        // Render subjects sorted by votes
        const sortedSubjects = category.subjects.sort((a, b) => b.votes - a.votes);
        const subjectsDiv = document.createElement('div');
        subjectsDiv.classList.add('subjects', 'scrollable');

        sortedSubjects.forEach(subject => {
            const subjectDiv = document.createElement('div');
            subjectDiv.classList.add('subject');
            subjectDiv.setAttribute('data-subject-id', subject.subject_id);
            subjectDiv.innerHTML = `
                <p><a href="${escapeHTML(subject.link)}" target="_blank">${escapeHTML(subject.name)}</a></p>
                <span class="vote-container">
                    <span class="vote-count">${subject.votes}</span>
                    <button class="vote-button" onclick="upvote(${subject.subject_id}, ${category.category_id})">&#9650;</button>
                </span>
                <button onclick="toggleComments(${subject.subject_id})" class="comments-toggle">▼</button>
                <div id="comments-container-${subject.subject_id}" class="comments-container hidden">
                    <input type="text" id="comment-input-${subject.subject_id}" placeholder="Leave a Review..." />
                    <button onclick="addComment(${subject.subject_id})">Add Comment</button>
                    <div class="comments" id="comment-section-${subject.subject_id}"></div>
                </div>
            `;
            subjectsDiv.appendChild(subjectDiv);
        });

        categoryDiv.appendChild(subjectsDiv);
        categoriesContainer.appendChild(categoryDiv);
    });
}

// Toggle Comments Function: Show/Hide Comments Below the Relevant Subject
function toggleComments(subjectId) {
    const commentsContainer = document.getElementById(`comments-container-${subjectId}`);
    const toggleButton = document.querySelector(`[data-subject-id="${subjectId}"] .comments-toggle`);

    // Toggle visibility of comments
    commentsContainer.classList.toggle('hidden');

    // Update button text or icon based on visibility
    toggleButton.textContent = commentsContainer.classList.contains('hidden') ? '▼' : '▲';
}

// Sanitize Input
function sanitizeInput(input) {
    return input.replace(/https?:\/\/[^\s]+/g, ''); // Remove URLs
}

// Validate Comment Content
function isValidComment(input) {
    const validPattern = /^[a-zA-Z0-9\s.,!?]+$/; // Adjust as necessary
    return validPattern.test(input);
}

// Escape HTML for Safe Rendering
function escapeHTML(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Validate and Add Comment
function addComment(subjectId) {
    const commentInput = document.getElementById(`comment-input-${subjectId}`);
    let commentText = commentInput.value.trim();

    // Sanitize and validate input
    commentText = sanitizeInput(commentText);
    if (!isValidComment(commentText)) {
        alert("Your comment contains invalid content.");
        return;
    }

    // Check comment length
    const maxLength = 200;
    if (commentText.length > maxLength) {
        alert("Your comment is too long.");
        return;
    }

    // Flag prohibited content
    const flaggedKeywords = ["spam", "malware", "phishing"]; // Extend as needed
    if (flaggedKeywords.some(keyword => commentText.includes(keyword))) {
        alert("Your comment contains prohibited content.");
        return;
    }

    // Sanitize for safe rendering and proceed to submit
    const sanitizedText = escapeHTML(commentText);
    fetch(`/api/subjects/${subjectId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_text: sanitizedText })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Prepend the new comment
                const commentContainer = document.getElementById(`comment-section-${subjectId}`);
                const newComment = document.createElement('div');
                newComment.classList.add('comment');
                newComment.innerHTML = `
                    <strong>User:</strong> ${sanitizedText}
                `;
                commentContainer.prepend(newComment);
                commentInput.value = ''; // Clear input
            }
        })
        .catch(error => console.error('Error adding comment:', error));
}

// Updated: Navigation Event Listener for "For You" Button
document.getElementById('forYouButton').addEventListener('click', () => {
    infiniteScrollEnabled = true; // Enable infinite scroll
    activeFilterFunction = fetchForYouCategories;
    currentCategoriesLimit = 15; // Reset limit
    fetchForYouCategories(currentCategoriesLimit);
});

// Updated: Utility Functions for Cookies
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000); // Convert days to milliseconds
    const expires = 'expires=' + date.toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + ';' + expires + ';path=/';
}

function getCookie(name) {
    const value = '; ' + document.cookie;
    const parts = value.split('; ' + name + '=');
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

// Voting functionality
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

                    // Reorder subjects dynamically after vote
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

// Add and fetch comments functionality remains as provided in the original script.


// Variables for media recorder
// let mediaRecorder;
// let audioChunks = [];

// Function to initialize voice recording controls dynamically
// function initializeVoiceRecordingControls(subjectId) {
//     const commentsContainer = document.getElementById(`comments-container-${subjectId}`);

//     // Create the voice review section dynamically
//     const voiceReviewSection = document.createElement("div");
//     voiceReviewSection.id = `voice-review-section-${subjectId}`;
//     voiceReviewSection.classList.add("hidden"); // Initially hidden
//     voiceReviewSection.innerHTML = `
//         <button id="record-${subjectId}" onclick="startRecording(${subjectId})">Start Recording</button>
//         <button id="stop-${subjectId}" class="hidden" onclick="stopRecording(${subjectId})">Stop Recording</button>
//         <audio id="audio-preview-${subjectId}" controls class="hidden"></audio>
//         <button id="submit-voice-${subjectId}" class="hidden" onclick="submitVoiceReview(${subjectId})">Submit Voice Review</button>
//     `;

//     // Toggle visibility for voice review section
//     const voiceReviewToggle = document.createElement("button");
//     voiceReviewToggle.textContent = "Record Voice Review";
//     voiceReviewToggle.onclick = () => voiceReviewSection.classList.toggle("hidden");

//     // Append controls to the comments container
//     commentsContainer.appendChild(voiceReviewToggle);
//     commentsContainer.appendChild(voiceReviewSection);
// }


// Function to toggle comment visibility
window.toggleComments = function (subjectId) {
    const commentsContainer = document.getElementById(`comments-container-${subjectId}`);
    commentsContainer.classList.toggle("hidden");

    const toggleButton = commentsContainer.previousElementSibling;
    toggleButton.textContent = commentsContainer.classList.contains("hidden") ? "▼" : "▲";

    if (!commentsContainer.classList.contains("hidden")) {
        if (!commentsContainer.dataset.loaded) {
            fetchComments(subjectId);
            enableCommentInfiniteScroll(subjectId);
            commentsContainer.dataset.loaded = true; // Mark as loaded
        }
    }
};

// Function to create and return a comment HTML element
function createCommentElement(commentData) {
    const commentElement = document.createElement('div');
    commentElement.classList.add('comment');
    commentElement.innerHTML = `
        <strong>${commentData.username}:</strong> ${escapeHTML(commentData.text)}
        <span class="comment-time">${new Date(commentData.createdAt).toLocaleString()}</span>
    `;
    return commentElement;
}

function getUsernameFromCookie() {
    return getCookie('username'); // Assume 'username' is set as a cookie when the user logs in.
}

function addComment(subjectId) {
    const commentInput = document.getElementById(`comment-input-${subjectId}`);
    const commentText = commentInput.value.trim();
    const username = getUsernameFromCookie() || localStorage.getItem("username");


    if (!username) {
        alert("You need to sign in to leave a comment.");
        return;
    }

    if (commentText) {
        fetch(`/api/subjects/${subjectId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, comment_text: commentText })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Prepend the new comment to the top of the list
                const commentContainer = document.getElementById(`comment-section-${subjectId}`);
                const newCommentElement = createCommentElement(data.comment);
                commentContainer.prepend(newCommentElement);

                commentInput.value = ""; // Clear input field
            }
        })
        .catch(error => console.error('Error posting comment:', error));
    }
}

function enableCommentInfiniteScroll(subjectId) {
    const commentsContainer = document.getElementById(`comment-section-${subjectId}`);
    let currentPage = 1;
    let isLoading = false;

    commentsContainer.addEventListener('scroll', () => {
        if (
            commentsContainer.scrollTop + commentsContainer.clientHeight >= commentsContainer.scrollHeight - 10 &&
            !isLoading
        ) {
            isLoading = true;
            currentPage++;
            fetchComments(subjectId, currentPage).then(() => {
                isLoading = false;
            });
        }
    });
}



// Function to fetch comments and voice reviews together
function fetchComments(subjectId, page = 1, limit = 10) {
    fetch(`/api/subjects/${subjectId}/comments?page=${page}&limit=${limit}`)
        .then(response => response.json())
        .then(data => {
            const commentContainer = document.getElementById(`comment-section-${subjectId}`);
            
            // Append new comments
            data.comments.forEach(comment => {
                const commentElement = createCommentElement(comment);
                commentContainer.appendChild(commentElement);
            });

            if (data.hasMore) {
                console.log("Setting up infinite scroll for page", page + 1); // Debug
                setupInfiniteScroll(subjectId, page + 1, limit);
            } else {
                console.log("No more comments to load"); // Debug
            }
        })
        .catch(error => console.error("Error fetching comments:", error));
}

function setupInfiniteScroll(subjectId, nextPage, limit = 10) {
    const commentContainer = document.getElementById(`comment-section-${subjectId}`);
    const onScroll = () => {
        if (commentContainer.scrollTop + commentContainer.clientHeight >= commentContainer.scrollHeight - 10) {
            fetchComments(subjectId, nextPage, limit);
            commentContainer.removeEventListener('scroll', onScroll); // Remove listener once triggered
        }
    };

    commentContainer.addEventListener('scroll', onScroll);
}

// Call setupInfiniteScroll in toggleComments when the section is expanded
window.toggleComments = function (subjectId) {
    const commentsContainer = document.getElementById(`comments-container-${subjectId}`);
    commentsContainer.classList.toggle("hidden");

    if (!commentsContainer.classList.contains("hidden") && !commentsContainer.dataset.loaded) {
        fetchComments(subjectId);
        setupInfiniteScroll(subjectId, 2); // Initialize infinite scroll starting at page 2
        commentsContainer.dataset.loaded = true; // Mark as loaded
    }
};

// Helper to create a comment element
function createCommentElement(comment) {
    const commentElement = document.createElement("div");
    commentElement.classList.add("comment");

    const usernameElement = document.createElement("strong");
    usernameElement.textContent = `${comment.username}: `;
    commentElement.appendChild(usernameElement);

    if (comment.text) {
        const textElement = document.createElement("p");
        textElement.textContent = comment.text; // Ensure comment text is rendered
        commentElement.appendChild(textElement);
    }

    return commentElement;
}



// // Function to start recording voice reviews
// // Start recording
// function startRecording(subjectId) {
//     navigator.mediaDevices.getUserMedia({ audio: true })
//         .then((stream) => {
//             mediaRecorder = new MediaRecorder(stream);
//             mediaRecorder.start();

//             audioChunks = [];
//             mediaRecorder.ondataavailable = (event) => {
//                 audioChunks.push(event.data);
//             };

//             mediaRecorder.onstop = () => {
//                 const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
//                 const audioUrl = URL.createObjectURL(audioBlob);

//                 const audioPreview = document.getElementById(`audio-preview-${subjectId}`);
//                 audioPreview.src = audioUrl;
//                 audioPreview.classList.remove("hidden");

//                 const submitButton = document.getElementById(`submit-voice-${subjectId}`);
//                 submitButton.dataset.audioBlob = audioBlob;
//                 submitButton.classList.remove("hidden");
//             };

//             document.getElementById(`record-${subjectId}`).classList.add("hidden");
//             document.getElementById(`stop-${subjectId}`).classList.remove("hidden");
//         })
//         .catch((error) => console.error("Error accessing microphone:", error));
// }

// // Stop recording
// function stopRecording(subjectId) {
//     mediaRecorder.stop();
//     document.getElementById(`stop-${subjectId}`).classList.add("hidden");
//     document.getElementById(`record-${subjectId}`).classList.remove("hidden");
// }


// // Function to submit the recorded voice review
// function submitVoiceReview(subjectId) {
//     const submitButton = document.getElementById(`submit-voice-${subjectId}`);
//     const audioBlob = submitButton.dataset.audioBlob;

//     if (!audioBlob) {
//         alert("No audio recording found. Please record your review before submitting.");
//         return;
//     }
    
// const username = localStorage.getItem('username') || generateRandomUsername();
    
//     const formData = new FormData();
//     console.log(audioBlob)
//     formData.append("audio", audioBlob); // Attach the audio file
//     formData.append("username", username); // Replace with actual username logic if needed

//     fetch(`/api/subjects/${subjectId}/voice-review`, {
//         method: "POST",
//         body: formData,
//     })
//         .then((response) => response.json())
//         .then((data) => {
//             if (data.success) {
//                 alert("Voice review submitted successfully!");
//                 fetchComments(subjectId); // Reload comments to show the new voice review
//             } else {
//                 console.error("Failed to submit voice review:", data.error);
//                 alert("Failed to submit voice review. Please try again.");
//             }
//         })
//         .catch((error) => {
//             console.error("Error submitting voice review:", error);
//             alert("An error occurred while submitting your review. Please try again.");
//         });
// }


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

    // Check if cookies were already accepted
    if (!getCookie("cookiesAccepted")) {
        cookieConsent.classList.remove("hidden"); // Show the banner
        console.log("Cookie consent banner is now visible.");
    } else {
        console.log("Cookie consent already accepted.");
    }

    // Add event listener to accept cookies
    acceptCookiesButton.addEventListener("click", () => {
        setCookie("cookiesAccepted", "true", 365); // Set cookie for 1 year
        cookieConsent.classList.add("hidden"); // Hide the banner
        console.log("Cookie consent accepted and banner hidden.");
    });
});

// Utility function to set a cookie with an expiration date
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000); // Convert days to milliseconds
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
}

// Utility function to get a cookie value by name
function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
    return null;
}


// Utility function to track user behavior (e.g., votes) in cookies
function trackUserBehavior(action, data) {
    let behaviorData = JSON.parse(getCookie("userBehavior") || "{}");

    if (!behaviorData[action]) {
        behaviorData[action] = [];
    }

    // Avoid duplicate entries
    if (!behaviorData[action].includes(data)) {
        behaviorData[action].push(data);
        setCookie("userBehavior", JSON.stringify(behaviorData), 365); // Persist for 1 year
        console.log(`Action tracked: ${action} - ${data}`);
    }
}

// Example usage: Track user voting behavior
function upvote(subjectId) {
    fetch(`/api/subjects/${subjectId}/vote`, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update UI
                const voteCountElement = document.querySelector(`[data-subject-id="${subjectId}"] .vote-count`);
                if (voteCountElement) {
                    const newVoteCount = parseInt(voteCountElement.textContent) + 1;
                    voteCountElement.textContent = newVoteCount;
                }

                // Track vote behavior
                trackUserBehavior("votes", subjectId);
            }
        })
        .catch(error => console.error('Error upvoting:', error));
}

// On page load, retrieve and apply stored user behavior (e.g., highlight votes)
document.addEventListener("DOMContentLoaded", () => {
    const userBehavior = JSON.parse(getCookie("userBehavior") || "{}");

    if (userBehavior.votes) {
        userBehavior.votes.forEach(subjectId => {
            const subjectElement = document.querySelector(`[data-subject-id="${subjectId}"]`);
            if (subjectElement) {
                subjectElement.classList.add("voted");
            }
        });
    }
});
function fetchAndDisplayTotalVotes() {
    fetch('/api/totalVotes')
        .then(response => response.json())
        .then(data => {
            const totalVotesElement = document.getElementById('totalVotesDisplay');
            if (totalVotesElement) {
                totalVotesElement.textContent = `Total Votes: ${data.totalVotes}`;
            }
        })
        .catch(error => console.error('Error fetching total votes:', error));
    }
    
    // Fetch total votes every 10 seconds to keep it updated
    setInterval(fetchAndDisplayTotalVotes, 10000);
    document.addEventListener('DOMContentLoaded', fetchAndDisplayTotalVotes);

function submitVoiceReview(subjectId) {
    const submitButton = document.getElementById(`submit-voice-${subjectId}`);
    const audioBlob = submitButton.dataset.audioBlob;

    const formData = new FormData();
    formData.append("audio", audioBlob);
    formData.append("username", "User123"); // Optional username

    console.log([...formData.entries()]);
    
    fetch(`/api/subjects/${subjectId}/voice-review`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert("Voice review submitted successfully!");
            fetchComments(subjectId); // Reload comments to show new review
        }
    })
    .catch(error => console.error('Error submitting voice review:', error));
}
document.addEventListener("DOMContentLoaded", () => {
    const darkModeToggle = document.getElementById("darkModeToggle");

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    darkModeToggle.textContent = savedTheme === "dark" ? "Light Mode" : "Dark Mode";

    // Toggle theme on button click
    darkModeToggle.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);

        // Update button text
        darkModeToggle.textContent = newTheme === "dark" ? "Light Mode" : "Dark Mode";
    });
});
