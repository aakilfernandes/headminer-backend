const Twitter = require('twitter')
const getSecret = require('./getSecret')

module.exports = new Twitter({
  consumer_key: '3H5Y38lqnV37WOEcyfMQayqC6',
  consumer_secret: getSecret('twitter_consumer'),
  access_token_key: '881893613994745858-uLHmYR2cIDWiT68accNNHexstFdAGQX',
  access_token_secret: getSecret('twitter_access')
})