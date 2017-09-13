const fs = require('./fs')
const getApiLimitedAts = require('./getApiLimitedAts')
const api_limited_ats_path = require('./api_limited_ats_path')

module.exports = function updateApiLimitedAt(api) {
  return getApiLimitedAts().then((api_limited_ats) => {
    api_limited_ats[api] = new Date()
    return fs.writeFileAsync(api_limited_ats_path, JSON.stringify(api_limited_ats))
  })
}
