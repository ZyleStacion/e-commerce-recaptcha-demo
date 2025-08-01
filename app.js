const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const twofactor = require('node-2fa');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create mail-sending agent for MFA tokens
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_APP_USERNAME,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const secretKey = process.env.RECAPTCHA_SECRET_KEY;

app.set('view engine', 'ejs');
app.set('views', 'views');
app.set('port', process.env.PORT || 3000);

app.get('/', (req, res) => {
    res.render('index', { page: { title: 'Home' }, email: 'Guest' });
})

app.get('/login', (req, res) => {
    res.render('login', {
        page: { title: 'Login' },
        error: null
    })
});

app.post('/login', (req, res) => {
    const email = req.body.inputEmail;

    // Create a new secret
    const fullSecret = twofactor.generateSecret({ name: 'E-Commerce App', account: email });

    // Create a new token
    const token = twofactor.generateToken(fullSecret.secret);

    // Configure email message
    const mail = {
        from: process.env.EMAIL_APP_USERNAME,
        to: email,
        subject: 'E-Commerce App Verification Code',
        text: `Your authentication code is: ${token.token}`
    }

    // Create the QR code
    const uri = fullSecret.uri;
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;

    // Send the email
    transporter.sendMail(mail, (err, info) => {
        if (err) {
            console.error('Error sending email:', err);
            return res.render('login', {
                page: { title: 'Login' },
                error: 'Failed to send email.'
            });
        } else {
            console.log('Email sent:', info.response);
            // Render the authentication page
            res.render('auth', {
                email: email,
                secret: fullSecret.secret,
                qrUrl: qrCode,
                page: { title: 'Login' },
                error: null
            });
        }
    })
});

app.get('/register', (req, res) => {
    res.render('register', { page: { title: 'Register' } })
})

app.get('/products', (req, res) => {
    res.render('products', { page: { title: 'Products' } })
})

app.post('/register', (req, res) => {
    const recaptchaToken = req.body['g-recaptcha-response'];
    const email = req.body.email;

    // Verify successful Captcha
    // Ask Google to verify our secret key and recaptcha client-side response
    const response = fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`, {
        method: 'POST',
    })
        // Process the .json response into the server
        .then((response => response.json()))
        .then((google_response) => {
            // Log the score
            console.log(google_response.score);

            // Response is successful
            if (google_response.success) {
                return res.render('index', { page: 'Home', email: email })
            } else {
                return res.send("Invalid Captcha!");
            }
        })
        .catch((error) => {
            return res.json({ error });
        });
})

app.post('/auth', (req, res) => {
    // Get user input token and verify it
    const email = req.body.inputEmail;
    const secret = req.body.secret;
    const userToken = req.body.userToken;
    const qrCode = req.body.qrCode;

    // Verify token
    const verificationResult = twofactor.verifyToken(secret, userToken);
    
    if (verificationResult && verificationResult.delta == 0) {
        // Token is correct
        res.render('index', { page: { title: 'Home' }, email: email });
    } else {
        res.render('auth', {
            email: email,
            secret: secret,
            page: { title: 'Authentication' },
            error: 'Invalid MFA token.',
            qrUrl: qrCode
        });
    }
});

const port = 3000;

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})

