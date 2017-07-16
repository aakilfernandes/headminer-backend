const connection = require('./connection')
const Promise = require('bluebird')
const Emitter = require('event-emitter')
const fs = require('fs')

function JobQueue() {
  this.running = []
  this.jobs = []
  this.emitter = new Emitter()
}

JobQueue.prototype.addJob = function addJob(job){
  this.jobs.push(job)
  this.emitter.emit('job', job)
}

JobQueue.prototype.runJob = function runJob(job) {
  let is_failed = true
  let job_id
  return connection.query('INSERT INTO jobs(name) VALUES(?)', [job.name]).then((results) => {
    job_id = results.insertId
    return job.run().then(() => {
      is_failed = false
    }, (err) => {
      console.log('err', `${__dirname}/../workspace/jobErrors/${job_id}`)
      fs.writeFileSync(`${__dirname}/../workspace/jobErrors/${job_id}`, err)
    })
  }).finally(() => {
    return connection.query('UPDATE jobs SET finished_at = NOW(), is_failed = ? WHERE id = ?', [
      is_failed, job_id
    ])
  })
}

JobQueue.prototype.getNextJob = function getNextJob() {
  return new Promise((resolve, reject) => {
    if (this.jobs.length > 0) {
      resolve(this.jobs.shift())
    } else {
      this.emitter.once('job', () => {
        resolve(this.jobs.shift())
      })
    }
  })
}

JobQueue.prototype.runJobs = function runJobs() {
  return this.getNextJob().then((job) => {
    return this.runJob(job)
  }).then(() => {
    return this.runJobs()
  })
}

module.exports = JobQueue
