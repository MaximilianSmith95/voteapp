require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const cookieParser = require("cookie-parser");
const rateLimit = require('express-rate-limit'); // Import the rate-limiting middleware
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save files in the 'uploads' directory
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

// Ensure the 'uploads' directory exists
const fs = require('fs');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

const app = express();
app.set('trust proxy', true);
app.use(cookieParser());
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(`https://${req.hostname}${req.url}`);
    }
    next();
});

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

// Haversine formula for distance calculation
const haversine = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Define a rate limiter for the voting endpoint
const voteLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 100, // Limit each IP to 100 requests per minute
    message: { error: 'Too many requests. Please try again later.' } // Custom message
});

app.get('/api/categories', (req, res) => {
    const { latitude, longitude, type } = req.query;
    const preferences = req.cookies.preferences ? JSON.parse(req.cookies.preferences) : {};

    const query = `
        SELECT c.category_id, c.name AS category_name, c.latitude, c.longitude,
               s.subject_id, s.name AS subject_name, s.votes, s.link
        FROM Categories c
        LEFT JOIN Subjects s ON c.category_id = s.category_id;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const categories = results.reduce((acc, row) => {
            let category = acc.find(cat => cat.category_id === row.category_id);
            if (!category) {
                category = { 
                    category_id: row.category_id, 
                    name: row.category_name, 
                    subjects: [],
                    latitude: row.latitude,
                    longitude: row.longitude 
                };
                acc.push(category);
            }
            if (row.subject_id) {
                category.subjects.push({
                    subject_id: row.subject_id,
                    name: row.subject_name,
                    votes: row.votes,
                    link: row.link
                });
            }
            return acc;
        }, []);

        if (type === "near") {
            // Sort by geolocation proximity
            const userLat = parseFloat(latitude);
            const userLon = parseFloat(longitude);

            const sortedCategories = categories.map(category => ({
                ...category,
                distance: haversine(userLat, userLon, category.latitude, category.longitude)
            })).sort((a, b) => a.distance - b.distance);

            res.json(sortedCategories);
        } else if (type === "for-you") {
            // Sort by preferences
            const sortedCategories = categories.sort((a, b) => {
                return (preferences[b.category_id] || 0) - (preferences[a.category_id] || 0);
            });

            res.json(sortedCategories);
        } else {
            // Default to unsorted (randomized or default logic)
            res.json(categories);
        }
    });
});


// API to vote for a subject
app.post('/api/subjects/:id/vote', voteLimiter, (req, res) => { // Apply rate limiter here
    const subjectId = parseInt(req.params.id, 10);
    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const checkQuery = `
        SELECT votes_count FROM IpVotes WHERE ip_address = ? AND subject_id = ?
    `;

    db.query(checkQuery, [userIp, subjectId], (err, results) => {
        if (err) {
            console.error('Error checking IP votes:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const currentVotes = results[0]?.votes_count || 0;

        if (currentVotes >= 200) {
            return res.status(403).json({ error: 'Wow you love it! Vote limit reached' });
        }

        const incrementQuery = `
            INSERT INTO IpVotes (ip_address, subject_id, votes_count)
            VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE votes_count = votes_count + 1
        `;

        db.query(incrementQuery, [userIp, subjectId], (err) => {
            if (err) {
                console.error('Error incrementing IP votes:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            const updateVotesQuery = `
                UPDATE Subjects SET votes = votes + 1 WHERE subject_id = ?
            `;

            db.query(updateVotesQuery, [subjectId], (err) => {
                if (err) {
                    console.error('Error updating votes:', err);
                    return res.status(500).json({ error: 'Failed to update votes' });
                }

                // Update cookie-stored preferences
                const query = 'SELECT category_id FROM Subjects WHERE subject_id = ?';
                db.query(query, [subjectId], (err, results) => {
                    if (err) {
                        console.error('Error fetching category ID:', err);
                    }

                    const categoryId = results[0]?.category_id;
                    if (categoryId) {
                        const preferences = req.cookies.preferences ? JSON.parse(req.cookies.preferences) : {};
                        preferences[categoryId] = (preferences[categoryId] || 0) + 1;

                        res.cookie("preferences", JSON.stringify(preferences), { httpOnly: true, secure: true });
                    }

                    res.json({ success: true });
                });
            });
        });
    });
});
// API endpoint for uploading voice notes
app.post('/api/subjects/:id/comment/audio', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { id: subjectId } = req.params;
    const { username } = req.body; // This should come from the frontend
    const audioPath = `/uploads/${req.file.filename}`;

    // Save file details to the database
    const query = `
        INSERT INTO comments (subject_id, username, comment_text, audio_path)
        VALUES (?, ?, NULL, ?)
    `;
    db.query(query, [subjectId, username, audioPath], (err) => {
        if (err) {
            console.error('Error inserting comment:', err);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true, audioPath });
    });
});

// API to add a comment
app.post('/api/subjects/:id/comment', (req, res) => {
    const { id: subjectId } = req.params;
    const { username, comment_text, parent_comment_id = null } = req.body;

    const query = `INSERT INTO comments (subject_id, username, comment_text, parent_comment_id) VALUES (?, ?, ?, ?)`;
    db.query(query, [subjectId, username, comment_text, parent_comment_id], (err) => {
        if (err) {
            console.error('Error inserting comment:', err);
            res.json({ success: false });
        } else {
            res.json({ success: true });
        }
    });
});

// API to fetch comments
app.get('/api/subjects/:id/comments', (req, res) => {
    const subjectId = req.params.id;
    const query = `
        SELECT comment_id, parent_comment_id, username, comment_text, created_at
        FROM comments
        WHERE subject_id = ?
        ORDER BY created_at ASC;
    `;

    db.query(query, [subjectId], (err, results) => {
        if (err) {
            console.error('Error fetching comments:', err);
            res.status(500).json({ error: 'Failed to fetch comments' });
        } else {
            const commentsMap = {};
            results.forEach(comment => {
                commentsMap[comment.comment_id] = { ...comment, replies: [] };
            });

            const structuredComments = [];
            results.forEach(comment => {
                if (comment.parent_comment_id) {
                    commentsMap[comment.parent_comment_id].replies.push(commentsMap[comment.comment_id]);
                } else {
                    structuredComments.push(commentsMap[comment.comment_id]);
                }
            });

            res.json(structuredComments);
        }
    });
});

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
