const Promise = require('bluebird')

function Job(name, runner) {
  this.name = name
  this.runner = runner
}

Job.prototype.run = function run() {
  return new Promise((resolve, reject) => {
    return this.runner().then(resolve, reject)
  })
}

module.exports = Job
