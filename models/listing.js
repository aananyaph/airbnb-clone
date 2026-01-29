const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

/* ✅ 1. DEFINE CATEGORIES OUTSIDE THE SCHEMA */
const categories = [
  "Trending",
  "Rooms",
  "Farms",
  "Iconic Cities",
  "Pools",
  "Beach",
  "Pet-friendly",
  "Arctic",
  "Sunrise",
  "Horse Riding"
];

const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },

  description: String,

  image: {
    filename: {
      type: String
    },
    url: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1625505826533-5c80aca7d157?auto=format&fit=crop&w=800&q=60",
      set: (v) =>
        v === ""
          ? "https://images.unsplash.com/photo-1625505826533-5c80aca7d157?auto=format&fit=crop&w=800&q=60"
          : v,
    },
  },

  price: Number,
  location: String,
  country: String,

  category: {
    type: [String],           // ✅ ARRAY
    enum: categories,         // ✅ VALID CATEGORIES
    required: true,
    default: ["Rooms"]
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],

  owner: {
    type: Schema.Types.ObjectId,
    ref: "User"
  }
});

// ✅ Middleware to delete associated reviews
listingSchema.post("findOneAndDelete", async function (listing) {
  if (listing) {
    await Review.deleteMany({
      _id: { $in: listing.reviews },
    });
  }
});

module.exports = mongoose.model("Listing", listingSchema);
