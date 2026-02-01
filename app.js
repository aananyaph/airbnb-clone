if(process.env.NODE_ENV != "production"){
    require("dotenv").config();
}
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const ejsMate = require("ejs-mate");
const methodOverride = require("method-override");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
// Use MongoStore as a class (construct a new instance) to avoid .create() mismatch on this package export
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/reviews.js");
const userRouter = require("./routes/user.js");

// Database connection
const dbUrl = process.env.ATLASDB_URL || "mongodb://localhost:27017/airbnb";

async function main() {
    try {
        await mongoose.connect(dbUrl);
        console.log("✅ Connected to MongoDB!");
        
        // Check if we have any users
        const userCount = await User.countDocuments();
        console.log(`✅ Total users in database: ${userCount}`);

        // Fix: drop legacy username unique index if it exists (causes E11000 with null username)
        try {
            const db = mongoose.connection.db;
            const indexes = await db.collection('users').indexes();
            const hasUsernameIndex = indexes.some(idx => idx.name === 'username_1' || (idx.key && idx.key.username === 1));
            if (hasUsernameIndex) {
                console.log("⚠️ Dropping legacy 'username_1' unique index to allow email-based login");
                await db.collection('users').dropIndex('username_1');
                console.log("✅ Dropped 'username_1' index.");
            }
        } catch (e) {
            console.log("No legacy username index found or drop failed:", e.message);
        }
    } catch (err) {
        console.log("❌ MongoDB connection error:", err.message);
        console.log("Running in limited mode...");
    }
}

main().catch(err => console.log(err));

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

// Session store
const store = new MongoStore({
    mongoUrl: dbUrl,
    crypto: {
        secret: process.env.SECRET || "defaultsecret"
    },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
});

// Session configuration
const sessionOptions = {
    store,
    secret: process.env.SECRET || "defaultsecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 1 week
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true
    }
};

app.use(session(sessionOptions));
app.use(flash());

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// IMPORTANT: Configure passport to use email as username
passport.use(new LocalStrategy({
    usernameField: 'email'  // Tell passport to use email field
}, User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware to make user available in all templates
app.use((req, res, next) => {
    console.log("Current user:", req.user ? req.user.email : "No user");
    res.locals.currUser = req.user;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

// Routes
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

// Home route
app.get("/", (req, res) => {
    res.redirect("/listings");
});

// Error handlers
app.use((req, res, next) => {
    next(new ExpressError("Page Not Found", 404));
});

app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("error.ejs", { statusCode, message, err });
});

// Start server
app.listen(8080, () => {
    console.log("✅ Server listening on port 8080");
    console.log("✅ Open: http://localhost:8080");
    console.log("✅ Authentication is now ENABLED");
});