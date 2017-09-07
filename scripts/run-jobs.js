const Jobbit = require('jobbit')
const _ = require('lodash')
const connection = require('../lib/connection')
const fs = require('../lib/fs')
const getProcessingPriorities = require('../lib/getProcessingPriorities')
const Promise = require('bluebird')
const getRandomWeightedChoice = require('random-weighted-choice')
const getApiAvailability = require('../lib/getApiAvailability')

let add_reddit_posts_started_at = null

_.range(4).map(() => {
  return runJobbitThread()
})

function getCommand(script) {
  return `node ${__dirname}/../scripts/${script}.js`
}

function runJobbitThread() {
  return getNextJobbit().finally(runJobbitThread)
}

function getNextJobbit() {
  return getNextScriptName().then((script_name) => {
    console.log(script_name)
    return connection.query('INSERT INTO jobs(created_at, name) VALUES(?, ?)', [
      new Date(), script_name
    ]).then((results) => {
      const job_id = results.insertId
      const command = getCommand(script_name)
      const jobbit = new Jobbit(command)

      return jobbit.promise.then((completion) => {
        return connection.query('UPDATE jobs SET finished_at = ?, stdout = ?, is_failed = ?, error = ? WHERE id = ?', [
          new Date(),
          completion.stdout || null,
          (completion.error || completion.stderr) ? true : false,
          completion.stderr || completion.error || null,
          job_id
        ])
      }, (error) => {
        return connection.query('UPDATE jobs SET finished_at = ?, stdout = ?, is_failed = ?, error = ? WHERE id = ?', [
          new Date(),
          completion.stdout || null,
          true,
          error,
          job_id
        ])
      })
    })
  }).catch((error) => {
    console.error(error)
  })
}

function getNextScriptName() {
  return Promise.resolve().then(() => {
    if (add_reddit_posts_started_at === null || Date.now() - add_reddit_posts_started_at > 60000) {
      add_reddit_posts_started_at = Date.now()
      return 'add-reddit-posts'
    }
    return getProcessingPriorities().then((priorities) => {
      const weightedChoices = _.map(priorities, (weight, id) => {
        return { weight, id}
      })
      const script_name = getRandomWeightedChoice(weightedChoices)
      return checkApiAvailabilityOrGetNextScriptName(script_name)
    })
  })
}

function checkApiAvailabilityOrGetNextScriptName(script_name) {
  return Promise.resolve().then(() => {
    switch(script_name) {
      case 'add-facebook-snapshots':
        return getApiAvailability('facebook').then((is_available) => {
          return is_available ? script_name : getNextScriptName()
        })
      case 'add-twitter-statuses':
        return getApiAvailability('twitter-search').then((is_available) => {
          return is_available ? script_name : getNextScriptName()
        })
      case 'add-twitter-friends':
        return getApiAvailability('twitter-friend-ids').then((is_available) => {
          return is_available ? script_name : getNextScriptName()
        })
      default:
        return script_name
    }
  })
}
