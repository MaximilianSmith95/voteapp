require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const cookieParser = require("cookie-parser");

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

app.get('/api/categories', (req, res) => {
    const preferences = req.cookies.preferences ? JSON.parse(req.cookies.preferences) : {};

    const query = `
        SELECT c.category_id, c.name AS category_name,
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
                category = { category_id: row.category_id, name: row.category_name, subjects: [] };
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

        const sortedCategories = categories.sort((a, b) => {
            return (preferences[b.category_id] || 0) - (preferences[a.category_id] || 0);
        });

        res.json(sortedCategories);
    });
});

app.post('/api/subjects/:id/vote', (req, res) => {
    const subjectId = req.params.id;

    // Find the category linked to the subject
    const query = 'SELECT category_id FROM Subjects WHERE subject_id = ?';
    db.query(query, [subjectId], (err, results) => {
        if (err) {
            console.error('Error fetching category ID:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const categoryId = results[0]?.category_id;
        if (categoryId) {
            // Update cookie-stored preferences
            const preferences = req.cookies.preferences ? JSON.parse(req.cookies.preferences) : {};
            preferences[categoryId] = (preferences[categoryId] || 0) + 1;

            res.cookie("preferences", JSON.stringify(preferences), { httpOnly: true, secure: true });
        }

        // Increment the subject votes
        const updateVotesQuery = 'UPDATE Subjects SET votes = votes + 1 WHERE subject_id = ?';
        db.query(updateVotesQuery, [subjectId], (err) => {
            if (err) {
                console.error('Error updating votes:', err);
                return res.status(500).json({ error: 'Failed to update votes' });
            }
            res.json({ success: true });
        });
    });
});

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

