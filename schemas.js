const Joi = require("joi");

module.exports.listingSchema = Joi.object({
  listing: Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),

    category: Joi.array()
      .items(
        Joi.string().valid(
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
        )
      )
      .min(1)
      .required(),

    price: Joi.number().min(0).required(),
    location: Joi.string().required(),
    country: Joi.string().required(),

    image: Joi.alternatives()
      .try(
        Joi.string().allow(""),
        Joi.object({
          filename: Joi.string().allow(""),
          url: Joi.string().allow("")
        })
      )
      .optional()
      .allow(null)

  }).required()
});

module.exports.reviewSchema = Joi.object({
  review: Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().required()
  }).required()
});
