const fs = require('./fs')
const api_reset_times = require('./api_reset_times')
const getApiLimitedAts = require('./getApiLimitedAts')

module.exports = function getApiAvailability(api) {
  return getApiLimitedAts().then((api_limited_ats) => {
    if (api_limited_ats[api] === undefined) {
      return true
    }
    if (new Date() - new Date(api_limited_ats[api]) > api_reset_times[api]) {
      return true
    }
    return false
  })
}
