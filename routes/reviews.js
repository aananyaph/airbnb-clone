const express = require('express');
const router = express.Router({ mergeParams: true });
const Listing = require('../models/listing.js'); 
const Review = require('../models/review.js');
const wrapAsync=require("../utils/wrapAsync.js");
const ExpressError=require("../utils/ExpressError.js");
const { reviewSchema } = require("../schemas.js");
const {validateReview, isLoggedIn, isOwner, isReviewAuthor} = require("../middleware.js");

const reviewController = require("../controllers/review.js");
//post route for reviews (mounted at /listings/:id/reviews)
router.post("/", isLoggedIn,validateReview, wrapAsync(reviewController.createReview));


//delete review route
router.delete("/:reviewId",isLoggedIn,isOwner, wrapAsync(reviewController.deleteReview)); 

module.exports = router;