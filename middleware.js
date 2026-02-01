const Listing = require("./models/listing");
const ExpressError = require("./utils/ExpressError");
const { listingSchema, reviewSchema } = require("./schemas.js");
const Review = require("./models/review");

module.exports.isLoggedIn = (req, res, next) => {
    if(!req.isAuthenticated()){
        req.session.redirectTo = req.originalUrl;
        req.flash("error","You must be signed in first!");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectTo) {
        res.locals.redirectTo = req.session.redirectTo;
    }
    next();
};

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }

    if (!res.locals.currUser || !res.locals.currUser._id) {
        req.flash("error", "You must be signed in first!");
        return res.redirect("/login");
    }

    if (!listing.owner || !listing.owner.equals(res.locals.currUser._id)) {
        req.flash("error", "You do not have permission to do that");
        return res.redirect(`/listings/${id}`);
    }

    next();
};

module.exports.validateListing = (req, res, next) => {
  // 🔥 FORCE category to array BEFORE Joi runs
  if (req.body?.listing?.category) {
    if (!Array.isArray(req.body.listing.category)) {
      req.body.listing.category = [req.body.listing.category];
    }
  }

  const { error } = listingSchema.validate(req.body);
  if (error) {
    let errMsg = error.details.map(el => el.message).join(",");
    throw new ExpressError(errMsg, 400);
  }
  next();
};


// module.exports.validateListing = (req, res, next) => {
//     let {error} = listingSchema.validate(req.body);
//     if(error){
//         let errMsg = error.details.map(el => el.message).join(",");
//         throw new ExpressError(errMsg, 400);
//     }  else{
//         next();
//     }
// };

module.exports.validateReview = (req, res, next) => {
        let {error}=reviewSchema.validate(req.body);
        if(error){
            let errMsg=error.details.map(el => el.message).join(",");
            throw new ExpressError(errMsg, 400);
        }
        else{ 
              next();
             }
    };
    
 module.exports.isReviewAuthor = async (req, res, next) => {
    let { id, reviewId } = req.params;
    let review = await Review.findById(reviewId);

    if (!review) {
        req.flash("error", "Review not found");
        return res.redirect(`/listings/${id}`);
    }

    if (!res.locals.currUser || !res.locals.currUser._id) {
        req.flash("error", "You must be signed in first!");
        return res.redirect("/login");
    }

    if (!review.author || !review.author.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not authorized to do that");
        return res.redirect(`/listings/${id}`);
    }

    next();
};
