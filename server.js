require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const cookieParser = require("cookie-parser");
const rateLimit = require('express-rate-limit');
const AWS = require('aws-sdk');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: 'eu-north-1'
});

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

const voteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please try again later.' }
});

// Haversine formula
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

// Search API
app.get('/api/search', (req, res) => {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Invalid search query' });
    }
    const sanitizedQuery = query.trim();

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

    db.execute(searchQuery, [`%${sanitizedQuery}%`, `%${sanitizedQuery}%`], (err, results) => {
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

// Categories API
app.get('/api/categories', (req, res) => {
    const { latitude, longitude, type } = req.query;
    const preferences = req.cookies.preferences ? JSON.parse(req.cookies.preferences) : {};
    const deviceId = req.cookies.device_id;

    const baseQuery = `
        SELECT c.category_id, c.name AS category_name, c.latitude, c.longitude,
               s.subject_id, s.name AS subject_name, s.votes, s.link
        FROM Categories c
        LEFT JOIN Subjects s ON c.category_id = s.category_id;
    `;

    db.query(baseQuery, (err, results) => {
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
                    latitude: row.latitude,
                    longitude: row.longitude,
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

        if (latitude && longitude) {
            const userLat = parseFloat(latitude);
            const userLon = parseFloat(longitude);

            const categoriesWithDistance = categories.map(category => ({
                ...category,
                distance: category.latitude && category.longitude
                    ? haversine(userLat, userLon, category.latitude, category.longitude)
                    : Infinity
            }));

            const sortedCategories = categoriesWithDistance.sort((a, b) => a.distance - b.distance);

            return res.json(sortedCategories);
        }

        if (type === "for-you") {
            const relatedCategoriesQuery = `
                SELECT s1.category_id AS category_id_1, s2.category_id AS category_id_2, COUNT(*) AS shared_subjects
                FROM Subjects s1
                INNER JOIN Subjects s2 ON s1.name = s2.name AND s1.category_id != s2.category_id
                WHERE s1.category_id IN (
                    SELECT category_id FROM UserPreferences WHERE device_id = ?
                )
                GROUP BY s1.category_id, s2.category_id
                ORDER BY shared_subjects DESC;
            `;

            db.execute(relatedCategoriesQuery, [deviceId], (relatedErr, relatedResults) => {
                if (relatedErr) {
                    console.error('Error fetching related categories:', relatedErr);
                    return res.status(500).json({ error: 'Database error' });
                }

                const relatedCategoryIds = relatedResults.map(row => row.category_id_2);

                const forYouCategoryIds = new Set([
                    ...Object.keys(preferences).map(Number),
                    ...relatedCategoryIds
                ]);

                let forYouCategories = categories.filter(cat => forYouCategoryIds.has(cat.category_id));

                if (forYouCategories.length === 0) {
                    forYouCategories = categories.sort(() => 0.5 - Math.random());
                }

                const sortedCategories = forYouCategories.sort((a, b) => {
                    return (preferences[b.category_id] || 0) - (preferences[a.category_id] || 0);
                });

                res.json(sortedCategories);
            });
        } else {
            res.json(categories);
        }
    });
});

// Voting API
app.post('/api/subjects/:id/vote', voteLimiter, (req, res) => {
    const subjectId = parseInt(req.params.id, 10);
    if (isNaN(subjectId) || subjectId <= 0) {
        return res.status(400).json({ error: 'Invalid subject ID' });
    }

    const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const checkQuery = `
        SELECT votes_count FROM IpVotes WHERE ip_address = ? AND subject_id = ?
    `;

    db.execute(checkQuery, [userIp, subjectId], (err, results) => {
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

        db.execute(incrementQuery, [userIp, subjectId], (err) => {
            if (err) {
                console.error('Error incrementing IP votes:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            const updateVotesQuery = `
                UPDATE Subjects SET votes = votes + 1 WHERE subject_id = ?
            `;

            db.execute(updateVotesQuery, [subjectId], (err) => {
                if (err) {
                    console.error('Error updating votes:', err);
                    return res.status(500).json({ error: 'Failed to update votes' });
                }

                res.json({ success: true });
            });
        });
    });
});

// Add a Comment
app.post('/api/subjects/:id/comment', (req, res) => {
    const { id: subjectId } = req.params;
    const { username, comment_text, parent_comment_id = null } = req.body;

    if (!username || typeof username !== 'string' || username.length > 50) {
        return res.status(400).json({ error: 'Invalid username' });
    }
    if (!comment_text || typeof comment_text !== 'string' || comment_text.length > 500) {
        return res.status(400).json({ error: 'Invalid comment text' });
    }

    const sanitizedUsername = username.trim();
    const sanitizedComment = comment_text.trim();
    const sanitizedParentCommentId = parent_comment_id ? parseInt(parent_comment_id, 10) : null;

    if (parent_comment_id && isNaN(sanitizedParentCommentId)) {
        return res.status(400).json({ error: 'Invalid parent comment ID' });
    }

    const query = `
        INSERT INTO comments (subject_id, username, comment_text, parent_comment_id)
        VALUES (?, ?, ?, ?)
    `;
    db.execute(query, [subjectId, sanitizedUsername, sanitizedComment, sanitizedParentCommentId], (err) => {
        if (err) {
            console.error('Error inserting comment:', err);
            res.status(500).json({ error: 'Failed to add comment' });
        } else {
            res.json({ success: true });
        }
    });
});

// Upload Voice Review
app.post('/api/subjects/:id/voice-review', upload.single('audio'), async (req, res) => {
    const { id: subjectId } = req.params;
    const username = req.body.username || 'Anonymous';
    const audioFile = req.file;

    if (!audioFile) {
        return res.status(400).json({ error: 'Audio file is required' });
    }

    const s3Params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `voice-reviews/${subjectId}/${Date.now()}_${audioFile.originalname}`,
        Body: audioFile.buffer,
        ContentType: audioFile.mimetype,
        ACL: 'public-read'
    };

    try {
        const s3Response = await s3.upload(s3Params).promise();
        const query = `
            INSERT INTO comments (subject_id, username, audio_path, is_voice_review)
            VALUES (?, ?, ?, TRUE)
        `;
        db.execute(query, [subjectId, username, s3Response.Location], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to save review in database' });
            }
            res.json({ success: true, url: s3Response.Location });
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to upload to S3' });
    }
});

// Fetch Total Votes
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
