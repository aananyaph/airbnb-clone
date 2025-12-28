const express = require('express');
const router = express.Router({ mergeParams: true });
const Listing = require('../models/listing');
const Review = require('../models/review'); // import model

router.post('/', async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    const review = new Review(req.body.review); // use model, not "reviewSchema"
    await review.save();
    listing.reviews.push(review);
    await listing.save();
    res.redirect(`/listings/${listing._id}`);
  } catch (err) {
    next(err);
  }
});

router.delete('/:reviewId', async (req, res, next) => {
  try {
    await Listing.findByIdAndUpdate(req.params.id, { $pull: { reviews: req.params.reviewId } });
    await Review.findByIdAndDelete(req.params.reviewId); // use model
    res.redirect(`/listings/${req.params.id}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;