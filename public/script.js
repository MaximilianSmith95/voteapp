let allCategoriesData = []; // Global variable to store initial categories data

document.addEventListener("DOMContentLoaded", () => {
    // Fetch categories without geolocation on page load
    fetch('/api/categories')
        .then(response => response.json())
        .then(data => {
            allCategoriesData = data; // Store the data globally
            const shuffledData = shuffleArray([...data]); // Shuffle the data for random order
            renderCategories(shuffledData); // Render shuffled categories
        })
        .catch(error => {
            console.error('Error fetching categories:', error);
        });
});

// Function to call requestUserLocation on button click
window.enableGeolocationSearch = function () {
    requestUserLocation();
};

// Function to request user's location and filter categories by proximity
function requestUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLatitude = position.coords.latitude;
                const userLongitude = position.coords.longitude;

                // Fetch categories based on user's geolocation
                fetch(`/api/categories?latitude=${userLatitude}&longitude=${userLongitude}`)
                    .then(response => response.json())
                    .then(data => {
                        // Update the global data with geolocation-sorted categories
                        allCategoriesData = data;

                        // Render categories sorted by proximity
                        renderCategories(data);
                    })
                    .catch(error => console.error('Error fetching categories:', error));
            },
            (error) => {
                console.error("Geolocation error:", error);
            }
        );
    } else {
        console.log("Geolocation is not available in this browser.");
    }
}

// Function to filter content based on user input
window.filterContent = function () {
    const searchTerm = document.getElementById("searchBar").value.toLowerCase();
    const categoriesContainer = document.getElementById("categories");
    const categories = Array.from(categoriesContainer.getElementsByClassName("category"));

    categories.forEach(category => {
        const categoryName = category.querySelector("h2").textContent.toLowerCase();
        const isCategoryMatch = categoryName.includes(searchTerm);
        const subjects = Array.from(category.getElementsByClassName("subject"));
        let subjectMatchFound = false;

        subjects.forEach(subject => {
            const subjectName = subject.textContent.toLowerCase();
            const isSubjectMatch = subjectName.includes(searchTerm);
            subject.classList.toggle("highlighted", isSubjectMatch);
            if (isSubjectMatch) subjectMatchFound = true;
        });

        category.style.display = isCategoryMatch || subjectMatchFound ? "block" : "none";
    });
};

// Function to render categories in the DOM
function renderCategories(categories) {
    const categoriesContainer = document.getElementById("categories");
    categoriesContainer.innerHTML = "";

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
                    <div class="comments" id="comment-section-${subject.subject_id}"></div>
                </div>
            `;
            subjectsDiv.appendChild(subjectDiv);
        });

        categoryDiv.appendChild(subjectsDiv);
        categoriesContainer.appendChild(categoryDiv);
    });
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
