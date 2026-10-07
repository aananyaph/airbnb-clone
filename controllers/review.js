const Listing = require("../models/listing");
const Review = require("../models/review");

module.exports.createReview = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  // Owner cannot review own listing
  if (listing.owner && listing.owner.equals(req.user._id)) {
    req.flash("error", "You cannot review your own listing");
    return res.redirect(`/listings/${listing._id}`);
  }

  // One review per user per listing
  const already = await Review.findOne({
    _id: { $in: listing.reviews },
    author: req.user._id
  });
  if (already) {
    req.flash("error", "You already reviewed this listing");
    return res.redirect(`/listings/${listing._id}`);
  }

  const newReview = new Review(req.body.review);

  // ✅ THIS IS THE KEY FIX
  newReview.author = req.user._id;

  listing.reviews.push(newReview);

  await newReview.save();
  await listing.save();

  req.flash("success", "New review created");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;

  await Listing.findByIdAndUpdate(id, {
    $pull: { reviews: reviewId }
  });

  await Review.findByIdAndDelete(reviewId);

  req.flash("success", "Successfully deleted a review");
  res.redirect(`/listings/${id}`);
};
