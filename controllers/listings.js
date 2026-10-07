const Listing = require("../models/listing");
const Booking = require("../models/booking");

/* ======================
   INDEX (with category filter + owner)
   ====================== */
module.exports.index = async (req, res) => {
  const { category } = req.query;
  let listings;

  if (category) {
    listings = await Listing.find({
      category: { $in: [category] }
    }).populate("owner");
  } else {
    listings = await Listing.find({}).populate("owner");
  }

  res.render("listings/index.ejs", { listings, category });
};

/* ======================
   NEW
   ====================== */
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

/* ======================
   SHOW (populate owner + reviews)
   ====================== */
module.exports.showListing = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id)
    .populate("owner")   // 👈 HERE
    .populate({
      path: "reviews",
      populate: { path: "author" }
    });

  if (!listing) {
    req.flash("error", "Cannot find that listing");
    return res.redirect("/listings");
  }

  // Confirmed bookings block these dates. Pending bookings block them
  // for 15 minutes only (older pendings free the dates again).
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const blockingBookings = await Booking.find({
    listing: id,
    $or: [
      { status: "confirmed" },
      { status: "pending", createdAt: { $gt: fifteenMinAgo } }
    ]
  }).select("checkIn checkOut");
  const bookedDates = blockingBookings.map((b) => ({
    from: b.checkIn.toISOString().split("T")[0],
    to: b.checkOut.toISOString().split("T")[0]
  }));

  // Real rating average for the header strip (or null when no reviews yet)
  let avgRating = null;
  const reviewCount = listing.reviews ? listing.reviews.length : 0;
  if (reviewCount) {
    const sum = listing.reviews.reduce((s, r) => s + (r.rating || 0), 0);
    avgRating = (sum / reviewCount).toFixed(2);
  }

  // Photo gallery (old listings may only have the single `image`)
  const photos = listing.images && listing.images.length
    ? listing.images
    : (listing.image && listing.image.url ? [listing.image] : []);

  res.render("listings/show.ejs", { listing, bookedDates, photos, avgRating, reviewCount });
};


/* ======================
   CREATE
   ====================== */
module.exports.createListing = async (req, res) => {

  if (!req.body.listing.category) {
    req.body.listing.category = ["Rooms"];
  } else if (!Array.isArray(req.body.listing.category)) {
    req.body.listing.category = [req.body.listing.category];
  }

  // Empty number inputs come as "" — drop them so Mongoose Number cast stays happy
  for (const key of ["maxGuests", "bedrooms", "beds", "bathrooms"]) {
    if (req.body.listing[key] === "" || req.body.listing[key] == null) {
      delete req.body.listing[key];
    }
  }

  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;

  // Multiple photos (first photo is also kept in `image` for old code)
  const photos = (req.files || []).map((f) => ({ url: f.path, filename: f.filename }));
  if (photos.length) {
    newListing.image = photos[0];
    newListing.images = photos;
  }

  await newListing.save();
  req.flash("success", "Successfully created a new listing!");
  res.redirect("/listings");
};

/* ======================
   EDIT FORM
   ====================== */
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;

  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Cannot find that listing");
    return res.redirect("/listings");
  }

  // All current photos (old listings may only have the single `image`)
  const photos = listing.images && listing.images.length
    ? listing.images
    : (listing.image && listing.image.url ? [listing.image] : []);

  let originalImageUrl = photos.length ? photos[0].url.replace(
    "/uploads",
    "/uploads/w_250"
  ) : "";

  res.render("listings/edit.ejs", { listing, photos, originalImageUrl });
};

/* ======================
   UPDATE (ONLY ONCE!)
   ====================== */
module.exports.updateListing = async (req, res) => {
  let { id } = req.params;

  if (!req.body.listing.category) {
    req.body.listing.category = ["Rooms"];
  } else if (!Array.isArray(req.body.listing.category)) {
    req.body.listing.category = [req.body.listing.category];
  }

  for (const key of ["maxGuests", "bedrooms", "beds", "bathrooms"]) {
    if (req.body.listing[key] === "" || req.body.listing[key] == null) {
      delete req.body.listing[key];
    }
  }

  let listing = await Listing.findByIdAndUpdate(
    id,
    { ...req.body.listing },
    { new: true }
  );

  // Remove photos the owner ticked for deletion (match by url)
  let removed = req.body.deletedImages || [];
  if (!Array.isArray(removed)) removed = [removed];
  let current = listing.images && listing.images.length
    ? [...listing.images]
    : (listing.image && listing.image.url ? [{ url: listing.image.url, filename: listing.image.filename }] : []);
  if (removed.length) {
    current = current.filter((p) => !removed.includes(p.url));
  }

  // Append newly uploaded photos
  const added = (req.files || []).map((f) => ({ url: f.path, filename: f.filename }));
  current = current.concat(added);

  if (removed.length || added.length) {
    listing.images = current;
    listing.image = current.length ? current[0] : listing.image;
    await listing.save();
  }

  req.flash("success", "Listing Updated!");
  res.redirect("/listings");
};

/* ======================
   DELETE
   ====================== */
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;

  await Listing.findByIdAndDelete(id);
  req.flash("success", "Successfully deleted a listing");
  res.redirect("/listings");
};
