const express=require("express");
const router=express.Router();
// Use parent-level relative paths from routes/
const wrapAsync=require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });


router
.route("/")
.get(wrapAsync(listingController.index))
// Change this line:
.post(
  isLoggedIn,
  upload.single("listing[image]"), 
  validateListing,
  wrapAsync(listingController.createListing)  // ← Use the controller!
);

// NEW
router.post("/:id/bookings", isLoggedIn, wrapAsync(async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut, guests } = req.body;
  const listing = await Listing.findById(id);
  
  if (!listing) {
    return res.json({ success: false, message: "Listing not found!" });
  }
  
  // Check if user is the owner - they cannot book their own listing
  if (listing.owner.equals(req.user._id)) {
    return res.json({ success: false, message: "You cannot book your own listing!" });
  }
  
  // Validate dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  if (checkOutDate <= checkInDate) {
    return res.json({ success: false, message: "Check-out date must be after check-in date!" });
  }
  
  // Check if dates are in the past
  const today = new Date();
  if (checkInDate < today) {
    return res.json({ success: false, message: "Cannot book for past dates!" });
  }
  
  // Calculate nights
  const nights = (checkOutDate - checkInDate) / (1000 * 60 * 60 * 24);
  
  // Check for overlapping confirmed bookings (ignore pending ones)
  const overlappingBookings = await Booking.find({
    listing: id,
    status: "confirmed",
    $or: [
      { checkIn: { $lt: checkOutDate }, checkOut: { $gt: checkInDate } }
    ]
  });
  
  if (overlappingBookings.length > 0) {
    return res.json({ success: false, message: "These dates are already booked for this listing!" });
  }
  
  // Calculate prices
  const basePrice = listing.price * nights;
  const gstRate = 0.18;
  const gst = Math.round(basePrice * gstRate);
  const totalPrice = basePrice + gst;
  
  // Create the booking as "pending"
  const booking = new Booking({
    listing: id,
    user: req.user._id,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    guests: guests || 1,
    nights: nights,
    basePrice: basePrice,
    gst: gst,
    totalPrice: totalPrice,
    status: "pending",
    paymentStatus: "unpaid"
  });
  
  await booking.save();
  
  // Return booking details as JSON for Razorpay integration
  const receipt = `booking_${booking._id}`;
  res.json({
    success: true,
    bookingId: booking._id,
    amount: totalPrice * 100,
    currency: 'INR',
    booking: {
      id: booking._id,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalPrice: booking.totalPrice
    }
  });
}));

  

// NEW
router.get("/new", isLoggedIn, listingController.renderNewForm);

router.route("/:id")
.get( wrapAsync(listingController.showListing))
.put( isLoggedIn,
   isOwner, 
   upload.single("listing[image]"),
   validateListing, 
   wrapAsync(listingController.updateListing))
.delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing))


// EDIT
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.renderEditForm));

module.exports = router;




// //index route (mounted at /listings)
// router.get("/", wrapAsync(listingController.index));

//     //new route
// router.get("/new", isLoggedIn, listingController.renderNewForm);
// //show route
// router.get("/:id", wrapAsync(listingController.showListing));


// //create route
// router.post("/",isLoggedIn,validateListing,wrapAsync (listingController.createListing));

// //edit route
// router.get("/:id/edit",isLoggedIn,isOwner, wrapAsync(listingController.renderEditForm));

// //update route
// router.put("/:id", isLoggedIn, isOwner, validateListing, wrapAsync(listingController.updateListing));

// //delete route
// router.delete("/:id",isLoggedIn,isOwner, wrapAsync(listingController.destroyListing));


// module.exports=router;