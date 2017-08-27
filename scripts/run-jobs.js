const Jobbit = require('jobbit')
const _ = require('lodash')
const connection = require('../lib/connection')
const fs = require('fs')
const getTimeSinceTwitterSearchLimitedAt = require('../lib/getTimeSinceTwitterSearchLimitedAt')
const getTimeSinceTwitterFriendIdsLimitedAt = require('../lib/getTimeSinceTwitterFriendIdsLimitedAt')

let add_reddit_posts_started_at = null
let add_twitter_influencers_started_at = null
let twitter_influencify_url_started_at = null
let heatify_articles_started_at = null

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

  const script_name = getNextScriptName()
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
  }).catch((error) => {
    console.error(error)
  })
}

function getNextScriptName() {
  if (add_reddit_posts_started_at === null || Date.now() - add_reddit_posts_started_at > 30000) {
    add_reddit_posts_started_at = Date.now()
    return 'add-reddit-posts'
  }

  if (add_twitter_influencers_started_at === null || Date.now() - add_twitter_influencers_started_at > 600000) {
    add_twitter_influencers_started_at = Date.now()
    return 'add-twitter-influencers'
  }

  if (twitter_influencify_url_started_at === null || Date.now() - twitter_influencify_url_started_at > 300000) {
    twitter_influencify_url_started_at = Date.now()
    return 'twitter-influencify-url'
  }

  if (heatify_articles_started_at === null || Date.now() - heatify_articles_started_at > 60000) {
    heatify_articles_started_at = Date.now()
    return 'heatify-articles'
  }

  const random = Math.random()

  if (random < .1) {
    return 'coallesce-article'
  }

  if (random < .2) {
    return 'add-reddit-post-snapshot'
  }

  if (random < .6) {
    const time_since_limited_at = getTimeSinceTwitterSearchLimitedAt()
    if (time_since_limited_at === null || time_since_limited_at > 900000) {
      return 'add-twitter-statuses'
    }
  }

  if (random < .8) {
    const time_since_limited_at = getTimeSinceTwitterFriendIdsLimitedAt()
    if (time_since_limited_at === null || time_since_limited_at > 900000) {
      return 'add-twitter-friends'
    }
  }


  return 'scrape-url'

}
