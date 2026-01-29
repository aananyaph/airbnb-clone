const Listing = require("../models/listing");

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

  res.render("listings/show.ejs", { listing });
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

  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = {
    url: req.file.path,
    filename: req.file.filename
  };

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

  let originalImageUrl = listing.image.url.replace(
    "/uploads",
    "/uploads/w_250"
  );

  res.render("listings/edit.ejs", { listing, originalImageUrl });
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

  let listing = await Listing.findByIdAndUpdate(
    id,
    { ...req.body.listing },
    { new: true }
  );

  if (req.file) {
    listing.image = {
      url: req.file.path,
      filename: req.file.filename
    };
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
