const Jobbit = require('jobbit')
const _ = require('lodash')
const mysqlQuery = require('../lib/mysqlQuery')
const mysqlDisconnect = require('../lib/mysqlDisconnect')
const fs = require('../lib/fs')
const getProcessingPriorities = require('../lib/getProcessingPriorities')
const Promise = require('bluebird')
const getRandomWeightedChoice = require('random-weighted-choice')
const getApiAvailability = require('../lib/getApiAvailability')
const scripts_config = require('../lib/scripts_config')
const delay = require('delay')

let is_getting_next_jobbit = false

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
  if (is_getting_next_jobbit) {
    return Promise.resolve().then(delay(100))
  }
  is_getting_next_jobbit = true
  return getNextScriptName().then((script_name) => {
    scripts_config[script_name].started_at = Date.now()
    return mysqlQuery('INSERT INTO jobs(name) VALUES(?)', [script_name]).then((results) => {
      const job_id = results.insertId
      console.log('==== start ====')
      console.log(script_name)
      console.log(job_id)
      const command = getCommand(script_name)
      const jobbit = new Jobbit(command)
      is_getting_next_jobbit = false

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

let is_getting_next_script_name = false

function getNextScriptName() {
  return Promise.resolve().then(() => {

    let script_name

    _.forEach(scripts_config, (config, _script_name) => {
      if (!config.target_ms) { return }
      if (config.started_at && (Date.now() - config.started_at < config.target_ms)) {
        return
      }
      script_name = _script_name
      return false
    })

    if (script_name) {
      return script_name
    }

    return getProcessingPriorities().then((priorities) => {
      const weightedChoices = _.map(priorities, (weight, id) => {
        return { weight, id}
      })
      return getRandomWeightedChoice(weightedChoices)
    })
  }).then((script_name) => {
    const config = scripts_config[script_name]
    if (config && config.api) {
      return getApiAvailability(config.api).then((is_available) => {
        return is_available ? script_name : getNextScriptName()
      })
    }
    return script_name
  }).then((script_name) => {
    const config = scripts_config[script_name] = scripts_config[script_name] || {}
    if (config && config.wait_ms && Date.now() - config.started_at < config.wait_ms) {
      return getNextScriptName()
    }
    return script_name
  }).then((script_name) => {
    if (script_name === null) {
      return delay(1000).then(getNextScriptName)
    }
    return script_name
  })
}
