const Jobbit = require('jobbit')
const _ = require('lodash')
const connection = require('../lib/connection')
const fs = require('fs')

const twitter_search_rate_limited_at_file = `${__dirname}/../workspace/twitter-search-rate-limited-at`

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

  const time_since_twitter_search_rate_limited_at = getTimeSinceTwitterSearchRateLimitedAt()
  if (time_since_twitter_search_rate_limited_at !== null && time_since_twitter_search_rate_limited_at < 60000) {
    return 'scrape-url'
  }

  // if (Math.random() > .3) {
  //   return 'add-twitter-statuses'
  // }

  return 'scrape-url'

}

function getTimeSinceTwitterSearchRateLimitedAt () {
  if (!fs.existsSync(twitter_search_rate_limited_at_file)) {
    return null
  }
  const twitter_search_rate_limited_at = fs.readFileSync(twitter_search_rate_limited_at_file, 'utf8')
  return new Date() - new Date(twitter_search_rate_limited_at)
}
