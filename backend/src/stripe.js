// const stripe = require('stripe')
// const config = stripe(process.env.STRIPE_SECRET)
// module.export config
// all above can be done in one single line (below)
module.exports = require('stripe')(process.env.STRIPE_SECRET);
