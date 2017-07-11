const twitter = require('../lib/twitter')
const connection = require('../lib/connection')
const request = require('request-promise')
const waterfall = require('promise-waterfall')
const fs = require('../lib/fs')
const urljs = require('url')
const _ = require('lodash')
const getQs = require('../lib/getQs')
const getQGroups = require('../lib/getQGroups')


const workDirPath = `${__dirname}/../workspace/twitterStatuses/`
const count = 100

let hostnamePojos
let values

connection.query('SELECT * FROM publisher_hostnames').then((_hostnamePojos) => {
  hostnamePojos = _hostnamePojos
}).then(() => {
  return connection.query(
    `START TRANSACTION;
    SELECT id FROM twitter_statuses WHERE parsed_at IS NULL ORDER BY id ASC LIMIT ?;
    UPDATE twitter_statuses SET parsed_at = NOW() WHERE parsed_at IS NULL ORDER BY id ASC LIMIT ?;
    COMMIT;`,
    [count, count]
  )
}).then((results) => {

  const status_ids = _.map(results[1], 'id')

  if (status_ids.length === 0) {
    return []
  }

  const statuses = []

  const fsPromiseWrappers = status_ids.map((status_id) => {
    const filePath = `${__dirname}/../workspace/twitterStatuses/${status_id}.json`
    return function fsPromiseWrapper() {
      return fs.readFileAsync(filePath, 'utf8').then((file) => {
        statuses.push(JSON.parse(file))
      }).then(() => {
        return fs.unlinkAsync(filePath)
      })
    }
  })

  return waterfall(fsPromiseWrappers).then(() => {
    return statuses
  })

}).then((statuses) => {

  const status_delete_values = []
  const user_insert_values = []
  const url_insert_values = []
  const status_url_insert_values = []

  let status_deletes_count = 0
  let user_inserts_count = 0
  let url_inserts_count = 0

  statuses.forEach((status) => {

    const urls = getUrls(status)
    if (urls.length === 0) {
      status_deletes_count ++
      status_delete_values.push(status.id_str)
      return
    }


    urls.forEach((url) => {
      url_inserts_count ++
      url_insert_values.push(url)
      status_url_insert_values.push(status.id_str, url)
    })

    user_insert_values.push(status.user.id_str, status.user.friends_count, status.user.followers_count)
    user_inserts_count ++
  })
  url_insert_values.push(...status_url_insert_values)

  const promiseWrappers = []

  if (status_deletes_count > 0) {
    const status_delete_qs = getQs(status_deletes_count)
    const query = `DELETE FROM twitter_statuses WHERE id IN (${status_delete_qs})`
    promiseWrappers.push(function statusDeleteWrapper() {
      return connection.query(query, status_delete_values)
    })
  }

  if (user_inserts_count > 0) {
    const user_insert_q_groups = getQGroups(user_inserts_count, 3)
    promiseWrappers.push(function userInsertWrapper() {
      return connection.query(
        `INSERT IGNORE INTO twitter_users (id, friends_count, followers_count) VALUES ${user_insert_q_groups}`,
        user_insert_values
      )
    })
  }

  if (url_inserts_count > 0) {
    const url_inserts_q_groups = getQGroups(url_inserts_count, 1)
    const status_url_insert_q_groups = getQGroups(url_inserts_count, 1, ', (SELECT id FROM urls WHERE url = ?)')
    promiseWrappers.push(function urlInsertWrapper() {
      return connection.query(
        `
          INSERT IGNORE INTO urls (url) VALUES ${url_inserts_q_groups};
          INSERT INTO twitter_status_urls (status_id, url_id) VALUES ${status_url_insert_q_groups}
        `,
        url_insert_values
      )
    })
  }

  if (promiseWrappers.length === 0) {
    return
  }

  return waterfall(promiseWrappers)
}).finally(() => {
  connection.end()
})

function getUrls(status) {

  const urls = []

  if (status.entities && status.entities.urls) {
    urls.push(..._.map(status.entities.urls, 'expanded_url'))
  }

  if (status.extended_entities && status.extended_entities.urls) {
    urls.push(..._.map(status.extended_entities.urls, 'expanded_url'))
  }

  if (status.retweeted_status) {
    urls.push(...getUrls(status.retweeted_status))
  }

  if (status.quoted_status) {
    urls.push(...getUrls(status.quoted_status))
  }

  if (status.extended_tweet) {
    urls.push(...getUrls(status.extended_tweet))
  }

  return _.uniq(urls.filter((url) => {
    if (!url) return false
    if (url.length > 255) return false
    if (url.indexOf('https://twitter.com') === 0) return false
    return true
  }))
}
