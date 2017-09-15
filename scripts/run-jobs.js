const Jobbit = require('jobbit')
const _ = require('lodash')
const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const fs = require('../lib/fs')
const getProcessingPriorities = require('../lib/getProcessingPriorities')
const Promise = require('bluebird')
const getRandomWeightedChoice = require('random-weighted-choice')
const getApiAvailability = require('../lib/getApiAvailability')

let update_processing_priorities_started_at = null
let add_reddit_posts_started_at = null
let delete_ignored_urls_started_at = null
let heatify_articles_started_at = null
let add_article_snapshots_started_at = null
let add_twitter_statuses_started_at = null

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
    return mysqlQuery('INSERT INTO jobs(name) VALUES(?)', [script_name]).then((results) => {
      const job_id = results.insertId
      console.log('==== start ====')
      console.log(script_name)
      console.log(job_id)
      const command = getCommand(script_name)
      const jobbit = new Jobbit(command)

      return jobbit.promise.then((completion) => {
        console.log('===== end =====')
        console.log(script_name)
        console.log(job_id)
        console.log(completion.time)
        console.log(completion.error ? completion.error : 'no error')
        return mysqlQuery('UPDATE jobs SET time = ?, stdout = ?, is_failed = ?, error = ? WHERE id = ?', [
          completion.time,
          completion.stdout || null,
          (completion.error || completion.stderr) ? true : false,
          completion.stderr || completion.error || null,
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

    if (update_processing_priorities_started_at === null || Date.now() - update_processing_priorities_started_at > 600000) {
      update_processing_priorities_started_at = Date.now()
      return 'update-processing-priorities'
    }

    if (add_reddit_posts_started_at === null || Date.now() - add_reddit_posts_started_at > 60000) {
      add_reddit_posts_started_at = Date.now()
      return 'add-reddit-posts'
    }

    if (delete_ignored_urls_started_at === null || Date.now() - delete_ignored_urls_started_at > 60000) {
      delete_ignored_urls_started_at = Date.now()
      return 'delete-ignored-urls'
    }

    if (heatify_articles_started_at === null || Date.now() - heatify_articles_started_at > 60000) {
      heatify_articles_started_at = Date.now()
      return 'heatify-articles'
    }

    if (add_article_snapshots_started_at === null || Date.now() - add_article_snapshots_started_at > 3600000) {
      add_article_snapshots_started_at = Date.now()
      return 'add-article-snapshots'
    }

    return getProcessingPriorities().then((priorities) => {
      const weightedChoices = _.map(priorities, (weight, id) => {
        return { weight, id}
      })
      const script_name = getRandomWeightedChoice(weightedChoices)

      if (script_name === 'add-twitter-statuses') {
        if (add_twitter_statuses_started_at !== null & Date.now() - add_twitter_statuses_started_at < 10000) {
          return getNextScriptName()
        }
        add_twitter_statuses_started_at = Date.now()
      }

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
