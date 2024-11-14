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
        const limitedSubjects = sortedSubjects.slice(0, 15);


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
function renderComments(comments, parentElement) {
    comments.forEach(comment => {
        const commentDiv = document.createElement("div");
        commentDiv.classList.add("comment");
        commentDiv.innerHTML = `<strong>${comment.username}</strong>: ${comment.comment_text}`;
        parentElement.appendChild(commentDiv);

        if (comment.replies) {
            const repliesDiv = document.createElement("div");
            repliesDiv.classList.add("replies");
            renderComments(comment.replies, repliesDiv);
            commentDiv.appendChild(repliesDiv);
        }
    });
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
        "Top Sportswear Stores"
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
        "Worst Things About Liverpool"
    ],
    Entertainment: [
        "Most Disappointing Horror Films of 2024",
        "Most Confusing Movie Endings of All Time",
        "Most Unexpected Box Office Flops",
        "Best Soundtracks from 90s Movies"
    ],
    Music: [
        "Most Overplayed Songs of the 2010s",
        "Most Misinterpreted Song Lyrics",
        "Weirdest Music Genres You've Probably Never Heard Of",
        "Most Influential Musicians of All Time"
    ],
    History: [
        "Controversial Artists of the 20th Century",
        "Most Impactful Philosophers",
        "Top Political Thinkers of Modern Times",
        "Most Bizarre Unsolved Mysteries in History"
    ],
    Miscellaneous: [
        "Popular Internet Games",
        "Worst President of the United States",
        "Worst Smells"
    ]
};



// // script.js

// document.addEventListener("DOMContentLoaded", () => {
//     const categories = [
//         {
//             name: "Best Cafés Liverpool",
//             subjects: [
//                 { name: "Bold Street Coffee", votes: 0, link: "https://www.boldstreetcoffee.co.uk/" },
//                 { name: "92 Degrees Coffee", votes: 0, link: "https://www.92degrees.coffee/" },
//                 { name: "Filter + Fox", votes: 0, link: "https://filterandfox.co.uk/" },
//                 { name: "Crosby Coffee", votes: 0, link: "https://www.crosbycoffee.co.uk/" },
//                 { name: "The Bagelry", votes: 0, link: "https://www.thebagelry.co.uk/" },
//                 { name: "East Avenue Bakehouse", votes: 0, link: "https://eastavenuebakehouse.co.uk/" },
//                 { name: "The Quarter", votes: 0, link: "https://www.thequarteruk.com/" },
//                 { name: "Cafe Tabac", votes: 0, link: "https://www.cafetabac.co.uk/" },
//                 { name: "Stollies Cafe", votes: 0, link: "https://www.Stolliescafedeli.co.uk/" },
//                 { name: "Ropes & Twines", votes: 0, link: "https://www.ropesandtwines.co.uk/" },
//                 { name: "Bean There Coffee Shop", votes: 0, link: "https://beanthere.com/" },
//                 { name: "Mother Espresso", votes: 0, link: "https://motherespresso.co.uk/" },
//                 { name: "Moose Coffee", votes: 0, link: "https://moosecoffee.co.uk/" }
//             ]
//         },
//         {
//             name: "Best Restaurants Liverpool",
//             subjects: [
//                 { name: "Mowgli Street Food", votes: 0, link: "https://www.mowglistreetfood.com/" },
//                 { name: "Panoramic 34", votes: 0, link: "https://www.panoramic34.com/" },
//                 { name: "Lunya", votes: 0, link: "https://www.lunya.co.uk/" },
//                 { name: "Roski", votes: 0, link: "https://www.roskirestaurant.com/" },
//                 { name: "The Art School Restaurant", votes: 0, link: "https://www.theartschoolrestaurant.co.uk/" },
//                 { name: "Maray", votes: 0, link: "https://www.maray.co.uk/" },
//                 { name: "Cowshed", votes: 0, link: "https://cowshedliverpool.com/" },
//                 { name: "Albert’s Schenke", votes: 0, link: "https://albertsschenke.co.uk/" }
//             ]
//         },
//         {
//             name: "Best Landmarks Liverpool",
//             subjects: [
//                 { name: "Royal Albert Dock", votes: 0, link: "https://en.wikipedia.org/wiki/Royal_Albert_Dock,_Liverpool" },
//                 { name: "Liverpool Cathedral", votes: 0, link: "https://en.wikipedia.org/wiki/Liverpool_Cathedral" },
//                 { name: "The Beatles Statue", votes: 0, link: "https://en.wikipedia.org/wiki/The_Beatles_Statue" },
//                 { name: "Anfield Stadium", votes: 0, link: "https://en.wikipedia.org/wiki/Anfield" },
//                 { name: "The Liver Building", votes: 0, link: "https://en.wikipedia.org/wiki/Royal_Liver_Building" },
//                 { name: "Pier Head", votes: 0, link: "https://en.wikipedia.org/wiki/Pier_Head" },
//                 { name: "Wallasey Beach", votes: 0, link: "https://www.visitwirral.com/things-to-do/wallasey-beach" },
//                 { name: "St John’s Beacon (Radio City Tower)", votes: 0, link: "https://en.wikipedia.org/wiki/Radio_City_Tower" }
//             ]
//         },
//         {
//             name: "Nights Out Liverpool",
//             subjects: [
//                 { name: "The Cavern Club", votes: 0, link: "https://www.cavernclub.com/" },
//                 { name: "Constellations", votes: 0, link: "https://www.constellations-liv.com/" },
//                 { name: "The Merchant", votes: 0, link: "https://themerchantliverpool.co.uk/" },
//                 { name: "Baltic Market", votes: 0, link: "https://www.balticmarket.co.uk/" },
//                 { name: "Mansion Nightclub", votes: 0, link: "https://mansionnightclub.co.uk/" },
//                 { name: "Salt Dog Slim's", votes: 0, link: "https://www.salt.dog/" },
//                 { name: "Jimmy’s Liverpool", votes: 0, link: "https://jimmys.group/liverpool/" },
//                 { name: "Heebie Jeebies", votes: 0, link: "https://www.heebiejeebiesliverpool.co.uk/" }
//             ]
//         },
//         {
//             name: "Museums and Galleries Liverpool",
//             subjects: [
//                 { name: "Museum of Liverpool", votes: 0, link: "https://www.liverpoolmuseums.org.uk/museum-of-liverpool" },
//                 { name: "World Museum", votes: 0, link: "https://www.liverpoolmuseums.org.uk/world-museum" },
//                 { name: "Walker Art Gallery", votes: 0, link: "https://www.liverpoolmuseums.org.uk/walker-art-gallery" },
//                 { name: "Tate Liverpool", votes: 0, link: "https://www.tate.org.uk/visit/tate-liverpool" },
//                 { name: "The Beatles Story", votes: 0, link: "https://www.beatlesstory.com/" },
//                 { name: "Victoria Gallery & Museum", votes: 0, link: "https://vgm.liverpool.ac.uk/" },
//                 { name: "Merseyside Maritime Museum", votes: 0, link: "https://www.liverpoolmuseums.org.uk/merseyside-maritime-museum" },
//                 { name: "Western Approaches Museum", votes: 0, link: "https://liverpoolwarmuseum.co.uk/" }
//             ]
//         },
//         {
//             name: "Parks and Outdoor Spaces Liverpool",
//             subjects: [
//                 { name: "Sefton Park", votes: 0, link: "https://en.wikipedia.org/wiki/Sefton_Park" },
//                 { name: "Birkenhead Park", votes: 0, link: "https://en.wikipedia.org/wiki/Birkenhead_Park" },
//                 { name: "Otterspool Promenade", votes: 0, link: "https://en.wikipedia.org/wiki/Otterspool_Promenade" },
//                 { name: "New Brighton Promenade", votes: 0, link: "https://en.wikipedia.org/wiki/New_Brighton,_Merseyside" },
//                 { name: "Crosby Beach", votes: 0, link: "https://en.wikipedia.org/wiki/Crosby_Beach" },
//                 { name: "Princes Park", votes: 0, link: "https://en.wikipedia.org/wiki/Princes_Park,_Liverpool" },
//                 { name: "Stanley Park", votes: 0, link: "https://en.wikipedia.org/wiki/Stanley_Park,_Liverpool" },
//                 { name: "Calderstones Park", votes: 0, link: "https://en.wikipedia.org/wiki/Calderstones_Park" }
//             ]
//         },
//         {
//             name: "Best Vegan Restaurants in the World",
//             subjects: [
//                 { name: "Plant (Asheville, NC, USA)", votes: 0, link: "https://plantisfood.com/" },
//                 { name: "Gauthier Soho (London, UK)", votes: 0, link: "https://www.gauthiersoho.co.uk/" },
//                 { name: "El Huerto (Santiago, Chile)", votes: 0, link: "https://www.elhuerto.cl/" },
//                 { name: "Loving Hut (Multiple Locations)", votes: 0, link: "https://lovinghut.com/" },
//                 { name: "Gracias Madre (San Francisco, CA, USA)", votes: 0, link: "https://www.graciasmadre.co/" },
//                 { name: "TIAN (Vienna, Austria)", votes: 0, link: "https://www.tian-restaurant.com/en/" },
//                 { name: "Green Table (Seoul, South Korea)", votes: 0, link: "https://greentable.co.kr/" },
//                 { name: "Vegan Beat (Athens, Greece)", votes: 0, link: "https://www.veganbeat.gr/" },
//                 { name: "Alchemy Vegan (Dublin, Ireland)", votes: 0, link: "https://www.alchemy.ie/" },
                
//             ]
//         },
//         {
//             name: "Most Influential Musicians of All Time",
//             subjects: [
//                 { name: "The Beatles", votes: 0, link: "https://en.wikipedia.org/wiki/The_Beatles" },
//                 { name: "Bob Dylan", votes: 0, link: "https://en.wikipedia.org/wiki/Bob_Dylan" },
//                 { name: "Elvis Presley", votes: 0, link: "https://en.wikipedia.org/wiki/Elvis_Presley" },
//                 { name: "Michael Jackson", votes: 0, link: "https://en.wikipedia.org/wiki/Michael_Jackson" },
//                 { name: "Madonna", votes: 0, link: "https://en.wikipedia.org/wiki/Madonna" },
//                 { name: "Prince", votes: 0, link: "https://en.wikipedia.org/wiki/Prince_(musician)" },
//                 { name: "Freddie Mercury", votes: 0, link: "https://en.wikipedia.org/wiki/Freddie_Mercury" },
//                 { name: "Beyoncé", votes: 0, link: "https://en.wikipedia.org/wiki/Beyonc%C3%A9" },
//                 { name: "Tupac Shakur", votes: 0, link: "https://en.wikipedia.org/wiki/Tupac_Shakur" },
//                 { name: "Johann Sebastian Bach", votes: 0, link: "https://en.wikipedia.org/wiki/Johann_Sebastian_Bach" },
//                 { name: "Ludwig van Beethoven", votes: 0, link: "https://en.wikipedia.org/wiki/Ludwig_van_Beethoven" },
//                 { name: "Frank Sinatra", votes: 0, link: "https://en.wikipedia.org/wiki/Frank_Sinatra" },
//                 { name: "John Lennon", votes: 0, link: "https://en.wikipedia.org/wiki/John_Lennon" },
//                 { name: "Whitney Houston", votes: 0, link: "https://en.wikipedia.org/wiki/Whitney_Houston" }
//             ]
//         },
//         {
//             name: "Most Impactful Philosophers",
//             subjects: [
//                 { name: "Socrates", votes: 0, link: "https://en.wikipedia.org/wiki/Socrates" },
//                 { name: "Confucius", votes: 0, link: "https://en.wikipedia.org/wiki/Confucius" },
//                 { name: "Immanuel Kant", votes: 0, link: "https://en.wikipedia.org/wiki/Immanuel_Kant" },
//                 { name: "Karl Marx", votes: 0, link: "https://en.wikipedia.org/wiki/Karl_Marx" },
//                 { name: "Jean-Paul Sartre", votes: 0, link: "https://en.wikipedia.org/wiki/Jean-Paul_Sartre" },
//                 { name: "Plato", votes: 0, link: "https://en.wikipedia.org/wiki/Plato" },
//                 { name: "René Descartes", votes: 0, link: "https://en.wikipedia.org/wiki/Ren%C3%A9_Descartes" },
//                 { name: "Friedrich Nietzsche", votes: 0, link: "https://en.wikipedia.org/wiki/Friedrich_Nietzsche" },
//                 { name: "Laozi", votes: 0, link: "https://en.wikipedia.org/wiki/Laozi" },
//                 { name: "Michel Foucault", votes: 0, link: "https://en.wikipedia.org/wiki/Michel_Foucault" },
//                 { name: "John Stuart Mill", votes: 0, link: "https://en.wikipedia.org/wiki/John_Stuart_Mill" },
//                 { name: "Aristotle", votes: 0, link: "https://en.wikipedia.org/wiki/Aristotle" },
//                 { name: "Simone de Beauvoir", votes: 0, link: "https://en.wikipedia.org/wiki/Simone_de_Beauvoir" }
//             ]
//         },
//         {
//             name: "Most Popular Global Sports",
//             subjects: [
//                 { name: "Soccer (Football)", votes: 0, link: "https://en.wikipedia.org/wiki/Association_football" },
//                 { name: "Basketball", votes: 0, link: "https://en.wikipedia.org/wiki/Basketball" },
//                 { name: "Cricket", votes: 0, link: "https://en.wikipedia.org/wiki/Cricket" },
//                 { name: "Tennis", votes: 0, link: "https://en.wikipedia.org/wiki/Tennis" },
//                 { name: "Rugby", votes: 0, link: "https://en.wikipedia.org/wiki/Rugby_football" },
//                 { name: "Baseball", votes: 0, link: "https://en.wikipedia.org/wiki/Baseball" },
//                 { name: "Golf", votes: 0, link: "https://en.wikipedia.org/wiki/Golf" },
//                 { name: "Boxing", votes: 0, link: "https://en.wikipedia.org/wiki/Boxing" },
//                 { name: "Ice Hockey", votes: 0, link: "https://en.wikipedia.org/wiki/Ice_hockey" },
//                 { name: "MMA (Mixed Martial Arts)", votes: 0, link: "https://en.wikipedia.org/wiki/Mixed_martial_arts" },
//                 { name: "Table Tennis", votes: 0, link: "https://en.wikipedia.org/wiki/Table_tennis" },
//                 { name: "Cycling", votes: 0, link: "https://en.wikipedia.org/wiki/Cycling" },
//                 { name: "American Football", votes: 0, link: "https://en.wikipedia.org/wiki/American_football" }
//             ]
//         },
//         {
//             name: "Controversial Artists of the 20th Century",
//             subjects: [
//                 { name: "Pablo Picasso", votes: 0, link: "https://en.wikipedia.org/wiki/Pablo_Picasso" },
//                 { name: "Salvador Dalí", votes: 0, link: "https://en.wikipedia.org/wiki/Salvador_Dal%C3%AD" },
//                 { name: "Jackson Pollock", votes: 0, link: "https://en.wikipedia.org/wiki/Jackson_Pollock" },
//                 { name: "Andy Warhol", votes: 0, link: "https://en.wikipedia.org/wiki/Andy_Warhol" },
//                 { name: "Jean-Michel Basquiat", votes: 0, link: "https://en.wikipedia.org/wiki/Jean-Michel_Basquiat" },
//                 { name: "Marina Abramović", votes: 0, link: "https://en.wikipedia.org/wiki/Marina_Abramovi%C4%87" },
//                 { name: "Damien Hirst", votes: 0, link: "https://en.wikipedia.org/wiki/Damien_Hirst" },
//                 { name: "Frida Kahlo", votes: 0, link: "https://en.wikipedia.org/wiki/Frida_Kahlo" },
//                 { name: "Georgia O’Keeffe", votes: 0, link: "https://en.wikipedia.org/wiki/Georgia_O%27Keeffe" },
//                 { name: "Francis Bacon", votes: 0, link: "https://en.wikipedia.org/wiki/Francis_Bacon_(artist)" },
//                 { name: "Cindy Sherman", votes: 0, link: "https://en.wikipedia.org/wiki/Cindy_Sherman" }
//             ]
//         },
//         {
//             name: "Top Political Thinkers of Modern Times",
//             subjects: [
//                 { name: "Karl Marx", votes: 0, link: "https://en.wikipedia.org/wiki/Karl_Marx" },
//                 { name: "Thomas Jefferson", votes: 0, link: "https://en.wikipedia.org/wiki/Thomas_Jefferson" },
//                 { name: "Mahatma Gandhi", votes: 0, link: "https://en.wikipedia.org/wiki/Mahatma_Gandhi" },
//                 { name: "Nelson Mandela", votes: 0, link: "https://en.wikipedia.org/wiki/Nelson_Mandela" },
//                 { name: "Martin Luther King Jr.", votes: 0, link: "https://en.wikipedia.org/wiki/Martin_Luther_King_Jr." },
//                 { name: "Che Guevara", votes: 0, link: "https://en.wikipedia.org/wiki/Che_Guevara" },
//                 { name: "Vladimir Lenin", votes: 0, link: "https://en.wikipedia.org/wiki/Vladimir_Lenin" },
//                 { name: "Malcolm X", votes: 0, link: "https://en.wikipedia.org/wiki/Malcolm_X" },
//                 { name: "Angela Davis", votes: 0, link: "https://en.wikipedia.org/wiki/Angela_Davis" },
//                 { name: "Noam Chomsky", votes: 0, link: "https://en.wikipedia.org/wiki/Noam_Chomsky" },
//                 { name: "Milton Friedman", votes: 0, link: "https://en.wikipedia.org/wiki/Milton_Friedman" },
//                 { name: "John Maynard Keynes", votes: 0, link: "https://en.wikipedia.org/wiki/John_Maynard_Keynes" }
//             ]
//         },
//         {
//             name: "Popular Internet Games",
//             subjects: [
//                 { name: "Wordle", votes: 0, link: "https://www.nytimes.com/games/wordle/index.html" },
//                 { name: "Sporcle", votes: 0, link: "https://www.sporcle.com/" },
//                 { name: "Worldle", votes: 0, link: "https://worldle.teuteuf.fr/" },
//                 { name: "GeoGuessr", votes: 0, link: "https://www.geoguessr.com/" },
//                 { name: "Agar.io", votes: 0, link: "http://agar.io/" },
//                 { name: "Little Alchemy", votes: 0, link: "https://littlealchemy.com/" },
//                 { name: "Slither.io", votes: 0, link: "http://slither.io/" },
//                 { name: "Cookie Clicker", votes: 0, link: "https://orteil.dashnet.org/cookieclicker/" },
//                 { name: "2048", votes: 0, link: "https://play2048.co/" },
//                 { name: "Crossword Labs", votes: 0, link: "https://crosswordlabs.com/" },
//                 { name: "Trivia Crack", votes: 0, link: "https://www.triviacrack.com/" },
//                 { name: "Heardle", votes: 0, link: "https://www.spotify.com/heardle/" },
//                 { name: "Lingo", votes: 0, link: "https://www.wordlingo.com/" },
//                 { name: "TypeRacer", votes: 0, link: "https://play.typeracer.com/" },
//                 { name: "Wiki Game", votes: 0, link: "https://www.thewikigame.com/" },
//                 { name: "QWOP", votes: 0, link: "http://www.foddy.net/Athletics.html" }
//             ]
//         },
//         {
//             name: "Worst President of the United States",
//             subjects: [
//                 { name: "James Buchanan", votes: 0, link: "https://en.wikipedia.org/wiki/James_Buchanan" },
//                 { name: "Andrew Johnson", votes: 0, link: "https://en.wikipedia.org/wiki/Andrew_Johnson" },
//                 { name: "Warren G. Harding", votes: 0, link: "https://en.wikipedia.org/wiki/Warren_G._Harding" },
//                 { name: "Richard Nixon", votes: 0, link: "https://en.wikipedia.org/wiki/Richard_Nixon" },
//                 { name: "Herbert Hoover", votes: 0, link: "https://en.wikipedia.org/wiki/Herbert_Hoover" }
//             ]
//         },
//         {
//             name: "Best South American Countries for Backpackers",
//             subjects: [
//                 { name: "Argentina", votes: 0, link: "https://en.wikipedia.org/wiki/Argentina" },
//                 { name: "Bolivia", votes: 0, link: "https://en.wikipedia.org/wiki/Bolivia" },
//                 { name: "Brazil", votes: 0, link: "https://en.wikipedia.org/wiki/Brazil" },
//                 { name: "Chile", votes: 0, link: "https://en.wikipedia.org/wiki/Chile" },
//                 { name: "Colombia", votes: 0, link: "https://en.wikipedia.org/wiki/Colombia" },
//                 { name: "Ecuador", votes: 0, link: "https://en.wikipedia.org/wiki/Ecuador" },
//                 { name: "Guyana", votes: 0, link: "https://en.wikipedia.org/wiki/Guyana" },
//                 { name: "Paraguay", votes: 0, link: "https://en.wikipedia.org/wiki/Paraguay" },
//                 { name: "Peru", votes: 0, link: "https://en.wikipedia.org/wiki/Peru" },
//                 { name: "Suriname", votes: 0, link: "https://en.wikipedia.org/wiki/Suriname" },
//                 { name: "Uruguay", votes: 0, link: "https://en.wikipedia.org/wiki/Uruguay" },
//                 { name: "Venezuela", votes: 0, link: "https://en.wikipedia.org/wiki/Venezuela" }
//             ]
//         },
//         {
//         name: "Most Disappointing Horror Films of 2024",
//         subjects: [
//             { name: "Imaginary", votes: 0, link: "https://www.imdb.com/title/tt11697220/" },
//             { name: "AfrAId", votes: 0, link: "https://www.imdb.com/title/tt21644476/" },
//             { name: "The First Omen", votes: 0, link: "https://www.imdb.com/title/tt14999720/" },
//             { name: "Abigail", votes: 0, link: "https://www.imdb.com/title/tt15243418/" },
//             { name: "Tarot", votes: 0, link: "https://www.imdb.com/title/tt23519856/" },
//             { name: "The Strangers: Chapter 1", votes: 0, link: "https://www.imdb.com/title/tt1609497/" },
//             { name: "Cuckoo", votes: 0, link: "https://www.imdb.com/title/tt11995420/" },
//             { name: "Strange Darling", votes: 0, link: "https://www.imdb.com/title/tt15190690/" }
//         ]
//     },  
//     {  
//     name: "Worst Smells",
//         subjects: [
//             { name: "Body Odor", votes: 0, link: "https://www.nhs.uk/conditions/body-odour-bo/" },
//             { name: "Feces", votes: 0, link: "https://en.wikipedia.org/wiki/Feces" },
//             { name: "Rotten Eggs (Hydrogen Sulfide)", votes: 0, link: "https://en.wikipedia.org/wiki/Hydrogen_sulfide" },
//             { name: "Sour Milk", votes: 0, link: "https://en.wikipedia.org/wiki/Milk#Spoilage_and_sourness" },
//             { name: "Garbage", votes: 0, link: "https://en.wikipedia.org/wiki/Waste_management" },
//             { name: "Mold and Mildew", votes: 0, link: "https://en.wikipedia.org/wiki/Mold" },
//             { name: "Pet Urine", votes: 0, link: "https://en.wikipedia.org/wiki/Urea" },
//             { name: "Cigarette Smoke", votes: 0, link: "https://en.wikipedia.org/wiki/Health_effects_of_tobacco" }
//         ]
//     },
//     {
//         name: "Top Sportswear Stores",
//         subjects: [
//             { name: "Nike", votes: 0, link: "https://www.nike.com/" },
//             { name: "Adidas", votes: 0, link: "https://www.adidas.com/" },
//             { name: "Puma", votes: 0, link: "https://us.puma.com/" },
//             { name: "Under Armour", votes: 0, link: "https://www.underarmour.com/" },
//             { name: "Reebok", votes: 0, link: "https://www.reebok.com/" },
//             { name: "New Balance", votes: 0, link: "https://www.newbalance.com/" },
//             { name: "ASICS", votes: 0, link: "https://www.asics.com/" },
//             { name: "Columbia Sportswear", votes: 0, link: "https://www.columbia.com/" },
//             { name: "The North Face", votes: 0, link: "https://www.thenorthface.com/" },
//             { name: "Patagonia", votes: 0, link: "https://www.patagonia.com/" },
//             { name: "Lululemon", votes: 0, link: "https://shop.lululemon.com/" },
//             { name: "Fila", votes: 0, link: "https://www.fila.com/" },
//             { name: "Champion", votes: 0, link: "https://www.champion.com/" },
//             { name: "Decathlon", votes: 0, link: "https://www.decathlon.com/" },
//             { name: "Umbro", votes: 0, link: "https://www.umbro.com/" }
//         ]
//     }
// ];

// const categoriesContainer = document.getElementById("categories");
// let currentFilteredCategories = categories;

// // Helper function to determine the category style
// function getCategoryStyle(categoryName) {
//     const nameLower = categoryName.toLowerCase();
    
//     // Check for negative keywords first to give them priority
//     if (nameLower.includes("disappointing") || nameLower.includes("worst") || nameLower.includes("least")) {
//         return "category-red";
//     }
    
//     // Check for positive keywords if no negative keywords are present
//     if (nameLower.includes("best") || nameLower.includes("popular") || nameLower.includes("most") || nameLower.includes("top")) {
//         return "category-green";
//     }

//     // Default to blue if no specific keywords are matched
//     return "category";
// }

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

// // Function to close the comment section if clicked outside
// document.addEventListener('click', (event) => {
//     const commentSections = document.querySelectorAll('.comments-section');
//     const isCommentSection = Array.from(commentSections).some((section) => section.contains(event.target));
//     const isToggleButton = event.target.classList.contains('comment-toggle');

//     if (!isCommentSection && !isToggleButton) {
//         commentSections.forEach((section) => section.classList.add('hidden'));
//     }
// });


// // Function to add a new comment
// function addComment(categoryIndex, subjectIndex) {
//     const commentInput = document.getElementById(`comment-input-${categoryIndex}-${subjectIndex}`);
//     const commentText = commentInput.value.trim().substring(0, 200);

//     if (commentText) {
//         const commentContainer = document.getElementById(`comments-container-${categoryIndex}-${subjectIndex}`);
//         const randomUsername = `User${Math.floor(Math.random() * 1000)}`;

//         const commentDiv = document.createElement("div");
//         commentDiv.classList.add("comment");
//         commentDiv.innerHTML = `<strong>${randomUsername}:</strong> ${commentText}`;
        
//         // Append the new comment
//         commentContainer.appendChild(commentDiv);
//         commentInput.value = "";
//     }
// }

// // Function to render categories with color-coding based on title
// function renderCategories(filteredCategories = categories, highlight = "") {
//     categoriesContainer.innerHTML = "";
//     currentFilteredCategories = filteredCategories;

//     filteredCategories.forEach((category, categoryIndex) => {
//         const categoryDiv = document.createElement("div");
//         const categoryStyle = getCategoryStyle(category.name);
//         categoryDiv.classList.add("category", "scrollable", categoryStyle);
//         categoryDiv.innerHTML = `<h2>${category.name}</h2>`;

//         const sortedSubjects = category.subjects.sort((a, b) => b.votes - a.votes);

//         sortedSubjects.forEach((subject, subjectIndex) => {
//             const subjectDiv = document.createElement("div");
//             subjectDiv.classList.add("subject");

//             const rank = subjectIndex + 1;
            
//             const isMatch = highlight && subject.name.toLowerCase().includes(highlight.toLowerCase());
//             const subjectStyle = isMatch ? 'style="background-color: #fef3bd;"' : ''; // Light yellow highlight
//             subjectDiv.innerHTML = `
//     <span ${subjectStyle} class="subject-info">
//         <span class="ranking">${rank}</span>
//         <a href="${subject.link}" target="_blank">${subject.name}</a>
//         <button class="comment-toggle" onclick="toggleCommentSection(${categoryIndex}, ${subjectIndex})">
//             &#x25BC;
//         </button>
//     </span>
//     <button class="vote-button" onclick="upvote(${categoryIndex}, ${subjectIndex})">
//         &#x25B2; <span class="vote-count">${subject.votes}</span>
//     </button>
//     <div id="comments-${categoryIndex}-${subjectIndex}" class="comments-section hidden">
//         <div id="comments-container-${categoryIndex}-${subjectIndex}" class="comments-container"></div>
//         <textarea id="comment-input-${categoryIndex}-${subjectIndex}" maxlength="200" placeholder="Add a comment..."></textarea>
//         <button onclick="addComment(${categoryIndex}, ${subjectIndex})">Post Comment</button>
//     </div>
// `;

//             categoryDiv.appendChild(subjectDiv);
//         });

//         categoriesContainer.appendChild(categoryDiv);
//     });
// }

// // Function to handle upvotes
// window.upvote = function (categoryIndex, subjectIndex) {
//     const subject = currentFilteredCategories[categoryIndex].subjects[subjectIndex];
//     const maxVotes = 1000;

//     if (subject.votes < maxVotes) {
//         subject.votes += 1;
//         renderCategories(currentFilteredCategories);
//     } else {
//         alert("This subject has reached the maximum votes from your IP address.");
//     }
// };

// // Filter content based on search input
// window.filterContent = function () {
//     const searchTerm = document.getElementById("searchBar").value.toLowerCase();
    
//     const filteredCategories = categories.map(category => {
//         const matchingSubjects = category.subjects.filter(subject => 
//             subject.name.toLowerCase().includes(searchTerm)
//         );
        
//         return matchingSubjects.length > 0 ? category : null;
//     }).filter(Boolean);

//     renderCategories(filteredCategories, searchTerm);
// };

// // Filter by genre
// window.filterByGenre = function (genre) {
//     const filteredCategories = categories.filter(category => category.name === genre);
//     renderCategories(filteredCategories);
// };

// // Initial render of all categories
// renderCategories();

// // Recursive function to render comments and their replies
// function renderComments(comments, parentElement) {
//     comments.forEach(comment => {
//         // Create comment div
//         const commentDiv = document.createElement("div");
//         commentDiv.classList.add("comment");
//         commentDiv.innerHTML = `<strong>${comment.username}</strong>: ${comment.comment_text}`;

//         // Append to the parent comment or root element
//         parentElement.appendChild(commentDiv);

//         // Check if there are replies and render them
//         if (comment.replies) {
//             const repliesDiv = document.createElement("div");
//             repliesDiv.classList.add("replies"); // Style for nested replies
//             renderComments(comment.replies, repliesDiv);
//             commentDiv.appendChild(repliesDiv);
//         }
//     });
// }

// });

    
