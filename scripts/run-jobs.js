const Jobbit = require('jobbit')
const _ = require('lodash')
const connection = require('../lib/connection')

console.log('run-jobs')

const script_dir = `node ${__dirname}/../scripts`

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
  return connection.query('INSERT INTO jobs(created_at, name) VALUES(?, ?)', [
    new Date(), script_name
  ]).then((results) => {
    const job_id = results.insertId
    const command = getCommand(script_name)
    const jobbit = new Jobbit(command)

    return jobbit.promise.then((completion) => {
      return connection.query('UPDATE jobs SET finished_at = ?, is_failed = ?, error = ? WHERE id = ?', [
        new Date(),
        (completion.error || completion.stderr) ? true : false,
        completion.stderr || completion.error || null,
        job_id
      ])
    }, (error) => {
      return connection.query('UPDATE jobs SET finished_at = ?, is_failed = ?, error = ? WHERE id = ?', [
        new Date(),
        true,
        error,
        job_id
      ])
    })
  })
}

function getNextScriptName() {
  if (add_reddit_posts_started_at === null || Date.now() - add_reddit_posts_started_at > 10000) {
    add_reddit_posts_started_at = Date.now()
    return 'add-reddit-posts'
  }
  return 'scrape-url'
}
