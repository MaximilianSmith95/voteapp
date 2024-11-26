require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const cookieParser = require("cookie-parser");
const rateLimit = require('express-rate-limit'); // Import the rate-limiting middleware
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Use memory storage for temporary files

// AWS S3 Configuration
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: 'eu-north-1' // Correct region configuration
});

const app = express();
app.set('trust proxy', true);
app.use(cookieParser());
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Device ID Middleware: Place this after cookieParser and before routes
app.use((req, res, next) => {
    if (!req.cookies.deviceId) {
        const deviceId = uuidv4();
        res.cookie('deviceId', deviceId, { httpOnly: true, secure: true });
        req.deviceId = deviceId;
    } else {
        req.deviceId = req.cookies.deviceId;
    }
    next();
});
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

// Search API
app.get('/api/search', (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    const searchQuery = `
        SELECT c.category_id, c.name AS category_name,
               s.subject_id, s.name AS subject_name, s.votes, s.link
        FROM Categories c
        LEFT JOIN Subjects s ON c.category_id = s.category_id
        WHERE c.name LIKE ? OR c.category_id IN (
            SELECT category_id
            FROM Subjects
            WHERE name LIKE ?
        )
    `;

    db.query(searchQuery, [`%${query}%`, `%${query}%`], (err, results) => {
        if (err) {
            console.error('Error executing search query:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const categories = results.reduce((acc, row) => {
            let category = acc.find(cat => cat.category_id === row.category_id);
            if (!category) {
                category = {
                    category_id: row.category_id,
                    name: row.category_name,
                    subjects: []
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

        res.json(categories);
    });
});

// Fetch categories
app.get('/api/categories', (req, res) => {
    const { latitude, longitude, type } = req.query;

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
            if (!latitude || !longitude) {
                return res.status(400).json({ error: 'Latitude and longitude are required for near me categories.' });
            }

            const userLat = parseFloat(latitude);
            const userLon = parseFloat(longitude);

            const sortedCategories = categories
                .map(category => ({
                    ...category,
                    distance: haversine(userLat, userLon, category.latitude, category.longitude)
                }))
                .sort((a, b) => a.distance - b.distance);

            res.json(sortedCategories);
        } else {
            res.json(categories);
        }
    });
});

app.get('/api/categories/for-you', (req, res) => {
    const deviceId = req.cookies.deviceId || req.headers['x-forwarded-for'] || 'unknown';

    const query = `
        SELECT c.category_id, c.name AS category_name, COALESCE(up.weight, 0) AS weight
        FROM Categories c
        LEFT JOIN UserPreferences up ON c.category_id = up.category_id AND up.device_id = ?
        ORDER BY weight DESC, c.name ASC;
    `;

    db.query(query, [deviceId], (err, results) => {
        if (err) {
            console.error('Error fetching personalized categories:', err); // Log exact error
            return res.status(500).json({ error: 'Failed to fetch personalized categories' });
        }
        res.json(results);
    });
});



app.post('/api/subjects/:id/vote', voteLimiter, (req, res) => {
    const subjectId = parseInt(req.params.id, 10);
    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const deviceId = req.cookies.deviceId || req.headers['x-forwarded-for'] || 'unknown';

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

                // Fetch the category ID associated with the subject
                const query = 'SELECT category_id FROM Subjects WHERE subject_id = ?';
                db.query(query, [subjectId], (err, results) => {
                    if (err) {
                        console.error('Error fetching category ID:', err);
                    }

                    const categoryId = results[0]?.category_id;

                    // Update preferences in UserPreferences table
                    if (categoryId) {
                        const updatePreferenceQuery = `
                            INSERT INTO UserPreferences (device_id, category_id, weight)
                            VALUES (?, ?, 1)
                            ON DUPLICATE KEY UPDATE weight = weight + 1
                        `;

                        db.query(updatePreferenceQuery, [deviceId, categoryId], (err) => {
                            if (err) {
                                console.error('Error updating preferences:', err);
                            }
                        });

                        // Update cookie-based preferences for backward compatibility
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


// Add a comment
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

// Combined comments and voice reviews fetch
app.get('/api/subjects/:id/comments', (req, res) => {
    const subjectId = req.params.id;
    const query = `
        SELECT comment_id, parent_comment_id, username, comment_text, audio_path, is_voice_review, created_at
        FROM comments
        WHERE subject_id = ?
        ORDER BY created_at ASC;
    `;

    db.query(query, [subjectId], (err, results) => {
        if (err) {
            console.error('Error fetching comments:', err);
            res.status(500).json({ error: 'Failed to fetch comments' });
        } else {
            const comments = results.filter(comment => !comment.is_voice_review);
            const voiceReviews = results.filter(comment => comment.is_voice_review);

            res.json({ comments, voiceReviews });
        }
    });
});

// Upload voice reviews
app.post('/api/subjects/:id/voice-review', upload.single('audio'), async (req, res) => {
    const { id: subjectId } = req.params;
    const username = req.body.username || 'Anonymous';
    const audioFile = req.file;

    // Check if audio file is present
    if (!audioFile) {
        console.error('No audio file received in the request.');
        return res.status(400).json({ error: 'Audio file is required' });
    }

    // Log file and body details for debugging
    console.log('File received:', {
        fieldname: audioFile.fieldname,
        originalname: audioFile.originalname,
        mimetype: audioFile.mimetype,
        size: audioFile.size
    });
    console.log('Body received:', req.body);

    // S3 upload parameters
    const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `voice-reviews/${subjectId}/${Date.now()}_${audioFile.originalname}`,
        Body: audioFile.buffer,
        ContentType: audioFile.mimetype,
        ACL: 'public-read'
    };

    try {
        // Attempt to upload the file to S3
        const s3Response = await s3.upload(s3Params).promise();
        console.log('S3 upload successful:', s3Response);

        // Save review details to the database
        const query = 'INSERT INTO comments (subject_id, username, audio_path, is_voice_review) VALUES (?, ?, ?, TRUE)';
        db.query(query, [subjectId, username, s3Response.Location], (err) => {
            if (err) {
                console.error('Database error while saving voice review:', err);
                return res.status(500).json({ error: 'Failed to save review in database' });
            }
            res.json({ success: true, url: s3Response.Location });
        });
    } catch (err) {
        // Handle any errors during the S3 upload
        console.error('Error during S3 upload:', err.message);
        return res.status(500).json({ error: 'Failed to upload to S3' });
    }
});

// Fetch total votes
app.get('/api/totalVotes', (req, res) => {
    const query = 'SELECT SUM(votes) AS totalVotes FROM subjects';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching total votes:', err);
            res.status(500).json({ error: 'Database error' });
        } else {
            res.json({ totalVotes: results[0]?.totalVotes || 0 });
        }
    });
});

const PORT = process.env.PORT || 3500;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
