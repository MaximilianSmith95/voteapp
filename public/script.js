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
    // Attach event listeners for navigation buttons
    document.getElementById("geolocationButton").addEventListener("click", () => {
        infiniteScrollEnabled = true; // Enable infinite scroll
        activeFilterFunction = fetchNearMeCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchNearMeCategories(currentCategoriesLimit);
    });

    document.getElementById("forYouButton").addEventListener("click", () => {
        infiniteScrollEnabled = true; // Enable infinite scroll
        activeFilterFunction = fetchForYouCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchForYouCategories(currentCategoriesLimit);
    });

    document.getElementById("allButton").addEventListener("click", () => {
        infiniteScrollEnabled = true; // Enable infinite scroll
        activeFilterFunction = fetchAllCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchAllCategories(currentCategoriesLimit);
    });

    document.getElementById("latestButton").addEventListener("click", () => {
        infiniteScrollEnabled = true; // Enable infinite scroll
        activeFilterFunction = fetchLatestCategories;
        currentCategoriesLimit = 15; // Reset limit
        fetchLatestCategories(currentCategoriesLimit);
    });

    // Default to "All Categories"
    activeFilterFunction = fetchAllCategories;
    fetchAllCategories(currentCategoriesLimit);
    setupExploreMoreButton(); // Set up the Explore More button
    enableInfiniteScrolling(); // Enable infinite scrolling
});

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
    fetchAndRenderCategories(`/api/categories`, limit, (data) => shuffleArray([...data]));
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
        categoryDiv.innerHTML = `<h2>${categoryName} </h2>`;

        // Render subjects sorted by votes
        const sortedSubjects = category.subjects.sort((a, b) => b.votes - a.votes);
        const subjectsDiv = document.createElement('div');
        subjectsDiv.classList.add('subjects', 'scrollable');

        sortedSubjects.forEach(subject => {
            const subjectDiv = document.createElement('div');
            subjectDiv.classList.add('subject');
            subjectDiv.setAttribute('data-subject-id', subject.subject_id);
            subjectDiv.innerHTML = `
                <p><a href="${subject.link}" target="_blank">${subject.name}</a></p>
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
let mediaRecorder;
let audioChunks = [];

// Function to initialize voice recording controls dynamically
function initializeVoiceRecordingControls(subjectId) {
    const commentsContainer = document.getElementById(`comments-container-${subjectId}`);

    // Add voice review controls dynamically
    const voiceReviewSection = document.createElement("div");
    voiceReviewSection.id = `voice-review-section-${subjectId}`;
    voiceReviewSection.classList.add("hidden"); // Initially hidden
    voiceReviewSection.innerHTML = `
        <button id="record-${subjectId}" onclick="startRecording(${subjectId})">Start Recording</button>
        <button id="stop-${subjectId}" class="hidden" onclick="stopRecording(${subjectId})">Stop Recording</button>
        <audio id="audio-preview-${subjectId}" controls class="hidden"></audio>
        <button id="submit-voice-${subjectId}" class="hidden" onclick="submitVoiceReview(${subjectId})">Submit Voice Review</button>
    `;

    // Add a button to toggle voice review visibility
    const voiceReviewToggle = document.createElement("button");
    voiceReviewToggle.textContent = "Record Voice Review";
    voiceReviewToggle.onclick = () => voiceReviewSection.classList.toggle("hidden");

    // Append the new elements to the comments container
    commentsContainer.appendChild(voiceReviewToggle);
    commentsContainer.appendChild(voiceReviewSection);
}

// Function to toggle comment visibility
window.toggleComments = function (subjectId) {
    const commentsContainer = document.getElementById(`comments-container-${subjectId}`);
    commentsContainer.classList.toggle("hidden");

    const toggleButton = commentsContainer.previousElementSibling;
    toggleButton.textContent = commentsContainer.classList.contains("hidden") ? "▼" : "▲";

    // Dynamically load comments and voice recording controls only when expanded
    if (!commentsContainer.classList.contains("hidden")) {
        // Fetch comments if not already loaded
        if (!commentsContainer.dataset.loaded) {
            fetchComments(subjectId);
            initializeVoiceRecordingControls(subjectId);
            commentsContainer.dataset.loaded = true; // Mark as loaded
        }
    }
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


// Function to fetch comments and voice reviews together
function fetchComments(subjectId) {
    fetch(`/api/subjects/${subjectId}/comments`)
        .then(response => response.json())
        .then(data => {
            const commentContainer = document.getElementById(`comment-section-${subjectId}`);

            // Clear existing content
            commentContainer.innerHTML = "";

            // Render text comments and voice reviews
            data.comments.forEach(comment => {
                const commentElement = document.createElement("div");
                commentElement.classList.add("comment");

                // Add username
                const usernameElement = document.createElement("strong");
                usernameElement.textContent = `${comment.username}: `;
                commentElement.appendChild(usernameElement);

                // Add text comment
                if (!comment.is_voice_review) {
                    const textElement = document.createElement("p");
                    textElement.textContent = comment.comment_text;
                    commentElement.appendChild(textElement);
                }

                // Add voice review
                if (comment.is_voice_review) {
                    const audioElement = document.createElement("audio");
                    audioElement.controls = true;
                    audioElement.src = comment.audio_path;
                    commentElement.appendChild(audioElement);
                }

                commentContainer.appendChild(commentElement);
            });
        })
        .catch(error => console.error("Error fetching comments:", error));
}


// Function to start recording voice reviews
function startRecording(subjectId) {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.start();

            audioChunks = [];
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audioPreview = document.getElementById(`audio-preview-${subjectId}`);
                audioPreview.src = audioUrl;
                audioPreview.classList.remove("hidden");

                const submitButton = document.getElementById(`submit-voice-${subjectId}`);
                submitButton.dataset.audioBlob = audioBlob;
                submitButton.classList.remove("hidden");
            };

            document.getElementById(`record-${subjectId}`).classList.add("hidden");
            document.getElementById(`stop-${subjectId}`).classList.remove("hidden");
        })
        .catch(error => console.error('Error accessing microphone:', error));
}

// Function to stop recording voice reviews
function stopRecording(subjectId) {
    mediaRecorder.stop();
    document.getElementById(`stop-${subjectId}`).classList.add("hidden");
    document.getElementById(`record-${subjectId}`).classList.remove("hidden");
}

// Function to submit the recorded voice review
// function submitVoiceReview(subjectId) {
//     const submitButton = document.getElementById(`submit-voice-${subjectId}`);
//     const audioBlob = submitButton.dataset.audioBlob;

//     const formData = new FormData();
//     formData.append("audio", audioBlob); // Ensure this blob is set correctly
//     formData.append("username", "User123"); // Optional username

    
//     fetch(`/api/subjects/${subjectId}/voice-review`, {
//         method: 'POST',
//         body: formData,
//     })
//         .then((response) => response.json())
//         .then((data) => {
//             if (data.success) {
//                 alert("Voice review submitted successfully!");
//                 fetchComments(subjectId); // Reload comments to show new review
//             }
//     })
//     .catch((error) => {
//         console.error("Error submitting voice review:", error);
//     });
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
// function fetchComments(subjectId) {
//     fetch(`/api/subjects/${subjectId}/comments`)
//         .then(response => response.json())
//         .then(comments => {
//             const commentContainer = document.getElementById(`comment-section-${subjectId}`);
//             commentContainer.innerHTML = comments.map(comment => `
//                 <div class="comment">
//                     <strong>${comment.username}</strong>: 
//                     ${comment.is_voice_review ? 
//                         `<audio controls src="${comment.audio_path}"></audio>` : 
//                         `<p>${comment.comment_text}</p>`}
//                 </div>
//             `).join("");
//         });
// }
