let allCategoriesData = []; // Global variable to store initial categories data
let currentCategoriesLimit = 15; // Start with 15 categories

function renderLimitedCategories(categories, limit = 15) {
    const limitedCategories = categories.slice(0, limit);
    renderCategories(limitedCategories); // Reuse existing render logic
}

// Function to fetch user's geolocation and use it to fetch categories
function requestUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatitude = position.coords.latitude;
                const userLongitude = position.coords.longitude;

                // Fetch categories sorted by proximity
                fetch(`/api/categories?latitude=${userLatitude}&longitude=${userLongitude}`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Error fetching geolocation-based categories: ${response.statusText}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        renderCategories(data);
                    })
                    .catch(error => console.error("Error fetching geolocation-based categories:", error));
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("Unable to fetch location. Please allow location access.");
            }
        );
    } else {
        console.log("Geolocation is not available in this browser.");
        alert("Geolocation is not supported by your browser.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Attach event listeners
    const geolocationButton = document.getElementById("geolocationButton");
    if (geolocationButton) {
        geolocationButton.addEventListener("click", requestUserLocation);
    }

    const forYouButton = document.getElementById("forYouButton");
    if (forYouButton) {
        forYouButton.addEventListener("click", loadForYouCategories);
    }

    const allButton = document.getElementById("allButton");
    if (allButton) {
        allButton.addEventListener("click", showAllCategories);
    }

    const latestButton = document.getElementById("latestButton");
    if (latestButton) {
        latestButton.addEventListener("click", showLatestCategories);
    }

    console.log("Event listeners attached to navigation buttons.");

    fetch('/api/categories')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching categories: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            allCategoriesData = data; // Store the data globally
            renderLimitedCategories(allCategoriesData, currentCategoriesLimit); // Render limited categories

            // Add "Explore More" button
            const exploreMoreButton = document.getElementById("exploreMoreButton");
            if (exploreMoreButton) {
                exploreMoreButton.addEventListener("click", () => {
                    exploreMoreButton.disabled = true; // Disable button temporarily
                    currentCategoriesLimit += 15; // Increase limit
                    renderLimitedCategories(allCategoriesData, currentCategoriesLimit); // Render more categories
                    exploreMoreButton.disabled = false; // Re-enable button
                });
            }
        })
        .catch(error => {
            console.error('Error fetching categories:', error);
            const errorContainer = document.getElementById("errorContainer");
            if (errorContainer) {
                errorContainer.innerText = "Failed to load categories. Please try again later.";
                errorContainer.style.display = "block";
            }
        });
});

// Function to render categories in the DOM
function renderCategories(categories) {
    const categoriesContainer = document.getElementById("categories");
    if (!categoriesContainer) return;
    categoriesContainer.innerHTML = "";

    const fragment = document.createDocumentFragment(); // Use fragment to minimize reflows
    categories.forEach(category => {
        const categoryDiv = document.createElement("div");
        categoryDiv.classList.add("category");
        categoryDiv.setAttribute("data-category-id", category.category_id);
        categoryDiv.innerHTML = `<h2>${category.name}</h2>`;

        const sortedSubjects = category.subjects.sort((a, b) => b.votes - a.votes);
        const limitedSubjects = sortedSubjects.slice(0, 100);

        const subjectsDiv = document.createElement("div");
        subjectsDiv.classList.add("subjects", "scrollable");

        limitedSubjects.forEach(subject => {
            const subjectDiv = document.createElement("div");
            subjectDiv.classList.add("subject");
            subjectDiv.setAttribute("data-subject-id", subject.subject_id);

            subjectDiv.innerHTML = `
                <p style="display: inline-block;">
                    <a href="${subject.link}" target="_blank">${subject.name}</a>
                </p>
                <span class="vote-container">
                    <span class="vote-count">${subject.votes}</span>
                    <button class="vote-button" onclick="upvote(${subject.subject_id})">&#9650;</button> 
                </span>
                <button onclick="toggleComments(${subject.subject_id})" class="comments-toggle">▼</button>
                <div id="comments-container-${subject.subject_id}" class="comments-container hidden">
                    <input type="text" id="comment-input-${subject.subject_id}" placeholder="Leave a Review..." />
                    <button onclick="addComment(${subject.subject_id})">Add Comment</button>
                </div>
            `;
            subjectsDiv.appendChild(subjectDiv);
        });

        categoryDiv.appendChild(subjectsDiv);
        fragment.appendChild(categoryDiv);
    });
    categoriesContainer.appendChild(fragment);
}

// Other functions (toggleComments, startRecording, stopRecording, etc.) remain unchanged and are already defined in the previous script


// Lazy-load voice messaging when comments are toggled
window.toggleComments = function (subjectId) {
    const commentsContainer = document.getElementById(`comments-container-${subjectId}`);
    if (!commentsContainer) return;

    commentsContainer.classList.toggle("hidden");
    const toggleButton = commentsContainer.previousElementSibling;
    toggleButton.textContent = commentsContainer.classList.contains("hidden") ? "▼" : "▲";

    // Lazy-load voice recording UI
    if (!commentsContainer.classList.contains("hidden") && !commentsContainer.dataset.voiceInitialized) {
        const voiceCommentDiv = document.createElement("div");
        voiceCommentDiv.classList.add("voice-comment");
        voiceCommentDiv.innerHTML = `
            <button id="record-button-${subjectId}" onclick="startRecording(${subjectId})">🎤 Record</button>
            <button id="stop-button-${subjectId}" onclick="stopRecording(${subjectId})" disabled>⏹ Stop</button>
            <audio id="voice-preview-${subjectId}" controls></audio>
        `;
        commentsContainer.appendChild(voiceCommentDiv);
        commentsContainer.dataset.voiceInitialized = true;
    }
};

// Voice recording functions
let mediaRecorder;
let audioChunks = [];

function startRecording(subjectId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Voice recording is not supported on this browser.");
        return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audioPreview = document.getElementById(`voice-preview-${subjectId}`);
                if (audioPreview) {
                    audioPreview.src = audioUrl;
                }
                // Optional: upload the audioBlob to your server here
            };

            mediaRecorder.start();
            document.getElementById(`record-button-${subjectId}`).disabled = true;
            document.getElementById(`stop-button-${subjectId}`).disabled = false;
        })
        .catch(error => {
            console.error("Error accessing microphone:", error);
        });
}

function stopRecording(subjectId) {
    if (mediaRecorder) {
        mediaRecorder.stop();
        document.getElementById(`record-button-${subjectId}`).disabled = false;
        document.getElementById(`stop-button-${subjectId}`).disabled = true;
    }
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

