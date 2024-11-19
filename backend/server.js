const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');  // For generating JWT tokens
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();


app.use(cors());
app.use(express.json());





app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});



















// MySQL connection setup
const connection = mysql.createConnection({
  host: 'sql8.freemysqlhosting.net',
  user: 'sql8745769', 
  password: 'hra5FNtkYc', 
  database: 'sql8745769' 
});

connection.connect(err => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// getting books
app.get('/books', (req, res) => {
  const query = 'SELECT * FROM Book';
  connection.query(query, (error, results) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.json(results);
  });
});

// get books by id 
app.get('/books/:id', (req, res) => {
  const bookId = req.params.id;
  const query = 'SELECT * FROM book WHERE bookID = ?';
  connection.query(query, [bookId], (error, results) => {
    if (error) {
      return res.status(500).send(error);
    }

    // Check if a book with the given ID was found
    if (results.length > 0) {
      res.json(results[0]); // Send back the first (and only) result as a JSON object
    } else {
      res.status(404).send('Book not found');
    }
  });
});

// Signup route
// Signup route
app.post('/signup', (req, res) => {
  const { memberName, email, password,contactInfo,membershipType } = req.body;

  // Check if any fields are empty
  if (!memberName || !email || !password  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Check if username or email already exists
  connection.query('SELECT * FROM Member WHERE email = ? ', [email], (error, results) => {
    if (error) {
      console.error("Error checking user:", error);
      return res.status(500).json({ message: "Database error on checking user" });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: "Email or username already exists" });
    }

    // Hash password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error("Error hashing password:", err);
        return res.status(500).json({ message: "Error hashing password" });
      }

      
      // Insert new user
      connection.query('INSERT INTO Member (memberName, email, password, contactInfo, membershipType) VALUES (?, ?, ?, ?, ?)', [memberName, email, hashedPassword, contactInfo, membershipType], (error, results) => {
        if (error) {
          console.error('Error inserting user:', error);
          return res.status(500).json({ message: "Database error on user creation", error: error });
        }
        res.status(201).json({ message: "User created successfully!" });
      });
    });
  });
});



app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Check for empty fields
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // Query the database
  const query = 'SELECT * FROM Member WHERE email = ?';
  connection.query(query, [email], async (error, results) => {
    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = results[0];

    try {
      // Validate password
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Generate a JWT token
      const token = jwt.sign({ userId: user.memberID, role: user.membershipType }, 'your_secret_key', { expiresIn: '1h' });

      // Send the full user object to the client
      res.json({
        token,
        user: {
          memberName: user.memberName,
          contactInfo: user.contactInfo,
          membershipType: user.membershipType,
          memberID: user.memberID,
        },
        message: 'Login successful',
      });
    } catch (err) {
      console.error('Error comparing passwords:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  });
});


app.get('/categories',(req, res) =>{

  const query = 'SELECT * FROM Category';
  connection.query(query, (error, results) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.json(results);
  })
  
});



app.post('/admin/add-book', (req, res) => {
  const { title, author, isbn, publishYear, shelfLocation, categoryID, imagepath } = req.body;
  
  if (!title || !author || !isbn || !publishYear || !categoryID) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const query = `
    INSERT INTO Book (title, author, ISBN, publishYear, shelfLocation, categoryID, imagepath, isAvailable)
    VALUES (?, ?, ?, ?, ?, ?, ?, true)
  `;

  connection.query(query, [title, author, isbn, publishYear, shelfLocation, categoryID, imagepath], (error, results) => {
    if (error) {
      console.error('Error adding book:', error);
      return res.status(500).json({ message: 'Database error on adding book' });
    }
    res.status(201).json({ message: 'Book added successfully!' });
  });
});



app.post('/reservations', (req, res) => {
  const { reservationType, memberID, bookID, spaceID, reservationDate, startTime, endTime, expirationDate } = req.body;

  // Check if reservation is valid based on type
  if (reservationType === 'book' && !bookID) {
    return res.status(400).json({ message: 'Book ID is required for book reservation' });
  }

  if (reservationType === 'quiet_space' && !spaceID) {
    return res.status(400).json({ message: 'Space ID is required for quiet space reservation' });
  }

  // SQL query to insert reservation (Assuming MySQL setup)
  const query = `
    INSERT INTO Reservation (reservationType, memberID, bookID, spaceID, reservationDate, startTime, endTime, expirationDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  connection.query(query, [reservationType, memberID, bookID, spaceID, reservationDate, startTime, endTime, expirationDate], (err, result) => {
    if (err) {
      console.error('Error inserting reservation:', err);
      return res.status(500).json({ message: 'Error creating reservation' });
    }

    // Update book availability if reservation is for a book
    if (reservationType === 'book') {
      const query2 = 'UPDATE book SET isAvailable = ? WHERE bookID = ?';
      connection.query(query2, [false, bookID], (updateErr, updateResult) => {
        if (updateErr) {
          console.error('Error updating book availability:', updateErr);
          return res.status(500).json({ message: 'Error updating book availability' });
        }

        res.status(200).json({ message: 'Reservation successful', reservationID: result.insertId });
      });
    } else {
      res.status(200).json({ message: 'Reservation successful', reservationID: result.insertId });
    }
  });
});




//  boroowed books 
app.post('/borrowedbooks', (req, res) => {
  const { memberID } = req.body;

  const query = `
   SELECT 
    b.bookID,
    b.title,
    b.author,
    b.ISBN,
    b.publishYear,
    b.shelfLocation,
    b.categoryID,
    b.isAvailable,
    b.imagepath,
    r.expirationDate
FROM 
    Book b
JOIN 
    Reservation r ON b.bookID = r.bookID
WHERE 
    r.memberID = ? 
    AND r.reservationType = 'book'

  `;

  connection.query(query, [memberID], (err, results) => {
    if (err) {
      console.error('Error getting books:', err);
      return res.status(500).json({ message: 'Error retrieving borrowed books' });
    }

    res.json(results);
  });
});





// Example in Node.js (Express)
// POST route to create a new notification for a member
// GET route to fetch notifications for a specific member
app.get('/notifications', (req, res) => {
  const memberID = req.query.memberID;
  if (!memberID) {
    return res.status(400).send('Missing memberID');
  }

  const query = 'SELECT * FROM notifications WHERE member_id = ?';
  connection.query(query, [memberID], (error, results) => {
    if (error) {
      return res.status(500).send(error);
    }
    res.json(results);
  });
});



// delet book 
// Delete book by ID
app.delete('/books/:id', (req, res) => {
  const bookId = req.params.id;

  // SQL query to delete the book
  const query = 'DELETE FROM Book WHERE bookID = ?';

  connection.query(query, [bookId], (error, results) => {
    if (error) {
      console.error('Error deleting book:', error);
      return res.status(500).json({ message: 'Error deleting the book' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ message: 'Book not found' });
    }

    res.json({ message: 'Book deleted successfully' });
  });
});










app.get('/events', (req, res) => {
  connection.query('SELECT * FROM Event ORDER BY eventDate DESC', (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching events' });
    }
    res.json(results);
  });
});

// Get event by ID
app.get('/events/:id', (req, res) => {
  const { id } = req.params;
  connection.query('SELECT * FROM events WHERE id = ?', [id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching event' });
    }
    res.json(result[0]);
  });
});

// Create new event
app.post('/events', (req, res) => {
  const { name, date, location, description } = req.body;
  const newEvent = { name, date, location, description };

  // Corrected SQL query
  connection.query(
    'INSERT INTO event (eventName, eventDate, location, description, staffID) VALUES (?, ?, ?, ?, ?)', 
    [name, date, location, description, 1], // Assuming staffID is 1 for simplicity
    (err, result) => {
      if (err) {
        console.error('Error creating event:', err); // More detailed error logging
        return res.status(500).json({ message: 'Error creating event' });
      }
      res.status(201).json({ message: 'Event created successfully', id: result.insertId });
    }
  );
});


// Update event
app.put('/events/:id', (req, res) => {
  const { id } = req.params;
  const { name, date, location, description } = req.body;
  const updatedEvent = { name, date, location, description };
  connection.query('UPDATE events SET ? WHERE id = ?', [updatedEvent, id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error updating event' });
    }
    res.json({ message: 'Event updated successfully' });
  });
});

// Delete event
app.delete('/events/:id', (req, res) => {
  const { id } = req.params;
  connection.query('DELETE FROM event WHERE eventID = ?', [id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error deleting event' });
    }
    res.json({ message: 'Event deleted successfully' });
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

