const processing_priorities_path = require('./processing_priorities_path')
const fs = require('./fs')

module.exports = function getProcessingPriorities() {
  return fs.readFileAsync(processing_priorities_path).then((processing_priorities_json) => {
    return JSON.parse(processing_priorities_json)
  }, () => {
    throw new Error('Processing priorities not set')
  })
}
