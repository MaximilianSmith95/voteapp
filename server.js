require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(`https://${req.hostname}${req.url}`);
    }
    next();
});
app.set('trust proxy', true);

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
    const userLat = parseFloat(req.query.latitude);
    const userLon = parseFloat(req.query.longitude);

    const query = `
        SELECT c.category_id, c.name AS category_name, c.latitude, c.longitude,
               s.subject_id, s.name AS subject_name, s.votes, s.link
        FROM Categories c
        LEFT JOIN Subjects s ON c.category_id = s.category_id;
    `;

    db.query(query, (err, results) => {
        if (err) throw err;

        const categories = results.reduce((acc, row) => {
            let category = acc.find(cat => cat.category_id === row.category_id);
            if (!category) {
                category = { category_id: row.category_id, name: row.category_name, subjects: [], latitude: row.latitude, longitude: row.longitude };
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

        const sortedCategories = categories.map(category => ({
            ...category,
            distance: haversine(userLat, userLon, category.latitude, category.longitude)
        })).sort((a, b) => a.distance - b.distance);

        res.json(sortedCategories);
    });
});

app.post('/api/subjects/:id/vote', (req, res) => {
    const subjectId = req.params.id;
    const query = 'UPDATE Subjects SET votes = votes + 1 WHERE subject_id = ?';

    db.query(query, [subjectId], (err) => {
        if (err) throw err;
        res.json({ success: true });
    });
});

app.post('/api/subjects/:id/comment', (req, res) => {
    const { id: subjectId } = req.params;
    const { username, comment_text, parent_comment_id = null } = req.body;

    const query = `INSERT INTO Comments (subject_id, username, comment_text, parent_comment_id) VALUES (?, ?, ?, ?)`;
    db.query(query, [subjectId, username, comment_text, parent_comment_id], (err) => {
        if (err) throw err;
        res.json({ success: true });
    });
});

app.get('/api/subjects/:id/comments', (req, res) => {
    const subjectId = req.params.id;
    const query = `
        SELECT comment_id, parent_comment_id, username, comment_text, created_at
        FROM Comments
        WHERE subject_id = ?
        ORDER BY created_at ASC;
    `;

    db.query(query, [subjectId], (err, results) => {
        if (err) throw err;

        const commentsMap = {};
        results.forEach(comment => {
            commentsMap[comment.comment_id] = { ...comment, replies: [] };
        });

        const comments = [];
        results.forEach(comment => {
            if (comment.parent_comment_id) {
                commentsMap[comment.parent_comment_id].replies.push(commentsMap[comment.comment_id]);
            } else {
                comments.push(commentsMap[comment.comment_id]);
            }
        });

        res.json(comments);
    });
});

const PORT = process.env.PORT || 3500;  
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
