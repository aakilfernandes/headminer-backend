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
  let error
  return connection.query('INSERT INTO jobs(created_at, name) VALUES(?, ?)', [
    new Date(), job.name
  ]).then((results) => {
    job_id = results.insertId
    return job.run().then(() => {
      is_failed = false
    }, (_error) => {
      error = _error
    })
  }).finally(() => {
    return connection.query('UPDATE jobs SET finished_at = ?, is_failed = ?, error = ? WHERE id = ?', [
      new Date(), is_failed, error ? error.toString() : null , job_id
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
