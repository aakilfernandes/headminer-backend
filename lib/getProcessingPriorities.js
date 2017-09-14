const processing_priorities_path = require('./processing_priorities_path')
const fs = require('./fs')
const Promise = require('bluebird')

let processing_priorities
let got_processing_priorities_at = null

module.exports = function getProcessingPriorities() {

  if (new Date() - got_processing_priorities_at < 60000) {
    return Promise.resolve(processing_priorities)
  }

  return fs.readFileAsync(processing_priorities_path).then((processing_priorities_json) => {
    got_processing_priorities_at = new Date()
    processing_priorities = JSON.parse(processing_priorities_json)
    return processing_priorities
  }, () => {
    throw new Error('Processing priorities not set')
  })
}
