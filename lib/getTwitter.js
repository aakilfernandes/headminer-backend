const Twitter = require('twitter')
const getSecret = require('./getSecret')
const Promise = require('bluebird')

module.exports = function getTwitter(){
  return getSecret('twitter_consumer').then((consumer_secret) => {
    return getSecret('twitter_access').then((access_token_secret) => {
      return new Twitter({
        consumer_key: '3H5Y38lqnV37WOEcyfMQayqC6',
        consumer_secret: consumer_secret,
        access_token_key: '881893613994745858-uLHmYR2cIDWiT68accNNHexstFdAGQX',
        access_token_secret: access_token_secret
      })
    })
  })
}
