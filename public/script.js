let allCategoriesData = []; // Global variable to store initial categories data
document.addEventListener("DOMContentLoaded", () => {
    const acceptButton = document.getElementById("acceptButton");
    const termsModal = document.getElementById("termsModal");

    acceptButton.addEventListener("click", () => {
        termsModal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target === termsModal) {
            termsModal.style.display = "none";
        }
    });
});

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


// Function to zoom and centralize a category when clicked
function zoomCategory(event) {
    const category = event.currentTarget; // Get the clicked category
    const overlay = document.getElementById("overlay");
    overlay.classList.add("active"); // Show the overlay
    category.classList.add("zoomed"); // Add zoom effect to the category

    // Event listener to close zoomed view when overlay is clicked
    overlay.onclick = () => {
        overlay.classList.remove("active");
        category.classList.remove("zoomed");
    };
}

// Attach zoomCategory function to each category's title
function enableCategoryZoom() {
    document.querySelectorAll(".category h2").forEach(title => {
        title.addEventListener("click", zoomCategory);
    });
}

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
    
    enableCategoryZoom(); // Enable zoom functionality
}




function upvote(subjectId) {
    fetch(`/api/subjects/${subjectId}/vote`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Update the vote count for the clicked subject
            const voteCountElement = document.querySelector(`[data-subject-id="${subjectId}"] .vote-count`);
            if (voteCountElement) {
                const newVoteCount = parseInt(voteCountElement.textContent) + 1;
                voteCountElement.textContent = newVoteCount;

                // Get the parent category's subjects container and re-sort based on vote count
                const subjectDiv = voteCountElement.closest(".subject");
                const subjectsContainer = subjectDiv.parentNode;

                // Re-sort the subjects based on updated vote counts
                const subjectsArray = Array.from(subjectsContainer.children);
                subjectsArray.sort((a, b) => {
                    const votesA = parseInt(a.querySelector(".vote-count").textContent);
                    const votesB = parseInt(b.querySelector(".vote-count").textContent);
                    return votesB - votesA; // Sort in descending order
                });

                // Clear and re-append sorted subjects
                subjectsArray.forEach(subject => subjectsContainer.appendChild(subject));
            }
        }
    })
    .catch(error => console.error('Error upvoting:', error));
}

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

// Function to fetch comments for a specific subject
function fetchComments(subjectId) {
    fetch(`/api/subjects/${subjectId}/comments`)
        .then(response => response.json())
        .then(comments => {
            const commentContainer = document.getElementById(`comments-container-${subjectId}`);
            commentContainer.innerHTML = "";
            renderComments(comments, commentContainer);
        });
}

// Recursive function to render comments and their replies
// Modify renderComments to add a reply option under each comment
function renderComments(comments, parentElement) {
    comments.forEach(comment => {
        console.log('Rendering comment:', comment);
        const commentDiv = document.createElement("div");
        commentDiv.classList.add("comment");
        commentDiv.id = `comment-${comment.comment_id}`;
        commentDiv.innerHTML = `
            <strong>${comment.username}</strong>: ${comment.comment_text}
            <span class="reply-button" onclick="toggleReplyInput(${comment.comment_id}, ${comment.subject_id})">Reply</span>
            <span class="toggle-replies-button" onclick="toggleReplies(${comment.comment_id})">Show Replies</span>
            <div id="reply-input-${comment.comment_id}" class="hidden">
                <input type="text" id="reply-text-${comment.comment_id}" placeholder="Write a reply..."/>
                <span class="submit-reply-link" onclick="addReply(${comment.comment_id}, ${comment.subject_id})">Post Reply</span>
            </div>
            <div id="replies-${comment.comment_id}" class="replies hidden"></div>
        `;

        parentElement.appendChild(commentDiv);

        if (comment.replies && comment.replies.length > 0) {
            const repliesDiv = commentDiv.querySelector(`#replies-${comment.comment_id}`);
            renderComments(comment.replies, repliesDiv);  // Recursively render replies
        }
    });
}


// Function to show/hide replies
function toggleReplies(commentId) {
    const repliesDiv = document.getElementById(`replies-${commentId}`);
    const toggleButton = document.querySelector(`#comment-${commentId} .toggle-replies-link`);

    if (repliesDiv) {
        repliesDiv.classList.toggle("hidden");
        toggleButton.textContent = repliesDiv.classList.contains("hidden") ? "Show Replies" : "Hide Replies";
        console.log(`Toggled replies for comment ${commentId}`);
    } else {
        console.error(`Replies div not found for comment ${commentId}`);
    }
}



// Function to show/hide reply input
function toggleReplyInput(commentId) {
    const replyInput = document.getElementById(`reply-input-${commentId}`);
    replyInput.classList.toggle("hidden");
}

// Add reply function to post a reply to a comment
// Add reply function to post a reply to a comment
function addReply(parentCommentId, subjectId) {
    const replyText = document.getElementById(`reply-text-${parentCommentId}`).value.trim();
    const username = `User${Math.floor(Math.random() * 1000)}`;  // Generate a random username or use a logged-in user's name

    if (replyText) {
        fetch(`/api/subjects/${subjectId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, comment_text: replyText, parent_comment_id: parentCommentId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Create the reply element and append it to the current comment
                const repliesDiv = document.createElement("div");
                repliesDiv.classList.add("comment");
                repliesDiv.innerHTML = `<strong>${username}</strong>: ${replyText}`;
                
                const parentCommentElement = document.getElementById(`comment-${parentCommentId}`);
                const repliesContainer = parentCommentElement.querySelector(".replies") || document.createElement("div");
                
                repliesContainer.classList.add("replies");
                repliesContainer.appendChild(repliesDiv);

                parentCommentElement.appendChild(repliesContainer);

                document.getElementById(`reply-text-${parentCommentId}`).value = "";  // Clear reply input
                toggleReplyInput(parentCommentId);  // Hide reply input
            }
        })
        .catch(error => console.error('Error posting reply:', error));
    }
}


// Function to shuffle an array in random order
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to display all categories in random order
window.showAllCategories = function () {
    const shuffledCategories = shuffleArray([...allCategoriesData]); // Shuffle a copy of the initial data
    renderCategories(shuffledCategories);
};

// Function to display categories in order of `category_id` (for the "Latest" button)
window.showLatestCategories = function () {
    const sortedCategories = [...allCategoriesData].sort((a, b) => b.category_id - a.category_id); // Sort by ID descending
    renderCategories(sortedCategories);
};

// Function to filter categories by navigation topic and display in random order
window.filterByNavTopic = function (topic) {
    // Filter categories based on the topic
    const filteredCategories = allCategoriesData.filter(category => {
        return category.name.includes(topic);
    });

    // Shuffle the filtered categories
    const shuffledFilteredCategories = shuffleArray(filteredCategories);

    // Render the shuffled filtered categories
    renderCategories(shuffledFilteredCategories);
};


const navTopicMapping = {
    Sport: [
        "Current Liverpool Players",
        "Current Everton Players",
        "Most Popular Global Sports",
        "Most Overrated Soccer Players of the Last Decade",
        "Most Iconic Underdog Teams in Soccer History",
        "Best Soccer Rivalries of All Time",
        "Top Sportswear Stores",
        "Most Controversial Topics in Sports",
        "The Best Footballers in Premier League History",
        "Best European Football Teams",
        "Best Footballers of All Time",
        "The Best Football Players of the 21st Century",
        "The Most Iconic Olympic Moments",
        "The Best Football Clubs in English History",
        "The Greatest NBA Players of All Time",
        "The Best Boxers in History",
        "The Hardest Olympic Sports",
        "The Hardest Sports to be the GOAT"
    ],
    Travel: [
        "Best Cafés Liverpool",
        "Best Restaurants Liverpool",
        "Best Landmarks Liverpool",
        "Nights Out Liverpool",
        "Museums and Galleries Liverpool",
        "Parks and Outdoor Spaces Liverpool",
        "Best South American Countries for Backpackers",
        "Best Vegan Restaurants in the World",
        "Best Cafes in London",
        "Best Nightlife Spots in London",
        "Worst Things About London",
        "Best Cafes in Manchester",
        "Best Nightlife Spots in Manchester",
        "Worst Things About Manchester",
        "Best Cafes in New York",
        "Best Nightlife Spots in New York",
        "Worst Things About New York",
        "Best Nightlife Spots in Liverpool",
        "Worst Things About Liverpool",
        "Top Adventure Destinations for Backpackers",
        "Best Places to Go Camping in the UK",
        "Essential Items for Backpacking",
        "Best Countries for Backpackers",
        "Best Websites for Backpackers",
        "The Best Indie Music Venues in Manchester",
        "Best Places to Rave in the UK",
        "Best Places to Rave in the World"
    ],
    Entertainment: [
        "Most Disappointing Horror Films of 2024",
        "Most Confusing Movie Endings of All Time",
        "Most Unexpected Box Office Flops",
        "Best Soundtracks from 90s Movies",
        "The Best British Comedy TV Shows",
        "The Best Horror Movies of All Time",
        "The Most Iconic Movie Soundtracks",
        "Best Actors and Actresses of All Time",
        "Best British Films",
        "The Worst Hairstyles in History",
        "The Most Iconic Movie Soundtracks",
        "Most Controversial Topics in Film",
        "The Most Memorable World Cup Moments",
        "The Best Art Galleries in Liverpool",
        "The Best Live Music Venues in Liverpool",
        "The Best Historic Buildings in Manchester",
        "Famous Landmarks in Manchester",
        "Top Museums and Galleries in Manchester",
        "Best Restaurants in Edinburgh",
        "The Most Historic Sites in Edinburgh",
        "Best British High Street Clothing Brands",
        "Best British Online Shopping Sites",
        "Best British Department Stores"
    ],
    Music: [
        "Most Overplayed Songs of the 2010s",
        "Most Misinterpreted Song Lyrics",
        "Weirdest Music Genres You've Probably Never Heard Of",
        "Most Influential Musicians of All Time",
        "Most Controversial Topics in Music",
        "Best New Rap Artists of the 2020s",
        "Top TikTok Dance Songs of All Time",
        "Best Pop Songs of the 2010s",
        "Best Electronic Dance Music (EDM) Songs of the 2010s",
        "Most Influential Rappers of the 2000s and 2010s",
        "The Best Indie Music Venues in Manchester"
    ],
    History: [
        "Controversial Artists of the 20th Century",
        "Most Impactful Philosophers",
        "Top Political Thinkers of Modern Times",
        "Most Bizarre Unsolved Mysteries in History",
        "Most Influential Scientists in History",
        "The Worst Diseases in Human History",
        "The Most Fascinating Ancient Civilizations",
        "The Most Famous British Authors",
        "The Most Haunted Locations in the UK",
        "The Most Notable Historic Pubs in London"
    ],
    Miscellaneous: [
        "Popular Internet Games",
        "Worst President of the United States",
        "Worst Smells",
        "Most Famous People, Dead or Alive",
        "The Future: Predictions and Concerns",
        "Inventions: Past and Future",
        "Best British Supermarkets",
        "Most Popular British Pub Foods",
        "Best British Gins",
        "Most Popular British Cheeses",
        "Best Beers Around the World",
        "Best Wine-Producing Countries"
    ]
};

window.toggleComments = function(subjectId) {
    const commentsContainer = document.getElementById(`comments-container-${subjectId}`);
    commentsContainer.classList.toggle("hidden");
    
    // Change arrow direction in the button text
    const toggleButton = commentsContainer.previousElementSibling;
    if (commentsContainer.classList.contains("hidden")) {
        toggleButton.textContent = "▼";
    } else {
        toggleButton.textContent = "▲";
    }
};
document.querySelectorAll('.category h2').forEach(title => {
    title.addEventListener('click', () => {
        // Remove 'zoomed' from any other zoomed category
        document.querySelectorAll('.category').forEach(category => {
            category.classList.remove('zoomed');
        });

        // Add 'zoomed' to clicked category
        const category = title.parentElement;
        category.classList.add('zoomed');
        
        // Add 'faded' class to container to fade out other sections
        document.querySelector('#categories').classList.add('faded');
        
        // Activate the overlay
        document.getElementById('overlay').classList.add('active');
    });
});

document.getElementById('overlay').addEventListener('click', () => {
    // Remove zoom and fade effects
    document.querySelectorAll('.category').forEach(category => {
        category.classList.remove('zoomed');
    });
    document.querySelector('#categories').classList.remove('faded');
    document.getElementById('overlay').classList.remove('active');
});
// Function to wrap each category in a .category div and ensure titles are in <h2> tags
function initializeCategoryStructure() {
    const categoriesContainer = document.getElementById("categories");
    
    // Assuming each category currently in `categoriesContainer` is a direct child
    Array.from(categoriesContainer.children).forEach((categoryElement) => {
        // Check if the category element is already wrapped in a .category div
        if (!categoryElement.classList.contains("category")) {
            // Create a new div wrapper with the .category class
            const wrapper = document.createElement("div");
            wrapper.classList.add("category");

            // Check if the first child of the element is already an <h2>
            if (categoryElement.firstElementChild && categoryElement.firstElementChild.tagName !== "H2") {
                // If not, create an <h2> for the title
                const title = document.createElement("h2");
                title.textContent = categoryElement.firstElementChild.textContent;
                
                // Remove the original title element
                categoryElement.firstElementChild.remove();
                
                // Insert the new <h2> as the first child of the wrapper
                wrapper.appendChild(title);
            } else {
                // If the first element is already an <h2>, move it into the wrapper
                wrapper.appendChild(categoryElement.firstElementChild);
            }
            
            // Move all other content into the wrapper
            while (categoryElement.firstChild) {
                wrapper.appendChild(categoryElement.firstChild);
            }
            
            // Replace the original categoryElement with the wrapper
            categoriesContainer.replaceChild(wrapper, categoryElement);
        }
    });
}

// Call initializeCategoryStructure after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    initializeCategoryStructure();
    addCategoryZoomListeners();  // Make sure listeners are attached to the new structure
});

    

    
