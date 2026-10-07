if(process.env.NODE_ENV != "production"){
    require("dotenv").config();
}
const express=require("express");
const app=express();
const mongoose = require("mongoose");
const path=require("path");
const ejsMate= require("ejs-mate");
const methodOverride=require("method-override");
const ExpressError=require("./utils/ExpressError.js");
const session=require("express-session");
const MongoStore = require("connect-mongo").default;
const flash=require("connect-flash");
const passport=require("passport");
const LocalStrategy=require("passport-local").Strategy;
const User=require("./models/user.js");

const listingRouter=require("./routes/listing.js");
const reviewRouter=require("./routes/reviews.js");
const userRouter=require("./routes/user.js");
const bookingRouter=require("./routes/bookings.js");

const dbUrl = process.env.ATLASDB_URL;

async function connectDB() {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    if (!dbUrl) {
        throw new Error("ATLASDB_URL environment variable is missing!");
    }
    await mongoose.connect(dbUrl);
    console.log("connected to db");
}

connectDB().catch((err) => {
    console.error("MongoDB Connection Error:", err.message);
});

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine('ejs',ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const store = MongoStore.create({
    mongoUrl: dbUrl || "mongodb://127.0.0.1:27017/wanderlust",
    crypto: {
        secret: process.env.SECRET || "mysupersecretkey",
    },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("ERROR in MONGO SESSION STORE", err);
});


const sessionOptions = {
    store,
    secret: process.env.SECRET || "mysupersecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true
     }
}

// app.get("/",(req,res) => {
//     res.send("hi,i am root");
// });



 app.use(session(sessionOptions));
 app.use(flash());

 app.use(passport.initialize());
 app.use(passport.session());
 passport.use(new LocalStrategy(User.authenticate()));
 console.log('passport strategies:', Object.keys(passport._strategies || {}));

 passport.serializeUser(User.serializeUser());
 passport.deserializeUser(User.deserializeUser());

  // res.locals FIRST: if the DB is down, the error page still needs
  // currUser/success/error defined, otherwise error.ejs itself crashes
  // (EJS throws on undeclared variables) and the function dies with 500.
  app.use((req,res,next) => {
     res.locals.success=req.flash("success");
     res.locals.error=req.flash("error");
     res.locals.currUser=req.user;
     next();
  });

  app.use(async (req, res, next) => {
     try {
         await connectDB();
         next();
     } catch (err) {
         next(err);
     }
  });

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);
app.use("/bookings", bookingRouter);
    
app.use((req, res, next) => {
    next(new ExpressError("Page Not Found", 404));
});

app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("error.ejs", { statusCode, message, err });
});

if (require.main === module) {
    app.listen(8080, () => {
        console.log("server is listening on port 8080");
    });
}