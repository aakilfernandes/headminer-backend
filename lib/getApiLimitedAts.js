const api_limited_ats_path = require('./api_limited_ats_path')
const fs = require('./fs')

module.exports = function getApiLimitedAts () {
  return fs.readFileAsync(api_limited_ats_path).then((api_limited_ats_json) => {
    return JSON.parse(api_limited_ats_json)
  }, () => {
    return {}
  })
}
