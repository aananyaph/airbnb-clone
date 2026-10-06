const express=require("express");
const app=express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path=require("path");
app.use(express.urlencoded({ extended: true }));
const ejsMate= require("ejs-mate");
const wrapAsync=require("./utils/wrapAsync.js");
const ExpressError=require("./utils/ExpressError.js");
const { listingSchema, reviewSchema } = require("./schemas.js");
const Review = require("./models/review.js");



const methodOverride=require("method-override");
app.use(methodOverride("_method"));

const MONGO_URL="mongodb://127.0.0.1:27017/wanderlust";

main()
.then(() => {
    console.log("connected to db");
})
.catch((err) => {
    console.log(err);
});

async function main() {
    await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
}

app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine('ejs',ejsMate);
app.use(express.static(path.join(__dirname, "/public")));


app.get("/",(req,res) => {
    res.send("hi,i am root");
});

const validateListing=(req,res,next) => {
    let {error}=listingSchema.validate(req.body);
    if(error){
        let errMsg=error.details.map(el => el.message).join(",");
        throw new ExpressError(400,errMsg);
    }
    else{   next(); }
};

const validateReview=(req,res,next) => {
    let {error}=reviewSchema.validate(req.body);
    if(error){
        let errMsg=error.details.map(el => el.message).join(",");
        throw new ExpressError(400,errMsg);
    }
    else{   next(); }
}




//index route
app.get("/listings", wrapAsync(async (req, res) => {

    const AllListings=await Listing.find({});
    res.render("listings/index.ejs",{AllListings});
    }));

    //new route
app.get("/listings/new", (req,res) =>{
    res.render("listings/new.ejs");
});
//show route
app.get("/listings/:id", wrapAsync(async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id).populate("reviews");
    res.render("listings/show", { listing });
}));


//create route
app.post("/listings",validateListing,wrapAsync (async (req,res,next) => {
let result=listingSchema.validate(req.body);
console.log(result);
if(result.error){
    new ExpressError(400,result.error);
}
const newListing=new Listing(req.body.listing);
   
await newListing.save();
res.redirect("/listings");
 
}));

//edit route
app.get("/listings/:id/edit", wrapAsync(async(req,res) => {
  let {id} =req.params;
    const listing= await Listing.findById(id);
       res.render("listings/edit.ejs",{listing});
}));

//update route
app.put("/listings/:id",validateListing, wrapAsync(async (req,res) => {
       let {id} =req.params;
     await Listing.findByIdAndUpdate(id, {...req.body.listing});
     res.redirect("/listings");
}));

//delete route
app.delete("/listings/:id", wrapAsync(async(req,res) => {
    let {id} = req.params;
    let deletedListing=await Listing.findByIdAndDelete(id);
    console.log(deletedListing);
    res.redirect("/listings");
}));
//reviews
//post route for reviews
app.post("/listings/:id/reviews",validateReview, wrapAsync(async (req, res) => {
    let listing = await Listing.findById(req.params.id);
    let newReview = new Review(req.body.review);
    listing.reviews.push(newReview);
    await newReview.save();
    await listing.save();
    res.redirect(`/listings/${listing._id}`);
  
}));


//delete review route
app.delete("/listings/:id/reviews/:reviewId", wrapAsync(async (req, res) => {
    let { id, reviewId } = req.params;
    await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/listings/${id}`);
})); 

    


app.use((req, res, next) => {
    next(new ExpressError("Page Not Found", 404));
});


app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong" } = err;
    res.status(statusCode).render("error.ejs", { statusCode, message, err });
});



app.listen(8080, () => {
    console.log("server is istening");
    });